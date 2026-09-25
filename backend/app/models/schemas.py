from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TelemetryPoint(BaseModel):
    frame_index: int
    timestamp_ms: int
    latitude: float
    longitude: float
    altitude_m: float
    speed_ms: float
    heading_deg: float


class UploadResponse(BaseModel):
    video_id: str
    video_filename: str
    telemetry_filename: Optional[str] = None
    telemetry_data: List[TelemetryPoint]
    message: str


class PreprocessRequest(BaseModel):
    video_id: str


class KeyframeResult(BaseModel):
    frame_index: int
    keyframe_path: str
    telemetry: TelemetryPoint
    laplacian_variance: float
    is_sharp: bool


class PreprocessResponse(BaseModel):
    video_id: str
    total_keyframes: int
    blurred_frames_dropped: int
    processing_time_seconds: float
    keyframes: List[KeyframeResult]
    message: str


class HealthResponse(BaseModel):
    status: str
    app_name: str
    app_version: str
    timestamp: datetime
    cuda_available: bool
    upload_dir_exists: bool
    keyframe_dir_exists: bool


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


class ReconstructRequest(BaseModel):
    video_id: str
    use_dynamic_masking: bool = True


class ReconstructResponse(BaseModel):
    video_id: str
    status: str
    total_points: int
    processing_time_sec: float
    is_synthetic: bool
    model_used: str
    ply_download_url: str
    message: str


class GeoreferenceRequest(BaseModel):
    video_id: str
    ply_filename: str = "raw_dense_cloud.ply"


class BoundingBoxMeters(BaseModel):
    min_easting: float
    max_easting: float
    min_northing: float
    max_northing: float
    min_altitude: float
    max_altitude: float
    width_meters: float
    length_meters: float
    height_meters: float


class GeoreferenceResponse(BaseModel):
    video_id: str
    scale_factor_s: float
    utm_zone: str
    bounding_box_meters: BoundingBoxMeters
    georeferenced_ply: str
    georeferenced_ply_url: str
    total_points: int
    message: str


class GISExportRequest(BaseModel):
    video_id: str
    export_formats: list[str] = ["las", "obj", "geotiff", "3dtiles"]


class GISExportResponse(BaseModel):
    video_id: str
    export_urls: dict[str, str]
    message: str
