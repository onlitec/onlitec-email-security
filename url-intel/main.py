"""
URL Intelligence Service - Main Application
FastAPI service for URL analysis without blacklists
"""
import re
import time
import math
import logging
from typing import Optional
from urllib.parse import urlparse, unquote
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
import httpx
import tldextract

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REQUESTS_TOTAL = Counter('url_intel_requests_total', 'Total requests', ['endpoint', 'status'])
ANALYSIS_HISTOGRAM = Histogram('url_intel_duration_seconds', 'Analysis duration')

start_time = time.time()

# Suspicious TLDs
SUSPICIOUS_TLDS = {
    'xyz', 'top', 'click', 'link', 'pw', 'tk', 'ml', 'ga', 'cf', 'gq',
    'work', 'party', 'review', 'country', 'stream', 'download', 'racing',
    'win', 'bid', 'date', 'faith', 'loan', 'men', 'cricket', 'science'
}

# Legitimate well-known domains (basic list)
KNOWN_SAFE_DOMAINS = {
    'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'facebook.com',
    'twitter.com', 'linkedin.com', 'github.com', 'youtube.com', 'instagram.com',
    'gov.br', 'gov.com', 'edu', 'edu.br'
}


class AnalyzeRequest(BaseModel):
    """Request model for URL analysis"""
    url: str = Field(..., description="URL to analyze")
    follow_redirects: bool = Field(False, description="Follow redirects to final URL")


class AnalyzeBatchRequest(BaseModel):
    """Request model for batch URL analysis"""
    urls: list[str] = Field(..., description="List of URLs to analyze")
    follow_redirects: bool = Field(False, description="Follow redirects")


class AnalyzeResponse(BaseModel):
    """Response model for URL analysis"""
    url: str = Field(..., description="Original URL")
    final_url: Optional[str] = Field(None, description="Final URL after redirects")
    domain_age_days: Optional[int] = Field(None, description="Domain age in days")
    risk: str = Field(..., description="Risk level: low, medium, high, critical")
    score: float = Field(..., ge=0.0, description="Risk score (0-15)")
    reasons: list[str] = Field(default=[], description="Risk indicators")
    domain: str = Field(..., description="Extracted domain")
    tld: str = Field(..., description="Top-level domain")
    has_ip: bool = Field(..., description="URL uses IP address instead of domain")
    is_encoded: bool = Field(..., description="URL contains encoded characters")
    is_shortened: bool = Field(..., description="URL is from URL shortener")
    redirect_count: int = Field(0, description="Number of redirects")
    processing_time_ms: float = Field(..., description="Processing time in ms")


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting URL Intelligence Service")
    yield
    logger.info("Shutting down URL Intelligence Service")


app = FastAPI(
    title="URL Intelligence Service",
    version="1.0.0",
    description="Heuristic-based URL analysis without blacklists",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# URL shortener domains
URL_SHORTENERS = {
    'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly',
    'adf.ly', 'j.mp', 'tr.im', 'cli.gs', 'short.to', 'budurl.com', 'ping.fm',
    'post.ly', 'just.as', 'bkite.com', 'snipr.com', 'fic.kr', 'loopt.us',
    'su.pr', 'twurl.nl', 'snipurl.com', 'short.ie', 'kl.am', 'wp.me', 'u.nu',
    'rubyurl.com', 'om.ly', 'to.ly', 'bit.do', 'lnkd.in', 'db.tt', 'qr.ae',
    'cur.lv', 'ity.im', 'q.gs', 'po.st', 'bc.vc', 'twitthis.com', 'u.to',
    'j.gs', 'v.gd', 'tra.kz', 'rb.gy'
}


def calculate_entropy(s: str) -> float:
    """Calculate Shannon entropy of a string"""
    if not s:
        return 0.0
    
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    
    entropy = 0.0
    length = len(s)
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    
    return entropy



async def get_domain_age_days(domain: str) -> Optional[int]:
    """
    Get domain age in days using RDAP.
    Returns None if age cannot be determined.
    """
    rdap_url = f"https://rdap.org/domain/{domain}"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(rdap_url)
            if response.status_code == 200:
                data = response.json()
                events = data.get('events', [])
                creation_date_str = None
                
                for event in events:
                    if event.get('eventAction') == 'registration':
                        creation_date_str = event.get('eventDate')
                        break
                
                if not creation_date_str:
                    # Try to find 'last changed' if registration not available, though less accurate
                    for event in events:
                         if event.get('eventAction') == 'last changed':
                             creation_date_str = event.get('eventDate')
                             break

                if creation_date_str:
                    # Handle format "2024-01-01T12:00:00Z"
                    creation_date = datetime.fromisoformat(creation_date_str.replace('Z', '+00:00'))
                    age = datetime.now(timezone.utc) - creation_date
                    return max(0, age.days)
    except Exception as e:
        logger.warning(f"RDAP lookup failed for {domain}: {e}")
    
    return None

def is_suspicious_homograph(domain: str) -> bool:
    """
    Check for IDN homograph attacks (mixed scripts).
    """
    try:
        # If domain matches existing lookalikes regex, it's already caught.
        # Here we check for mixed scripts (e.g. Cyrillic 'a' in Latin domain)
        
        # Convert to punycode
        encoded = domain.encode('idna').decode('ascii')
        
        # If it starts with xn-- it's an IDN
        if domain.startswith('xn--') or 'xn--' in domain:
            return True # Treat all IDNs as suspicious for this context unless whitelisted
            
    except Exception:
        pass
    return False

async def analyze_url_heuristic(url: str) -> dict:
    """Analyze URL using heuristics AND external RDAP"""
    start = time.time()
    
    result = {
        "url": url,
        "final_url": None,
        "risk": "low",
        "score": 0.0,
        "reasons": [],
        "domain": "",
        "tld": "",
        "has_ip": False,
        "is_encoded": False,
        "is_shortened": False,
        "redirect_count": 0,
        "domain_age_days": None
    }
    
    try:
        parsed = urlparse(url)
        extracted = tldextract.extract(url)
        
        domain_str = f"{extracted.domain}.{extracted.suffix}" if extracted.suffix else extracted.domain
        result["domain"] = domain_str
        result["tld"] = extracted.suffix
        
        # Check for IP address
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if re.match(ip_pattern, parsed.netloc.split(':')[0]):
            result["has_ip"] = True
            result["score"] += 5.0
            result["reasons"].append("Uses IP address instead of domain")
        
        # Check suspicious TLD
        if extracted.suffix.lower() in SUSPICIOUS_TLDS:
            result["score"] += 3.0
            result["reasons"].append(f"Suspicious TLD: .{extracted.suffix}")
        
        # Check URL shortener
        full_domain = domain_str.lower()
        if full_domain in URL_SHORTENERS:
            result["is_shortened"] = True
            result["score"] += 2.0
            result["reasons"].append("URL shortener detected")
        
        # Check for encoding
        decoded = unquote(url)
        if decoded != url:
            result["is_encoded"] = True
            encoded_count = url.count('%')
            if encoded_count > 3:
                result["score"] += 2.0
                result["reasons"].append(f"Excessive URL encoding ({encoded_count} encoded chars)")
        
        # Check URL length
        if len(url) > 100:
            result["score"] += 1.0
            result["reasons"].append("Unusually long URL")
        
        if len(url) > 200:
            result["score"] += 2.0
            result["reasons"].append("Extremely long URL")
        
        # Check subdomain depth
        if extracted.subdomain:
            subdomain_depth = extracted.subdomain.count('.') + 1
            if subdomain_depth > 2:
                result["score"] += 2.0
                result["reasons"].append(f"Deep subdomain nesting ({subdomain_depth} levels)")
        
        # Check for suspicious keywords in path
        suspicious_path_keywords = [
            'login', 'signin', 'verify', 'secure', 'account', 'update',
            'confirm', 'banking', 'password', 'credential', 'auth'
        ]
        path_lower = parsed.path.lower()
        for keyword in suspicious_path_keywords:
            if keyword in path_lower:
                result["score"] += 1.5
                result["reasons"].append(f"Suspicious path keyword: {keyword}")
                break
        
        # Check domain entropy (high entropy = likely random/malicious)
        domain_entropy = calculate_entropy(extracted.domain)
        if domain_entropy > 4.0:
            result["score"] += 2.0
            result["reasons"].append(f"High domain entropy: {domain_entropy:.2f}")
        
        # Check for homograph/lookalike domains
        lookalike_patterns = [
            (r'paypa[l1]', 'PayPal lookalike'),
            (r'amaz[0o]n', 'Amazon lookalike'),
            (r'g[0o]{2}gle', 'Google lookalike'),
            (r'micr[0o]s[0o]ft', 'Microsoft lookalike'),
            (r'app[l1]e', 'Apple lookalike'),
            (r'faceb[0o]{2}k', 'Facebook lookalike'),
        ]
        
        found_lookalike = False
        for pattern, description in lookalike_patterns:
            if re.search(pattern, extracted.domain.lower()):
                result["score"] += 5.0
                result["reasons"].append(f"Possible {description}")
                found_lookalike = True
                break
        
        if not found_lookalike and is_suspicious_homograph(full_domain):
             result["score"] += 4.0
             result["reasons"].append("Suspicious IDN/Homograph (punycode)")

        # Check for double extension attacks
        if re.search(r'\.(pdf|doc|xls|exe|zip)\.[a-z]{2,4}$', parsed.path.lower()):
            result["score"] += 4.0
            result["reasons"].append("Double file extension detected")
            
        # Check Domain Age (Async)
        if not result["has_ip"]:
            age_days = await get_domain_age_days(full_domain)
            result["domain_age_days"] = age_days
            if age_days is not None:
                if age_days < 30:
                    result["score"] += 5.0
                    result["reasons"].append(f"New domain (< 30 days): {age_days} days old")
                elif age_days < 90:
                    result["score"] += 2.0
                    result["reasons"].append(f"Recent domain (< 90 days): {age_days} days old")
        
    except Exception as e:
        logger.error(f"URL analysis error: {e}")
        result["reasons"].append(f"Analysis error: {str(e)}")
        result["score"] += 3.0
    
    # Determine risk level
    result["score"] = min(result["score"], 15.0)
    
    if result["score"] >= 10:
        result["risk"] = "critical"
    elif result["score"] >= 6:
        result["risk"] = "high"
    elif result["score"] >= 3:
        result["risk"] = "medium"
    else:
        result["risk"] = "low"
    
    result["processing_time_ms"] = round((time.time() - start) * 1000, 2)
    
    return result


async def follow_url_redirects(url: str, max_redirects: int = 5) -> tuple[str, int]:
    """Follow URL redirects and return final URL"""
    redirect_count = 0
    current_url = url
    
    async with httpx.AsyncClient(follow_redirects=False, timeout=5.0) as client:
        for _ in range(max_redirects):
            try:
                response = await client.head(current_url, follow_redirects=False)
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get('location')
                    if location:
                        current_url = location
                        redirect_count += 1
                    else:
                        break
                else:
                    break
            except Exception:
                break
    
    return current_url, redirect_count


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
async def analyze_url(request: AnalyzeRequest):
    """Analyze single URL for security risks"""
    try:
        with ANALYSIS_HISTOGRAM.time():
            # Await the async heuristic analysis (now includes network call)
            result = await analyze_url_heuristic(request.url)
            
            if request.follow_redirects:
                final_url, redirect_count = await follow_url_redirects(request.url)
                result["final_url"] = final_url
                result["redirect_count"] = redirect_count
                
                if redirect_count > 2:
                    result["score"] = min(result["score"] + 2.0, 15.0)
                    result["reasons"].append(f"Multiple redirects: {redirect_count}")
        
        REQUESTS_TOTAL.labels(endpoint="/analyze", status="success").inc()
        
        logger.info(f"URL analyzed: {request.url[:50]}... risk={result['risk']} score={result['score']:.1f}")
        
        return AnalyzeResponse(**result)
        
    except Exception as e:
        REQUESTS_TOTAL.labels(endpoint="/analyze", status="error").inc()
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/batch", tags=["Analysis"])
async def analyze_urls_batch(request: AnalyzeBatchRequest):
    """Analyze multiple URLs"""
    results = []
    # Process sequentially for now to avoid rate limits
    for url in request.urls[:20]:  # Limit to 20 URLs
        result = await analyze_url_heuristic(url)
        results.append(result)
    
    return {
        "results": results,
        "total": len(results)
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "service": "URL Intelligence",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "POST /analyze",
            "batch": "POST /analyze/batch",
            "health": "GET /health",
            "metrics": "GET /metrics"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

