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
import math
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailClassifier:
    """
    Email classifier using heuristics and pattern matching.
    Can be extended to use ML models (DistilBERT, RoBERTa, etc.)
    """
    
    def __init__(self):
        self.model_version = "2.0.0-enhanced"
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
        
        # Portuguese/Brazil specific patterns
        self.pt_government_keywords = [
            r'gov\.br', r'receita\s+federal', r't[iy]tulo\s+eleitoral',
            r'cpf', r'cnpj', r'serasa', r'bacen', r'banco\s+central'
        ]

        self.pt_urgency_patterns = [
            r'bloqueio\s+(imediato|de\s+cpf|de\s+chave\s+pix|de\s+conta)',
            r'evite\s+a\s+suspens[ãa]o',
            r'cpf\s+irregular',
            r'com\s+restri[çc][ãa]o',
            r'regularize\s+agora',
            r'notifica[çc][ãa]o\s+extrajudicial',
            r'a\s+qualquer\s+momento',
            r'cancelamento\s+definitivo'
        ]
        
        # Vague/short subject patterns (HIGH spam indicator - v2.0)
        self.vague_subject_patterns = [
            r'^your\s+document$',
            r'^your\s+file$',
            r'^your\s+invoice$',
            r'^your\s+order$',
            r'^your\s+package$',
            r'^your\s+receipt$',
            r'^shared\s+document$',
            r'^shared\s+file$',
            r'^document\s+shared$',
            r'^action\s+required$',
            r'^urgent$',
            r'^important$',
            r'^notification$',
            r'^fwd:\s*$',
            r'^re:\s*$',
            r'^attached$',
            r'^see\s+attached$',
            r'^please\s+review$',
            r'^for\s+your\s+review$'
        ]
        
        # Suspicious TLDs commonly used for spam/phishing
        self.suspicious_tlds = [
            '.cfd', '.shop', '.xyz', '.top', '.click', '.link', 
            '.pw', '.tk', '.ml', '.ga', '.cf', '.gq', '.site', 
            '.online', '.store', '.buzz', '.work', '.icu'
        ]
        
        # Mass-mailing sender patterns
        self.mass_mail_patterns = [
            r'^[a-z]+@[a-z]{2,5}\.[a-z]{2,3}$',  # Generic: jenny@gsd.com
            r'@relatorios\d+[a-z]\.',  # Campaign pattern: relatorios01a
            r'^no-?reply\d+@',
            r'^info\d+@',
            r'^admin\d+@',
            r'@.*\d{5,}.*\.'  # Domain with many numbers
        ]
    
    def _calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of a string"""
        if not text:
            return 0.0
        entropy = 0
        for x in range(256):
            p_x = float(text.count(chr(x))) / len(text)
            if p_x > 0:
                entropy += - p_x * math.log(p_x, 2)
        return entropy

    def _check_sender_anomalies(self, headers: dict) -> tuple[float, list[str]]:
        """Check for anomalies in sender address like high digit count or simple alphanumeric patterns"""
        score = 0.0
        reasons = []
        if not headers or not headers.get('from_address'):
            return score, reasons

        from_addr = headers.get('from_address', '').lower()
        # Extract email part if format is "Name <email>"
        email_match = re.search(r'<([^>]+)>', from_addr)
        email = email_match.group(1) if email_match else from_addr
        email = email.strip('<> ')

        if '@' not in email:
            return score, reasons

        local_part, domain = email.split('@', 1)

        # Check for excessive digits in local part (e.g., no-reply98234)
        digit_count = sum(c.isdigit() for c in local_part)
        if len(local_part) > 0:
            digit_ratio = digit_count / len(local_part)
            if digit_count > 4 or digit_ratio > 0.4:
                score += 0.35
                reasons.append(f"Sender local-part has high digit count ({digit_count})")
        
        # Check subdomains in domain part
        domain_parts = domain.split('.')
        if len(domain_parts) > 3: # e.g. sub.domain.com.br is 4 parts, suspicious if random
             # Check entropy of the first subdomain
             subdomain = domain_parts[0]
             entropy = self._calculate_entropy(subdomain)
             if len(subdomain) > 5 and entropy > 3.5:
                 score += 0.3
                 reasons.append(f"Suspicious high-entropy subdomain: {subdomain}")

        return score, reasons
    
    def _check_vague_subject(self, subject: str) -> tuple[float, list[str]]:
        """Check for vague/generic subjects commonly used in spam/phishing"""
        score = 0.0
        reasons = []
        
        if not subject:
            return score, reasons
        
        subject_clean = subject.strip().lower()
        
        # Check against vague subject patterns
        for pattern in self.vague_subject_patterns:
            if re.search(pattern, subject_clean, re.IGNORECASE):
                score += 0.45  # High score for vague subjects
                reasons.append(f"Vague/generic subject detected: '{subject_clean}'")
                break
        
        # Additional: very short subject (<=15 chars) without RE:/FWD:
        if len(subject_clean) <= 15 and not subject_clean.startswith(('re:', 'fwd:', 'enc:')):
            score += 0.2
            reasons.append(f"Very short subject ({len(subject_clean)} chars)")
        
        return score, reasons
    
    def _check_suspicious_sender(self, headers: dict) -> tuple[float, list[str]]:
        """Check sender for suspicious patterns and TLDs"""
        score = 0.0
        reasons = []
        
        if not headers or not headers.get('from_address'):
            return score, reasons
        
        from_addr = headers.get('from_address', '').lower()
        # Extract email part if format is "Name <email>"
        email_match = re.search(r'<([^>]+)>', from_addr)
        email = email_match.group(1) if email_match else from_addr
        email = email.strip('<> ')
        
        if '@' not in email:
            return score, reasons
        
        local_part, domain = email.split('@', 1)
        
        # Check for suspicious TLDs
        for tld in self.suspicious_tlds:
            if domain.endswith(tld) or tld + '.' in domain:
                score += 0.4
                reasons.append(f"Suspicious TLD in sender domain: {tld}")
                break
        
        # Check mass-mailing patterns
        for pattern in self.mass_mail_patterns:
            if re.search(pattern, email, re.IGNORECASE):
                score += 0.35
                reasons.append(f"Mass-mailing sender pattern detected")
                break
        
        # Check for very short/generic domain (e.g., gsd.com)
        domain_base = domain.split('.')[0]
        if len(domain_base) <= 4 and domain_base.isalpha():
            score += 0.25
            reasons.append(f"Very short/generic domain: {domain}")
        
        return score, reasons
        

        
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
        
        suspicious_tlds = ['.xyz', '.top', '.click', '.link', '.pw', '.tk', '.ml', '.ga', '.shop', '.site', '.online', '.store']
        
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
            
            # Advanced: Check for IP usage (v4)
            # Regex captures http(s)://IP...
            if re.search(r'https?://(?:[0-9]{1,3}\.){3}[0-9]{1,3}', url_lower):
                 score += 0.5
                 reasons.append("URL uses raw IP address")

            # Advanced: Check subdomain entropy in URL
            try:
                parsed = urlparse(url)
                hostname = parsed.hostname or ""
                host_parts = hostname.split('.')
                # If many subdomains, check the first one
                if len(host_parts) > 2:
                    # Ignore www
                    target_sub = host_parts[0] if host_parts[0] != 'www' else (host_parts[1] if len(host_parts) > 3 else "")
                    if target_sub:
                        entropy = self._calculate_entropy(target_sub)
                        if len(target_sub) > 7 and entropy > 3.8:
                            score += 0.25
                            reasons.append(f"High entropy/random subdomain in URL: {target_sub}")
                
                # Check for HTTP (non-secure) on strange domains
                if parsed.scheme == 'http':
                     score += 0.1
                     reasons.append("Insecure HTTP protocol used")
            except Exception:
                pass # Fail silently on malformed URLs

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
        
        # Check Sender Anomalies (Numeric patterns, entropy)
        sender_score, sender_reasons = self._check_sender_anomalies(headers)
        phishing_score += sender_score
        reasons.extend(sender_reasons)

        # Check PT patterns
        pt_urgency_matches = self._check_patterns(full_text, self.pt_urgency_patterns)
        if pt_urgency_matches:
            phishing_score += 0.35
            reasons.append(f"PT Urgency language detected ({len(pt_urgency_matches)} patterns)")
        
        # NEW v2.0: Check vague/generic subject
        vague_score, vague_reasons = self._check_vague_subject(subject)
        phishing_score += vague_score
        reasons.extend(vague_reasons)
        
        # NEW v2.0: Check suspicious sender patterns and TLDs
        susp_sender_score, susp_sender_reasons = self._check_suspicious_sender(headers)
        phishing_score += susp_sender_score
        reasons.extend(susp_sender_reasons)

        # Check Government impersonation
        gov_matches = self._check_patterns(full_text, self.pt_government_keywords)
        if gov_matches:
             # Check if sender is NOT .gov.br
             if headers and headers.get('from_address'):
                 from_addr = headers['from_address'].lower()
                 if 'gov.br' not in from_addr:
                      phishing_score += 0.4
                      reasons.append("Government keywords found but sender is not gov.br")
        
        # Check for PDF with external links (high risk)
        if pdf_text and urls:
            phishing_score += 0.2
            reasons.append("PDF contains external URLs")
        
        # Check spam patterns
        spam_matches = self._check_patterns(full_text, self.spam_patterns)
        if spam_matches:
            spam_score += min(0.5, len(spam_matches) * 0.15)
        
        # Determine classification - v2.0: Lowered thresholds for better detection
        phishing_score = min(phishing_score, 1.0)
        spam_score = min(spam_score, 1.0)
        
        if phishing_score >= 0.5:  # Lowered from 0.6
            label = ClassificationLabel.PHISHING
            confidence = phishing_score
            rspamd_score = confidence * settings.phishing_score_weight
        elif phishing_score >= 0.35:  # Lowered from 0.4
            label = ClassificationLabel.FRAUD
            confidence = phishing_score
            rspamd_score = confidence * settings.fraud_score_weight
        elif spam_score >= 0.4:  # Lowered from 0.5
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
