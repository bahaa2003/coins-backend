'use strict';

/**
 * providerProduct.service.js
 *
 * Layer 2 service — ProviderProduct CRUD and admin queries.
 *
 * These records are INTERNAL ONLY. They are never exposed to end-users.
 * Admins browse them to decide which products to publish to the platform.
 *
 * Responsibilities:
 *   - List / search provider products (admin product-selection screen)
 *   - Update translatedName or other admin annotations
 *   - Get by ID (used by publish flow)
 */

const { ProviderProduct } = require('./providerProduct.model');
const { Provider } = require('./provider.model');
const { NotFoundError } = require('../../shared/errors/AppError');
const {
    KARAK_DYNAMIC_PRODUCT_ID,
    KARAK_DYNAMIC_PRODUCT,
    buildKarakDynamicProductDto,
    isKarakProvider,
} = require('./adapters/dealerApi.service');

const toPlainObject = (value) => {
    if (!value) return value;
    if (typeof value.toObject === 'function') {
        return value.toObject({ getters: false, virtuals: false });
    }
    return { ...value };
};

const isKarakDynamicProduct = (product) => (
    String(product?.externalProductId || '').trim() === KARAK_DYNAMIC_PRODUCT_ID
);

const normalizeKarakDynamicProduct = (product) => {
    const plain = toPlainObject(product);
    if (!isKarakDynamicProduct(plain)) return plain;

    const price = Number(KARAK_DYNAMIC_PRODUCT.price);

    return {
        ...plain,
        id: plain.id ?? plain._id,
        externalProductId: KARAK_DYNAMIC_PRODUCT.id,
        rawName: KARAK_DYNAMIC_PRODUCT.name,
        rawPrice: price,
        price,
        costPrice: price,
        providerPrice: price,
        minQty: KARAK_DYNAMIC_PRODUCT.minQty,
        maxQty: KARAK_DYNAMIC_PRODUCT.maxQty,
        isActive: true,
        rawPayload: {
            ...(plain.rawPayload || {}),
            ...KARAK_DYNAMIC_PRODUCT,
            product_id: KARAK_DYNAMIC_PRODUCT.id,
            product_name: KARAK_DYNAMIC_PRODUCT.name,
            product_price: price,
        },
    };
};

const ensureKarakDynamicProduct = async (providerId) => {
    if (!providerId) return null;

    const provider = await Provider.findById(providerId)
        .select('name slug isActive')
        .lean();

    if (!provider || !isKarakProvider(provider)) return null;

    const dto = buildKarakDynamicProductDto();
    const now = new Date();

    return ProviderProduct.findOneAndUpdate(
        {
            provider: provider._id,
            externalProductId: KARAK_DYNAMIC_PRODUCT_ID,
        },
        {
            $set: {
                rawName: dto.rawName,
                rawPrice: dto.rawPrice,
                minQty: dto.minQty,
                maxQty: dto.maxQty,
                isActive: true,
                rawPayload: dto.rawPayload,
                lastSyncedAt: now,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }
    );
};

// =============================================================================
// LIST / SEARCH
// =============================================================================

/**
 * listProviderProducts(filter, paginationOptions)
 *
 * Returns a paginated list of ProviderProducts.
 *
 * @param {Object} filter               - Mongoose filter (e.g. { provider, isActive })
 * @param {Object} [opts]
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=50]
 * @param {string} [opts.search]        - partial text match on rawName / translatedName
 * @returns {Promise<{ products, pagination }>}
 */
const listProviderProducts = async (filter = {}, { page = 1, limit = 500, search } = {}) => {
    const query = { ...filter };

    if (query.provider) {
        await ensureKarakDynamicProduct(query.provider);
    }

    if (search) {
        const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$or = [{ rawName: re }, { translatedName: re }];
    }

    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
        ProviderProduct.find(query)
            .sort({ rawName: 1 })
            .skip(skip)
            .limit(limit)
            .populate('provider', 'name slug'),
        ProviderProduct.countDocuments(query),
    ]);

    return {
        products: products.map(normalizeKarakDynamicProduct),
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};

// =============================================================================
// GET ONE
// =============================================================================

/**
 * getProviderProductById(id)
 * Throws NotFoundError if missing.
 */
const getProviderProductById = async (id) => {
    const pp = await ProviderProduct.findById(id).populate('provider', 'name slug isActive');
    if (!pp) throw new NotFoundError('ProviderProduct');
    return normalizeKarakDynamicProduct(pp);
};

// =============================================================================
// ADMIN ANNOTATIONS
// =============================================================================

/**
 * setTranslatedName(providerProductId, translatedName)
 *
 * Admin sets a human-friendly localised name for a raw provider product.
 * This value is NEVER overwritten by sync runs.
 *
 * @returns {Promise<ProviderProduct>}
 */
const setTranslatedName = async (providerProductId, translatedName) => {
    const pp = await ProviderProduct.findByIdAndUpdate(
        providerProductId,
        { $set: { translatedName: translatedName?.trim() || null } },
        { new: true, runValidators: true }
    );
    if (!pp) throw new NotFoundError('ProviderProduct');
    return pp;
};

module.exports = {
    listProviderProducts,
    getProviderProductById,
    setTranslatedName,
    ensureKarakDynamicProduct,
    normalizeKarakDynamicProduct,
};
