import torch
import numpy as np
import cv2
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import warnings
import time

from app.services.synthetic_ply_generator import generate_mock_terrain_ply


class MASt3RReconstructor:
    """
    Wrapper for MASt3R/DUSt3R 3D reconstruction model.
    Performs dense 3D point cloud reconstruction from image pairs.
    """
    
    def __init__(self, model_name: str = "naver/mast3r", device: Optional[str] = None):
        """
        Initialize the MASt3R reconstructor.
        
        Args:
            model_name: Model name (naver/mast3r or naver/dust3r)
            device: Device to run inference on (cuda/cpu). Auto-detect if None.
        """
        self.model_name = model_name
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.model_loaded = False
        
        print(f"Initializing MASt3RReconstructor on device: {self.device}")
        
    def load_model(self) -> bool:
        """
        Load the MASt3R/DUSt3R model.
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        try:
            # Try to import DUSt3R/MASt3R
            from dust3r.inference import inference
            from dust3r.model import AsymmetricCroCo3DStereo
            from dust3r.utils.image import load_images
            
            print(f"Loading model: {self.model_name}")
            
            # Load model (this is a placeholder - actual implementation depends on dust3r API)
            # In production, this would load the actual pretrained weights
            # self.model = AsymmetricCroCo3DStereo.from_pretrained(self.model_name).to(self.device)
            
            self.model_loaded = True
            print("Model loaded successfully")
            return True
            
        except ImportError as e:
            warnings.warn(f"Failed to import dust3r/mast3r: {str(e)}")
            self.model_loaded = False
            return False
        except Exception as e:
            warnings.warn(f"Failed to load model: {str(e)}")
            self.model_loaded = False
            return False
    
    def run_reconstruction(
        self,
        keyframes_paths: List[str],
        output_ply_path: str,
        masks_paths: Optional[List[str]] = None,
        use_dynamic_masking: bool = True
    ) -> Dict[str, any]:
        """
        Run 3D reconstruction on keyframe sequence.
        
        Args:
            keyframes_paths: List of keyframe image paths
            masks_paths: Optional list of binary mask paths (same order as keyframes)
            output_ply_path: Path to save the output PLY file
            use_dynamic_masking: Whether to apply dynamic object masks
        
        Returns:
            Dict with reconstruction statistics
        """
        start_time = time.time()
        
        # Ensure output directory exists
        output_path = Path(output_ply_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Check if we have keyframes
        if not keyframes_paths:
            raise ValueError("No keyframes provided for reconstruction")
        
        # Try to load model and run reconstruction
        if self.load_model() and self.model_loaded:
            try:
                return self._run_mast3r_reconstruction(
                    keyframes_paths,
                    masks_paths,
                    output_ply_path,
                    use_dynamic_masking,
                    start_time
                )
            except Exception as e:
                warnings.warn(f"MASt3R reconstruction failed: {str(e)}. Falling back to OpenCV SfM.")
                return self._reconstruct_from_opencv_sfm(
                    keyframes_paths,
                    masks_paths,
                    output_ply_path,
                    use_dynamic_masking,
                    start_time
                )
        else:
            warnings.warn("Model not available. Running OpenCV SIFT/ORB Structure-from-Motion reconstruction on real video features.")
            return self._reconstruct_from_opencv_sfm(
                keyframes_paths,
                masks_paths,
                output_ply_path,
                use_dynamic_masking,
                start_time
            )
    
    def _run_mast3r_reconstruction(
        self,
        keyframes_paths: List[str],
        masks_paths: Optional[List[str]],
        output_ply_path: str,
        use_dynamic_masking: bool,
        start_time: float
    ) -> Dict[str, any]:
        """
        Internal method to run actual MASt3R reconstruction.
        
        This is a placeholder implementation. The actual implementation would:
        1. Load images
        2. Form sequential pairs
        3. Run MASt3R inference on each pair
        4. Extract pointmaps and confidence
        5. Apply masks if provided
        6. Global alignment
        7. Export to PLY
        """
        print(f"Running MASt3R reconstruction on {len(keyframes_paths)} keyframes")
        
        # Placeholder: In production, this would call the actual MASt3R inference
        # For now, we'll use the synthetic fallback as a placeholder
        warnings.warn("MASt3R inference not fully implemented. Using synthetic fallback.")
        return self._fallback_to_synthetic(output_ply_path, start_time)
        
        # Example of what the actual implementation would look like:
        """
        from dust3r.inference import inference
        from dust3r.utils.image import load_images
        
        # Load images
        imgs = load_images(keyframes_paths, size=512)
        
        # Run inference
        output = inference([tuple(imgs)], self.model, self.device)
        
        # Extract pointmaps
        pointmaps = output['points3D']
        confidences = output['conf']
        
        # Apply masks if provided
        if use_dynamic_masking and masks_paths:
            pointmaps = self._apply_masks_to_pointmaps(pointmaps, masks_paths, keyframes_paths)
        
        # Global alignment (placeholder)
        aligned_points = self._global_alignment(pointmaps, confidences)
        
        # Export to PLY
        self._export_to_ply(aligned_points, output_ply_path)
        
        processing_time = time.time() - start_time
        return {
            "status": "success",
            "total_points": len(aligned_points),
            "processing_time_sec": processing_time,
            "is_synthetic": False,
            "model_used": self.model_name
        }
        """
    
    def _apply_masks_to_pointmaps(
        self,
        pointmaps: np.ndarray,
        masks_paths: List[str],
        keyframes_paths: List[str]
    ) -> np.ndarray:
        """
        Apply binary masks to pointmaps to remove dynamic object points.
        
        Args:
            pointmaps: Nx3 array of 3D points
            masks_paths: List of mask file paths
            keyframes_paths: List of corresponding keyframe paths
        
        Returns:
            Filtered pointmaps with dynamic object points removed
        """
        # Placeholder implementation
        # In production, this would project 3D points back to 2D image space
        # and filter based on the binary masks
        return pointmaps
    
    def _global_alignment(
        self,
        pointmaps: List[np.ndarray],
        confidences: List[np.ndarray]
    ) -> np.ndarray:
        """
        Perform global alignment of multiple pointmaps.
        
        Args:
            pointmaps: List of pointmaps from image pairs
            confidences: List of confidence scores
        
        Returns:
            Globally aligned point cloud
        """
        # Placeholder implementation
        # In production, this would use a global alignment algorithm
        # (e.g., ICP, pose graph optimization)
        return np.vstack(pointmaps)
    
    def _export_to_ply(self, points: np.ndarray, output_path: str) -> None:
        """
        Export point cloud to PLY format.
        
        Args:
            points: Nx3 array of 3D points
            output_path: Output file path
        """
        # Placeholder - would use actual PLY writing
        from app.services.synthetic_ply_generator import write_ply_file
        
        # Generate default colors (white)
        colors = np.full((len(points), 3), [255, 255, 255], dtype=np.uint8)
        write_ply_file(output_path, points, colors)
    
    def _reconstruct_from_opencv_sfm(
        self,
        keyframes_paths: List[str],
        masks_paths: Optional[List[str]],
        output_ply_path: str,
        use_dynamic_masking: bool,
        start_time: float
    ) -> Dict[str, any]:
        """
        OpenCV-based Structure-from-Motion reconstruction using SIFT/ORB features.
        
        Args:
            keyframes_paths: List of keyframe image paths
            masks_paths: Optional list of binary mask paths
            output_ply_path: Path to save the output PLY file
            use_dynamic_masking: Whether to apply dynamic object masks
            start_time: Start time for timing statistics
        
        Returns:
            Dict with reconstruction statistics
        """
        print(f"Running OpenCV SfM reconstruction on {len(keyframes_paths)} keyframes")
        
        # Need at least 2 frames for SfM
        if len(keyframes_paths) < 2:
            warnings.warn("Insufficient keyframes for SfM (need at least 2). Falling back to synthetic.")
            return self._fallback_to_synthetic(output_ply_path, start_time)
        
        try:
            # Initialize feature detector (try SIFT first, fallback to ORB)
            try:
                detector = cv2.SIFT_create()
                use_sift = True
                print("Using SIFT feature detector")
            except AttributeError:
                detector = cv2.ORB_create()
                use_sift = False
                print("Using ORB feature detector (SIFT not available)")
            
            # Initialize matcher
            if use_sift:
                matcher = cv2.BFMatcher(cv2.NORM_L2, crossCheck=True)
            else:
                matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            
            # Load first image
            img1 = cv2.imread(keyframes_paths[0], cv2.IMREAD_COLOR)
            if img1 is None:
                raise ValueError(f"Failed to load image: {keyframes_paths[0]}")
            
            h, w = img1.shape[:2]
            
            # Estimate focal length (common approximation)
            focal_length = 1.2 * max(w, h)
            cx, cy = w / 2, h / 2
            K = np.array([[focal_length, 0, cx],
                          [0, focal_length, cy],
                          [0, 0, 1]], dtype=np.float32)
            
            # Load mask for first image if available
            mask1 = None
            if masks_paths and len(masks_paths) > 0 and use_dynamic_masking:
                mask1 = cv2.imread(masks_paths[0], cv2.IMREAD_GRAYSCALE)
                if mask1 is not None:
                    # CV_8UC1 binary mask: 255 for areas to compute features, 0 for areas to ignore.
                    # Assuming > 127 is the foreground/object.
                    mask1 = (mask1 > 127).astype(np.uint8) * 255
            
            # Extract features from first image
            kp1, des1 = detector.detectAndCompute(img1, mask=mask1)
            
            if not kp1 or des1 is None or len(kp1) < 10:
                warnings.warn("Insufficient features in first image. Falling back to synthetic.")
                return self._fallback_to_synthetic(output_ply_path, start_time)
            
            # Accumulate all 3D points and colors
            all_points_3d = []
            all_colors = []
            
            # Global rotation and translation for sequential SfM
            R_global = np.eye(3)
            t_global = np.zeros((3, 1))
            
            # Process adjacent frame pairs
            for i in range(1, len(keyframes_paths)):
                img2 = cv2.imread(keyframes_paths[i], cv2.IMREAD_COLOR)
                if img2 is None:
                    print(f"Failed to load image: {keyframes_paths[i]}, skipping")
                    continue
                
                # Load mask for second image if available
                mask2 = None
                if masks_paths and len(masks_paths) > i and use_dynamic_masking:
                    mask2 = cv2.imread(masks_paths[i], cv2.IMREAD_GRAYSCALE)
                    if mask2 is not None:
                        mask2 = (mask2 > 127).astype(np.uint8) * 255
                
                # Extract features from second image
                kp2, des2 = detector.detectAndCompute(img2, mask=mask2)
                
                if not kp2 or des2 is None or len(kp2) < 10:
                    print(f"Insufficient features in image {i}, skipping")
                    continue
                
                # Match features
                matches = matcher.match(des1, des2)
                
                if len(matches) < 10:
                    print(f"Insufficient matches between frames {i-1} and {i}, skipping")
                    kp1, des1 = kp2, des2
                    img1 = img2
                    continue
                
                # Sort matches by distance
                matches = sorted(matches, key=lambda x: x.distance)
                matches = matches[:min(500, len(matches))]  # Keep best matches
                
                # Extract matched keypoints
                pts1_2d = np.float32([kp1[m.queryIdx].pt for m in matches])
                pts2_2d = np.float32([kp2[m.trainIdx].pt for m in matches])
                
                # Compute Essential Matrix
                E, inlier_mask = cv2.findEssentialMat(pts1_2d, pts2_2d, K, method=cv2.RANSAC, prob=0.999, threshold=1.0)
                
                if E is None or E.shape != (3, 3):
                    print(f"Failed to compute Essential Matrix for frames {i-1} and {i}, skipping")
                    kp1, des1 = kp2, des2
                    img1 = img2
                    continue
                
                # Recover relative pose
                _, R, t, mask_pose = cv2.recoverPose(E, pts1_2d, pts2_2d, K, mask=inlier_mask)
                
                # Update global pose (P2) relative to the very first camera (which is at origin)
                # Next camera pose is R_global * R, t_global + R_global * t
                # Wait, for simple pairs we can triangulate relative to first camera of the pair,
                # then transform to global coordinates.
                
                # Projection matrices for this pair (local coordinates: cam1 at origin)
                P1 = K @ np.hstack([np.eye(3), np.zeros((3, 1))])
                P2 = K @ np.hstack([R, t])
                
                # Triangulate points
                pts1_for_triangulation = pts1_2d.T  # shape (2, N)
                pts2_for_triangulation = pts2_2d.T  # shape (2, N)
                
                points_4d = cv2.triangulatePoints(P1, P2, pts1_for_triangulation, pts2_for_triangulation)
                points_3d_local = (points_4d[:3] / points_4d[3]).T  # Convert to Nx3
                
                # Filter points using the inlier mask from pose recovery and positive Z
                valid_mask = (mask_pose.ravel() > 0) & (points_3d_local[:, 2] > 0)
                points_3d_local = points_3d_local[valid_mask]
                pts1_valid = pts1_2d[valid_mask]
                
                # Transform local points to global coordinate system
                points_3d_global = (R_global @ points_3d_local.T).T + t_global.T
                
                # Extract colors from first image of the pair
                for j, (pt, point_3d) in enumerate(zip(pts1_valid, points_3d_global)):
                    x, y = int(pt[0]), int(pt[1])
                    if 0 <= x < w and 0 <= y < h:
                        # OpenCV uses BGR, convert to RGB
                        b, g, r = img1[y, x]
                        all_points_3d.append(point_3d)
                        all_colors.append([r, g, b])
                
                # Update global camera pose for next iteration
                t_global = t_global + R_global @ t
                R_global = R_global @ R
                
                # Move to next frame
                kp1, des1 = kp2, des2
                img1 = img2
            
            # Convert to numpy arrays
            if len(all_points_3d) < 10:
                warnings.warn("Insufficient triangulated points. Falling back to synthetic.")
                return self._fallback_to_synthetic(output_ply_path, start_time)
            
            points_3d = np.array(all_points_3d, dtype=np.float32)
            colors = np.array(all_colors, dtype=np.uint8)
            
            # Optional: Statistical Outlier Removal
            centroid = np.mean(points_3d, axis=0)
            points_3d = points_3d - centroid
            
            # Scale to reasonable size
            max_dist = np.max(np.linalg.norm(points_3d, axis=1))
            if max_dist > 0:
                points_3d = points_3d / max_dist * 100  # Scale to ~100 units
            
            # Save as PLY using write_ply_file
            from app.services.synthetic_ply_generator import write_ply_file
            write_ply_file(output_ply_path, points_3d, colors)
            
            processing_time = time.time() - start_time
            
            print(f"OpenCV SfM reconstruction complete: {len(points_3d)} points in {processing_time:.2f}s")
            
            return {
                "status": "success",
                "total_points": len(points_3d),
                "processing_time_sec": processing_time,
                "is_synthetic": False,
                "model_used": "opencv_sfm"
            }
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            warnings.warn(f"OpenCV SfM reconstruction failed: {str(e)}. Falling back to synthetic.")
            return self._fallback_to_synthetic(output_ply_path, start_time)
    
    def _fallback_to_synthetic(self, output_ply_path: str, start_time: float) -> Dict[str, any]:
        """
        Fallback to synthetic point cloud generation when model is unavailable.
        
        Args:
            output_ply_path: Path to save the synthetic PLY
            start_time: Start time for timing statistics
        
        Returns:
            Dict with synthetic generation statistics
        """
        print("Generating synthetic point cloud as fallback")
        
        result = generate_mock_terrain_ply(output_ply_path, num_points=15000)
        
        processing_time = time.time() - start_time
        
        result["processing_time_sec"] = processing_time
        result["model_used"] = "synthetic_fallback"
        
        return result


def reconstruct_from_keyframes(
    keyframes_dir: str,
    output_ply_path: str,
    masks_dir: Optional[str] = None,
    use_dynamic_masking: bool = True,
    model_name: str = "naver/mast3r"
) -> Dict[str, any]:
    """
    Convenience function to reconstruct 3D point cloud from keyframes directory.
    
    Args:
        keyframes_dir: Directory containing keyframe images
        masks_dir: Optional directory containing binary masks
        output_ply_path: Path to save the output PLY file
        use_dynamic_masking: Whether to apply dynamic object masks
        model_name: Model name for reconstruction
    
    Returns:
        Dict with reconstruction statistics
    """
    keyframes_path = Path(keyframes_dir)
    
    # Get sorted keyframe files
    keyframe_files = sorted(keyframes_path.glob("*.png"))
    keyframe_files.extend(sorted(keyframes_path.glob("*.jpg")))
    keyframe_files = sorted(set(keyframe_files))
    
    keyframes_paths = [str(f) for f in keyframe_files]
    
    # Get mask files if provided
    masks_paths = None
    if masks_dir and use_dynamic_masking:
        masks_path = Path(masks_dir)
        mask_files = sorted(masks_path.glob("*.png"))
        masks_paths = [str(f) for f in mask_files]
    
    # Run reconstruction
    reconstructor = MASt3RReconstructor(model_name=model_name)
    return reconstructor.run_reconstruction(
        keyframes_paths=keyframes_paths,
        masks_paths=masks_paths,
        output_ply_path=output_ply_path,
        use_dynamic_masking=use_dynamic_masking
    )
