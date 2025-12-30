"""
AI Semantic Engine - Configuration
All configuration from environment variables
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings from environment variables"""
    
    # Application
    app_name: str = "AI Semantic Engine"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Model Configuration
    model_name: str = "distilbert-base-uncased"
    model_path: str = "/app/models"
    use_gpu: bool = False
    
    # Classification Labels
    labels: list[str] = ["legit", "spam", "phishing", "fraud"]
    
    # Thresholds
    confidence_threshold: float = 0.7
    phishing_score_weight: float = 15.0
    spam_score_weight: float = 8.0
    fraud_score_weight: float = 12.0
    
    # Performance
    max_text_length: int = 512
    batch_size: int = 1
    timeout_seconds: float = 2.0
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_prefix = "AI_ENGINE_"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
