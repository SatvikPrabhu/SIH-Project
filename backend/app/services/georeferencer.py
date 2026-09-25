import numpy as np
from typing import Tuple, List, Dict, Optional
from pathlib import Path
import warnings

try:
    from pyproj import Transformer, CRS
    PYPROJ_AVAILABLE = True
except ImportError:
    PYPROJ_AVAILABLE = False
    warnings.warn("pyproj not available. UTM conversion will use fallback.")

try:
    from scipy.spatial.transform import Rotation
    from scipy.linalg import svd
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    warnings.warn("scipy not available. Sim(3) alignment will use fallback.")


def get_utm_zone(longitude: float) -> int:
    """
    Get UTM zone from longitude.
    
    Args:
        longitude: Longitude in degrees
    
    Returns:
        int: UTM zone number (1-60)
    """
    return int((longitude + 180) / 6) + 1


def latlon_to_utm(
    latitude: float,
    longitude: float,
    altitude: float,
    utm_zone: Optional[int] = None
) -> Tuple[float, float, float]:
    """
    Convert WGS84 GPS coordinates to UTM (Easting, Northing, Altitude in meters).
    
    Args:
        latitude: Latitude in degrees
        longitude: Longitude in degrees
        altitude: Altitude in meters
        utm_zone: Optional UTM zone (auto-detected if None)
    
    Returns:
        Tuple of (easting, northing, altitude) in meters
    """
    if not PYPROJ_AVAILABLE:
        # Fallback: simple approximation (not accurate for production)
        warnings.warn("Using fallback UTM conversion (approximate)")
        # Very rough approximation: 1 degree ≈ 111km at equator
        easting = longitude * 111320.0 * np.cos(np.radians(latitude))
        northing = latitude * 110540.0
        return (easting, northing, altitude)
    
    # Auto-detect UTM zone if not provided
    if utm_zone is None:
        utm_zone = get_utm_zone(longitude)
    
    # Determine hemisphere for UTM
    hemisphere = "north" if latitude >= 0 else "south"
    
    # Create UTM CRS
    utm_crs = CRS.from_epsg(f"326{utm_zone:02d}" if hemisphere == "north" else f"327{utm_zone:02d}")
    
    # Create transformer from WGS84 to UTM
    transformer = Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True)
    
    # Transform coordinates
    easting, northing = transformer.transform(longitude, latitude)
    
    return (easting, northing, altitude)


class Sim3Solver:
    """
    Solves for Sim(3) transformation (Rotation, Scale, Translation)
    using Umeyama algorithm / Procrustes analysis.
    """
    
    def __init__(self):
        self.rotation_matrix: Optional[np.ndarray] = None
        self.scale_factor: float = 1.0
        self.translation_vector: Optional[np.ndarray] = None
    
    def compute_sim3_alignment(
        self,
        source_points: np.ndarray,
        target_utm_points: np.ndarray
    ) -> Tuple[np.ndarray, float, np.ndarray]:
        """
        Compute optimal Sim(3) transformation aligning source to target.
        
        Uses Umeyama algorithm for similarity transformation.
        
        Args:
            source_points: Nx3 array of source points (camera trajectory)
            target_utm_points: Nx3 array of target points (UTM coordinates)
        
        Returns:
            Tuple of (rotation_matrix R, scale_factor S, translation_vector T)
        """
        if not SCIPY_AVAILABLE:
            warnings.warn("scipy not available. Using identity transformation.")
            return np.eye(3), 1.0, np.zeros(3)
        
        # Ensure points are numpy arrays
        source_points = np.asarray(source_points)
        target_utm_points = np.asarray(target_utm_points)
        
        # Check minimum points required
        if source_points.shape[0] < 3 or target_utm_points.shape[0] < 3:
            warnings.warn("Insufficient points for SVD alignment. Using identity transformation.")
            return np.eye(3), 1.0, np.zeros(3)
        
        # Compute centroids
        source_centroid = np.mean(source_points, axis=0)
        target_centroid = np.mean(target_utm_points, axis=0)
        
        # Center the points
        source_centered = source_points - source_centroid
        target_centered = target_utm_points - target_centroid
        
        # Compute covariance matrix
        H = source_centered.T @ target_centered
        
        # SVD decomposition
        U, S, Vt = svd(H)
        
        # Compute rotation matrix
        R = Vt.T @ U.T
        
        # Ensure proper rotation (det(R) = 1)
        if np.linalg.det(R) < 0:
            Vt[-1, :] *= -1
            R = Vt.T @ U.T
        
        # Compute scale factor
        source_variance = np.sum(source_centered ** 2)
        target_variance = np.sum(target_centered ** 2)
        
        if source_variance > 0:
            scale_factor = np.sqrt(target_variance / source_variance)
        else:
            scale_factor = 1.0
        
        # Compute translation vector
        translation_vector = target_centroid - scale_factor * (R @ source_centroid)
        
        # Store results
        self.rotation_matrix = R
        self.scale_factor = scale_factor
        self.translation_vector = translation_vector
        
        return R, scale_factor, translation_vector
    
    def apply_transform(self, points: np.ndarray) -> np.ndarray:
        """
        Apply the computed Sim(3) transformation to points.
        
        Args:
            points: Nx3 array of points to transform
        
        Returns:
            Nx3 array of transformed points
        """
        if self.rotation_matrix is None or self.translation_vector is None:
            warnings.warn("Transformation not computed. Returning original points.")
            return points
        
        # Apply: P_georef = S * (R @ P_raw) + T
        transformed = self.scale_factor * (points @ self.rotation_matrix.T) + self.translation_vector
        return transformed


def read_ply_file(ply_path: str) -> Tuple[np.ndarray, np.ndarray]:
    """
    Read PLY file and return points and colors.
    
    Args:
        ply_path: Path to PLY file
    
    Returns:
        Tuple of (points Nx3, colors Nx3)
    """
    points = []
    colors = []
    
    with open(ply_path, 'r') as f:
        lines = f.readlines()
        
        # Find header end
        header_end = 0
        vertex_count = 0
        has_colors = False
        
        for i, line in enumerate(lines):
            if line.startswith("element vertex"):
                vertex_count = int(line.split()[2])
            if "property uchar red" in line:
                has_colors = True
            if line.strip() == "end_header":
                header_end = i + 1
                break
        
        # Read vertex data
        for i in range(header_end, header_end + vertex_count):
            parts = lines[i].strip().split()
            
            if has_colors and len(parts) >= 6:
                # XYZ RGB format
                x, y, z = map(float, parts[:3])
                r, g, b = map(int, parts[3:6])
                points.append([x, y, z])
                colors.append([r, g, b])
            elif len(parts) >= 3:
                # XYZ only format
                x, y, z = map(float, parts[:3])
                points.append([x, y, z])
                colors.append([255, 255, 255])  # Default white
    
    return np.array(points), np.array(colors)


def write_ply_file(
    ply_path: str,
    points: np.ndarray,
    colors: np.ndarray,
    binary: bool = False
) -> None:
    """
    Write points and colors to PLY file.
    
    Args:
        ply_path: Output file path
        points: Nx3 array of XYZ coordinates
        colors: Nx3 array of RGB colors (0-255)
        binary: Whether to write in binary format
    """
    num_points = len(points)
    
    with open(ply_path, 'w') as f:
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


def apply_georeferencing(
    input_ply_path: str,
    telemetry_data: List[Dict],
    output_ply_path: str
) -> Dict:
    """
    Apply georeferencing to point cloud using GPS telemetry.
    
    Args:
        input_ply_path: Path to input PLY file
        telemetry_data: List of telemetry points with GPS coordinates
        output_ply_path: Path to save georeferenced PLY file
    
    Returns:
        Dict with georeferencing metadata
    """
    # Ensure output directory exists
    output_path = Path(output_ply_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Read input PLY file
    points, colors = read_ply_file(input_ply_path)
    
    # Convert telemetry GPS to UTM coordinates
    utm_points = []
    utm_zone = None
    
    for telemetry in telemetry_data:
        lat = telemetry.get("latitude", 0.0)
        lon = telemetry.get("longitude", 0.0)
        alt = telemetry.get("altitude_m", 0.0)
        
        # Determine UTM zone from first point
        if utm_zone is None:
            utm_zone = get_utm_zone(lon)
        
        easting, northing, altitude = latlon_to_utm(lat, lon, alt, utm_zone)
        utm_points.append([easting, northing, altitude])
    
    utm_points = np.array(utm_points)
    
    # Create source points from point cloud (use first N points matching telemetry count)
    # In production, this would use camera pose estimation from reconstruction
    # For now, we'll use a subset of point cloud points as proxy
    num_telemetry_points = len(utm_points)
    if num_telemetry_points > len(points):
        num_telemetry_points = len(points)
    
    source_points = points[:num_telemetry_points]
    
    # Compute Sim(3) alignment
    solver = Sim3Solver()
    R, S, T = solver.compute_sim3_alignment(source_points, utm_points)
    
    # Apply transformation to all points
    georeferenced_points = solver.apply_transform(points)
    
    # Save georeferenced PLY
    write_ply_file(output_ply_path, georeferenced_points, colors)
    
    # Compute bounding box
    min_coords = np.min(georeferenced_points, axis=0)
    max_coords = np.max(georeferenced_points, axis=0)
    bounding_box = {
        "min_easting": float(min_coords[0]),
        "max_easting": float(max_coords[0]),
        "min_northing": float(min_coords[1]),
        "max_northing": float(max_coords[1]),
        "min_altitude": float(min_coords[2]),
        "max_altitude": float(max_coords[2]),
        "width_meters": float(max_coords[0] - min_coords[0]),
        "length_meters": float(max_coords[1] - min_coords[1]),
        "height_meters": float(max_coords[2] - min_coords[2])
    }
    
    return {
        "scale_factor_s": float(S),
        "utm_zone": f"UTM {utm_zone}",
        "bounding_box_meters": bounding_box,
        "georeferenced_ply": str(output_ply_path),
        "rotation_matrix": R.tolist(),
        "translation_vector": T.tolist(),
        "total_points": len(points)
    }
