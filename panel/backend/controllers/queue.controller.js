const { exec } = require('child_process');
const logger = require('../config/logger');

// Execute command in Postfix container
const execPostfix = (command) => {
    return new Promise((resolve, reject) => {
        exec(`docker exec onlitec_postfix ${command}`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Postfix command failed: ${command}`, { error: error.message, stderr });
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
};

// List all emails in queue
exports.list = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 50 } = req.query;
        const output = await execPostfix('postqueue -j');

        if (!output || output.trim() === '') {
            return res.json({
                success: true,
                data: [],
                stats: { total: 0, deferred: 0, active: 0, hold: 0 },
                pagination: { page: 1, limit, total: 0, pages: 0 }
            });
        }

        // Parse JSON lines
        let emails = output.trim().split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    const parsed = JSON.parse(line);
                    return {
                        id: parsed.queue_id,
                        queue: parsed.queue_name,
                        sender: parsed.sender || 'MAILER-DAEMON',
                        recipient: parsed.recipients?.[0]?.address || 'unknown',
                        recipients: parsed.recipients || [],
                        size: parsed.message_size,
                        arrivalTime: new Date(parsed.arrival_time * 1000).toISOString(),
                        reason: parsed.recipients?.[0]?.delay_reason || null,
                        forcedExpire: parsed.forced_expire
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(e => e !== null);

        // Calculate stats
        const stats = {
            total: emails.length,
            deferred: emails.filter(e => e.queue === 'deferred').length,
            active: emails.filter(e => e.queue === 'active').length,
            hold: emails.filter(e => e.queue === 'hold').length
        };

        // Apply filters
        if (status) {
            emails = emails.filter(e => e.queue === status);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            emails = emails.filter(e =>
                e.sender.toLowerCase().includes(searchLower) ||
                e.recipient.toLowerCase().includes(searchLower) ||
                e.id.toLowerCase().includes(searchLower) ||
                (e.reason && e.reason.toLowerCase().includes(searchLower))
            );
        }

        // Pagination
        const total = emails.length;
        const offset = (page - 1) * limit;
        emails = emails.slice(offset, offset + parseInt(limit));

        res.json({
            success: true,
            data: emails,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error listing queue:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_LIST_ERROR', message: 'Failed to list mail queue' }
        });
    }
};

// Get email details
exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        const output = await execPostfix(`postcat -q ${id}`);

        res.json({
            success: true,
            data: {
                id,
                content: output
            }
        });
    } catch (error) {
        logger.error('Error getting queue item:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_GET_ERROR', message: 'Failed to get email details' }
        });
    }
};

// Delete email from queue
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        await execPostfix(`postsuper -d ${id}`);

        logger.info(`Queue item deleted: ${id}`);
        res.json({
            success: true,
            message: 'Email removed from queue'
        });
    } catch (error) {
        logger.error('Error deleting queue item:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_DELETE_ERROR', message: 'Failed to delete email' }
        });
    }
};

// Flush (force delivery) single email
exports.flush = async (req, res) => {
    try {
        const { id } = req.params;
        await execPostfix(`postqueue -i ${id}`);

        logger.info(`Queue item flushed: ${id}`);
        res.json({
            success: true,
            message: 'Delivery attempt initiated'
        });
    } catch (error) {
        logger.error('Error flushing queue item:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_FLUSH_ERROR', message: 'Failed to flush email' }
        });
    }
};

// Hold email
exports.hold = async (req, res) => {
    try {
        const { id } = req.params;
        await execPostfix(`postsuper -h ${id}`);

        logger.info(`Queue item held: ${id}`);
        res.json({
            success: true,
            message: 'Email put on hold'
        });
    } catch (error) {
        logger.error('Error holding queue item:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_HOLD_ERROR', message: 'Failed to hold email' }
        });
    }
};

// Release held email
exports.release = async (req, res) => {
    try {
        const { id } = req.params;
        await execPostfix(`postsuper -H ${id}`);

        logger.info(`Queue item released: ${id}`);
        res.json({
            success: true,
            message: 'Email released from hold'
        });
    } catch (error) {
        logger.error('Error releasing queue item:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_RELEASE_ERROR', message: 'Failed to release email' }
        });
    }
};

// Flush all emails
exports.flushAll = async (req, res) => {
    try {
        await execPostfix('postqueue -f');

        logger.info('Queue flushed (all)');
        res.json({
            success: true,
            message: 'All emails queued for delivery'
        });
    } catch (error) {
        logger.error('Error flushing all:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_FLUSH_ALL_ERROR', message: 'Failed to flush queue' }
        });
    }
};

// Delete all emails
exports.deleteAll = async (req, res) => {
    try {
        await execPostfix('postsuper -d ALL');

        logger.info('Queue cleared (all deleted)');
        res.json({
            success: true,
            message: 'All emails removed from queue'
        });
    } catch (error) {
        logger.error('Error deleting all:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_DELETE_ALL_ERROR', message: 'Failed to clear queue' }
        });
    }
};

// Delete by pattern (e.g., all MAILER-DAEMON)
exports.deleteByPattern = async (req, res) => {
    try {
        const { sender } = req.body;
        if (!sender) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_SENDER', message: 'Sender pattern required' }
            });
        }

        // Get queue, filter by sender, delete matching
        const output = await execPostfix('postqueue -j');
        const emails = output.trim().split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(e => e.sender === sender || e.sender.includes(sender));

        let deleted = 0;
        for (const email of emails) {
            try {
                await execPostfix(`postsuper -d ${email.queue_id}`);
                deleted++;
            } catch (e) {
                // Continue on individual failures
            }
        }

        logger.info(`Queue items deleted by pattern: ${sender} (${deleted} items)`);
        res.json({
            success: true,
            message: `Deleted ${deleted} emails from sender: ${sender}`
        });
    } catch (error) {
        logger.error('Error deleting by pattern:', error);
        res.status(500).json({
            success: false,
            error: { code: 'QUEUE_DELETE_PATTERN_ERROR', message: 'Failed to delete by pattern' }
        });
    }
};
