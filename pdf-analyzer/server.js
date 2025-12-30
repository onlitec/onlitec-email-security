/**
 * PDF Analyzer - Node.js Version
 * Extract text/URLs from PDFs and detect malicious patterns
 */

const express = require('express');
const cors = require('cors');
const { register, Counter, Histogram } = require('prom-client');
const pdfParse = require('pdf-parse');

const app = express();
const PORT = process.env.PORT || 8080;
const startTime = Date.now();

// Metrics
const requestsTotal = new Counter({
    name: 'pdf_analyzer_requests_total',
    help: 'Total requests',
    labelNames: ['endpoint', 'status']
});

const analysisHistogram = new Histogram({
    name: 'pdf_analyzer_duration_seconds',
    help: 'Analysis duration'
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

function extractUrls(text) {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = text.match(urlPattern) || [];
    return [...new Set(urls)];
}

async function analyzePdf(pdfBuffer) {
    const start = Date.now();

    const result = {
        has_links: false,
        has_js: false,
        has_actions: false,
        has_embedded_files: false,
        is_encrypted: false,
        risk_score: 0,
        text: '',
        urls: [],
        page_count: 0,
        reasons: []
    };

    try {
        const data = await pdfParse(pdfBuffer);

        result.page_count = data.numpages || 0;
        result.text = (data.text || '').substring(0, 10000);

        // Extract URLs from text
        const urls = extractUrls(data.text || '');
        result.urls = urls.slice(0, 50);

        if (urls.length > 0) {
            result.has_links = true;
            result.risk_score += Math.min(5, urls.length * 0.5);
            result.reasons.push(`Contains ${urls.length} external URLs`);
        }

        // Check for JavaScript indicators in raw PDF
        const pdfString = pdfBuffer.toString('latin1');

        if (/\/JavaScript\b/i.test(pdfString) || /\/JS\b/i.test(pdfString)) {
            result.has_js = true;
            result.risk_score += 8;
            result.reasons.push('Contains JavaScript');
        }

        if (/\/OpenAction\b/i.test(pdfString)) {
            result.has_actions = true;
            result.risk_score += 3;
            result.reasons.push('Contains OpenAction');
        }

        if (/\/EmbeddedFile\b/i.test(pdfString) || /\/FileSpec\b/i.test(pdfString)) {
            result.has_embedded_files = true;
            result.risk_score += 5;
            result.reasons.push('Contains embedded files');
        }

        if (/\/Encrypt\b/i.test(pdfString)) {
            result.is_encrypted = true;
            result.risk_score += 3;
            result.reasons.push('PDF is encrypted');
        }

        // Check for suspicious patterns in text
        const lowerText = result.text.toLowerCase();
        if (/password|credential|login|verify|urgent/i.test(lowerText) && result.has_links) {
            result.risk_score += 3;
            result.reasons.push('Contains phishing keywords with links');
        }

    } catch (error) {
        result.reasons.push(`Parse error: ${error.message}`);
        result.risk_score += 5;
    }

    result.risk_score = Math.min(result.risk_score, 20);
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

app.post('/analyze', async (req, res) => {
    const end = analysisHistogram.startTimer();

    try {
        const { pdf_base64, filename } = req.body;

        if (!pdf_base64) {
            return res.status(400).json({ error: 'pdf_base64 is required' });
        }

        const pdfBuffer = Buffer.from(pdf_base64, 'base64');
        const result = await analyzePdf(pdfBuffer);

        requestsTotal.inc({ endpoint: '/analyze', status: 'success' });
        end();

        console.log(`PDF analyzed: pages=${result.page_count}, urls=${result.urls.length}, score=${result.risk_score}`);

        res.json(result);
    } catch (error) {
        requestsTotal.inc({ endpoint: '/analyze', status: 'error' });
        end();
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        service: 'PDF Analyzer',
        version: '1.0.0',
        endpoints: {
            analyze: 'POST /analyze (base64 PDF)',
            health: 'GET /health',
            metrics: 'GET /metrics'
        }
    });
});

app.listen(PORT, () => {
    console.log(`📄 PDF Analyzer running on port ${PORT}`);
});
