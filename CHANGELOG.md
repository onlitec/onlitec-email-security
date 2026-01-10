# Changelog

All notable changes to this project will be documented in this file.

## [v2.1.0] - 2026-01-09

### Added
- Automated Test Suite for backend with Jest and Supertest
- Enhanced CI/CD Pipeline with testing, linting, security audit, and Docker build test
- Code coverage reporting

## [v2.0.3] - 2026-01-09

### Fixed
- Update paths to correct production directory `/home/alfreire/docker/apps/onlitec-email`
- Normalize role names to support both 'super-admin' and 'superadmin' formats
- Correct ai_verdicts JOIN to use `mail_log_id` instead of `email_id`
- Correct paths for auto-deploy and webhook listener
- Set released_by to NULL to avoid FK constraint violation
- Robust quarantine actions and bulk operations

### Added
- GitHub Actions CI/CD workflow
- Multi-tenant filters
- Mail Queue Management System
- Whitelist/blacklist indicators to Logs and AI Verdicts
- Dynamic tenant lookup from Redis

## [v2.0.0] - 2026-01-09

### Added
- Multi-tenant support with tenant-based filtering
- Super-admin permissions and role management
- Enhanced dashboard statistics
- AI verdicts tracking

### Changed
- Upgraded platform to v2.0.0
- Improved quarantine management

## [v1.0.0] - 2025-12-24

### Added
- Initial release
- Email protection panel
- Spam detection with Rspamd
- Virus scanning with ClamAV
- AI-powered threat detection
- Quarantine management
- User and domain management
- Real-time monitoring
