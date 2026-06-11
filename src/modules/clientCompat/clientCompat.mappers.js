'use strict';

const { ORDER_STATUS } = require('../orders/order.model');

const toNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const toFixedCompatNumber = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Number(numeric.toFixed(6));
};

const mapStatus = (status) => {
    switch (status) {
        case ORDER_STATUS.COMPLETED:
            return 'accept';
        case ORDER_STATUS.FAILED:
        case ORDER_STATUS.CANCELED:
            return 'reject';
        case ORDER_STATUS.PENDING:
        case ORDER_STATUS.PROCESSING:
        case ORDER_STATUS.MANUAL_REVIEW:
        case ORDER_STATUS.PARTIAL:
        default:
            return 'wait';
    }
};

const formatDateTime = (value) => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';

    const pad = (part) => String(part).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
    ].join('-') + ' ' + [
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join(':');
};

const getActiveFields = (product = {}) => {
    const fields = Array.isArray(product.orderFields) && product.orderFields.length > 0
        ? product.orderFields
        : product.dynamicFields;

    return (Array.isArray(fields) ? fields : [])
        .filter((field) => field && field.isActive !== false);
};

const getFieldKey = (field = {}) => String(field.key || field.name || field.id || '').trim();

const getFieldLabel = (field = {}) => String(field.label || field.name || field.key || field.id || '').trim();

const mapProductParams = (product = {}) => getActiveFields(product)
    .map((field) => getFieldLabel(field))
    .filter(Boolean);

const mapQuantity = (product = {}) => {
    const minQty = Number(product.minQty || 1);
    const maxQty = Number(product.maxQty || minQty);

    if (Number.isFinite(minQty) && Number.isFinite(maxQty) && maxQty > minQty) {
        return {
            qty_values: {
                min: String(minQty),
                max: String(maxQty),
            },
            product_type: 'amount',
        };
    }

    return {
        qty_values: null,
        product_type: 'package',
    };
};

const getCategoryForProduct = (product, categoryById) => {
    const categoryId = String(product?.category || '').trim();
    return categoryId ? categoryById.get(categoryId) || null : null;
};

const mapProduct = ({ product, category, price, priceUsd, minimal = false }) => {
    const id = Number(product.compatProductId);
    if (minimal) {
        return {
            id,
            name: product.name,
        };
    }

    const quantity = mapQuantity(product);
    return {
        id,
        name: product.name,
        price: toFixedCompatNumber(price),
        params: mapProductParams(product),
        category_name: category?.name || '',
        available: product.isActive !== false && !product.deletedAt,
        qty_values: quantity.qty_values,
        product_type: quantity.product_type,
        parent_id: Number(category?.compatCategoryId || 0),
        base_price: toFixedCompatNumber(priceUsd ?? price),
        category_img: category?.image || '',
    };
};

const getOrderData = (order = {}) => {
    const values = order.customerInput?.values || order.customInputs || {};
    if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
    if (values instanceof Map) return Object.fromEntries(values.entries());
    if (typeof values.toObject === 'function') return values.toObject();
    return { ...values };
};

const getOrderPrice = (order = {}) => {
    if (order.chargedAmount !== null && order.chargedAmount !== undefined) {
        return order.chargedAmount;
    }
    if (order.totalPrice !== null && order.totalPrice !== undefined) {
        return order.totalPrice;
    }
    return 0;
};

const mapCreatedOrder = (order = {}) => ({
    order_id: order.compatOrderId,
    status: mapStatus(order.status),
    price: toFixedCompatNumber(getOrderPrice(order)),
    data: getOrderData(order),
    replay_api: null,
});

const mapCheckedOrder = (order = {}) => ({
    order_id: order.compatOrderId,
    quantity: Number(order.quantity || 0),
    data: getOrderData(order),
    created_at: formatDateTime(order.createdAt),
    product_name: order.productId?.name || null,
    price: String(getOrderPrice(order)),
    status: mapStatus(order.status),
    replay_api: null,
});

const parseOrdersQuery = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return [];

    const withoutBrackets = raw.replace(/^\[/, '').replace(/\]$/, '');
    return withoutBrackets
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
};

const parseProductIds = (value) => String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);

const extractOrderFieldsFromQuery = (query = {}) => {
    const fields = {};

    for (const [key, value] of Object.entries(query)) {
        if (key === 'qty' || key === 'order_uuid') continue;
        if (value === undefined || value === null || value === '') continue;
        fields[key] = Array.isArray(value) ? value[value.length - 1] : String(value);
    }

    return fields;
};

module.exports = {
    toNumber,
    toFixedCompatNumber,
    mapStatus,
    formatDateTime,
    getActiveFields,
    getFieldKey,
    getFieldLabel,
    getCategoryForProduct,
    mapProduct,
    mapCreatedOrder,
    mapCheckedOrder,
    parseOrdersQuery,
    parseProductIds,
    extractOrderFieldsFromQuery,
};
