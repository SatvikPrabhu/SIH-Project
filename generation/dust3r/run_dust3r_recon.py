import os
import sys
import argparse
import numpy as np
import torch

# Fix for PyTorch 2.6+ unpickling check
torch.serialization.add_safe_globals([argparse.Namespace])
_orig_load = torch.load
torch.load = lambda *args, **kwargs: _orig_load(*args, **{**kwargs, "weights_only": False})

# Ensure script directory and dust3r package are in python path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

import trimesh
from dust3r.model import load_model
from dust3r.inference import inference
from dust3r.utils.image import load_images
from dust3r.image_pairs import make_pairs
from dust3r.cloud_opt import global_aligner, GlobalAlignerMode


def run_dust3r(images_dir: str, output_dir: str, weights_path: str, image_size: int = 512,
               niter: int = 300, conf_thr: float = 3.0, max_images: int = 20) -> dict:
    """
    Run DUSt3R multi-view reconstruction on a directory of images.

    Args:
        images_dir:   Path to directory containing extracted frames (.jpg / .png)
        output_dir:   Where to save model.ply and model.glb
        weights_path: Path to DUSt3R .pth checkpoint
        image_size:   Resize images to this resolution for inference (512 recommended)
        niter:        Global alignment iterations
        conf_thr:     Minimum confidence threshold for point filtering
        max_images:   Cap on number of images to feed DUSt3R (avoids OOM on large extractions)

    Returns:
        dict with keys: ply_path, glb_path, num_points, num_images
    """
    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"DUSt3R checkpoint not found at: {weights_path}")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[DUSt3R] Loading weights on {device} from: {weights_path}")
    model = load_model(weights_path, device=device)

    # Collect image files from the frames directory
    exts = (".jpg", ".jpeg", ".png")
    image_files = sorted([
        os.path.join(images_dir, f)
        for f in os.listdir(images_dir)
        if os.path.splitext(f)[1].lower() in exts
    ])

    if len(image_files) < 2:
        raise ValueError(
            f"DUSt3R requires at least 2 images, found {len(image_files)} in: {images_dir}"
        )

    # Cap to avoid GPU OOM on high-FPS extractions by uniform subsampling
    if max_images and len(image_files) > max_images:
        indices = [round(i * (len(image_files) - 1) / (max_images - 1)) for i in range(max_images)]
        image_files = [image_files[i] for i in indices]
        print(f"[DUSt3R] Subsampled to {len(image_files)} images (max_images={max_images})")

    print(f"[DUSt3R] Processing {len(image_files)} keyframes from: {images_dir}")
    images = load_images(image_files, size=image_size)

    # Build sequential image pairs (best for drone flight paths)
    pairs = make_pairs(images, scene_graph="linear", symmetrize=True)

    # Fallback in case make_pairs returns empty
    if not pairs:
        print("[DUSt3R] make_pairs returned empty — constructing linear pairs manually...")
        pairs = []
        for i in range(len(images) - 1):
            pairs.append((images[i], images[i + 1]))
            pairs.append((images[i + 1], images[i]))

    print(f"[DUSt3R] Generated {len(pairs)} image pairs for inference.")

    # Pairwise inference
    print("[DUSt3R] Running pairwise prediction...")
    with torch.no_grad():
        output = inference(pairs, model, device=device, batch_size=1)

    # Global scene alignment
    print("[DUSt3R] Solving global scene alignment...")
    scene = global_aligner(output, device=device, mode=GlobalAlignerMode.PointCloudOptimizer)
    scene.compute_global_alignment(init="mst", niter=niter, schedule="cosine")
    scene.min_conf_thr = conf_thr

    # Extract confident 3D points + colours
    pts3d = scene.get_pts3d()
    masks = scene.get_masks()
    imgs = scene.imgs

    valid_pts = []
    valid_colors = []

    for p, c, m in zip(pts3d, imgs, masks):
        p_np = p.detach().cpu().numpy() if isinstance(p, torch.Tensor) else np.asarray(p)
        m_np = m.detach().cpu().numpy() if isinstance(m, torch.Tensor) else np.asarray(m)
        c_np = c.detach().cpu().numpy() if isinstance(c, torch.Tensor) else np.asarray(c)

        m_flat = m_np.flatten()
        p_flat = p_np.reshape(-1, 3)[m_flat]
        c_flat = c_np.reshape(-1, 3)[m_flat]

        valid_pts.append(p_flat)
        valid_colors.append(c_flat)

    all_pts = np.vstack(valid_pts)
    all_colors = np.vstack(valid_colors)

    # Normalise colours to uint8 [0–255]
    if all_colors.max() <= 1.0:
        all_colors = (all_colors * 255).astype(np.uint8)
    else:
        all_colors = all_colors.astype(np.uint8)

    # Export
    os.makedirs(output_dir, exist_ok=True)
    ply_path = os.path.join(output_dir, "model.ply")
    glb_path = os.path.join(output_dir, "model.glb")

    pcd = trimesh.PointCloud(vertices=all_pts, colors=all_colors)
    pcd.export(ply_path)
    pcd.export(glb_path)

    print(f"\n[DUSt3R] Reconstruction complete!")
    print(f"  Total valid 3D points : {len(all_pts):,}")
    print(f"  Saved PLY             : {ply_path}")
    print(f"  Saved GLB             : {glb_path}")

    return {
        "ply_path": ply_path,
        "glb_path": glb_path,
        "num_points": len(all_pts),
        "num_images": len(image_files),
    }


def main():
    parser = argparse.ArgumentParser(
        description="DUSt3R Multi-View 3D Reconstruction from extracted video frames"
    )
    parser.add_argument(
        "--images_dir", type=str,
        default=os.path.join(PROJECT_ROOT, "storage", "inputs", "test_frames"),
        help="Directory of input image frames"
    )
    parser.add_argument(
        "--output_dir", type=str,
        default=os.path.join(PROJECT_ROOT, "storage", "outputs", "recon_demo"),
        help="Output directory for model.ply and model.glb"
    )
    parser.add_argument(
        "--weights", type=str,
        default=os.path.join(SCRIPT_DIR, "checkpoints", "DUSt3R_ViTLarge_BaseDecoder_512_linear.pth"),
        help="Path to DUSt3R .pth checkpoint"
    )
    parser.add_argument(
        "--image_size", type=int, default=512,
        help="Image resize resolution for DUSt3R inference (default: 512)"
    )
    parser.add_argument(
        "--niter", type=int, default=300,
        help="Global alignment iterations (default: 300)"
    )
    parser.add_argument(
        "--conf_thr", type=float, default=3.0,
        help="Minimum confidence threshold for point filtering (default: 3.0)"
    )
    parser.add_argument(
        "--max_images", type=int, default=20,
        help="Max images to feed DUSt3R (uniformly subsampled if exceeded, default: 20)"
    )
    args = parser.parse_args()

    run_dust3r(
        images_dir=args.images_dir,
        output_dir=args.output_dir,
        weights_path=args.weights,
        image_size=args.image_size,
        niter=args.niter,
        conf_thr=args.conf_thr,
        max_images=args.max_images,
    )


if __name__ == "__main__":
    main()

