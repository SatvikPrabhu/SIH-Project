import numpy as np
from pathlib import Path
from typing import Dict, Tuple


def generate_mock_terrain_ply(
    output_ply_path: str,
    num_points: int = 15000,
    terrain_size: float = 50.0
) -> Dict[str, any]:
    """
    Generate a synthetic 3D point cloud representing a terrain patch with mock buildings.
    
    Args:
        output_ply_path: Path to save the .ply file
        num_points: Total number of points to generate
        terrain_size: Size of the terrain in meters (square)
    
    Returns:
        Dict with generation statistics
    """
    output_path = Path(output_ply_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate terrain points (ground plane with some noise)
    num_terrain_points = int(num_points * 0.7)
    terrain_x = np.random.uniform(-terrain_size/2, terrain_size/2, num_terrain_points)
    terrain_y = np.random.uniform(-terrain_size/2, terrain_size/2, num_terrain_points)
    terrain_z = np.random.normal(0, 0.5, num_terrain_points)  # Small height variation
    
    # Terrain colors (green/brown mix)
    terrain_colors = np.zeros((num_terrain_points, 3), dtype=np.uint8)
    for i in range(num_terrain_points):
        if np.random.random() > 0.5:
            # Green grass
            terrain_colors[i] = [34, 139, 34]
        else:
            # Brown earth
            terrain_colors[i] = [139, 69, 19]
    
    # Generate building points (simple rectangular structures)
    num_buildings = 5
    points_per_building = int((num_points - num_terrain_points) / num_buildings)
    
    building_points = []
    building_colors = []
    
    for _ in range(num_buildings):
        # Random building position and size
        bx = np.random.uniform(-terrain_size/3, terrain_size/3)
        by = np.random.uniform(-terrain_size/3, terrain_size/3)
        bw = np.random.uniform(3, 8)
        bd = np.random.uniform(3, 8)
        bh = np.random.uniform(5, 15)
        
        # Generate building points
        for _ in range(points_per_building):
            px = bx + np.random.uniform(-bw/2, bw/2)
            py = by + np.random.uniform(-bd/2, bd/2)
            pz = np.random.uniform(0, bh)
            
            building_points.append([px, py, pz])
            
            # Building colors (gray concrete or red brick)
            if np.random.random() > 0.3:
                building_colors.append([128, 128, 128])  # Gray
            else:
                building_colors.append([178, 34, 34])  # Red brick
    
    building_points = np.array(building_points)
    building_colors = np.array(building_colors, dtype=np.uint8)
    
    # Combine terrain and building points
    all_points = np.vstack([
        np.column_stack([terrain_x, terrain_y, terrain_z]),
        building_points
    ])
    
    all_colors = np.vstack([terrain_colors, building_colors])
    
    # Write PLY file
    write_ply_file(output_ply_path, all_points, all_colors)
    
    return {
        "status": "success",
        "total_points": len(all_points),
        "terrain_points": num_terrain_points,
        "building_points": len(building_points),
        "is_synthetic": True
    }


def write_ply_file(
    filepath: str,
    points: np.ndarray,
    colors: np.ndarray,
    binary: bool = False
) -> None:
    """
    Write point cloud to PLY file format.
    
    Args:
        filepath: Output file path
        points: Nx3 array of XYZ coordinates
        colors: Nx3 array of RGB colors (0-255)
        binary: Whether to write in binary format (default: ASCII)
    """
    num_points = len(points)
    
    with open(filepath, 'w') as f:
        # Write header
        f.write("ply\n")
        if binary:
            f.write("format binary_little_endian 1.0\n")
        else:
            f.write("format ascii 1.0\n")
        f.write(f"element vertex {num_points}\n")
        f.write("property float x\n")
        f.write("property float y\n")
        f.write("property float z\n")
        f.write("property uchar red\n")
        f.write("property uchar green\n")
        f.write("property uchar blue\n")
        f.write("end_header\n")
        
        if binary:
            # Write binary data
            for i in range(num_points):
                f.write(points[i, 0].astype(np.float32).tobytes())
                f.write(points[i, 1].astype(np.float32).tobytes())
                f.write(points[i, 2].astype(np.float32).tobytes())
                f.write(colors[i, 0].astype(np.uint8).tobytes())
                f.write(colors[i, 1].astype(np.uint8).tobytes())
                f.write(colors[i, 2].astype(np.uint8).tobytes())
        else:
            # Write ASCII data
            for i in range(num_points):
                f.write(f"{points[i, 0]:.6f} {points[i, 1]:.6f} {points[i, 2]:.6f} ")
                f.write(f"{int(colors[i, 0])} {int(colors[i, 1])} {int(colors[i, 2])}\n")


def generate_simple_plane_ply(
    output_ply_path: str,
    width: float = 50.0,
    depth: float = 50.0,
    resolution: float = 0.5
) -> Dict[str, any]:
    """
    Generate a simple flat plane point cloud (minimal fallback).
    
    Args:
        output_ply_path: Path to save the .ply file
        width: Width of the plane in meters
        depth: Depth of the plane in meters
        resolution: Point spacing in meters
    
    Returns:
        Dict with generation statistics
    """
    output_path = Path(output_ply_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Generate grid points
    x = np.arange(-width/2, width/2, resolution)
    y = np.arange(-depth/2, depth/2, resolution)
    xx, yy = np.meshgrid(x, y)
    
    points = np.column_stack([xx.ravel(), yy.ravel(), np.zeros_like(xx.ravel())])
    
    # Uniform color (light gray)
    colors = np.full((len(points), 3), [200, 200, 200], dtype=np.uint8)
    
    # Write PLY file
    write_ply_file(output_ply_path, points, colors)
    
    return {
        "status": "success",
        "total_points": len(points),
        "is_synthetic": True
    }
