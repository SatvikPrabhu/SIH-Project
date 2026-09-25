import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
import time

from app.core.config import settings
from app.services.blur_filter import is_frame_sharp
from app.models.schemas import TelemetryPoint, KeyframeResult


def get_adaptive_fps(speed_ms: float) -> int:
    """
    Determine adaptive sampling FPS based on ground speed.
    
    Args:
        speed_ms: Ground speed in meters per second
    
    Returns:
        int: Sampling FPS
    """
    if speed_ms > settings.HIGH_SPEED_THRESHOLD:
        return settings.HIGH_SPEED_FPS
    elif speed_ms < settings.LOW_SPEED_THRESHOLD:
        return settings.LOW_SPEED_FPS
    else:
        return settings.DEFAULT_FPS


def extract_adaptive_keyframes(
    video_path: str,
    telemetry_data: List[TelemetryPoint],
    output_dir: str,
    blur_threshold: float = None
) -> Dict[str, Any]:
    """
    Extract adaptive keyframes from video based on velocity and blur detection.
    
    Args:
        video_path: Path to the video file
        telemetry_data: List of telemetry points synchronized with video
        output_dir: Directory to save extracted keyframes
        blur_threshold: Optional custom blur threshold (uses config default if None)
    
    Returns:
        Dict containing:
        - total_keyframes: int
        - blurred_frames_dropped: int
        - processing_time_seconds: float
        - keyframes: List[KeyframeResult]
    """
    if blur_threshold is None:
        blur_threshold = settings.BLUR_THRESHOLD
    
    # Ensure output directory exists
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Open video capture
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Failed to open video file: {video_path}")
    
    # Get video properties
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video properties: FPS={video_fps}, Total Frames={total_frames}")
    
    # Initialize tracking variables
    keyframe_results: List[KeyframeResult] = []
    blurred_count = 0
    current_frame_idx = 0
    keyframe_idx = 0
    
    # Create telemetry lookup by frame index
    telemetry_map = {t.frame_index: t for t in telemetry_data}
    
    start_time = time.time()
    
    while current_frame_idx < total_frames:
        # Get telemetry for current frame (or use nearest available)
        telemetry = telemetry_map.get(current_frame_idx)
        if telemetry is None:
            # Find nearest telemetry point
            nearest_idx = min(telemetry_map.keys(), key=lambda x: abs(x - current_frame_idx))
            telemetry = telemetry_map[nearest_idx]
        
        # Determine adaptive sampling FPS based on speed
        adaptive_fps = get_adaptive_fps(telemetry.speed_ms)
        frame_interval = int(video_fps / adaptive_fps)
        
        # Only process if this frame should be sampled
        if current_frame_idx % frame_interval == 0:
            # Read frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame_idx)
            ret, frame = cap.read()
            
            if not ret:
                print(f"Failed to read frame {current_frame_idx}")
                break
            
            # Check blur
            is_sharp, variance = is_frame_sharp(frame, blur_threshold)
            
            if is_sharp:
                # Save keyframe
                keyframe_filename = f"frame_{keyframe_idx:04d}.png"
                keyframe_path = output_path / keyframe_filename
                cv2.imwrite(str(keyframe_path), frame)
                
                # Create keyframe result
                keyframe_result = KeyframeResult(
                    frame_index=current_frame_idx,
                    keyframe_path=str(keyframe_path),
                    telemetry=telemetry,
                    laplacian_variance=variance,
                    is_sharp=True
                )
                keyframe_results.append(keyframe_result)
                keyframe_idx += 1
                
                print(f"Saved keyframe {keyframe_idx}: frame {current_frame_idx}, variance={variance:.2f}")
            else:
                blurred_count += 1
                print(f"Dropped blurred frame {current_frame_idx}, variance={variance:.2f}")
        
        current_frame_idx += 1
    
    # Release video capture
    cap.release()
    
    processing_time = time.time() - start_time
    
    return {
        "total_keyframes": len(keyframe_results),
        "blurred_frames_dropped": blurred_count,
        "processing_time_seconds": processing_time,
        "keyframes": keyframe_results
    }


def get_video_info(video_path: str) -> Dict[str, Any]:
    """
    Get basic video information.
    
    Args:
        video_path: Path to the video file
    
    Returns:
        Dict containing video properties
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Failed to open video file: {video_path}")
    
    info = {
        "fps": cap.get(cv2.CAP_PROP_FPS),
        "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
        "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
        "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
        "duration_seconds": int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS))
    }
    
    cap.release()
    return info
