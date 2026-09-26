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

# Paths
weights_path = os.path.join(SCRIPT_DIR, "checkpoints", "DUSt3R_ViTLarge_BaseDecoder_512_linear.pth")
images_dir = os.path.join(PROJECT_ROOT, "storage", "inputs", "test_frames")
output_dir = os.path.join(PROJECT_ROOT, "storage", "outputs", "recon_demo")

if not os.path.exists(weights_path):
    raise FileNotFoundError(f"Checkpoint not found at: {weights_path}")

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Loading DUSt3R weights on {device} from: {weights_path}")

# Load model in FP32 (DUSt3R internals expect FP32 weights for output heads)
model = load_model(weights_path, device=device)

# Load keyframes
image_files = sorted([
    os.path.join(images_dir, f)
    for f in os.listdir(images_dir)
    if f.lower().endswith(('.jpg', '.jpeg', '.png'))
])[:4]

if len(image_files) < 2:
    raise ValueError(f"Please place at least 2 images inside {images_dir}")

print(f"Processing {len(image_files)} keyframes...")
images = load_images(image_files, size=512)

# Make sequential pairs for linear pass
pairs = make_pairs(images, scene_graph='linear', symmetrize=True)

# Explicit fallback if make_pairs returns 0 pairs
if not pairs or len(pairs) == 0:
    print("make_pairs returned empty list; constructing linear pair list manually...")
    pairs = []
    for i in range(len(images) - 1):
        pairs.append((images[i], images[i+1]))
        pairs.append((images[i+1], images[i]))

print(f"Generated {len(pairs)} image pairs for inference.")

# Pairwise inference
print("Running pairwise prediction...")
with torch.no_grad():
    output = inference(pairs, model, device=device, batch_size=1)

# Global alignment
print("Solving global scene alignment...")
scene = global_aligner(output, device=device, mode=GlobalAlignerMode.PointCloudOptimizer)
loss = scene.compute_global_alignment(init='mst', niter=300, schedule='cosine')

# Set confidence threshold to filter out low-confidence background points
scene.min_conf_thr = 3.0

# Extract point arrays, RGB images, and confidence masks correctly
pts3d = scene.get_pts3d()  # list of (H, W, 3) point tensors
masks = scene.get_masks()  # list of (H, W) confidence boolean tensors
imgs = scene.imgs          # list of original RGB image tensors or arrays

valid_pts = []
valid_colors = []

for p, c, m in zip(pts3d, imgs, masks):
    # Convert PyTorch tensors to NumPy arrays if necessary
    p_np = p.detach().cpu().numpy() if isinstance(p, torch.Tensor) else p
    m_np = m.detach().cpu().numpy() if isinstance(m, torch.Tensor) else m
    c_np = c.detach().cpu().numpy() if isinstance(c, torch.Tensor) else c
    
    # Flatten arrays to filter by mask
    m_flat = m_np.flatten()
    p_flat = p_np.reshape(-1, 3)[m_flat]
    c_flat = c_np.reshape(-1, 3)[m_flat]
    
    valid_pts.append(p_flat)
    valid_colors.append(c_flat)

all_pts = np.vstack(valid_pts)
all_colors = np.vstack(valid_colors)

# Normalize color range to uint8 [0, 255] if normalized to [0, 1]
if all_colors.max() <= 1.0:
    all_colors = (all_colors * 255).astype(np.uint8)

# Export outputs
os.makedirs(output_dir, exist_ok=True)
ply_path = os.path.join(output_dir, "model.ply")
glb_path = os.path.join(output_dir, "model.glb")

pcd = trimesh.PointCloud(vertices=all_pts, colors=all_colors)
pcd.export(ply_path)
pcd.export(glb_path)

print("\nReconstruction Complete!")
print(f"Total valid 3D points generated: {len(all_pts):,}")
print(f"Saved PLY: {ply_path}")
print(f"Saved GLB: {glb_path}")
