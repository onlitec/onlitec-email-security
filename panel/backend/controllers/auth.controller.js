const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'emailprotect',
    user: process.env.POSTGRES_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || 'changeme123'
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Login
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_CREDENTIALS',
                    message: 'Email and password are required'
                }
            });
        }

        // Find user
        const result = await pool.query(
            `SELECT id, email, password_hash, full_name, role, status 
             FROM admin_users 
             WHERE email = $1 AND deleted_at IS NULL`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                }
            });
        }

        const user = result.rows[0];

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_DISABLED',
                    message: 'Your account has been disabled'
                }
            });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                }
            });
        }

        // Generate tokens
        const accessToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
            {
                userId: user.id,
                type: 'refresh'
            },
            JWT_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
        );

        // Update last login
        await pool.query(
            'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Store session
        const tokenHash = require('crypto').createHash('sha256').update(accessToken).digest('hex');
        await pool.query(
            `INSERT INTO admin_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
             VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')`,
            [user.id, tokenHash, req.ip, req.get('user-agent')]
        );

        logger.info(`User logged in: ${user.email}`);

        res.json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

// Logout
exports.logout = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (token) {
            const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
            await pool.query('DELETE FROM admin_sessions WHERE token_hash = $1', [tokenHash]);
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        next(error);
    }
};

// Refresh token
exports.refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_TOKEN',
                    message: 'Refresh token is required'
                }
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        if (decoded.type !== 'refresh') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid refresh token'
                }
            });
        }

        // Get user
        const result = await pool.query(
            `SELECT id, email, role FROM admin_users 
             WHERE id = $1 AND status = 'active' AND deleted_at IS NULL`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found or inactive'
                }
            });
        }

        const user = result.rows[0];

        // Generate new access token
        const accessToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            data: {
                accessToken
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired refresh token'
                }
            });
        }
        next(error);
    }
};

// Get current user
exports.me = async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT id, email, full_name, role, status, last_login, created_at
             FROM admin_users 
             WHERE id = $1 AND deleted_at IS NULL`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                status: user.status,
                lastLogin: user.last_login,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        next(error);
    }
};

// Change password
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'MISSING_FIELDS',
                    message: 'Current password and new password are required'
                }
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: 'Password must be at least 6 characters long'
                }
            });
        }

        // Get current user
        const result = await pool.query(
            `SELECT password_hash FROM admin_users WHERE id = $1`,
            [req.user.userId]
        );

        const user = result.rows[0];

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: 'Current password is incorrect'
                }
            });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [newPasswordHash, req.user.userId]
        );

        // Invalidate all sessions
        await pool.query('DELETE FROM admin_sessions WHERE user_id = $1', [req.user.userId]);

        logger.info(`Password changed for user: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Password changed successfully. Please log in again.'
        });

    } catch (error) {
        next(error);
    }
};

// Forgot Password
exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const crypto = require('crypto');
        const nodemailer = require('nodemailer');

        if (!email) {
            return res.status(400).json({ success: false, error: { message: 'Email is required' } });
        }

        // Check user exists
        const userRes = await pool.query('SELECT id, email FROM admin_users WHERE email = $1 AND deleted_at IS NULL', [email]);
        if (userRes.rows.length === 0) {
            // Return success even if not found to prevent enumeration
            return res.json({ success: true, message: 'If credentials are valid, an email has been sent.' });
        }

        const user = userRes.rows[0];
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        // Save token
        await pool.query(
            'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
            [email, token, expiresAt]
        );

        // Get SMTP settings
        const settingsRes = await pool.query("SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'");
        const settings = {};
        settingsRes.rows.forEach(r => settings[r.key] = r.value);

        // Send Email if SMTP is configured
        if (settings.smtp_host) {
            const transporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: parseInt(settings.smtp_port || '587'),
                secure: settings.smtp_secure === 'true',
                auth: settings.smtp_user ? { user: settings.smtp_user, pass: settings.smtp_pass } : undefined,
                tls: { rejectUnauthorized: false }
            });

            // Assuming frontend URL structure
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Default dev
            const resetLink = `${frontendUrl}/reset-password?token=${token}`;

            await transporter.sendMail({
                from: settings.smtp_from || 'noreply@example.com',
                to: email,
                subject: 'Reset your password - Onlitec Email Protection',
                html: `<p>You requested a password reset. Click the link below to verify:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Link expires in 30 minutes.</p>`
            });
        }

        res.json({ success: true, message: 'If credentials are valid, an email has been sent.' });

    } catch (error) {
        next(error);
    }
};

// Reset Password
exports.resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ success: false, error: { message: 'Token and new password are required' } });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, error: { message: 'Password too short' } });
        }

        // Verify token
        const tokenRes = await pool.query(
            'SELECT * FROM password_resets WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (tokenRes.rows.length === 0) {
            return res.status(400).json({ success: false, error: { message: 'Invalid or expired token' } });
        }

        const resetEntry = tokenRes.rows[0];

        // Update user password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
            [hashedPassword, resetEntry.email]
        );

        // Delete used token
        await pool.query('DELETE FROM password_resets WHERE id = $1', [resetEntry.id]);

        res.json({ success: true, message: 'Password has been reset successfully.' });

    } catch (error) {
        next(error);
    }
};
