'use strict';

const TARGET_ALIASES = Object.freeze([
    'playerId',
    'player_id',
    'uid',
    'userId',
    'user_id',
    'accountId',
    'account_id',
    'toUserId',
    'target',
    'link',
]);

const RESERVED_ID_KEYS = Object.freeze([
    '_id',
    'productId',
    'externalProductId',
    'providerProductId',
    'providerId',
    'providerOrderId',
    'orderId',
    'order_id',
    'orderUuid',
    'order_uuid',
    'referenceId',
    'compatProductId',
]);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const toPlainObject = (params = {}) => {
    if (params instanceof Map) return Object.fromEntries(params.entries());
    if (!params || typeof params !== 'object' || Array.isArray(params)) return {};
    return { ...params };
};

const cleanTargetValue = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        const trimmed = String(value).trim();
        return trimmed ? trimmed : null;
    }
    return null;
};

const hasReservedIdContext = (params) => RESERVED_ID_KEYS.some((key) => hasOwn(params, key));

const extractTargetId = (params = {}) => {
    const source = toPlainObject(params);

    for (const key of TARGET_ALIASES) {
        if (!hasOwn(source, key)) continue;
        const value = cleanTargetValue(source[key]);
        if (value) return value;
    }

    if (hasOwn(source, 'id') && !hasReservedIdContext(source)) {
        return cleanTargetValue(source.id);
    }

    return null;
};

const hasTargetId = (params = {}) => Boolean(extractTargetId(params));

const normalizeParamAliases = (params = {}) => {
    const normalized = toPlainObject(params);
    const targetId = extractTargetId(normalized);
    if (!targetId) return normalized;

    normalized.playerId = targetId;
    return normalized;
};

module.exports = {
    TARGET_ALIASES,
    extractTargetId,
    hasTargetId,
    normalizeParamAliases,
};
