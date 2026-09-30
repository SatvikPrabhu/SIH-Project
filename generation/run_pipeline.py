#!/usr/bin/env python3
"""
Geo3D Vision: Master End-to-End Reconstruction & Geospatial Pipeline Orchestrator
Executes full video-to-3D pipeline with automated error handling, timing metrics, and configuration loading.

Usage:
  python generation/run_pipeline.py --config generation/configs/default.yaml
  python generation/run_pipeline.py --video path/to/drone.mp4 --all
  python generation/run_pipeline.py --step 1,2,3
"""

import os
import sys
import yaml
import time
import argparse
import numpy as np
from pathlib import Path
from typing import Dict, Any, List



# Ensure parent directory is in Python path
generation_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(generation_dir))

from utils.logger import setup_logger, PipelineTimer, LogColors

# Import script modules directly by importlib
import importlib.util

def load_module_from_path(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod

extract_frames_mod = load_module_from_path("extract_frames_mod", generation_dir / "scripts" / "01_extract_frames.py")
run_sfm_mod = load_module_from_path("run_sfm_mod", generation_dir / "scripts" / "02_run_sfm.py")
gps_align_mod = load_module_from_path("gps_align_mod", generation_dir / "scripts" / "03_gps_align.py")
train_3dgs_mod = load_module_from_path("train_3dgs_mod", generation_dir / "scripts" / "04_train_3dgs.py")
export_mesh_mod = load_module_from_path("export_mesh_mod", generation_dir / "scripts" / "05_export_mesh.py")

# Load DUSt3R reconstruction module
dust3r_script = generation_dir / "dust3r" / "run_dust3r_recon.py"
if dust3r_script.exists():
    dust3r_recon_mod = load_module_from_path("dust3r_recon_mod", dust3r_script)
else:
    dust3r_recon_mod = None

DUST3R_WEIGHTS = generation_dir / "dust3r" / "checkpoints" / "DUSt3R_ViTLarge_BaseDecoder_512_linear.pth"

logger = setup_logger("Master-Pipeline")

def load_yaml_config(config_path: Path) -> Dict[str, Any]:
    """Loads and validates pipeline YAML configuration."""
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    return config

def print_banner():
    banner = rf"""
{LogColors.CYAN}{LogColors.BOLD}========================================================================
   ____             _____ ____     __     ___                 
  / ___| ___  ___  |___ /|  _ \    \ \   / (_)___(_) ___  _ __  
 | |  _ / _ \/ _ \   |_ \| | | |____\ \ / /| / __| |/ _ \| '_ \ 
 | |_| |  __/ (_) | ___) | |_| |_____\ V / | \__ \ | (_) | | | |
  \____|\___|\___/ |____/|____/       \_/  |_|___/_|\___/|_| |_|
  
  AI Video-to-3D Reconstruction & Geospatial Georeferencing Pipeline
========================================================================{LogColors.RESET}
"""
    print(banner)


def run_full_pipeline(config_path: str = "generation/configs/default.yaml", video_override: str = None, output_dir_override: str = None, srt_path_override: str = None, steps_to_run: List[int] = None):
    """
    Executes selected or all steps of the Geo3D reconstruction pipeline.
    """
    cfg_p = Path(config_path) if Path(config_path).exists() else generation_dir / "configs" / "default.yaml"
    config = load_yaml_config(cfg_p)

    # Optional video path override from CLI
    if video_override:
        config["extract_frames"]["video_path"] = video_override

    # Optional SRT telemetry path override from CLI
    if srt_path_override:
        config["_srt_path_override"] = srt_path_override

    # Resolve output base directories
    if output_dir_override:
        # Per-job run: ALL subdirectories must live inside the job-specific work_dir.
        # Ignore YAML paths which are hardcoded global defaults.
        work_dir = Path(output_dir_override).resolve()
        frames_dir  = work_dir / "frames"
        sfm_dir     = work_dir / "sfm"
        aligned_dir = work_dir / "aligned"
        train_dir   = work_dir / "3dgs"
        export_dir  = work_dir / "exports"
    else:
        # Default run from CLI without --output_dir: use YAML config paths
        work_dir    = Path(config.get("project", {}).get("work_dir", "storage/outputs")).resolve()
        frames_dir  = Path(config["extract_frames"].get("output_dir",  str(work_dir / "frames")))
        sfm_dir     = Path(config["sfm"].get("output_dir",             str(work_dir / "sfm")))
        aligned_dir = Path(config["gps_align"].get("output_dir",       str(work_dir / "aligned")))
        train_dir   = Path(config["train_3dgs"].get("output_dir",      str(work_dir / "3dgs")))
        export_dir  = Path(config["export_mesh"].get("output_dir",     str(work_dir / "exports")))

    work_dir.mkdir(parents=True, exist_ok=True)



    all_steps = steps_to_run is None or len(steps_to_run) == 0
    start_total_time = time.time()
    results = {}

    # --------------------------------------------------------------------------
    # Step 1: Video Frame Extraction & GPS Telemetry Parsing
    # --------------------------------------------------------------------------
    if all_steps or 1 in steps_to_run:
        with PipelineTimer("Step 1: Frame Extraction & Telemetry Parsing", logger):
            c = config["extract_frames"]
            vid_p = Path(c["video_path"])
            
            # If default sample video does not exist yet, generate mock keyframes for quick verification
            if not vid_p.exists():
                logger.warning(f"Video file {vid_p} not found. Creating test frames placeholder in: {frames_dir}")
                frames_dir.mkdir(parents=True, exist_ok=True)
                import cv2
                dummy = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(dummy, "Geo3D Test Frame", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                for i in range(1, 11):
                    cv2.imwrite(str(frames_dir / f"frame_{i:05d}.jpg"), dummy)
                
                # Sample metadata
                import json
                meta = {
                    "video_path": str(vid_p),
                    "extracted_frames_count": 10,
                    "target_fps": c.get("fps", 2.0),
                    "frames": [
                        {
                            "filename": f"frame_{i:05d}.jpg",
                            "gps": {"latitude": 28.6139 + i * 0.0001, "longitude": 77.2090 + i * 0.0001, "altitude": 215.0 + i}
                        }
                        for i in range(1, 11)
                    ]
                }
                with open(frames_dir / "frames_metadata.json", "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2)
                results["step_1"] = meta
            else:
                res1 = extract_frames_mod.extract_frames(
                    video_path=str(vid_p),
                    output_dir=str(frames_dir),
                    target_fps=c.get("fps", 2.0),
                    blur_threshold=c.get("blur_filter", {}).get("threshold", 100.0),
                    blur_method=c.get("blur_filter", {}).get("method", "laplacian"),
                    resize_max=c.get("resize", {}).get("max_dimension") if c.get("resize", {}).get("enabled") else None,
                    max_frames=c.get("max_frames", 0),
                    srt_path=config.get("_srt_path_override") or c.get("gps_telemetry", {}).get("srt_path") or None
                )
                results["step_1"] = res1

    # --------------------------------------------------------------------------
    # Step 2: DUSt3R Multi-View 3D Reconstruction
    # Replaces COLMAP SfM — DUSt3R operates directly on extracted frames
    # without requiring camera calibration. Falls back to COLMAP/synthetic
    # if DUSt3R is unavailable.
    # --------------------------------------------------------------------------
    dust3r_output_dir = work_dir / "dust3r"
    dust3r_glb = dust3r_output_dir / "model.glb"
    dust3r_ply = dust3r_output_dir / "model.ply"

    if all_steps or 2 in steps_to_run:
        if dust3r_recon_mod is not None and DUST3R_WEIGHTS.exists():
            with PipelineTimer("Step 2: DUSt3R Multi-View 3D Reconstruction", logger):
                logger.info(f"Running DUSt3R on frames: {frames_dir}")
                try:
                    res2 = dust3r_recon_mod.run_dust3r(
                        images_dir=str(frames_dir),
                        output_dir=str(dust3r_output_dir),
                        weights_path=str(DUST3R_WEIGHTS),
                        image_size=512,
                        niter=300,
                        conf_thr=3.0,
                        max_images=20
                    )
                    results["step_2"] = res2
                    logger.info(f"DUSt3R generated {res2['num_points']:,} 3D points -> {dust3r_glb}")
                except Exception as e:
                    logger.error(f"DUSt3R reconstruction failed: {e}")
                    logger.warning("Falling back to COLMAP/synthetic SfM...")
                    c = config["sfm"]
                    res2 = run_sfm_mod.run_sfm(
                        images_dir=str(frames_dir),
                        output_dir=str(sfm_dir),
                        camera_model=c.get("camera_model", "OPENCV"),
                        matcher=c.get("matcher", "sequential")
                    )
                    results["step_2"] = res2
        else:
            logger.warning("DUSt3R weights not found. Falling back to COLMAP/synthetic SfM...")
            with PipelineTimer("Step 2: Structure from Motion (SfM) [COLMAP Fallback]", logger):
                c = config["sfm"]
                res2 = run_sfm_mod.run_sfm(
                    images_dir=str(frames_dir),
                    output_dir=str(sfm_dir),
                    camera_model=c.get("camera_model", "OPENCV"),
                    matcher=c.get("matcher", "sequential")
                )
                results["step_2"] = res2

    # --------------------------------------------------------------------------
    # Step 3: GPS Georeferencing & Sim(3) Alignment
    # --------------------------------------------------------------------------
    if all_steps or 3 in steps_to_run:
        with PipelineTimer("Step 3: GPS Georeferencing & Sim(3) Alignment", logger):
            c = config["gps_align"]
            res3 = gps_align_mod.run_gps_align(
                frames_dir=str(frames_dir),
                sfm_dir=str(sfm_dir),
                output_dir=str(aligned_dir),
                utm_zone=c.get("utm_zone")
            )
            results["step_3"] = res3

    # --------------------------------------------------------------------------
    # Step 4: 3D Gaussian Splatting Training (using DUSt3R PLY as seed if available)
    # --------------------------------------------------------------------------
    if all_steps or 4 in steps_to_run:
        with PipelineTimer("Step 4: 3D Gaussian Splatting Training", logger):
            c = config["train_3dgs"]
            # Use DUSt3R aligned PLY as 3DGS seed if available
            if dust3r_ply.exists():
                import shutil
                aligned_seed = aligned_dir / "aligned_sparse_points.ply"
                aligned_seed.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(dust3r_ply, aligned_seed)
                logger.info(f"Using DUSt3R point cloud as 3DGS seed: {aligned_seed}")
            res4 = train_3dgs_mod.train_3dgs_pipeline(
                aligned_dir=str(aligned_dir),
                frames_dir=str(frames_dir),
                output_dir=str(train_dir),
                iterations=c.get("iterations", 7000),
                sh_degree=c.get("sh_degree", 3),
                save_interval=c.get("checkpoint_interval", 2000)
            )
            results["step_4"] = res4

    # --------------------------------------------------------------------------
    # Step 5: Multi-Format Mesh & GIS Export
    # Prefer DUSt3R model.ply if 3DGS final ply is unavailable
    # --------------------------------------------------------------------------
    if all_steps or 5 in steps_to_run:
        with PipelineTimer("Step 5: Mesh & GIS Geospatial Export", logger):
            c = config["export_mesh"]
            # Prefer DUSt3R PLY if available (real reconstructed 3D geometry & RGB colors from video),
            # otherwise fall back to 3DGS point cloud
            if dust3r_ply.exists():
                model_ply = dust3r_ply
                logger.info(f"Using DUSt3R dense PLY for mesh & GIS export: {model_ply}")
            else:
                model_ply = train_dir / "point_cloud_final.ply"
            res5 = export_mesh_mod.run_export_pipeline(
                input_model=str(model_ply),
                output_dir=str(export_dir),
                formats=c.get("formats", ["ply", "obj", "las", "geotiff", "3d_tiles"]),
                poisson_depth=c.get("poisson_depth", 9)
            )
            results["step_5"] = res5

            # Also copy DUSt3R GLB directly if it exists (fastest path to viewer)
            if dust3r_glb.exists():
                target_dust3r_glb = work_dir / "model.glb"
                try:
                    import shutil
                    shutil.copy2(dust3r_glb, target_dust3r_glb)
                    logger.info(f"Copied DUSt3R model.glb to work_dir root: {target_dust3r_glb}")
                except Exception as e:
                    logger.warning(f"Could not copy DUSt3R GLB: {e}")
            
            # Ensure model.glb is available at root of work_dir for direct backend consumption
            exported_glb = export_dir / "model.glb"
            target_work_glb = work_dir / "model.glb"
            if exported_glb.exists() and not target_work_glb.exists():
                try:
                    import shutil
                    shutil.copy2(exported_glb, target_work_glb)
                except Exception as e:
                    logger.warning(f"Could not copy model.glb to root work_dir: {e}")

    total_elapsed = time.time() - start_total_time
    mins, secs = divmod(total_elapsed, 60)
    logger.info(f"{LogColors.GREEN}{LogColors.BOLD}[SUCCESS] Pipeline finished successfully in {int(mins)}m {secs:.2f}s!{LogColors.RESET}")
    logger.info(f"Artifacts exported to: {work_dir.resolve()}")
    return results

def main():
    parser = argparse.ArgumentParser(description="Geo3D Reconstruction & Georeferencing Pipeline")
    parser.add_argument("--config", type=str, default="generation/configs/default.yaml", help="Path to default.yaml configuration")
    parser.add_argument("--video", "--video_path", dest="video", type=str, default=None, help="Input video file path override")
    parser.add_argument("--output_dir", "--out", dest="output_dir", type=str, default=None, help="Output directory path override")
    parser.add_argument("--srt", type=str, default=None, help="Optional path to DJI SRT telemetry file")
    parser.add_argument("--step", type=str, default=None, help="Comma-separated step numbers to execute (e.g. 1,2,3)")
    parser.add_argument("--all", action="store_true", help="Run entire end-to-end pipeline")
    args = parser.parse_args()

    steps = None
    if args.step:
        steps = [int(s.strip()) for s in args.step.split(",") if s.strip().isdigit()]

    run_full_pipeline(
        config_path=args.config,
        video_override=args.video,
        output_dir_override=args.output_dir,
        srt_path_override=args.srt,
        steps_to_run=steps
    )

if __name__ == "__main__":
    main()
