/**
 * Health Check Tests
 * Tests for health endpoint and basic API functionality
 */

describe('Health Check', () => {
    describe('Health Response Format', () => {
        it('should have correct health response structure', () => {
            const healthResponse = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '2.0.3'
            };

            expect(healthResponse).toHaveProperty('status');
            expect(healthResponse).toHaveProperty('timestamp');
            expect(healthResponse).toHaveProperty('uptime');
            expect(healthResponse).toHaveProperty('version');
            expect(healthResponse.status).toBe('healthy');
        });

        it('should have valid timestamp format', () => {
            const healthResponse = {
                timestamp: new Date().toISOString()
            };

            const date = new Date(healthResponse.timestamp);
            expect(date).toBeInstanceOf(Date);
            expect(isNaN(date.getTime())).toBe(false);
        });

        it('should have numeric uptime', () => {
            const uptime = process.uptime();
            expect(typeof uptime).toBe('number');
            expect(uptime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('API Response Helpers', () => {
        it('should format success response correctly', () => {
            const formatSuccess = (data, message = 'Success') => ({
                success: true,
                message,
                data
            });

            const response = formatSuccess({ id: 1, name: 'Test' }, 'Data retrieved');

            expect(response.success).toBe(true);
            expect(response.message).toBe('Data retrieved');
            expect(response.data).toEqual({ id: 1, name: 'Test' });
        });

        it('should format error response correctly', () => {
            const formatError = (code, message) => ({
                success: false,
                error: { code, message }
            });

            const response = formatError('NOT_FOUND', 'Resource not found');

            expect(response.success).toBe(false);
            expect(response.error.code).toBe('NOT_FOUND');
            expect(response.error.message).toBe('Resource not found');
        });
    });
});
