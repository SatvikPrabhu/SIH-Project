#!/usr/bin/env python3
"""
Step 1: Video Frame & Telemetry Extraction
Extracts sharp keyframes from video at a configurable rate, removes motion-blurred frames,
and parses embedded/external GPS subtitle telemetry (DJI SRT / WGS84).
"""

import os
import re
import sys
import json
import argparse
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add generation parent dir to sys.path for internal imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils.logger import setup_logger, PipelineTimer
from utils.blur_detection import is_blurry_frame

logger = setup_logger("Extract-Frames")

def parse_dji_srt_telemetry(srt_path: Path) -> List[Dict[str, Any]]:
    """
    Parses DJI drone subtitle file (.srt) to extract frame-by-frame GPS telemetry.
    Matches latitude, longitude, barometric/relative altitude, and ISO/shutter speeds.
    """
    telemetry_records = []
    if not srt_path.exists():
        logger.warning(f"Telemetry SRT file not found at: {srt_path}")
        return telemetry_records

    with open(srt_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Regex patterns commonly used in DJI drone SRT streams
    # e.g.: [latitude: 28.613939] [longitude: 77.209021] [rel_alt: 35.400 abs_alt: 245.12]
    # or: LATITUDE: 28.6139 LONGITUDE: 77.2090 ALTITUDE: 35.4
    blocks = re.split(r"\n\s*\n", content.strip())
    
    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if len(lines) < 3:
            continue
            
        time_line = lines[1]
        data_line = " ".join(lines[2:])

        # Parse timestamp
        time_match = re.search(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})", time_line)
        start_sec = 0.0
        if time_match:
            h, m, s, ms = map(int, time_match.groups()[:4])
            start_sec = h * 3600 + m * 60 + s + ms / 1000.0

        lat_m = re.search(r"latitude\s*[:=]\s*([+-]?\d+\.?\d*)", data_line, re.IGNORECASE)
        lon_m = re.search(r"longitude\s*[:=]\s*([+-]?\d+\.?\d*)", data_line, re.IGNORECASE)
        alt_m = re.search(r"(?:rel_alt|abs_alt|altitude|alt)\s*[:=]\s*([+-]?\d+\.?\d*)", data_line, re.IGNORECASE)

        if lat_m and lon_m:
            telemetry_records.append({
                "time_sec": start_sec,
                "latitude": float(lat_m.group(1)),
                "longitude": float(lon_m.group(1)),
                "altitude": float(alt_m.group(1)) if alt_m else 0.0
            })

    logger.info(f"Parsed {len(telemetry_records)} GPS telemetry points from {srt_path.name}")
    return telemetry_records

def get_interpolated_gps(telemetry: List[Dict[str, Any]], timestamp_sec: float) -> Optional[Dict[str, float]]:
    """Interpolates GPS coordinates for a given video timestamp."""
    if not telemetry:
        return None
    
    # Exact or closest match
    closest = min(telemetry, key=lambda x: abs(x["time_sec"] - timestamp_sec))
    return {
        "latitude": closest["latitude"],
        "longitude": closest["longitude"],
        "altitude": closest["altitude"]
    }

def extract_frames(
    video_path: str,
    output_dir: str,
    target_fps: float = 2.0,
    blur_threshold: float = 100.0,
    blur_method: str = "laplacian",
    resize_max: Optional[int] = None,
    max_frames: int = 0,
    srt_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extracts frames from video, applies blur filtering, matches GPS, and writes metadata.
    """
    video_p = Path(video_path)
    if not video_p.exists():
        raise FileNotFoundError(f"Video file does not exist: {video_path}")

    out_p = Path(output_dir)
    out_p.mkdir(parents=True, exist_ok=True)

    # Detect matching SRT if not explicitly provided
    if not srt_path:
        potential_srt = video_p.with_suffix(".srt")
        if potential_srt.exists():
            srt_path = str(potential_srt)

    telemetry = parse_dji_srt_telemetry(Path(srt_path)) if srt_path else []

    cap = cv2.VideoCapture(str(video_p))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video capture for: {video_path}")

    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_sec = total_frames / native_fps if native_fps > 0 else 0

    frame_interval = max(1, int(round(native_fps / target_fps)))
    logger.info(f"Video: {video_p.name} ({video_width}x{video_height}, {native_fps:.1f} FPS, {duration_sec:.1f}s)")
    logger.info(f"Extracting 1 frame every {frame_interval} native frames (~{target_fps} FPS target)")

    extracted_records = []
    frame_idx = 0
    saved_count = 0
    skipped_blur = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_interval == 0:
            timestamp_sec = frame_idx / native_fps

            # Check Blur / Sharpness
            is_blurry, sharpness = is_blurry_frame(frame, threshold=blur_threshold, method=blur_method)
            if is_blurry and blur_threshold > 0:
                skipped_blur += 1
                frame_idx += 1
                continue

            # Optional Resize
            if resize_max and (video_width > resize_max or video_height > resize_max):
                scale = resize_max / max(video_width, video_height)
                new_w, new_h = int(video_width * scale), int(video_height * scale)
                save_frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
            else:
                save_frame = frame

            # Save Frame
            frame_filename = f"frame_{saved_count + 1:05d}.jpg"
            frame_filepath = out_p / frame_filename
            cv2.imwrite(str(frame_filepath), save_frame, [cv2.IMWRITE_JPEG_QUALITY, 95])

            gps_data = get_interpolated_gps(telemetry, timestamp_sec)

            record = {
                "frame_id": saved_count + 1,
                "filename": frame_filename,
                "path": str(frame_filepath.resolve()),
                "frame_index": frame_idx,
                "timestamp_sec": round(timestamp_sec, 3),
                "sharpness_score": round(sharpness, 2),
                "gps": gps_data
            }
            extracted_records.append(record)
            saved_count += 1

            if max_frames > 0 and saved_count >= max_frames:
                logger.info(f"Reached max frames limit: {max_frames}")
                break

        frame_idx += 1

    cap.release()

    # Save summary metadata JSON
    metadata = {
        "video_path": str(video_p.resolve()),
        "total_video_frames": total_frames,
        "native_fps": native_fps,
        "extracted_frames_count": saved_count,
        "skipped_blurry_frames": skipped_blur,
        "target_fps": target_fps,
        "frames": extracted_records
    }

    meta_path = out_p / "frames_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Extracted {saved_count} sharp frames ({skipped_blur} blurry frames rejected). Metadata saved to: {meta_path.name}")
    return metadata

def main():
    parser = argparse.ArgumentParser(description="Extract video frames with blur detection and GPS matching")
    parser.add_argument("--video", type=str, required=True, help="Path to input video file")
    parser.add_argument("--out", type=str, default="storage/outputs/frames", help="Output directory for frames")
    parser.add_argument("--fps", type=float, default=2.0, help="Target extraction FPS")
    parser.add_argument("--blur_threshold", type=float, default=100.0, help="Sharpness threshold")
    parser.add_argument("--srt", type=str, default="", help="Optional path to DJI telemetry SRT")
    parser.add_argument("--max_frames", type=int, default=0, help="Max frames limit")
    args = parser.parse_args()

    with PipelineTimer("Step 1: Frame & Telemetry Extraction", logger):
        extract_frames(
            video_path=args.video,
            output_dir=args.out,
            target_fps=args.fps,
            blur_threshold=args.blur_threshold,
            srt_path=args.srt or None,
            max_frames=args.max_frames
        )

if __name__ == "__main__":
    main()
