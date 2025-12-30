"""
PDF Analyzer Service - Main Application
FastAPI service for PDF content extraction and analysis
"""
import io
import re
import time
import base64
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

import fitz  # PyMuPDF

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUESTS_TOTAL = Counter('pdf_analyzer_requests_total', 'Total requests', ['endpoint', 'status'])
ANALYSIS_HISTOGRAM = Histogram('pdf_analyzer_duration_seconds', 'Analysis duration')

start_time = time.time()


class AnalyzeRequest(BaseModel):
    """Request model for PDF analysis"""
    pdf_base64: str = Field(..., description="Base64 encoded PDF content")
    filename: Optional[str] = Field(None, description="Original filename")


class AnalyzeResponse(BaseModel):
    """Response model for PDF analysis"""
    has_links: bool = Field(..., description="PDF contains external URLs")
    has_js: bool = Field(..., description="PDF contains JavaScript")
    has_actions: bool = Field(..., description="PDF contains OpenAction/URI actions")
    has_embedded_files: bool = Field(..., description="PDF contains embedded files")
    is_encrypted: bool = Field(..., description="PDF is encrypted/password protected")
    risk_score: float = Field(..., ge=0.0, description="Risk score (0-20)")
    text: str = Field(..., description="Extracted text content")
    urls: list[str] = Field(default=[], description="Extracted URLs")
    page_count: int = Field(..., description="Number of pages")
    reasons: list[str] = Field(default=[], description="Risk indicators")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting PDF Analyzer Service")
    yield
    logger.info("Shutting down PDF Analyzer Service")


app = FastAPI(
    title="PDF Analyzer Service",
    version="1.0.0",
    description="PDF content extraction and security analysis",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_urls(text: str) -> list[str]:
    """Extract URLs from text"""
    url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    urls = re.findall(url_pattern, text)
    return list(set(urls))


def analyze_pdf_content(pdf_bytes: bytes) -> dict:
    """Analyze PDF content for security risks"""
    start = time.time()
    
    result = {
        "has_links": False,
        "has_js": False,
        "has_actions": False,
        "has_embedded_files": False,
        "is_encrypted": False,
        "risk_score": 0.0,
        "text": "",
        "urls": [],
        "page_count": 0,
        "reasons": []
    }
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        result["page_count"] = len(doc)
        result["is_encrypted"] = doc.is_encrypted
        
        if doc.is_encrypted:
            result["risk_score"] += 3.0
            result["reasons"].append("PDF is encrypted")
        
        # Extract text from all pages
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        
        full_text = "\n".join(text_parts)
        result["text"] = full_text[:10000]  # Limit text length
        
        # Extract URLs from text
        urls = extract_urls(full_text)
        result["urls"] = urls[:50]  # Limit URLs
        
        if urls:
            result["has_links"] = True
            result["risk_score"] += min(5.0, len(urls) * 0.5)
            result["reasons"].append(f"Contains {len(urls)} external URLs")
        
        # Check for JavaScript
        for i in range(len(doc)):
            page = doc[i]
            # Check page annotations for JavaScript actions
            for annot in page.annots() or []:
                if annot.info.get("name") == "JavaScript":
                    result["has_js"] = True
                    result["risk_score"] += 8.0
                    result["reasons"].append("Contains JavaScript")
                    break
            if result["has_js"]:
                break
        
        # Check for embedded files
        if doc.embfile_count() > 0:
            result["has_embedded_files"] = True
            result["risk_score"] += 5.0
            result["reasons"].append(f"Contains {doc.embfile_count()} embedded files")
        
        # Check PDF metadata for OpenAction
        metadata = doc.metadata
        if metadata:
            for key, value in metadata.items():
                if value and "javascript" in str(value).lower():
                    result["has_js"] = True
                    result["risk_score"] += 5.0
                    result["reasons"].append("Metadata contains JavaScript reference")
        
        # Check for form actions
        for page in doc:
            links = page.get_links()
            for link in links:
                if link.get("kind") == fitz.LINK_URI:
                    result["has_actions"] = True
                    uri = link.get("uri", "")
                    if uri and uri not in result["urls"]:
                        result["urls"].append(uri)
        
        if result["has_actions"]:
            result["reasons"].append("Contains URI actions")
            result["risk_score"] += 2.0
        
        doc.close()
        
    except Exception as e:
        logger.error(f"PDF analysis error: {e}")
        result["reasons"].append(f"Analysis error: {str(e)}")
        result["risk_score"] += 5.0
    
    result["risk_score"] = min(result["risk_score"], 20.0)
    result["processing_time_ms"] = round((time.time() - start) * 1000, 2)
    
    return result


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        uptime_seconds=round(time.time() - start_time, 2)
    )


@app.get("/metrics", tags=["System"])
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/analyze", response_model=AnalyzeResponse, tags=["Analysis"])
async def analyze_pdf(request: AnalyzeRequest):
    """
    Analyze PDF content for security risks.
    
    Accepts base64 encoded PDF and returns risk analysis.
    """
    try:
        with ANALYSIS_HISTOGRAM.time():
            pdf_bytes = base64.b64decode(request.pdf_base64)
            result = analyze_pdf_content(pdf_bytes)
        
        REQUESTS_TOTAL.labels(endpoint="/analyze", status="success").inc()
        
        logger.info(
            f"PDF analyzed: pages={result['page_count']}, "
            f"urls={len(result['urls'])}, score={result['risk_score']:.1f}"
        )
        
        return AnalyzeResponse(**result)
        
    except Exception as e:
        REQUESTS_TOTAL.labels(endpoint="/analyze", status="error").inc()
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/upload", response_model=AnalyzeResponse, tags=["Analysis"])
async def analyze_pdf_upload(file: UploadFile = File(...)):
    """
    Analyze uploaded PDF file for security risks.
    """
    try:
        with ANALYSIS_HISTOGRAM.time():
            pdf_bytes = await file.read()
            result = analyze_pdf_content(pdf_bytes)
        
        REQUESTS_TOTAL.labels(endpoint="/analyze/upload", status="success").inc()
        return AnalyzeResponse(**result)
        
    except Exception as e:
        REQUESTS_TOTAL.labels(endpoint="/analyze/upload", status="error").inc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", tags=["System"])
async def root():
    return {
        "service": "PDF Analyzer",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "POST /analyze (base64 PDF)",
            "analyze_upload": "POST /analyze/upload (file upload)",
            "health": "GET /health",
            "metrics": "GET /metrics"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
