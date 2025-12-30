"""
AI Semantic Engine - Main Application
FastAPI service for email classification
"""
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

from config import get_settings
from models import (
    AnalyzeRequest, AnalyzeResponse, 
    HealthResponse, FeedbackRequest
)
from classifier import get_classifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUESTS_TOTAL = Counter(
    'ai_engine_requests_total',
    'Total requests',
    ['endpoint', 'status']
)
CLASSIFICATION_HISTOGRAM = Histogram(
    'ai_engine_classification_duration_seconds',
    'Classification duration',
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)
CLASSIFICATION_LABELS = Counter(
    'ai_engine_classification_labels_total',
    'Classification results by label',
    ['label']
)

# Application startup time
start_time = time.time()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    classifier = get_classifier()
    logger.info(f"Classifier loaded: {classifier.model_version}")
    yield
    # Shutdown
    logger.info("Shutting down AI Engine")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-powered email classification for phishing and spam detection",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint"""
    classifier = get_classifier()
    return HealthResponse(
        status="healthy",
        model_loaded=classifier.model_loaded,
        version=settings.app_version,
        uptime_seconds=round(time.time() - start_time, 2)
    )


@app.get("/metrics", tags=["System"])
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


@app.post("/analyze", response_model=AnalyzeResponse, tags=["Classification"])
async def analyze_email(request: AnalyzeRequest):
    """
    Analyze email content for phishing, spam, and fraud detection.
    
    This endpoint is called by Rspamd via Lua module.
    """
    try:
        with CLASSIFICATION_HISTOGRAM.time():
            classifier = get_classifier()
            
            result = classifier.classify(
                subject=request.subject,
                body=request.body,
                urls=request.urls,
                pdf_text=request.pdf_text,
                headers=request.headers.model_dump() if request.headers else None
            )
        
        # Update metrics
        REQUESTS_TOTAL.labels(endpoint="/analyze", status="success").inc()
        CLASSIFICATION_LABELS.labels(label=result["label"].value).inc()
        
        logger.info(
            f"Classification: {result['label'].value} "
            f"(confidence={result['confidence']:.2f}, score={result['score']:.1f})"
        )
        
        return AnalyzeResponse(**result)
        
    except Exception as e:
        REQUESTS_TOTAL.labels(endpoint="/analyze", status="error").inc()
        logger.error(f"Classification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback", tags=["Training"])
async def submit_feedback(request: FeedbackRequest):
    """
    Submit feedback for model improvement.
    
    This data is stored for future model retraining.
    """
    logger.info(
        f"Feedback received: email={request.email_id}, "
        f"original={request.original_label.value}, "
        f"correct={request.correct_label.value}"
    )
    
    # TODO: Store feedback in database for training pipeline
    
    return {
        "status": "received",
        "message": "Feedback recorded for model improvement"
    }


@app.get("/", tags=["System"])
async def root():
    """Root endpoint with service info"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "endpoints": {
            "analyze": "POST /analyze",
            "health": "GET /health",
            "metrics": "GET /metrics",
            "feedback": "POST /feedback"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
