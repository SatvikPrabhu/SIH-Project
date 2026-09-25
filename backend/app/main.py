from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.api.v1.router import api_router

# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure storage directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.KEYFRAME_DIR.mkdir(parents=True, exist_ok=True)
(settings.BASE_DIR / "storage" / "reconstructions").mkdir(parents=True, exist_ok=True)
(settings.BASE_DIR / "storage" / "exports").mkdir(parents=True, exist_ok=True)

# Mount API v1 routes
app.include_router(api_router, prefix="/api/v1")

# Mount static file serving for keyframes
app.mount("/keyframes", StaticFiles(directory=str(settings.KEYFRAME_DIR)), name="keyframes")

# Mount static file serving for reconstructions (PLY files)
app.mount("/reconstructions", StaticFiles(directory=str(settings.BASE_DIR / "storage" / "reconstructions")), name="reconstructions")

# Mount static file serving for GIS exports (LAS, OBJ, GeoTIFF, 3D Tiles)
app.mount("/exports", StaticFiles(directory=str(settings.BASE_DIR / "storage" / "exports")), name="exports")


@app.get("/")
async def root():
    """Root endpoint with basic API information."""
    return {
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "endpoints": {
            "api": "/api/v1",
            "health": "/api/v1/health",
            "upload": "/api/v1/upload",
            "preprocess": "/api/v1/preprocess",
            "reconstruct": "/api/v1/reconstruct",
            "keyframes": "/keyframes",
            "reconstructions": "/reconstructions",
            "exports": "/exports"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
