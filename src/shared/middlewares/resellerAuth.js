'use strict';

const { User, USER_STATUS } = require('../../modules/users/user.model');

const normalizeIp = (value) => String(value || '')
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/, '');

const sendAuthError = (res, statusCode, message, code) => res.status(statusCode).json({
    success: false,
    message,
    code,
});

const extractApiToken = (req) => {
    const headerToken = req.get('x-api-key') || req.get('api-token');
    if (headerToken) return String(headerToken).trim();

    const authorization = req.get('authorization') || '';
    if (authorization.toLowerCase().startsWith('bearer ')) {
        return authorization.slice(7).trim();
    }

    return '';
};

const resellerAuth = async (req, res, next) => {
    try {
        const token = extractApiToken(req);
        if (!token) {
            return sendAuthError(res, 401, 'Missing API token.', 'RESELLER_TOKEN_REQUIRED');
        }

        const candidates = await User.find({
            isApiEnabled: true,
            status: USER_STATUS.ACTIVE,
            apiToken: { $exists: true, $ne: null },
            deletedAt: null,
        })
            .select('+apiToken +apiSecret name email role status walletBalance creditLimit creditUsed currency groupId isApiEnabled whitelistIps webhookUrl')
            .populate('groupId', 'name percentage isActive billingMode');

        let reseller = null;
        for (const candidate of candidates) {
            if (await candidate.compareApiToken(token)) {
                reseller = candidate;
                break;
            }
        }

        if (!reseller) {
            return sendAuthError(res, 401, 'Invalid API token.', 'RESELLER_TOKEN_INVALID');
        }

        const whitelist = (Array.isArray(reseller.whitelistIps) ? reseller.whitelistIps : [])
            .map(normalizeIp)
            .filter(Boolean);
        const requestIp = normalizeIp(req.ip || req.socket?.remoteAddress || req.get('x-forwarded-for'));

        if (whitelist.length > 0 && !whitelist.includes(requestIp)) {
            return sendAuthError(res, 403, 'Request IP is not whitelisted.', 'RESELLER_IP_FORBIDDEN');
        }

        req.reseller = reseller;
        req.user = reseller;
        req.auditContext = {
            actorId: reseller._id,
            actorRole: 'RESELLER',
            ipAddress: requestIp || null,
            userAgent: req.get('User-Agent') || null,
        };

        return next();
    } catch (err) {
        return sendAuthError(res, 401, err.message || 'API authentication failed.', 'RESELLER_AUTH_FAILED');
    }
};

module.exports = resellerAuth;
