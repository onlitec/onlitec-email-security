/**
 * Utility Functions Tests
 * Tests for common utility functions and data validation
 */

describe('Utility Functions', () => {
    describe('Email Validation', () => {
        const isValidEmail = (email) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        it('should validate correct email addresses', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.org')).toBe(true);
            expect(isValidEmail('admin@onlitec.com.br')).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('invalid@')).toBe(false);
            expect(isValidEmail('@domain.com')).toBe(false);
            expect(isValidEmail('user@domain')).toBe(false);
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('Domain Validation', () => {
        const isValidDomain = (domain) => {
            const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
            return domainRegex.test(domain);
        };

        it('should validate correct domains', () => {
            expect(isValidDomain('example.com')).toBe(true);
            expect(isValidDomain('sub-domain.org')).toBe(true);
            expect(isValidDomain('onlitec.com')).toBe(true);
        });

        it('should reject invalid domains', () => {
            expect(isValidDomain('-invalid.com')).toBe(false);
            expect(isValidDomain('invalid')).toBe(false);
            expect(isValidDomain('.com')).toBe(false);
        });
    });

    describe('UUID Validation', () => {
        const isValidUUID = (uuid) => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return uuidRegex.test(uuid);
        };

        it('should validate correct UUIDs', () => {
            expect(isValidUUID('a12ba3bc-122f-44c7-aca0-db3bcbf14f20')).toBe(true);
            expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('should reject invalid UUIDs', () => {
            expect(isValidUUID('invalid-uuid')).toBe(false);
            expect(isValidUUID('12345678-1234-1234-1234-123456789')).toBe(false);
            expect(isValidUUID('')).toBe(false);
        });
    });

    describe('Spam Score Validation', () => {
        const isValidSpamScore = (score) => {
            return typeof score === 'number' && score >= 0 && score <= 100;
        };

        it('should validate valid spam scores', () => {
            expect(isValidSpamScore(0)).toBe(true);
            expect(isValidSpamScore(50)).toBe(true);
            expect(isValidSpamScore(100)).toBe(true);
            expect(isValidSpamScore(15.5)).toBe(true);
        });

        it('should reject invalid spam scores', () => {
            expect(isValidSpamScore(-1)).toBe(false);
            expect(isValidSpamScore(101)).toBe(false);
            expect(isValidSpamScore('50')).toBe(false);
            expect(isValidSpamScore(null)).toBe(false);
        });
    });

    describe('Role Normalization', () => {
        const normalizeRole = (role) => {
            return role ? role.replace(/-/g, '') : '';
        };

        it('should normalize super-admin to superadmin', () => {
            expect(normalizeRole('super-admin')).toBe('superadmin');
        });

        it('should keep admin unchanged', () => {
            expect(normalizeRole('admin')).toBe('admin');
        });

        it('should handle empty role', () => {
            expect(normalizeRole('')).toBe('');
            expect(normalizeRole(null)).toBe('');
            expect(normalizeRole(undefined)).toBe('');
        });

        it('should handle roles with multiple hyphens', () => {
            expect(normalizeRole('some-role-name')).toBe('somerolename');
        });
    });

    describe('Date Formatting', () => {
        const formatDate = (date) => {
            return new Date(date).toISOString().split('T')[0];
        };

        it('should format dates correctly', () => {
            expect(formatDate('2026-01-09T20:00:00Z')).toBe('2026-01-09');
            expect(formatDate(new Date('2026-01-09'))).toBeTruthy();
        });
    });

    describe('Pagination Helpers', () => {
        const calculateOffset = (page, limit) => {
            return (Math.max(1, page) - 1) * limit;
        };

        const calculateTotalPages = (total, limit) => {
            return Math.ceil(total / limit);
        };

        it('should calculate offset correctly', () => {
            expect(calculateOffset(1, 10)).toBe(0);
            expect(calculateOffset(2, 10)).toBe(10);
            expect(calculateOffset(5, 20)).toBe(80);
        });

        it('should handle page 0 or negative', () => {
            expect(calculateOffset(0, 10)).toBe(0);
            expect(calculateOffset(-1, 10)).toBe(0);
        });

        it('should calculate total pages correctly', () => {
            expect(calculateTotalPages(100, 10)).toBe(10);
            expect(calculateTotalPages(101, 10)).toBe(11);
            expect(calculateTotalPages(9, 10)).toBe(1);
            expect(calculateTotalPages(0, 10)).toBe(0);
        });
    });

    describe('Safe JSON Parse', () => {
        const safeJsonParse = (str, fallback = null) => {
            try {
                return JSON.parse(str);
            } catch {
                return fallback;
            }
        };

        it('should parse valid JSON', () => {
            expect(safeJsonParse('{"name":"test"}')).toEqual({ name: 'test' });
            expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
        });

        it('should return fallback for invalid JSON', () => {
            expect(safeJsonParse('invalid', null)).toBe(null);
            expect(safeJsonParse('', {})).toEqual({});
            expect(safeJsonParse(undefined, [])).toEqual([]);
        });
    });
});
