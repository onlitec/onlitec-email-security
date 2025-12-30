"""
AI Semantic Engine - Classifier Module
Handles email classification using NLP models
"""
import re
import time
import logging
from typing import Optional
from config import get_settings
from models import ClassificationLabel

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailClassifier:
    """
    Email classifier using heuristics and pattern matching.
    Can be extended to use ML models (DistilBERT, RoBERTa, etc.)
    """
    
    def __init__(self):
        self.model_version = "1.0.0-heuristic"
        self.model_loaded = True
        
        # Phishing indicators
        self.urgency_patterns = [
            r'\burgent\b', r'\bimmediately\b', r'\bsuspended\b',
            r'\bverify\b.*\baccount\b', r'\bconfirm\b.*\bidentity\b',
            r'\baction\s+required\b', r'\bwithin\s+\d+\s+hours?\b',
            r'\baccount\s+will\s+be\s+(closed|suspended|terminated)\b',
            r'\bfinal\s+warning\b', r'\blast\s+chance\b'
        ]
        
        self.brand_impersonation_keywords = [
            'paypal', 'amazon', 'microsoft', 'apple', 'google',
            'netflix', 'bank', 'santander', 'bradesco', 'itau',
            'nubank', 'caixa', 'banco do brasil', 'support', 'security team'
        ]
        
        self.suspicious_phrases = [
            r'click\s+(here|below|the\s+link)',
            r'update\s+your\s+(payment|billing|account)',
            r'your\s+account\s+has\s+been\s+(compromised|hacked)',
            r'unusual\s+(activity|login|sign-in)',
            r'verify\s+your\s+identity',
            r'confirm\s+your\s+password',
            r'win\s+\$?\d+',
            r'you\s+have\s+won',
            r'lottery\s+winner',
            r'inheritance\s+from',
            r'nigerian\s+prince',
            r'transfer\s+\$?\d+\s*(million|thousand)?'
        ]
        
        # Spam indicators
        self.spam_patterns = [
            r'\bfree\b.*\b(offer|gift|trial)\b',
            r'\blimited\s+time\b',
            r'\bact\s+now\b',
            r'\bcongratulations\b',
            r'\bunsubscribe\b',
            r'\bclick\s+here\b',
            r'\bbuy\s+now\b',
            r'\bdiscount\b.*\b\d+%\b'
        ]
        
    def _normalize_text(self, text: str) -> str:
        """Normalize text for analysis"""
        if not text:
            return ""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.lower().strip()
    
    def _check_patterns(self, text: str, patterns: list) -> list[str]:
        """Check text against regex patterns"""
        matches = []
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                matches.append(pattern)
        return matches
    
    def _analyze_urls(self, urls: list[str]) -> tuple[float, list[str]]:
        """Analyze URLs for suspicious patterns"""
        score = 0.0
        reasons = []
        
        suspicious_tlds = ['.xyz', '.top', '.click', '.link', '.pw', '.tk', '.ml', '.ga']
        
        for url in urls:
            url_lower = url.lower()
            
            # Check for IP address in URL
            if re.search(r'https?://\d+\.\d+\.\d+\.\d+', url_lower):
                score += 0.3
                reasons.append("URL contains IP address instead of domain")
            
            # Check suspicious TLDs
            for tld in suspicious_tlds:
                if tld in url_lower:
                    score += 0.2
                    reasons.append(f"Suspicious TLD: {tld}")
                    break
            
            # Check for encoded characters
            if '%' in url and len(re.findall(r'%[0-9a-fA-F]{2}', url)) > 3:
                score += 0.2
                reasons.append("URL contains excessive encoding")
            
            # Check for login/signin in URL
            if any(word in url_lower for word in ['login', 'signin', 'verify', 'secure', 'account']):
                score += 0.15
                reasons.append("URL contains login-related keywords")
            
            # Check URL length (phishing URLs tend to be long)
            if len(url) > 100:
                score += 0.1
                reasons.append("Unusually long URL")
        
        return min(score, 1.0), reasons
    
    def _check_header_mismatch(self, headers: Optional[dict]) -> tuple[float, list[str]]:
        """Check for suspicious header patterns"""
        score = 0.0
        reasons = []
        
        if not headers:
            return score, reasons
        
        from_addr = headers.get('from_address', '') or ''
        reply_to = headers.get('reply_to', '') or ''
        
        # Check From/Reply-To mismatch
        if from_addr and reply_to:
            from_domain = from_addr.split('@')[-1] if '@' in from_addr else ''
            reply_domain = reply_to.split('@')[-1] if '@' in reply_to else ''
            
            if from_domain and reply_domain and from_domain.lower() != reply_domain.lower():
                score += 0.3
                reasons.append(f"From/Reply-To domain mismatch: {from_domain} vs {reply_domain}")
        
        return score, reasons
    
    def classify(
        self,
        subject: str,
        body: str,
        urls: list[str] = None,
        pdf_text: str = None,
        headers: dict = None
    ) -> dict:
        """
        Classify email content
        
        Returns:
            dict with label, confidence, score, reasons
        """
        start_time = time.time()
        urls = urls or []
        
        # Combine text for analysis
        full_text = self._normalize_text(f"{subject} {body} {pdf_text or ''}")
        
        # Initialize scores
        phishing_score = 0.0
        spam_score = 0.0
        reasons = []
        
        # Check urgency patterns
        urgency_matches = self._check_patterns(full_text, self.urgency_patterns)
        if urgency_matches:
            phishing_score += 0.3
            reasons.append(f"Urgency language detected ({len(urgency_matches)} patterns)")
        
        # Check brand impersonation
        for brand in self.brand_impersonation_keywords:
            if brand in full_text:
                # Check if it looks like impersonation (not from official domain)
                if headers and headers.get('from_address'):
                    from_addr = headers['from_address'].lower()
                    if brand not in from_addr or any(susp in from_addr for susp in ['.xyz', '.top', '.click']):
                        phishing_score += 0.25
                        reasons.append(f"Possible brand impersonation: {brand}")
                        break
        
        # Check suspicious phrases
        suspicious_matches = self._check_patterns(full_text, self.suspicious_phrases)
        if suspicious_matches:
            phishing_score += min(0.3, len(suspicious_matches) * 0.1)
            reasons.append(f"Suspicious phrases detected ({len(suspicious_matches)} patterns)")
        
        # Analyze URLs
        url_score, url_reasons = self._analyze_urls(urls)
        phishing_score += url_score * 0.5
        reasons.extend(url_reasons)
        
        # Check header mismatches
        header_score, header_reasons = self._check_header_mismatch(headers)
        phishing_score += header_score
        reasons.extend(header_reasons)
        
        # Check for PDF with external links (high risk)
        if pdf_text and urls:
            phishing_score += 0.2
            reasons.append("PDF contains external URLs")
        
        # Check spam patterns
        spam_matches = self._check_patterns(full_text, self.spam_patterns)
        if spam_matches:
            spam_score += min(0.5, len(spam_matches) * 0.15)
        
        # Determine classification
        phishing_score = min(phishing_score, 1.0)
        spam_score = min(spam_score, 1.0)
        
        if phishing_score >= 0.6:
            label = ClassificationLabel.PHISHING
            confidence = phishing_score
            rspamd_score = confidence * settings.phishing_score_weight
        elif phishing_score >= 0.4:
            label = ClassificationLabel.FRAUD
            confidence = phishing_score
            rspamd_score = confidence * settings.fraud_score_weight
        elif spam_score >= 0.5:
            label = ClassificationLabel.SPAM
            confidence = spam_score
            rspamd_score = confidence * settings.spam_score_weight
        else:
            label = ClassificationLabel.LEGIT
            confidence = 1.0 - max(phishing_score, spam_score)
            rspamd_score = 0.0
            reasons = ["No suspicious patterns detected"]
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "label": label,
            "confidence": round(confidence, 3),
            "score": round(rspamd_score, 2),
            "reasons": reasons[:5],  # Limit to 5 reasons
            "processing_time_ms": round(processing_time, 2),
            "model_version": self.model_version
        }


# Global classifier instance
_classifier: Optional[EmailClassifier] = None


def get_classifier() -> EmailClassifier:
    """Get or create classifier instance"""
    global _classifier
    if _classifier is None:
        _classifier = EmailClassifier()
    return _classifier
