import cv2
import numpy as np
from pathlib import Path
from typing import List, Optional
import warnings

# COCO target classes for dynamic objects
# 0: person, 2: car, 3: motorcycle, 5: bus, 7: truck
DYNAMIC_CLASS_IDS = {0, 2, 3, 5, 7}


def generate_dynamic_masks(
    keyframes_dir: str,
    masks_dir: str,
    model_size: str = "yolov8n-seg"
) -> List[str]:
    """
    Generate binary masks for dynamic objects (vehicles, pedestrians) in keyframes.
    
    Args:
        keyframes_dir: Directory containing keyframe images
        masks_dir: Directory to save binary mask images
        model_size: YOLOv8 model size (yolov8n-seg, yolov8s-seg, yolov8m-seg, yolov8l-seg)
    
    Returns:
        List of generated mask file paths
    """
    keyframes_path = Path(keyframes_dir)
    masks_path = Path(masks_dir)
    
    # Ensure output directory exists
    masks_path.mkdir(parents=True, exist_ok=True)
    
    # Get all keyframe images (sorted)
    keyframe_files = sorted(keyframes_path.glob("*.png"))
    keyframe_files.extend(sorted(keyframes_path.glob("*.jpg")))
    keyframe_files = sorted(set(keyframe_files))
    
    if not keyframe_files:
        warnings.warn(f"No keyframe images found in {keyframes_dir}")
        return []
    
    mask_paths = []
    
    try:
        # Import ultralytics YOLO
        from ultralytics import YOLO
        
        # Load pre-trained segmentation model
        print(f"Loading YOLO model: {model_size}")
        model = YOLO(f"{model_size}.pt")
        
        for keyframe_file in keyframe_files:
            # Read image
            image = cv2.imread(str(keyframe_file))
            if image is None:
                print(f"Failed to read {keyframe_file}")
                continue
            
            # Run inference
            results = model(image, verbose=False)
            
            # Initialize binary mask (all black = static)
            binary_mask = np.zeros((image.shape[0], image.shape[1]), dtype=np.uint8)
            
            # Process results
            for result in results:
                if result.masks is not None:
                    masks = result.masks.data.cpu().numpy()
                    classes = result.boxes.cls.cpu().numpy()
                    
                    for mask, cls in zip(masks, classes):
                        # Only mark dynamic objects
                        if int(cls) in DYNAMIC_CLASS_IDS:
                            # Resize mask to image dimensions
                            mask_resized = cv2.resize(mask, (image.shape[1], image.shape[0]))
                            # Threshold to binary
                            mask_binary = (mask_resized > 0.5).astype(np.uint8) * 255
                            # Combine with existing mask
                            binary_mask = cv2.bitwise_or(binary_mask, mask_binary)
            
            # Save mask
            frame_index = keyframe_file.stem.split("_")[-1]
            mask_filename = f"mask_{frame_index}.png"
            mask_path = masks_path / mask_filename
            cv2.imwrite(str(mask_path), binary_mask)
            mask_paths.append(str(mask_path))
            
            print(f"Generated mask: {mask_filename}")
            
    except ImportError:
        warnings.warn("ultralytics package not available. Generating blank masks (all static).")
        # Fallback: generate blank masks (all black = no dynamic objects)
        for keyframe_file in keyframe_files:
            image = cv2.imread(str(keyframe_file))
            if image is None:
                continue
            
            # Create blank mask (all zeros = static)
            binary_mask = np.zeros((image.shape[0], image.shape[1]), dtype=np.uint8)
            
            frame_index = keyframe_file.stem.split("_")[-1]
            mask_filename = f"mask_{frame_index}.png"
            mask_path = masks_path / mask_filename
            cv2.imwrite(str(mask_path), binary_mask)
            mask_paths.append(str(mask_path))
            
    except Exception as e:
        warnings.warn(f"Error during segmentation: {str(e)}. Generating blank masks.")
        # Fallback: generate blank masks
        for keyframe_file in keyframe_files:
            image = cv2.imread(str(keyframe_file))
            if image is None:
                continue
            
            binary_mask = np.zeros((image.shape[0], image.shape[1]), dtype=np.uint8)
            
            frame_index = keyframe_file.stem.split("_")[-1]
            mask_filename = f"mask_{frame_index}.png"
            mask_path = masks_path / mask_filename
            cv2.imwrite(str(mask_path), binary_mask)
            mask_paths.append(str(mask_path))
    
    return mask_paths


def apply_mask_to_image(image_path: str, mask_path: str, output_path: str) -> None:
    """
    Apply a binary mask to an image, setting masked regions to black.
    
    Args:
        image_path: Path to the source image
        mask_path: Path to the binary mask (255 = dynamic, 0 = static)
        output_path: Path to save the masked image
    """
    image = cv2.imread(image_path)
    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    
    if image is None or mask is None:
        raise ValueError("Failed to read image or mask")
    
    # Resize mask to match image if needed
    if mask.shape != image.shape[:2]:
        mask = cv2.resize(mask, (image.shape[1], image.shape[0]))
    
    # Apply mask: set dynamic regions to black
    masked_image = image.copy()
    masked_image[mask == 255] = [0, 0, 0]
    
    cv2.imwrite(output_path, masked_image)
