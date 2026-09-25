"""
Coordinate Transformations & Geospatial Alignment Utilities
Provides WGS84 GPS to UTM/ENU conversion, Sim(3) 7-DOF rigid alignment (Umeyama),
and point cloud transformation methods for GIS integration.
"""

import math
import numpy as np
from typing import Tuple, Dict, Any, Optional

# Try importing pyproj for accurate geospatial projection
try:
    import pyproj
    HAS_PYPROJ = True
except ImportError:
    HAS_PYPROJ = False

def get_utm_zone_from_lon(longitude: float) -> int:
    """Computes the standard UTM zone (1-60) from longitude degrees."""
    return int((longitude + 180) / 6) + 1

def wgs84_to_utm(
    lat: float, 
    lon: float, 
    alt: float = 0.0, 
    utm_zone: Optional[int] = None
) -> Tuple[float, float, float, int, str]:
    """
    Converts WGS84 Geodetic coordinates (Latitude, Longitude, Altitude) to UTM coordinates (Easting, Northing, Altitude).

    Returns:
        (easting, northing, altitude, zone_number, hemisphere)
    """
    if utm_zone is None:
        utm_zone = get_utm_zone_from_lon(lon)
    
    hemisphere = "N" if lat >= 0 else "S"
    
    if HAS_PYPROJ:
        proj_utm = pyproj.Proj(
            proj="utm", 
            zone=utm_zone, 
            south=(hemisphere == "S"), 
            ellps="WGS84", 
            datum="WGS84"
        )
        easting, northing = proj_utm(lon, lat)
    else:
        # Standard analytical Karney/Snyder UTM approximation if pyproj is unavailable
        a = 6378137.0         # WGS84 semi-major axis
        f = 1 / 298.257223563  # WGS84 flattening
        k0 = 0.9996           # Scale factor
        
        lat_rad = math.radians(lat)
        lon_rad = math.radians(lon)
        lon0_rad = math.radians((utm_zone - 1) * 6 - 180 + 3)
        
        e2 = 2 * f - f ** 2
        e_prime2 = e2 / (1 - e2)
        N = a / math.sqrt(1 - e2 * math.sin(lat_rad) ** 2)
        T = math.tan(lat_rad) ** 2
        C = e_prime2 * math.cos(lat_rad) ** 2
        A = math.cos(lat_rad) * (lon_rad - lon0_rad)
        
        M = a * (
            (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * lat_rad
            - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * lat_rad)
            + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * lat_rad)
            - (35 * e2**3 / 3072) * math.sin(6 * lat_rad)
        )
        
        easting = k0 * N * (
            A + (1 - T + C) * A**3 / 6 + (5 - 18 * T + T**2 + 72 * C - 58 * e_prime2) * A**5 / 120
        ) + 500000.0
        
        northing = k0 * (
            M + N * math.tan(lat_rad) * (
                A**2 / 2 + (5 - T + 9 * C + 4 * C**2) * A**4 / 24 + (61 - 58 * T + T**2 + 600 * C - 330 * e_prime2) * A**6 / 720
            )
        )
        if hemisphere == "S":
            northing += 10000000.0

    return float(easting), float(northing), float(alt), utm_zone, hemisphere

def utm_to_wgs84(
    easting: float, 
    northing: float, 
    alt: float, 
    utm_zone: int, 
    hemisphere: str = "N"
) -> Tuple[float, float, float]:
    """Converts UTM coordinates back to WGS84 (Lat, Lon, Alt)."""
    if HAS_PYPROJ:
        proj_utm = pyproj.Proj(
            proj="utm", 
            zone=utm_zone, 
            south=(hemisphere.upper() == "S"), 
            ellps="WGS84", 
            datum="WGS84"
        )
        lon, lat = proj_utm(easting, northing, inverse=True)
        return float(lat), float(lon), float(alt)
    else:
        # Basic inverse approximation
        raise NotImplementedError("PyProj is required for inverse UTM to WGS84 mapping. Install via `pip install pyproj`.")

def umeyama_alignment(
    source_points: np.ndarray, 
    target_points: np.ndarray, 
    with_scaling: bool = True
) -> Tuple[float, np.ndarray, np.ndarray, np.ndarray]:
    """
    Umeyama algorithm for optimal Sim(3) 7-DOF similarity transformation:
    Finds scale `s`, rotation `R` in SO(3), and translation `t` such that:
        target = s * R @ source + t

    Args:
        source_points: (N, 3) numpy array of source 3D points (e.g. estimated SfM camera centers).
        target_points: (N, 3) numpy array of target 3D points (e.g. real GPS UTM coordinates).
        with_scaling: If True, computes uniform scale factor `s`. If False, rigid SE(3) with s=1.0.

    Returns:
        s (float): Scale factor.
        R (3x3 ndarray): Rotation matrix.
        t (3 ndarray): Translation vector.
        T (4x4 ndarray): Homogeneous transformation matrix.
    """
    assert source_points.shape == target_points.shape, "Source and target point sets must have equal shapes."
    n, m = source_points.shape
    assert m == 3, "Points must have 3 dimensions."

    # Compute centroids
    mean_src = np.mean(source_points, axis=0)
    mean_tgt = np.mean(target_points, axis=0)

    # Center the points
    src_centered = source_points - mean_src
    tgt_centered = target_points - mean_tgt

    # Covariance matrix H
    H = src_centered.T @ tgt_centered / n

    # Singular Value Decomposition (SVD)
    U, D, Vt = np.linalg.svd(H)
    V = Vt.T

    # Rotation matrix R
    d = np.linalg.det(V @ U.T)
    S = np.eye(m)
    if d < 0:
        S[m - 1, m - 1] = -1.0

    R = V @ S @ U.T

    # Compute scale factor s
    if with_scaling:
        var_src = np.sum(np.var(source_points, axis=0))
        if var_src > 1e-9:
            s = float(np.trace(np.diag(D) @ S) / var_src)
        else:
            s = 1.0
    else:
        s = 1.0

    # Compute translation vector t
    t = mean_tgt - s * (R @ mean_src)

    # Build 4x4 Homogeneous transformation matrix
    T = np.eye(4)
    T[0:3, 0:3] = s * R
    T[0:3, 3] = t

    return float(s), R, t, T

def apply_sim3_transform(points: np.ndarray, T: np.ndarray) -> np.ndarray:
    """
    Applies 4x4 Sim(3) transformation matrix to an (N, 3) array of 3D points.
    """
    if points.size == 0:
        return points
    
    # Homogeneous coordinates
    homo = np.hstack([points, np.ones((points.shape[0], 1), dtype=points.dtype)])
    transformed = (T @ homo.T).T
    return transformed[:, :3]

def calculate_bounding_box(points: np.ndarray) -> Dict[str, Any]:
    """Computes axis-aligned bounding box (AABB) of a point cloud."""
    if points.size == 0:
        return {"min": [0, 0, 0], "max": [0, 0, 0], "center": [0, 0, 0], "size": [0, 0, 0]}
    
    min_pt = np.min(points, axis=0).tolist()
    max_pt = np.max(points, axis=0).tolist()
    center = ((np.array(min_pt) + np.array(max_pt)) / 2.0).tolist()
    size = (np.array(max_pt) - np.array(min_pt)).tolist()

    return {
        "min": min_pt,
        "max": max_pt,
        "center": center,
        "size": size
    }
