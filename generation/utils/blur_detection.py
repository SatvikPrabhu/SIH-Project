"""
Blur and Image Quality Assessment Utility
Evaluates frame sharpness to filter out motion-blurred or degraded video frames.
"""

import cv2
import numpy as np
from typing import Tuple, Union

def calculate_laplacian_variance(gray_image: np.ndarray) -> float:
    """
    Computes sharpness using the variance of the Laplacian filter.
    Higher values indicate a sharper, clearer image.
    """
    lap = cv2.Laplacian(gray_image, cv2.CV_64F)
    score = float(lap.var())
    return score

def calculate_tenengrad_gradient(gray_image: np.ndarray) -> float:
    """
    Computes Tenengrad focus measure using Sobel gradient magnitude energy.
    """
    gx = cv2.Sobel(gray_image, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray_image, cv2.CV_64F, 0, 1, ksize=3)
    mag_sq = gx ** 2 + gy ** 2
    score = float(np.mean(mag_sq))
    return score

def calculate_fft_blur_ratio(gray_image: np.ndarray, size: int = 60) -> float:
    """
    Computes frequency domain blur score using 2D Fast Fourier Transform.
    Measures the ratio of high-frequency components relative to low-frequency components.
    """
    h, w = gray_image.shape
    cy, cx = h // 2, w // 2

    # Compute FFT and shift DC component to center
    fft = np.fft.fft2(gray_image)
    fft_shift = np.fft.fftshift(fft)
    
    # Zero out low frequencies at center
    fft_shift[cy - size : cy + size, cx - size : cx + size] = 0
    
    # Reconstruct magnitude
    fft_inverse = np.fft.ifftshift(fft_shift)
    recon = np.fft.ifft2(fft_inverse)
    magnitude = 20 * np.log(np.abs(recon) + 1e-8)
    
    mean_value = float(np.mean(magnitude))
    return mean_value

def calculate_blur_score(
    image: Union[np.ndarray, str], 
    method: str = "laplacian"
) -> float:
    """
    Calculates the sharpness score of an image.

    Args:
        image: Either a BGR numpy array or file path.
        method: Scoring method ('laplacian', 'tenengrad', or 'fft').

    Returns:
        float: Computed sharpness/blur score.
    """
    if isinstance(image, str):
        img_array = cv2.imread(image)
        if img_array is None:
            raise ValueError(f"Could not read image from path: {image}")
    else:
        img_array = image

    if len(img_array.shape) == 3:
        gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
    else:
        gray = img_array

    method_lower = method.lower()
    if method_lower == "laplacian":
        return calculate_laplacian_variance(gray)
    elif method_lower == "tenengrad":
        return calculate_tenengrad_gradient(gray)
    elif method_lower == "fft":
        return calculate_fft_blur_ratio(gray)
    else:
        raise ValueError(f"Unknown blur detection method: {method}. Use 'laplacian', 'tenengrad', or 'fft'.")

def is_blurry_frame(
    image: Union[np.ndarray, str], 
    threshold: float = 100.0, 
    method: str = "laplacian"
) -> Tuple[bool, float]:
    """
    Checks if a given frame is considered blurry relative to a threshold.

    Args:
        image: Frame array or file path.
        threshold: Minimum score to consider sharp.
        method: Evaluation algorithm.

    Returns:
        (is_blurry, score): Tuple of boolean flag and numeric score.
    """
    score = calculate_blur_score(image, method=method)
    is_blurry = score < threshold
    return is_blurry, score
