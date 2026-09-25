from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "AERO3D Preprocessing Engine"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # CORS settings
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Storage paths
    BASE_DIR: Path = Path(__file__).parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "storage" / "uploads"
    KEYFRAME_DIR: Path = BASE_DIR / "storage" / "keyframes"
    
    # Blur detection threshold
    BLUR_THRESHOLD: float = 100.0
    
    # Adaptive sampling thresholds (speed in m/s)
    HIGH_SPEED_THRESHOLD: float = 10.0
    LOW_SPEED_THRESHOLD: float = 2.0
    HIGH_SPEED_FPS: int = 5
    LOW_SPEED_FPS: int = 1
    DEFAULT_FPS: int = 2
    
    # Allowed file extensions
    ALLOWED_VIDEO_EXTENSIONS: set[str] = {".mp4", ".mov"}
    ALLOWED_TELEMETRY_EXTENSIONS: set[str] = {".srt", ".json"}
    
    # Maximum upload size (in bytes, 500MB)
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
