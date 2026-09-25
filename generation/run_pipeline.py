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


def run_full_pipeline(config_path: str, video_override: str = None, steps_to_run: List[int] = None):
    """
    Executes selected or all steps of the Geo3D reconstruction pipeline.
    """
    print_banner()
    cfg_p = Path(config_path)
    config = load_yaml_config(cfg_p)

    # Optional video path override from CLI
    if video_override:
        config["extract_frames"]["video_path"] = video_override

    # Resolve output base directories
    work_dir = Path(config.get("project", {}).get("work_dir", "storage/outputs"))
    work_dir.mkdir(parents=True, exist_ok=True)

    frames_dir = Path(config["extract_frames"].get("output_dir", str(work_dir / "frames")))
    sfm_dir = Path(config["sfm"].get("output_dir", str(work_dir / "sfm")))
    aligned_dir = Path(config["gps_align"].get("output_dir", str(work_dir / "aligned")))
    train_dir = Path(config["train_3dgs"].get("output_dir", str(work_dir / "3dgs")))
    export_dir = Path(config["export_mesh"].get("output_dir", str(work_dir / "exports")))

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
                    srt_path=c.get("gps_telemetry", {}).get("srt_path") or None
                )
                results["step_1"] = res1

    # --------------------------------------------------------------------------
    # Step 2: SfM Camera Pose Estimation
    # --------------------------------------------------------------------------
    if all_steps or 2 in steps_to_run:
        with PipelineTimer("Step 2: Structure from Motion (SfM)", logger):
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
    # Step 4: 3D Gaussian Splatting Training
    # --------------------------------------------------------------------------
    if all_steps or 4 in steps_to_run:
        with PipelineTimer("Step 4: 3D Gaussian Splatting Training", logger):
            c = config["train_3dgs"]
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
    # --------------------------------------------------------------------------
    if all_steps or 5 in steps_to_run:
        with PipelineTimer("Step 5: Mesh & GIS Geospatial Export", logger):
            c = config["export_mesh"]
            model_ply = train_dir / "point_cloud_final.ply"
            res5 = export_mesh_mod.run_export_pipeline(
                input_model=str(model_ply),
                output_dir=str(export_dir),
                formats=c.get("formats", ["ply", "obj", "las", "geotiff", "3d_tiles"]),
                poisson_depth=c.get("poisson_depth", 9)
            )
            results["step_5"] = res5

    total_elapsed = time.time() - start_total_time
    mins, secs = divmod(total_elapsed, 60)
    logger.info(f"{LogColors.GREEN}{LogColors.BOLD}[SUCCESS] Pipeline finished successfully in {int(mins)}m {secs:.2f}s!{LogColors.RESET}")
    logger.info(f"Artifacts exported to: {export_dir.resolve()}")
    return results

def main():
    parser = argparse.ArgumentParser(description="Geo3D Reconstruction & Georeferencing Pipeline")
    parser.add_argument("--config", type=str, default="generation/configs/default.yaml", help="Path to default.yaml configuration")
    parser.add_argument("--video", type=str, default=None, help="Input video file path override")
    parser.add_argument("--step", type=str, default=None, help="Comma-separated step numbers to execute (e.g. 1,2,3)")
    parser.add_argument("--all", action="store_true", help="Run entire end-to-end pipeline")
    args = parser.parse_args()

    steps = None
    if args.step:
        steps = [int(s.strip()) for s in args.step.split(",") if s.strip().isdigit()]

    run_full_pipeline(
        config_path=args.config,
        video_override=args.video,
        steps_to_run=steps
    )

if __name__ == "__main__":
    main()
