import uuid
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from datetime import datetime

from app.core.config import settings
from app.models.schemas import (
    UploadResponse,
    PreprocessRequest,
    PreprocessResponse,
    HealthResponse,
    ReconstructRequest,
    ReconstructResponse,
    GeoreferenceRequest,
    GeoreferenceResponse,
    GISExportRequest,
    GISExportResponse,
    TelemetryPoint,
    KeyframeResult
)
from app.services.telemetry_parser import parse_telemetry_file
from app.services.frame_extractor import extract_adaptive_keyframes, get_video_info
from app.services.dynamic_masker import generate_dynamic_masks
from app.services.reconstruction_3d import reconstruct_from_keyframes
from app.services.georeferencer import apply_georeferencing
from app.services.gis_exporter import GISExportEngine
import torch

router = APIRouter()


# In-memory storage for uploaded video metadata
# In production, use a database
video_registry = {}


@router.post("/upload", response_model=UploadResponse)
async def upload_video(
    video_file: UploadFile = File(...),
    telemetry_file: Optional[UploadFile] = File(None)
):
    """
    Upload video and optional telemetry file.
    Parses telemetry and returns synchronized data.
    """
    # Validate video file extension
    video_ext = Path(video_file.filename).suffix.lower()
    if video_ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid video extension. Allowed: {settings.ALLOWED_VIDEO_EXTENSIONS}"
        )
    
    # Validate telemetry file extension if provided
    telemetry_path = None
    telemetry_filename = None
    if telemetry_file:
        telemetry_ext = Path(telemetry_file.filename).suffix.lower()
        if telemetry_ext not in settings.ALLOWED_TELEMETRY_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid telemetry extension. Allowed: {settings.ALLOWED_TELEMETRY_EXTENSIONS}"
            )
    
    # Generate unique video ID
    video_id = str(uuid.uuid4())
    
    # Create video-specific directory
    video_dir = settings.UPLOAD_DIR / video_id
    video_dir.mkdir(parents=True, exist_ok=True)
    
    # Save video file
    video_path = video_dir / video_file.filename
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video_file.file, buffer)
    
    # Save telemetry file if provided
    if telemetry_file:
        telemetry_path = video_dir / telemetry_file.filename
        telemetry_filename = telemetry_file.filename
        with open(telemetry_path, "wb") as buffer:
            shutil.copyfileobj(telemetry_file.file, buffer)
    
    # Get video info for telemetry generation
    try:
        video_info = get_video_info(str(video_path))
        total_frames = video_info["frame_count"]
        fps = video_info["fps"]
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read video file: {str(e)}"
        )
    
    # Parse telemetry
    telemetry_data = parse_telemetry_file(
        str(telemetry_path) if telemetry_path else None,
        total_frames,
        fps
    )
    
    # Store video metadata
    video_registry[video_id] = {
        "video_path": str(video_path),
        "telemetry_path": str(telemetry_path) if telemetry_path else None,
        "video_filename": video_file.filename,
        "telemetry_filename": telemetry_filename,
        "telemetry_data": telemetry_data,
        "uploaded_at": datetime.now()
    }
    
    return UploadResponse(
        video_id=video_id,
        video_filename=video_file.filename,
        telemetry_filename=telemetry_filename,
        telemetry_data=telemetry_data,
        message="Video and telemetry uploaded successfully"
    )


@router.post("/preprocess", response_model=PreprocessResponse)
async def preprocess_video(request: PreprocessRequest):
    """
    Process uploaded video to extract adaptive keyframes.
    Applies blur detection and velocity-based sampling.
    """
    # Check if video exists
    if request.video_id not in video_registry:
        raise HTTPException(
            status_code=404,
            detail=f"Video ID {request.video_id} not found"
        )
    
    video_metadata = video_registry[request.video_id]
    video_path = video_metadata["video_path"]
    telemetry_data = video_metadata["telemetry_data"]
    
    # Create output directory for keyframes
    output_dir = settings.KEYFRAME_DIR / request.video_id
    
    # Extract keyframes
    try:
        result = extract_adaptive_keyframes(
            video_path=video_path,
            telemetry_data=telemetry_data,
            output_dir=str(output_dir),
            blur_threshold=settings.BLUR_THRESHOLD
        )
        
        # Update video registry with preprocessing results
        video_registry[request.video_id]["preprocessed"] = True
        video_registry[request.video_id]["keyframe_dir"] = str(output_dir)
        video_registry[request.video_id]["preprocessing_results"] = result
        
        return PreprocessResponse(
            video_id=request.video_id,
            total_keyframes=result["total_keyframes"],
            blurred_frames_dropped=result["blurred_frames_dropped"],
            processing_time_seconds=result["processing_time_seconds"],
            keyframes=result["keyframes"],
            message="Video preprocessing completed successfully"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Preprocessing failed: {str(e)}"
        )


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    Returns system status and CUDA availability.
    """
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        app_version=settings.APP_VERSION,
        timestamp=datetime.now(),
        cuda_available=torch.cuda.is_available(),
        upload_dir_exists=settings.UPLOAD_DIR.exists(),
        keyframe_dir_exists=settings.KEYFRAME_DIR.exists()
    )


@router.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct_3d(request: ReconstructRequest):
    """
    Reconstruct 3D point cloud from preprocessed keyframes.
    Applies dynamic object masking and MASt3R/DUSt3R reconstruction.
    """
    # Check if video exists
    if request.video_id not in video_registry:
        raise HTTPException(
            status_code=404,
            detail=f"Video ID {request.video_id} not found"
        )
    
    video_metadata = video_registry[request.video_id]
    
    # Check if video has been preprocessed
    if not video_metadata.get("preprocessed", False):
        raise HTTPException(
            status_code=400,
            detail=f"Video {request.video_id} has not been preprocessed yet"
        )
    
    keyframe_dir = video_metadata["keyframe_dir"]
    
    # Create output directories
    masks_dir = settings.BASE_DIR / "storage" / "masks" / request.video_id
    reconstruction_dir = settings.BASE_DIR / "storage" / "reconstructions"
    output_ply_path = reconstruction_dir / f"{request.video_id}_raw_dense_cloud.ply"
    
    try:
        # Step 1: Generate dynamic masks if enabled
        if request.use_dynamic_masking:
            print(f"Generating dynamic masks for {request.video_id}")
            mask_paths = generate_dynamic_masks(
                keyframes_dir=str(keyframe_dir),
                masks_dir=str(masks_dir)
            )
        else:
            mask_paths = None
        
        # Step 2: Run 3D reconstruction
        print(f"Running 3D reconstruction for {request.video_id}")
        result = reconstruct_from_keyframes(
            keyframes_dir=str(keyframe_dir),
            masks_dir=str(masks_dir) if request.use_dynamic_masking else None,
            output_ply_path=str(output_ply_path),
            use_dynamic_masking=request.use_dynamic_masking
        )
        
        # Update video registry with reconstruction results
        video_registry[request.video_id]["reconstructed"] = True
        video_registry[request.video_id]["reconstruction_results"] = result
        video_registry[request.video_id]["ply_path"] = str(output_ply_path)
        
        # Generate download URL
        ply_download_url = f"/reconstructions/{request.video_id}_raw_dense_cloud.ply"
        
        return ReconstructResponse(
            video_id=request.video_id,
            status=result["status"],
            total_points=result["total_points"],
            processing_time_sec=result["processing_time_sec"],
            is_synthetic=result["is_synthetic"],
            model_used=result["model_used"],
            ply_download_url=ply_download_url,
            message="3D reconstruction completed successfully"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Reconstruction failed: {str(e)}"
        )


@router.post("/georeference", response_model=GeoreferenceResponse)
async def georeference_point_cloud(request: GeoreferenceRequest):
    """
    Georeference reconstructed point cloud using GPS telemetry.
    Applies Sim(3) transformation to align point cloud to UTM coordinates.
    """
    # Check if video exists
    if request.video_id not in video_registry:
        raise HTTPException(
            status_code=404,
            detail=f"Video ID {request.video_id} not found"
        )
    
    video_metadata = video_registry[request.video_id]
    
    # Check if video has been reconstructed
    if not video_metadata.get("reconstructed", False):
        raise HTTPException(
            status_code=400,
            detail=f"Video {request.video_id} has not been reconstructed yet"
        )
    
    # Get input PLY path
    reconstruction_dir = settings.BASE_DIR / "storage" / "reconstructions"
    input_ply_path = reconstruction_dir / request.ply_filename
    
    if not input_ply_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"PLY file {request.ply_filename} not found"
        )
    
    # Get telemetry data
    telemetry_data = video_metadata["telemetry_data"]
    
    # Convert telemetry to dict format for georeferencer
    telemetry_dicts = [
        {
            "latitude": t.latitude,
            "longitude": t.longitude,
            "altitude_m": t.altitude_m
        }
        for t in telemetry_data
    ]
    
    # Create output path
    output_ply_path = reconstruction_dir / f"{request.video_id}_georeferenced_cloud.ply"
    
    try:
        # Apply georeferencing
        result = apply_georeferencing(
            input_ply_path=str(input_ply_path),
            telemetry_data=telemetry_dicts,
            output_ply_path=str(output_ply_path)
        )
        
        # Update video registry with georeferencing results
        video_registry[request.video_id]["georeferenced"] = True
        video_registry[request.video_id]["georeferencing_results"] = result
        video_registry[request.video_id]["georeferenced_ply_path"] = str(output_ply_path)
        
        # Generate download URL
        georeferenced_ply_url = f"/reconstructions/{request.video_id}_georeferenced_cloud.ply"
        
        return GeoreferenceResponse(
            video_id=request.video_id,
            scale_factor_s=result["scale_factor_s"],
            utm_zone=result["utm_zone"],
            bounding_box_meters=result["bounding_box_meters"],
            georeferenced_ply=result["georeferenced_ply"],
            georeferenced_ply_url=georeferenced_ply_url,
            total_points=result["total_points"],
            message="Georeferencing completed successfully"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Georeferencing failed: {str(e)}"
        )


@router.post("/export_gis", response_model=GISExportResponse)
async def export_gis_formats(request: GISExportRequest):
    """
    Export georeferenced point cloud to GIS formats.
    Supports LAS, OBJ/GLB mesh, GeoTIFF DSM, and 3D Tiles.
    """
    # Check if video exists
    if request.video_id not in video_registry:
        raise HTTPException(
            status_code=404,
            detail=f"Video ID {request.video_id} not found"
        )
    
    video_metadata = video_registry[request.video_id]
    
    # Check if video has been georeferenced
    if not video_metadata.get("georeferenced", False):
        raise HTTPException(
            status_code=400,
            detail=f"Video {request.video_id} has not been georeferenced yet"
        )
    
    # Get georeferenced PLY path
    georeferenced_ply_path = video_metadata.get("georeferenced_ply_path")
    
    if not georeferenced_ply_path or not Path(georeferenced_ply_path).exists():
        raise HTTPException(
            status_code=404,
            detail="Georeferenced PLY file not found"
        )
    
    # Initialize export engine
    exports_dir = settings.BASE_DIR / "storage" / "exports"
    export_engine = GISExportEngine(str(exports_dir))
    
    try:
        # Generate all requested exports
        export_urls = export_engine.generate_all_exports(
            job_id=request.video_id,
            georef_ply_path=georeferenced_ply_path,
            export_formats=request.export_formats
        )
        
        # Update video registry with export results
        video_registry[request.video_id]["exported"] = True
        video_registry[request.video_id]["export_results"] = export_urls
        
        return GISExportResponse(
            video_id=request.video_id,
            export_urls=export_urls,
            message="GIS exports generated successfully"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"GIS export failed: {str(e)}"
        )
