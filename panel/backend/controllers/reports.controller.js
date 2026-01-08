const { Pool } = require('pg');
const PDFDocument = require('pdfkit-table');
const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || process.env.DB_PORT || 5432,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'emailprotect',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'changeme123'
});

// Helper to fetch report data
const fetchReportData = async (startDate, endDate, options = {}, tenantId = null) => {
    let whereClause = "WHERE ml.created_at BETWEEN $1 AND $2";
    const params = [startDate, endDate];

    if (tenantId) {
        // Assuming mail_logs has a tenant_id or related field, but based on stats controller it's global for now
        // If necessary, join with domains/tenants. For now keeping it simple as per stats controller.
    }

    // Daily Stats Breakdown
    const dailyStatsQuery = `
        SELECT 
            DATE(ml.created_at) as date,
            COUNT(*) as received,
            SUM(CASE WHEN ml.status IN ('delivered', 'accepted') THEN 1 ELSE 0 END) as delivered,
            SUM(CASE 
                WHEN ml.is_spam = true OR ml.status = 'rejected' OR ml.spam_score > 15 
                THEN 1 ELSE 0 
            END) as spam,
            SUM(CASE 
                WHEN ml.status = 'virus' 
                OR ml.is_virus = true
                OR (ml.has_attachment = true AND (
                    ml.is_spam = true 
                    OR ml.status = 'rejected'
                    OR av.ai_label IN ('phishing', 'fraud', 'spam')
                ))
            THEN 1 ELSE 0 
            END) as virus
        FROM mail_logs ml
        LEFT JOIN ai_verdicts av ON av.mail_log_id = ml.id
        ${whereClause}
        GROUP BY DATE(ml.created_at)
        ORDER BY date ASC
    `;

    const { rows: dailyStats } = await pool.query(dailyStatsQuery, params);

    // Summary Totals
    const totalReceived = dailyStats.reduce((acc, curr) => acc + parseInt(curr.received), 0);
    const totalDelivered = dailyStats.reduce((acc, curr) => acc + parseInt(curr.delivered), 0);
    const totalSpam = dailyStats.reduce((acc, curr) => acc + parseInt(curr.spam), 0);
    const totalVirus = dailyStats.reduce((acc, curr) => acc + parseInt(curr.virus), 0);

    const data = {
        dailyStats,
        summary: {
            totalReceived,
            totalDelivered,
            totalSpam,
            totalVirus
        },
        details: {}
    };

    // Advanced Details
    if (options.includeVirus) {
        // Top Viruses (based on attachment name or status)
        data.details.topViruses = (await pool.query(`
            SELECT 'Vírus/Malware' as name, COUNT(*) as count 
            FROM mail_logs ml
            LEFT JOIN ai_verdicts av ON av.mail_log_id = ml.id
            ${whereClause} 
            AND (
                ml.status = 'virus' 
                OR ml.is_virus = true
                OR (ml.has_attachment = true AND (
                    ml.is_spam = true OR ml.status = 'rejected' OR av.ai_label IN ('phishing', 'fraud', 'spam')
                ))
            )
            GROUP BY name
        `, params)).rows;
    }

    if (options.includeSpam) {
        // Top Spam Sources (IPs or Senders)
        data.details.topSpamSenders = (await pool.query(`
            SELECT from_address as sender, COUNT(*) as count
            FROM mail_logs ml
            ${whereClause} 
            AND (is_spam = true OR status = 'rejected')
            GROUP BY from_address ORDER BY count DESC LIMIT 10
        `, params)).rows;
    }

    if (options.includeSenders) {
        // Top Senders Overall
        data.details.topSenders = (await pool.query(`
            SELECT from_address as sender, COUNT(*) as count
            FROM mail_logs ml
            ${whereClause}
            GROUP BY from_address ORDER BY count DESC LIMIT 10
        `, params)).rows;
    }

    if (options.includeDomains) {
        // Traffic by Domain (Sender Domain)
        data.details.topDomains = (await pool.query(`
            SELECT split_part(from_address, '@', 2) as domain, COUNT(*) as count
            FROM mail_logs ml
            ${whereClause}
            GROUP BY domain ORDER BY count DESC LIMIT 10
        `, params)).rows;
    }

    return data;
};

// Generate PDF Buffer
const generatePDF = async (reportData, dateRange, options = {}) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.fontSize(20).text('Relatório Onlitec Email Protection', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Período: ${dateRange.start} até ${dateRange.end}`, { align: 'center' });
        doc.moveDown(2);

        // Summary Table
        const summaryTable = {
            title: "Resumo Geral",
            headers: ["Métrica", "Total"],
            rows: [
                ["Total Recebidos", reportData.summary.totalReceived],
                ["Entregues", reportData.summary.totalDelivered],
                ["Spam Bloqueado", reportData.summary.totalSpam],
                ["Vírus Detectados", reportData.summary.totalVirus]
            ]
        };

        doc.table(summaryTable, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(12),
            prepareRow: () => doc.font("Helvetica").fontSize(10)
        });

        doc.moveDown(2);

        // Daily Stats Table
        const dailyTable = {
            title: "Detalhamento Diário",
            headers: ["Data", "Recebidos", "Entregues", "Spam", "Vírus"],
            rows: reportData.dailyStats.map(stat => [
                new Date(stat.date).toLocaleDateString('pt-BR'),
                stat.received,
                stat.delivered,
                stat.spam,
                stat.virus
            ])
        };

        doc.table(dailyTable, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: () => doc.font("Helvetica").fontSize(8)
        });

        // Advanced Reporting Sections
        const { details } = reportData;

        if (options.includeVirus && details.topViruses?.length > 0) {
            doc.addPage();
            doc.fontSize(14).text('Detalhamento de Ameaças (Vírus)', { underline: true });
            doc.moveDown();
            const virusTable = {
                title: "Top Detecções",
                headers: ["Tipo", "Quantidade"],
                rows: details.topViruses.map(v => [v.name, v.count])
            };
            doc.table(virusTable);
        }

        if (options.includeSpam && details.topSpamSenders?.length > 0) {
            doc.addPage();
            doc.fontSize(14).text('Detalhamento de Spam', { underline: true });
            doc.moveDown();
            const spamTable = {
                title: "Top Remetentes de Spam",
                headers: ["Remetente", "Bloqueios"],
                rows: details.topSpamSenders.map(s => [s.sender, s.count])
            };
            doc.table(spamTable);
        }

        if (options.includeSenders && details.topSenders?.length > 0) {
            doc.addPage();
            doc.fontSize(14).text('Relatório de Remetentes', { underline: true });
            doc.moveDown();
            const senderTable = {
                title: "Top Remetentes (Volume)",
                headers: ["Remetente", "Total Envios"],
                rows: details.topSenders.map(s => [s.sender, s.count])
            };
            doc.table(senderTable);
        }

        if (options.includeDomains && details.topDomains?.length > 0) {
            doc.addPage();
            doc.fontSize(14).text('Relatório de Domínios', { underline: true });
            doc.moveDown();
            const domainTable = {
                title: "Top Domínios (Volume)",
                headers: ["Domínio", "Total"],
                rows: details.topDomains.map(d => [d.domain, d.count])
            };
            doc.table(domainTable);
        }

        doc.end();
    });
};

exports.generateReport = async (req, res) => {
    try {
        const { startDate, endDate, options } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const data = await fetchReportData(startDate, endDate, options || {});
        const pdfBuffer = await generatePDF(data, { start: startDate, end: endDate }, options || {});

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=report-${startDate}-${endDate}.pdf`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        logger.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

exports.emailReport = async (req, res) => {
    try {
        const { startDate, endDate, email, options } = req.body;

        if (!startDate || !endDate || !email) {
            return res.status(400).json({ error: 'Start date, end date, and email are required' });
        }

        const data = await fetchReportData(startDate, endDate, options || {});
        const pdfBuffer = await generatePDF(data, { start: startDate, end: endDate }, options || {});

        // Setup Nodemailer (using existing env vars if available or default local postfix)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'localhost',
            port: process.env.SMTP_PORT || 25,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            } : undefined,
            tls: {
                rejectUnauthorized: false
            }
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Onlitec Report" <noreply@onlitec.com.br>',
            to: email,
            subject: `Relatório Onlitec Email Protection (${startDate} - ${endDate})`,
            text: `Segue em anexo o relatório solicitado para o período de ${startDate} até ${endDate}.`,
            attachments: [
                {
                    filename: `report-${startDate}-${endDate}.pdf`,
                    content: pdfBuffer
                }
            ]
        });

        res.json({ success: true, message: 'Report sent successfully' });

    } catch (error) {
        logger.error('Error emailing report:', error);
        res.status(500).json({ error: 'Failed to email report' });
    }
};
