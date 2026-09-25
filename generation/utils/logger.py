"""
Pipeline Logging Utility
Provides structured, colored terminal output and persistent log file writing.
"""

import os
import sys
import time
import logging
from pathlib import Path
from contextlib import contextmanager

# ANSI Color codes for formatted terminal logs
class LogColors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

class ColoredFormatter(logging.Formatter):
    """Custom formatter with ANSI color coding based on log level."""
    
    LEVEL_COLORS = {
        logging.DEBUG: LogColors.DIM + LogColors.CYAN,
        logging.INFO: LogColors.GREEN,
        logging.WARNING: LogColors.YELLOW,
        logging.ERROR: LogColors.RED,
        logging.CRITICAL: LogColors.BOLD + LogColors.RED,
    }

    def format(self, record):
        color = self.LEVEL_COLORS.get(record.levelno, LogColors.WHITE)
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(record.created))
        level_name = f"{record.levelname:<7}"
        message = record.getMessage()
        
        # Colorize prefix
        formatted = f"{LogColors.DIM}[{timestamp}]{LogColors.RESET} {color}[{level_name}]{LogColors.RESET} {message}"
        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"
        return formatted

def setup_logger(name: str = "Geo3D-Pipeline", log_file: str = None, level: int = logging.INFO) -> logging.Logger:
    """
    Initializes and returns a configured logger instance.
    
    Args:
        name: Logger name identifier.
        log_file: Optional path to save log output to a file.
        level: Logging verbosity level (e.g. logging.INFO, logging.DEBUG).
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid adding duplicate handlers if setup is called multiple times
    if logger.handlers:
        return logger

    # Stream Handler (stdout)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(level)
    stream_handler.setFormatter(ColoredFormatter())
    logger.addHandler(stream_handler)

    # Optional File Handler
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(str(log_path), encoding="utf-8")
        file_handler.setLevel(level)
        file_formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)-7s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)

    return logger

@contextmanager
def PipelineTimer(step_name: str, logger: logging.Logger = None):
    """
    Context manager to log and track execution time of pipeline stages.
    """
    start_time = time.time()
    if logger:
        logger.info(f"{LogColors.BOLD}--- Starting: {step_name} ---{LogColors.RESET}")
    else:
        print(f"--- Starting: {step_name} ---")
    
    try:
        yield
    finally:
        elapsed = time.time() - start_time
        mins, secs = divmod(elapsed, 60)
        formatted_time = f"{int(mins)}m {secs:.2f}s" if mins > 0 else f"{secs:.2f}s"
        if logger:
            logger.info(f"{LogColors.BOLD}[OK] Completed: {step_name} in {formatted_time}{LogColors.RESET}\n")
        else:
            print(f"[OK] Completed: {step_name} in {formatted_time}\n")

