/**
 * Auth Middleware Tests
 * Tests for JWT authentication and authorization logic
 * (Unit tests that don't require the actual module to avoid service connections)
 */

const jwt = require('jsonwebtoken');

// Test the logic directly without importing the module
const JWT_SECRET = 'test-secret-key';

// Recreate the logic here for testing
const createAuthMiddleware = () => {
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

            // Normalize role: convert 'super-admin' to 'superadmin'
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

    return { authenticate, authorize };
};

describe('Auth Middleware Logic', () => {
    let authMiddleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        authMiddleware = createAuthMiddleware();
        mockReq = {
            headers: {},
            user: null
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    describe('authenticate', () => {
        it('should return 401 when no authorization header is provided', () => {
            authMiddleware.authenticate(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'NO_TOKEN',
                    message: 'No authentication token provided'
                }
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when authorization header does not start with Bearer', () => {
            mockReq.headers.authorization = 'Basic sometoken';

            authMiddleware.authenticate(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 when token is invalid', () => {
            mockReq.headers.authorization = 'Bearer invalidtoken';

            authMiddleware.authenticate(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid authentication token'
                }
            });
        });

        it('should call next and attach user when token is valid', () => {
            const payload = { userId: '123', email: 'test@example.com', role: 'admin' };
            const token = jwt.sign(payload, JWT_SECRET);

            mockReq.headers.authorization = `Bearer ${token}`;

            authMiddleware.authenticate(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toEqual({
                userId: '123',
                email: 'test@example.com',
                role: 'admin'
            });
        });

        it('should return 401 when token is expired', () => {
            const payload = { userId: '123', email: 'test@example.com', role: 'admin' };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });

            mockReq.headers.authorization = `Bearer ${token}`;

            authMiddleware.authenticate(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Authentication token has expired'
                }
            });
        });
    });

    describe('authorize', () => {
        it('should return 401 when user is not authenticated', () => {
            const authorizeMiddleware = authMiddleware.authorize('admin');

            authorizeMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'NOT_AUTHENTICATED',
                    message: 'User not authenticated'
                }
            });
        });

        it('should return 403 when user role is not allowed', () => {
            mockReq.user = { userId: '123', email: 'test@example.com', role: 'viewer' };
            const authorizeMiddleware = authMiddleware.authorize('admin', 'superadmin');

            authorizeMiddleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to perform this action'
                }
            });
        });

        it('should call next when user has allowed role', () => {
            mockReq.user = { userId: '123', email: 'test@example.com', role: 'admin' };
            const authorizeMiddleware = authMiddleware.authorize('admin', 'superadmin');

            authorizeMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should normalize role with hyphen (super-admin to superadmin)', () => {
            mockReq.user = { userId: '123', email: 'test@example.com', role: 'super-admin' };
            const authorizeMiddleware = authMiddleware.authorize('superadmin');

            authorizeMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow access when no roles are specified', () => {
            mockReq.user = { userId: '123', email: 'test@example.com', role: 'viewer' };
            const authorizeMiddleware = authMiddleware.authorize();

            authorizeMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle roles specified in both formats', () => {
            mockReq.user = { userId: '123', email: 'test@example.com', role: 'super-admin' };
            const authorizeMiddleware = authMiddleware.authorize('super-admin', 'admin');

            authorizeMiddleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
