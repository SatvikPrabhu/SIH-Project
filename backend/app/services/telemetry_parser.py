import re
import json
import pysrt
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.models.schemas import TelemetryPoint


def parse_srt_telemetry(srt_path: str) -> List[TelemetryPoint]:
    """
    Parse DJI/Standard drone .srt telemetry files.
    
    Expected SRT format contains GPS coordinates, altitude, speed, heading, etc.
    Common DJI SRT format includes patterns like:
    - GPS: (18.9220, 72.8347, 120.4)
    - or similar coordinate patterns in subtitle text
    
    Args:
        srt_path: Path to the .srt telemetry file
    
    Returns:
        List of TelemetryPoint objects
    """
    telemetry_points = []
    
    try:
        subs = pysrt.open(srt_path)
        
        for idx, sub in enumerate(subs):
            text = sub.text
            
            # Extract timestamp in milliseconds
            start_time_ms = sub.start.hours * 3600000 + sub.start.minutes * 60000 + sub.start.seconds * 1000 + sub.start.milliseconds
            
            # Parse GPS coordinates using regex
            # Pattern for: GPS: (lat, long, alt) or similar formats
            gps_pattern = r'GPS[:\s]*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)'
            gps_match = re.search(gps_pattern, text, re.IGNORECASE)
            
            # Alternative pattern for DJI format: lat, lon, alt
            alt_pattern = r'([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)'
            
            if gps_match:
                lat = float(gps_match.group(1))
                lon = float(gps_match.group(2))
                alt = float(gps_match.group(3))
            else:
                # Try alternative coordinate extraction
                coords = re.findall(alt_pattern, text)
                if coords and len(coords[0]) >= 3:
                    lat = float(coords[0][0])
                    lon = float(coords[0][1])
                    alt = float(coords[0][2])
                else:
                    # Default values if GPS not found
                    lat = 0.0
                    lon = 0.0
                    alt = 0.0
            
            # Extract speed (ground speed in m/s)
            speed_pattern = r'(?i)(?:speed|ground.?speed|gs)[:\s]*([0-9]*\.?[0-9]+)'
            speed_match = re.search(speed_pattern, text)
            speed_ms = float(speed_match.group(1)) if speed_match else 5.0
            
            # Extract heading in degrees
            heading_pattern = r'(?i)(?:heading|yaw)[:\s]*([0-9]*\.?[0-9]+)'
            heading_match = re.search(heading_pattern, text)
            heading_deg = float(heading_match.group(1)) if heading_match else 0.0
            
            telemetry_point = TelemetryPoint(
                frame_index=idx,
                timestamp_ms=start_time_ms,
                latitude=lat,
                longitude=lon,
                altitude_m=alt,
                speed_ms=speed_ms,
                heading_deg=heading_deg
            )
            telemetry_points.append(telemetry_point)
            
    except Exception as e:
        raise ValueError(f"Failed to parse SRT file: {str(e)}")
    
    return telemetry_points


def parse_json_telemetry(json_path: str) -> List[TelemetryPoint]:
    """
    Parse JSON telemetry files.
    
    Expected JSON structure:
    [
        {
            "frame_index": 0,
            "timestamp_ms": 0,
            "latitude": 18.9220,
            "longitude": 72.8347,
            "altitude_m": 120.4,
            "speed_ms": 12.5,
            "heading_deg": 310.0
        },
        ...
    ]
    
    Args:
        json_path: Path to the .json telemetry file
    
    Returns:
        List of TelemetryPoint objects
    """
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    telemetry_points = []
    for item in data:
        telemetry_point = TelemetryPoint(**item)
        telemetry_points.append(telemetry_point)
    
    return telemetry_points


def generate_synthetic_telemetry(total_frames: int, fps: float = 30.0) -> List[TelemetryPoint]:
    """
    Generate synthetic linearly interpolated GPS telemetry points.
    This is a fallback when telemetry file is missing or corrupted.
    
    Creates a smooth flight path with realistic drone movement patterns:
    - Gradual altitude changes
    - Smooth speed variations
    - Realistic heading changes
    
    Args:
        total_frames: Total number of frames in the video
        fps: Frames per second of the video
    
    Returns:
        List of synthetic TelemetryPoint objects
    """
    telemetry_points = []
    
    # Starting position (example: Mumbai coordinates)
    start_lat = 19.0760
    start_lon = 72.8777
    start_alt = 100.0
    
    # Flight parameters
    flight_duration_sec = total_frames / fps
    avg_speed = 8.0  # m/s
    heading = 45.0  # degrees
    
    for frame_idx in range(total_frames):
        timestamp_ms = int((frame_idx / fps) * 1000)
        
        # Linear interpolation for position
        progress = frame_idx / total_frames
        
        # Simulate a gentle curve in the flight path
        lat = start_lat + (progress * 0.01) + (0.001 * (progress ** 2))
        lon = start_lon + (progress * 0.01) - (0.001 * (progress ** 2))
        alt = start_alt + (20.0 * progress)  # Gradual climb
        
        # Vary speed slightly for realism
        speed = avg_speed + (2.0 * (progress - 0.5))
        
        # Gradually change heading
        heading = 45.0 + (30.0 * progress)
        
        telemetry_point = TelemetryPoint(
            frame_index=frame_idx,
            timestamp_ms=timestamp_ms,
            latitude=lat,
            longitude=lon,
            altitude_m=alt,
            speed_ms=speed,
            heading_deg=heading
        )
        telemetry_points.append(telemetry_point)
    
    return telemetry_points


def parse_telemetry_file(telemetry_path: Optional[str], total_frames: int, fps: float = 30.0) -> List[TelemetryPoint]:
    """
    Main entry point for parsing telemetry files.
    Automatically detects file type and parses accordingly.
    Falls back to synthetic telemetry if file is missing or parsing fails.
    
    Args:
        telemetry_path: Path to telemetry file (can be None)
        total_frames: Total frames for synthetic fallback
        fps: Video FPS for synthetic fallback
    
    Returns:
        List of TelemetryPoint objects
    """
    if telemetry_path is None:
        print("No telemetry file provided, generating synthetic telemetry")
        return generate_synthetic_telemetry(total_frames, fps)
    
    path = Path(telemetry_path)
    
    if not path.exists():
        print(f"Telemetry file not found: {telemetry_path}, generating synthetic telemetry")
        return generate_synthetic_telemetry(total_frames, fps)
    
    try:
        if path.suffix.lower() == '.srt':
            return parse_srt_telemetry(str(path))
        elif path.suffix.lower() == '.json':
            return parse_json_telemetry(str(path))
        else:
            print(f"Unsupported telemetry format: {path.suffix}, generating synthetic telemetry")
            return generate_synthetic_telemetry(total_frames, fps)
    except Exception as e:
        print(f"Error parsing telemetry file: {str(e)}, generating synthetic telemetry")
        return generate_synthetic_telemetry(total_frames, fps)
