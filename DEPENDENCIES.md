# AERO3D Dependencies & Setup Guide

## System Requirements
- Node.js v20+
- Python 3.10+
- C++ Build Tools (Visual Studio 2022 on Windows, GCC on Linux)
- CUDA 11.8+ (for PyTorch GPU acceleration)

## Frontend Dependencies (Locked)
- next (14.2.0)
- react (18.3.0)
- react-dom (18.3.0)
- cesium (1.116.0)
- resium (1.17.0)
- lucide-react (0.368.0)
- tailwindcss (3.4.1)
- clsx (2.1.0)
- tailwind-merge (2.2.2)

## Backend Dependencies (Upcoming)
- python=3.10
- torch, torchvision (CUDA enabled)
- opencv-python
- fastapi, uvicorn

## Setup Instructions
### Windows (PowerShell)
1. Ensure Node.js v20+ is installed.
2. Run the automated setup script from the project root:
   `.\setup_env.ps1`
3. Start the dev server:
   `npm run dev`

### Linux / macOS
1. Ensure Node.js v20+ is installed.
2. Clean cache and install dependencies:
   `npm cache clean --force`
   `npm ci` (or `npm install`)
3. Start the dev server:
   `npm run dev`
