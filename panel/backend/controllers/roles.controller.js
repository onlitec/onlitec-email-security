const { Pool } = require('pg');
const logger = require('../config/logger');

const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'onlitec_emailprotect_db',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'emailprotect',
    user: process.env.POSTGRES_USER || 'emailprotect',
    password: process.env.POSTGRES_PASSWORD || 'changeme123'
});

exports.getRoles = async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY id ASC');
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
};

exports.createRole = async (req, res, next) => {
    try {
        const { name, permissions } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: { message: 'Role name is required' }
            });
        }

        const result = await pool.query(
            'INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING *',
            [name, permissions || {}]
        );

        logger.info(`Role created: ${name} by ${req.user.email}`);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({
                success: false,
                error: { message: 'Role name already exists' }
            });
        }
        next(error);
    }
};

exports.updateRole = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        const result = await pool.query(
            'UPDATE roles SET permissions = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [permissions, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Role not found' }
            });
        }

        logger.info(`Role updated: ${result.rows[0].name} by ${req.user.email}`);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteRole = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent deleting admin role (usually id 1 or name 'admin')
        const roleCheck = await pool.query('SELECT name FROM roles WHERE id = $1', [id]);
        if (roleCheck.rows.length > 0 && roleCheck.rows[0].name === 'admin') {
            return res.status(403).json({
                success: false,
                error: { message: 'Cannot delete admin role' }
            });
        }

        const result = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { message: 'Role not found' }
            });
        }

        logger.info(`Role deleted: ${result.rows[0].name} by ${req.user.email}`);

        res.json({
            success: true,
            message: 'Role deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};
