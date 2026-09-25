import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
import warnings
import json

try:
    import open3d as o3d
    OPEN3D_AVAILABLE = True
except ImportError:
    OPEN3D_AVAILABLE = False
    warnings.warn("open3d not available. Mesh export will use fallback.")

try:
    import laspy
    LASPY_AVAILABLE = True
except ImportError:
    LASPY_AVAILABLE = False
    warnings.warn("laspy not available. LAS export will use fallback.")

try:
    import rasterio
    from rasterio.transform import from_bounds
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False
    warnings.warn("rasterio not available. GeoTIFF export will use fallback.")

try:
    import trimesh
    TRIMESH_AVAILABLE = True
except ImportError:
    TRIMESH_AVAILABLE = False
    warnings.warn("trimesh not available. GLB export will use fallback.")


def read_ply_file(ply_path: str) -> tuple[np.ndarray, np.ndarray]:
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
                x, y, z = map(float, parts[:3])
                r, g, b = map(int, parts[3:6])
                points.append([x, y, z])
                colors.append([r, g, b])
            elif len(parts) >= 3:
                x, y, z = map(float, parts[:3])
                points.append([x, y, z])
                colors.append([255, 255, 255])
    
    return np.array(points), np.array(colors)


def export_to_las(ply_path: str, output_las_path: str) -> str:
    """
    Export PLY point cloud to LAS format.
    
    Args:
        ply_path: Path to input PLY file
        output_las_path: Path to output LAS file
    
    Returns:
        Path to output LAS file
    """
    output_path = Path(output_las_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Read PLY file
    points, colors = read_ply_file(ply_path)
    
    if LASPY_AVAILABLE:
        # Use laspy for proper LAS export
        header = laspy.LasHeader(point_format=laspy.PointFormat(2), version="1.2")
        header.offsets = np.min(points, axis=0)
        header.scales = np.array([0.01, 0.01, 0.01])
        
        las = laspy.LasData(header=header)
        las.x = points[:, 0]
        las.y = points[:, 1]
        las.z = points[:, 2]
        
        # Add RGB colors if available
        if colors is not None and len(colors) == len(points):
            las.red = colors[:, 0] * 256
            las.green = colors[:, 1] * 256
            las.blue = colors[:, 2] * 256
        
        las.write(str(output_path))
    else:
        # Fallback: create a simple binary file with mock LAS structure
        warnings.warn("Using fallback LAS export (mock format)")
        with open(output_path, 'wb') as f:
            # Write simple binary header (mock)
            f.write(b'LASF\x00')  # File signature
            f.write(np.array([1, 2], dtype=np.uint16).tobytes())  # Version
            f.write(np.array([0, 0], dtype=np.uint32).tobytes())  # Offset to point data
            f.write(np.array([len(points)], dtype=np.uint32).tobytes())  # Point count
            
            # Write point data
            for i in range(len(points)):
                f.write(np.array(points[i], dtype=np.float64).tobytes())
                if colors is not None and i < len(colors):
                    f.write(np.array(colors[i], dtype=np.uint16).tobytes())
    
    return str(output_path)


def export_poisson_mesh(ply_path: str, output_obj_path: str, depth: int = 8) -> str:
    """
    Export point cloud to mesh using Poisson Surface Reconstruction.
    
    Args:
        ply_path: Path to input PLY file
        output_obj_path: Path to output OBJ file
        depth: Poisson reconstruction depth (higher = more detail)
    
    Returns:
        Path to output OBJ file
    """
    output_path = Path(output_obj_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Read PLY file
    points, colors = read_ply_file(ply_path)
    
    if OPEN3D_AVAILABLE:
        # Use Open3D for Poisson reconstruction
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points)
        
        if colors is not None and len(colors) == len(points):
            pcd.colors = o3d.utility.Vector3dVector(colors / 255.0)
        
        # Estimate normals
        pcd.estimate_normals()
        pcd.orient_normals_consistent_tangent_plane(100)
        
        # Poisson reconstruction
        mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=depth
        )
        
        # Remove low-density vertices
        vertices_to_remove = densities < np.quantile(densities, 0.01)
        mesh.remove_vertices_by_mask(vertices_to_remove)
        
        # Save mesh
        o3d.io.write_triangle_mesh(str(output_path), mesh)
        
        # Also export GLB if trimesh is available
        glb_path = output_path.with_suffix('.glb')
        if TRIMESH_AVAILABLE:
            try:
                trimesh_mesh = trimesh.Trimesh(
                    vertices=np.asarray(mesh.vertices),
                    faces=np.asarray(mesh.triangles),
                    vertex_colors=np.asarray(mesh.vertex_colors) if mesh.has_vertex_colors() else None
                )
                trimesh_mesh.export(str(glb_path))
            except Exception as e:
                warnings.warn(f"GLB export failed: {str(e)}")
    else:
        # Fallback: create a simple OBJ file with basic geometry
        warnings.warn("Using fallback mesh export (simple OBJ)")
        with open(output_path, 'w') as f:
            f.write("# Simple mesh fallback\n")
            f.write("o mesh\n")
            
            # Write vertices
            for point in points:
                f.write(f"v {point[0]:.6f} {point[1]:.6f} {point[2]:.6f}\n")
            
            # Write simple faces (triangulate points)
            num_points = len(points)
            for i in range(0, min(num_points - 2, 1000), 3):
                f.write(f"f {i+1} {i+2} {i+3}\n")
        
        # Create mock GLB
        glb_path = output_path.with_suffix('.glb')
        with open(glb_path, 'wb') as f:
            f.write(b'glTF')  # Mock GLB header
    
    return str(output_path)


def export_dsm_geotiff(ply_path: str, output_tiff_path: str, grid_resolution_m: float = 0.5) -> str:
    """
    Export point cloud to Digital Surface Model (DSM) GeoTIFF.
    
    Args:
        ply_path: Path to input PLY file
        output_tiff_path: Path to output GeoTIFF file
        grid_resolution_m: Grid resolution in meters per pixel
    
    Returns:
        Path to output GeoTIFF file
    """
    output_path = Path(output_tiff_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Read PLY file
    points, _ = read_ply_file(ply_path)
    
    # Compute bounding box
    min_coords = np.min(points, axis=0)
    max_coords = np.max(points, axis=0)
    
    # Calculate grid dimensions
    width_m = max_coords[0] - min_coords[0]
    length_m = max_coords[1] - min_coords[1]
    
    grid_width = int(np.ceil(width_m / grid_resolution_m))
    grid_length = int(np.ceil(length_m / grid_resolution_m))
    
    # Create DSM grid
    dsm = np.zeros((grid_length, grid_width), dtype=np.float32)
    dsm.fill(np.nan)
    
    # Rasterize points (max Z per cell)
    for point in points:
        x, y, z = point
        col = int((x - min_coords[0]) / grid_resolution_m)
        row = int((y - min_coords[1]) / grid_resolution_m)
        
        if 0 <= col < grid_width and 0 <= row < grid_length:
            if np.isnan(dsm[row, col]) or z > dsm[row, col]:
                dsm[row, col] = z
    
    # Fill NaN values with interpolation or minimum
    dsm = np.nan_to_num(dsm, nan=np.nanmin(dsm))
    
    if RASTERIO_AVAILABLE:
        # Use rasterio for proper GeoTIFF export
        transform = from_bounds(
            min_coords[0], min_coords[1],
            max_coords[0], max_coords[1],
            grid_width, grid_length
        )
        
        with rasterio.open(
            output_path,
            'w',
            driver='GTiff',
            height=grid_length,
            width=grid_width,
            count=1,
            dtype=rasterio.float32,
            crs='EPSG:32643',  # UTM zone 43N (default, should be dynamic)
            transform=transform,
            compress='lzw'
        ) as dst:
            dst.write(dsm, 1)
    else:
        # Fallback: create a simple TIFF-like file
        warnings.warn("Using fallback GeoTIFF export (mock format)")
        with open(output_path, 'wb') as f:
            # Write simple binary header (mock TIFF)
            f.write(b'II')  # Little-endian TIFF
            f.write(np.array([42], dtype=np.uint16).tobytes())  # TIFF magic number
            f.write(np.array([8], dtype=np.uint32).tobytes())  # Offset to first IFD
            
            # Write image data
            dsm.tofile(f)
    
    return str(output_path)


def generate_3dtiles_tileset(glb_path: str, output_json_path: str) -> str:
    """
    Generate a 3D Tiles tileset.json for CesiumJS.
    
    Args:
        glb_path: Path to GLB mesh file
        output_json_path: Path to output tileset.json
    
    Returns:
        Path to output tileset.json
    """
    output_path = Path(output_json_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Create basic 3D Tiles tileset structure
    tileset = {
        "asset": {
            "version": "1.0"
        },
        "geometricError": 500,
        "root": {
            "boundingVolume": {
                "box": [
                    0, 0, 0,  # Position
                    100, 0, 0,  # Half-size X axis
                    0, 100, 0,  # Half-size Y axis
                    0, 0, 50    # Half-size Z axis
                ]
            },
            "geometricError": 500,
            "refine": "ADD",
            "content": {
                "boundingVolume": {
                    "box": [
                        0, 0, 0,
                        100, 0, 0,
                        0, 100, 0,
                        0, 0, 50
                    ]
                },
                "uri": Path(glb_path).name
            }
        }
    }
    
    with open(output_path, 'w') as f:
        json.dump(tileset, f, indent=2)
    
    return str(output_path)


class GISExportEngine:
    """
    Engine for generating all GIS export formats from georeferenced point cloud.
    """
    
    def __init__(self, exports_dir: str):
        """
        Initialize the GIS export engine.
        
        Args:
            exports_dir: Directory to store export files
        """
        self.exports_dir = Path(exports_dir)
        self.exports_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_all_exports(
        self,
        job_id: str,
        georef_ply_path: str,
        export_formats: Optional[List[str]] = None
    ) -> Dict[str, str]:
        """
        Generate all requested GIS export formats.
        
        Args:
            job_id: Unique job identifier
            georef_ply_path: Path to georeferenced PLY file
            export_formats: List of formats to export (las, obj, geotiff, 3dtiles)
                           If None, exports all formats
        
        Returns:
            Dict mapping format names to download URLs
        """
        if export_formats is None:
            export_formats = ["las", "obj", "geotiff", "3dtiles"]
        
        results = {}
        
        # Create job-specific export directory
        job_dir = self.exports_dir / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        
        # Export to LAS
        if "las" in export_formats:
            try:
                las_path = job_dir / "model.las"
                export_to_las(georef_ply_path, str(las_path))
                results["las"] = f"/exports/{job_id}/model.las"
            except Exception as e:
                warnings.warn(f"LAS export failed: {str(e)}")
        
        # Export to OBJ/GLB mesh
        if "obj" in export_formats:
            try:
                obj_path = job_dir / "model.obj"
                export_poisson_mesh(georef_ply_path, str(obj_path))
                results["obj"] = f"/exports/{job_id}/model.obj"
                results["glb"] = f"/exports/{job_id}/model.glb"
            except Exception as e:
                warnings.warn(f"Mesh export failed: {str(e)}")
        
        # Export to GeoTIFF DSM
        if "geotiff" in export_formats:
            try:
                tiff_path = job_dir / "dsm.tif"
                export_dsm_geotiff(georef_ply_path, str(tiff_path))
                results["geotiff"] = f"/exports/{job_id}/dsm.tif"
            except Exception as e:
                warnings.warn(f"GeoTIFF export failed: {str(e)}")
        
        # Generate 3D Tiles tileset
        if "3dtiles" in export_formats:
            try:
                glb_path = job_dir / "model.glb"
                if glb_path.exists():
                    tileset_path = job_dir / "tileset.json"
                    generate_3dtiles_tileset(str(glb_path), str(tileset_path))
                    results["3dtiles"] = f"/exports/{job_id}/tileset.json"
                else:
                    warnings.warn("GLB file not found, skipping 3D Tiles generation")
            except Exception as e:
                warnings.warn(f"3D Tiles export failed: {str(e)}")
        
        return results
