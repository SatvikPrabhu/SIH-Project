import cv2
import numpy as np
from typing import Tuple


def compute_laplacian_variance(image_np: np.ndarray) -> float:
    """
    Compute the Laplacian variance of an image as a measure of blur.
    
    Args:
        image_np: Input image as numpy array (BGR or RGB format)
    
    Returns:
        float: Variance of the Laplacian (higher = sharper)
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
    
    # Compute Laplacian
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    
    # Return variance
    return laplacian.var()


def is_frame_sharp(image_np: np.ndarray, threshold: float = 100.0) -> Tuple[bool, float]:
    """
    Determine if a frame is sharp based on Laplacian variance threshold.
    
    Args:
        image_np: Input image as numpy array
        threshold: Variance threshold for sharpness detection
    
    Returns:
        Tuple[bool, float]: (is_sharp, variance_score)
    """
    variance = compute_laplacian_variance(image_np)
    is_sharp = variance > threshold
    return is_sharp, variance
