/**
 * URL Intelligence - Node.js Version
 * Heuristic URL analysis without blacklists
 */

const express = require('express');
const cors = require('cors');
const { register, Counter, Histogram } = require('prom-client');
const { parse } = require('tldts');

const app = express();
const PORT = process.env.PORT || 8080;
const startTime = Date.now();

// Metrics
const requestsTotal = new Counter({
    name: 'url_intel_requests_total',
    help: 'Total requests',
    labelNames: ['endpoint', 'status']
});

const analysisHistogram = new Histogram({
    name: 'url_intel_duration_seconds',
    help: 'Analysis duration'
});

app.use(cors());
app.use(express.json());

// Suspicious TLDs
const SUSPICIOUS_TLDS = new Set([
    'xyz', 'top', 'click', 'link', 'pw', 'tk', 'ml', 'ga', 'cf', 'gq',
    'work', 'party', 'review', 'stream', 'download', 'racing', 'win',
    'bid', 'date', 'faith', 'loan', 'men', 'cricket', 'science'
]);

// URL shorteners
const URL_SHORTENERS = new Set([
    'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly', 'is.gd', 'buff.ly',
    'adf.ly', 'j.mp', 'tr.im', 'short.to', 'wp.me', 'rb.gy', 'cutt.ly'
]);

function calculateEntropy(str) {
    if (!str) return 0;
    const freq = {};
    for (const c of str) {
        freq[c] = (freq[c] || 0) + 1;
    }
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
        const p = count / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

function analyzeUrl(url) {
    const start = Date.now();

    const result = {
        url,
        final_url: null,
        risk: 'low',
        score: 0,
        reasons: [],
        domain: '',
        tld: '',
        has_ip: false,
        is_encoded: false,
        is_shortened: false,
        redirect_count: 0
    };

    try {
        const urlObj = new URL(url);
        const parsed = parse(url);

        result.domain = parsed.domain || urlObj.hostname;
        result.tld = parsed.publicSuffix || '';

        // Check for IP address
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(urlObj.hostname)) {
            result.has_ip = true;
            result.score += 5;
            result.reasons.push('Uses IP address instead of domain');
        }

        // Check suspicious TLD
        if (SUSPICIOUS_TLDS.has(result.tld.toLowerCase())) {
            result.score += 3;
            result.reasons.push(`Suspicious TLD: .${result.tld}`);
        }

        // Check URL shortener
        const fullDomain = `${parsed.domain}.${parsed.publicSuffix}`.toLowerCase();
        if (URL_SHORTENERS.has(fullDomain)) {
            result.is_shortened = true;
            result.score += 2;
            result.reasons.push('URL shortener detected');
        }

        // Check for encoding
        const decoded = decodeURIComponent(url);
        if (decoded !== url) {
            result.is_encoded = true;
            const encodedCount = (url.match(/%[0-9a-fA-F]{2}/g) || []).length;
            if (encodedCount > 3) {
                result.score += 2;
                result.reasons.push(`Excessive URL encoding (${encodedCount} chars)`);
            }
        }

        // Check URL length
        if (url.length > 100) {
            result.score += 1;
            result.reasons.push('Unusually long URL');
        }
        if (url.length > 200) {
            result.score += 2;
            result.reasons.push('Extremely long URL');
        }

        // Check subdomain depth
        const subdomain = parsed.subdomain || '';
        const subdomainDepth = subdomain ? subdomain.split('.').length : 0;
        if (subdomainDepth > 2) {
            result.score += 2;
            result.reasons.push(`Deep subdomain nesting (${subdomainDepth} levels)`);
        }

        // Check for suspicious path keywords
        const suspiciousKeywords = ['login', 'signin', 'verify', 'secure', 'account', 'update', 'confirm', 'password'];
        const pathLower = urlObj.pathname.toLowerCase();
        for (const kw of suspiciousKeywords) {
            if (pathLower.includes(kw)) {
                result.score += 1.5;
                result.reasons.push(`Suspicious path keyword: ${kw}`);
                break;
            }
        }

        // Check domain entropy
        const domainEntropy = calculateEntropy(parsed.domain || '');
        if (domainEntropy > 4.0) {
            result.score += 2;
            result.reasons.push(`High domain entropy: ${domainEntropy.toFixed(2)}`);
        }

        // Check for lookalikes
        const lookalikes = [
            [/paypa[l1]/i, 'PayPal'],
            [/amaz[0o]n/i, 'Amazon'],
            [/g[0o]{2}gle/i, 'Google'],
            [/micr[0o]s[0o]ft/i, 'Microsoft'],
            [/app[l1]e/i, 'Apple'],
            [/faceb[0o]{2}k/i, 'Facebook']
        ];

        for (const [pattern, brand] of lookalikes) {
            if (pattern.test(parsed.domain || '')) {
                result.score += 5;
                result.reasons.push(`Possible ${brand} lookalike`);
                break;
            }
        }

    } catch (error) {
        result.reasons.push(`Parse error: ${error.message}`);
        result.score += 3;
    }

    result.score = Math.min(result.score, 15);

    // Determine risk level
    if (result.score >= 10) result.risk = 'critical';
    else if (result.score >= 6) result.risk = 'high';
    else if (result.score >= 3) result.risk = 'medium';
    else result.risk = 'low';

    result.processing_time_ms = Date.now() - start;

    return result;
}

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        version: '1.0.0',
        uptime_seconds: Math.round((Date.now() - startTime) / 1000)
    });
});

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

app.post('/analyze', (req, res) => {
    const end = analysisHistogram.startTimer();

    try {
        const { url, follow_redirects } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'url is required' });
        }

        const result = analyzeUrl(url);

        requestsTotal.inc({ endpoint: '/analyze', status: 'success' });
        end();

        console.log(`URL analyzed: ${url.substring(0, 50)}... risk=${result.risk} score=${result.score}`);

        res.json(result);
    } catch (error) {
        requestsTotal.inc({ endpoint: '/analyze', status: 'error' });
        end();
        res.status(500).json({ error: error.message });
    }
});

app.post('/analyze/batch', (req, res) => {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'urls array is required' });
    }

    const results = urls.slice(0, 20).map(url => analyzeUrl(url));

    res.json({ results, total: results.length });
});

app.get('/', (req, res) => {
    res.json({
        service: 'URL Intelligence',
        version: '1.0.0',
        endpoints: {
            analyze: 'POST /analyze',
            batch: 'POST /analyze/batch',
            health: 'GET /health',
            metrics: 'GET /metrics'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🌐 URL Intelligence running on port ${PORT}`);
});
