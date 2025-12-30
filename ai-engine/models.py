"""
AI Semantic Engine - Data Models
Pydantic models for request/response validation
"""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class ClassificationLabel(str, Enum):
    """Email classification labels"""
    LEGIT = "legit"
    SPAM = "spam"
    PHISHING = "phishing"
    FRAUD = "fraud"


class EmailHeaders(BaseModel):
    """Relevant email headers"""
    from_address: Optional[str] = Field(None, alias="from")
    reply_to: Optional[str] = None
    return_path: Optional[str] = None
    x_mailer: Optional[str] = None
    
    class Config:
        populate_by_name = True


class AnalyzeRequest(BaseModel):
    """Request model for email analysis"""
    subject: str = Field(..., description="Email subject line")
    body: str = Field(..., description="Email body content (plain text or HTML)")
    urls: list[str] = Field(default=[], description="List of URLs found in email")
    pdf_text: Optional[str] = Field(None, description="Extracted text from PDF attachments")
    headers: Optional[EmailHeaders] = Field(None, description="Relevant email headers")
    tenant_id: Optional[str] = Field(None, description="Tenant identifier for multi-tenant")
    
    class Config:
        json_schema_extra = {
            "example": {
                "subject": "Urgent: Verify your account immediately",
                "body": "Dear customer, your account will be suspended. Click here to verify.",
                "urls": ["https://secure-bank-verify.com/login"],
                "pdf_text": None,
                "headers": {
                    "from": "support@bank-secure.com",
                    "reply_to": "noreply@random-domain.xyz"
                }
            }
        }


class AnalyzeResponse(BaseModel):
    """Response model for email analysis"""
    label: ClassificationLabel = Field(..., description="Classification result")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    score: float = Field(..., ge=0.0, description="Risk score for Rspamd integration")
    reasons: list[str] = Field(default=[], description="Human-readable explanations")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    model_version: str = Field(..., description="Model version used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "label": "phishing",
                "confidence": 0.94,
                "score": 17.5,
                "reasons": [
                    "Urgency language detected",
                    "Suspicious URL pattern",
                    "Brand impersonation attempt"
                ],
                "processing_time_ms": 145.2,
                "model_version": "1.0.0"
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    version: str
    uptime_seconds: float


class FeedbackRequest(BaseModel):
    """Feedback for model improvement"""
    email_id: str = Field(..., description="Unique email identifier")
    original_label: ClassificationLabel
    correct_label: ClassificationLabel
    user_notes: Optional[str] = None
    tenant_id: Optional[str] = None
