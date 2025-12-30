/**
 * AI Semantic Engine - Node.js Version
 * Email classification for phishing/spam/fraud detection
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { register, Counter, Histogram } = require('prom-client');

const app = express();
const PORT = process.env.PORT || 8080;
const startTime = Date.now();

// Prometheus metrics
const requestsTotal = new Counter({
    name: 'ai_engine_requests_total',
    help: 'Total requests',
    labelNames: ['endpoint', 'status']
});

const classificationHistogram = new Histogram({
    name: 'ai_engine_classification_duration_seconds',
    help: 'Classification duration',
    buckets: [0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
});

// Middleware
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));

// Phishing detection patterns
const URGENCY_PATTERNS = [
    /\burgent\b/i, /\bimmediately\b/i, /\bsuspended\b/i,
    /\bverify\b.*\baccount\b/i, /\bconfirm\b.*\bidentity\b/i,
    /\baction\s+required\b/i, /\bwithin\s+\d+\s+hours?\b/i,
    /\baccount\s+will\s+be\s+(closed|suspended|terminated)\b/i,
    /\bfinal\s+warning\b/i, /\blast\s+chance\b/i
];

const SUSPICIOUS_PHRASES = [
    /click\s+(here|below|the\s+link)/i,
    /update\s+your\s+(payment|billing|account)/i,
    /your\s+account\s+has\s+been\s+(compromised|hacked)/i,
    /unusual\s+(activity|login|sign-in)/i,
    /verify\s+your\s+identity/i,
    /confirm\s+your\s+password/i,
    /win\s+\$?\d+/i,
    /you\s+have\s+won/i,
    /lottery\s+winner/i
];

const SUSPICIOUS_TLDS = ['.xyz', '.top', '.click', '.link', '.pw', '.tk', '.ml', '.ga'];

const BRAND_KEYWORDS = [
    'paypal', 'amazon', 'microsoft', 'apple', 'google',
    'netflix', 'bank', 'santander', 'bradesco', 'itau',
    'nubank', 'caixa', 'banco do brasil'
];

function normalizeText(text) {
    if (!text) return '';
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
}

function checkPatterns(text, patterns) {
    return patterns.filter(p => p.test(text));
}

function analyzeUrls(urls) {
    let score = 0;
    const reasons = [];

    for (const url of urls || []) {
        const urlLower = url.toLowerCase();

        // Check for IP address
        if (/https?:\/\/\d+\.\d+\.\d+\.\d+/.test(urlLower)) {
            score += 0.3;
            reasons.push('URL contains IP address');
        }

        // Check suspicious TLDs
        for (const tld of SUSPICIOUS_TLDS) {
            if (urlLower.includes(tld)) {
                score += 0.2;
                reasons.push(`Suspicious TLD: ${tld}`);
                break;
            }
        }

        // Check for encoded characters
        if (url.includes('%') && (url.match(/%[0-9a-fA-F]{2}/g) || []).length > 3) {
            score += 0.2;
            reasons.push('Excessive URL encoding');
        }

        // Check URL length
        if (url.length > 100) {
            score += 0.1;
            reasons.push('Unusually long URL');
        }
    }

    return { score: Math.min(score, 1.0), reasons };
}

function classifyEmail(subject, body, urls, pdfText, headers) {
    const start = Date.now();
    const fullText = normalizeText(`${subject} ${body} ${pdfText || ''}`);

    let phishingScore = 0;
    let spamScore = 0;
    const reasons = [];

    // Check urgency patterns
    const urgencyMatches = checkPatterns(fullText, URGENCY_PATTERNS);
    if (urgencyMatches.length > 0) {
        phishingScore += 0.3;
        reasons.push(`Urgency language detected (${urgencyMatches.length} patterns)`);
    }

    // Check suspicious phrases
    const suspiciousMatches = checkPatterns(fullText, SUSPICIOUS_PHRASES);
    if (suspiciousMatches.length > 0) {
        phishingScore += Math.min(0.3, suspiciousMatches.length * 0.1);
        reasons.push(`Suspicious phrases detected (${suspiciousMatches.length} patterns)`);
    }

    // Check brand impersonation
    for (const brand of BRAND_KEYWORDS) {
        if (fullText.includes(brand)) {
            const from = headers?.from || '';
            if (from && !from.includes(brand)) {
                phishingScore += 0.25;
                reasons.push(`Possible brand impersonation: ${brand}`);
                break;
            }
        }
    }

    // Analyze URLs
    const urlAnalysis = analyzeUrls(urls);
    phishingScore += urlAnalysis.score * 0.5;
    reasons.push(...urlAnalysis.reasons);

    // PDF with links is high risk
    if (pdfText && urls && urls.length > 0) {
        phishingScore += 0.2;
        reasons.push('PDF contains external URLs');
    }

    // Header mismatch
    if (headers?.from && headers?.reply_to) {
        const fromDomain = headers.from.split('@')[1] || '';
        const replyDomain = headers.reply_to.split('@')[1] || '';
        if (fromDomain && replyDomain && fromDomain.toLowerCase() !== replyDomain.toLowerCase()) {
            phishingScore += 0.3;
            reasons.push(`From/Reply-To mismatch: ${fromDomain} vs ${replyDomain}`);
        }
    }

    // Determine classification
    phishingScore = Math.min(phishingScore, 1.0);

    let label, confidence, rspamdScore;

    if (phishingScore >= 0.6) {
        label = 'phishing';
        confidence = phishingScore;
        rspamdScore = confidence * 15.0;
    } else if (phishingScore >= 0.4) {
        label = 'fraud';
        confidence = phishingScore;
        rspamdScore = confidence * 12.0;
    } else if (spamScore >= 0.5) {
        label = 'spam';
        confidence = spamScore;
        rspamdScore = confidence * 8.0;
    } else {
        label = 'legit';
        confidence = 1.0 - phishingScore;
        rspamdScore = 0.0;
        reasons.length = 0;
        reasons.push('No suspicious patterns detected');
    }

    return {
        label,
        confidence: Math.round(confidence * 1000) / 1000,
        score: Math.round(rspamdScore * 100) / 100,
        reasons: reasons.slice(0, 5),
        processing_time_ms: Date.now() - start,
        model_version: '1.0.0-heuristic'
    };
}

// Routes
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        model_loaded: true,
        version: '1.0.0',
        uptime_seconds: Math.round((Date.now() - startTime) / 1000)
    });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

app.post('/analyze', (req, res) => {
    const end = classificationHistogram.startTimer();

    try {
        const { subject, body, urls, pdf_text, headers } = req.body;

        const result = classifyEmail(
            subject || '',
            body || '',
            urls || [],
            pdf_text,
            headers
        );

        requestsTotal.inc({ endpoint: '/analyze', status: 'success' });
        end();

        console.log(`Classification: ${result.label} (conf=${result.confidence}, score=${result.score})`);

        res.json(result);
    } catch (error) {
        requestsTotal.inc({ endpoint: '/analyze', status: 'error' });
        end();
        res.status(500).json({ error: error.message });
    }
});

app.post('/feedback', (req, res) => {
    console.log('Feedback received:', req.body);
    res.json({ status: 'received', message: 'Feedback recorded' });
});

app.get('/', (req, res) => {
    res.json({
        service: 'AI Semantic Engine',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            analyze: 'POST /analyze',
            health: 'GET /health',
            metrics: 'GET /metrics',
            feedback: 'POST /feedback'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🧠 AI Semantic Engine running on port ${PORT}`);
});
