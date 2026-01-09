const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authenticate middleware
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'NO_TOKEN',
                    message: 'No authentication token provided'
                }
            });
        }

        const token = authHeader.replace('Bearer ', '');

        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            // Attach user info to request
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role
            };

            next();

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'TOKEN_EXPIRED',
                        message: 'Authentication token has expired'
                    }
                });
            }

            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid authentication token'
                }
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication error'
            }
        });
    }
};

// Check role middleware
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'NOT_AUTHENTICATED',
                    message: 'User not authenticated'
                }
            });
        }

        // Normalize role: convert 'super-admin' to 'superadmin' for compatibility
        const userRole = req.user.role ? req.user.role.replace(/-/g, '') : '';
        const normalizedAllowedRoles = allowedRoles.map(role => role.replace(/-/g, ''));

        if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to perform this action'
                }
            });
        }

        next();
    };
};


// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };
    } catch (error) {
        // Token invalid but continue anyway
    }

    next();
};

module.exports = {
    authenticate,
    authorize,
    optionalAuth,
    // Aliases for route compatibility
    authenticateToken: authenticate,
    requireRole: (roles) => authorize(...roles)
};
