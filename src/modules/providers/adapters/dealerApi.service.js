'use strict';

const axios = require('axios');
const { BaseProviderAdapter } = require('./base.adapter');
const { extractTargetId } = require('./providerParams.helper');

const DEFAULT_TIMEOUT_MS = 180_000;
const PROVIDER_NAME = 'DealerApi';
const SUCCESS_CODE = '200';
const KARAK_DYNAMIC_PRODUCT_ID = 'karak_dynamic_coins';
const KARAK_DYNAMIC_PRODUCT = Object.freeze({
    id: KARAK_DYNAMIC_PRODUCT_ID,
    name: 'Karak Dynamic Coins (Any Amount)',
    price: 0.00001,
    minQty: 1,
    maxQty: 5000000,
    currency: 'USD',
});
const KARAK_PROVIDER_KEYS = new Set(['karak', 'karak-chat', 'karak chat', 'karakchat']);

const ERROR_MESSAGES = Object.freeze({
    131: 'Dealer API rejected the request. Check secretKey and request parameters.',
    138: 'Dealer API rejected the sale. Check target user ID, coin amount, and account balance.',
});

const normalizeProviderKey = (value) => String(value ?? '').toLowerCase().trim();

const compactProviderKey = (value) => normalizeProviderKey(value).replace(/[^a-z0-9]/g, '');

const isKarakProvider = (provider = {}) => {
    const candidates = [provider.code, provider.slug, provider.name, provider.providerCode];

    return candidates.some((value) => {
        const normalized = normalizeProviderKey(value);
        const compact = compactProviderKey(value);
        return KARAK_PROVIDER_KEYS.has(normalized) || KARAK_PROVIDER_KEYS.has(compact);
    });
};

const buildKarakDynamicProductDto = () => ({
    ...KARAK_DYNAMIC_PRODUCT,
    externalProductId: KARAK_DYNAMIC_PRODUCT.id,
    rawName: KARAK_DYNAMIC_PRODUCT.name,
    rawPrice: KARAK_DYNAMIC_PRODUCT.price,
    costPrice: KARAK_DYNAMIC_PRODUCT.price,
    providerPrice: KARAK_DYNAMIC_PRODUCT.price,
    minQty: KARAK_DYNAMIC_PRODUCT.minQty,
    maxQty: KARAK_DYNAMIC_PRODUCT.maxQty,
    isActive: true,
    rawPayload: {
        ...KARAK_DYNAMIC_PRODUCT,
        product_id: KARAK_DYNAMIC_PRODUCT.id,
        product_name: KARAK_DYNAMIC_PRODUCT.name,
        product_price: KARAK_DYNAMIC_PRODUCT.price,
    },
});

class DealerApiError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'DealerApiError';
        this.code = details.code ?? null;
        this.statusCode = details.statusCode ?? null;
        this.providerBody = details.providerBody ?? null;
    }
}

const buildClient = (baseURL, timeoutMs = DEFAULT_TIMEOUT_MS) => {
    const client = axios.create({
        baseURL,
        timeout: timeoutMs,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });

    client.interceptors.response.use(
        (res) => res,
        (err) => {
            const status = err.response?.status;
            const body = err.response?.data;
            const message = body?.message || body?.msg || body?.error || err.message || 'Unknown provider error';

            return Promise.reject(new DealerApiError(
                `[${PROVIDER_NAME}] HTTP ${status ?? 'NETWORK'}: ${message}`,
                {
                    statusCode: status ?? null,
                    providerBody: body ?? null,
                }
            ));
        }
    );

    return client;
};

const getProviderMessage = (payload, fallback = 'Dealer API request failed.') => {
    const code = String(payload?.code ?? '').trim();

    return payload?.message
        || payload?.msg
        || payload?.error
        || ERROR_MESSAGES[code]
        || fallback;
};

const assertSuccess = (payload, operation) => {
    const code = String(payload?.code ?? '').trim();

    if (code === SUCCESS_CODE) return payload;

    throw new DealerApiError(
        `[${PROVIDER_NAME}] ${operation} failed with code ${code || 'UNKNOWN'}: ${getProviderMessage(payload)}`,
        {
            code: code || null,
            providerBody: payload,
        }
    );
};

class DealerApiAdapter extends BaseProviderAdapter {
    constructor(provider, options = {}) {
        super(provider, options);

        const baseUrl = options.baseUrl || provider.baseUrl;
        const secretKey = options.secretKey
            || this._resolveToken()
            || provider.secretKey
            || provider.secret;

        if (!baseUrl) throw new Error(`[${PROVIDER_NAME}] provider.baseUrl is required`);
        if (!secretKey) throw new Error(`[${PROVIDER_NAME}] secretKey (apiToken / apiKey) is required`);

        this.secretKey = secretKey;
        this._client = buildClient(baseUrl, options.timeoutMs);
    }

    /**
     * GET /dealer/account?secretKey={secretKey}
     *
     * @returns {Promise<{ coinBalance: number, rawResponse: object }>}
     */
    async checkBalance() {
        const { data } = await this._client.get('/dealer/account', {
            params: { secretKey: this.secretKey },
        });

        assertSuccess(data, 'checkBalance');

        return {
            coinBalance: Number(data.data?.coinBalance ?? 0),
            rawResponse: data,
        };
    }

    async getBalance() {
        const balance = await this.checkBalance();

        return {
            balance: balance.coinBalance,
            coinBalance: balance.coinBalance,
            rawResponse: balance.rawResponse,
        };
    }

    /**
     * GET /dealer/user-info?secretKey={secretKey}&userId={userId}
     *
     * @param {string|number} userId
     * @returns {Promise<{ uid: string, nickName: string, avatar: string|null, rawResponse: object }>}
     */
    async validateUser(userId) {
        if (!userId) throw new Error(`[${PROVIDER_NAME}] userId is required`);

        const { data } = await this._client.get('/dealer/user-info', {
            params: {
                secretKey: this.secretKey,
                userId,
            },
        });

        assertSuccess(data, 'validateUser');

        return {
            uid: String(data.data?.uid ?? userId),
            nickName: data.data?.nickName ?? '',
            avatar: data.data?.avatar ?? null,
            rawResponse: data,
        };
    }

    /**
     * POST /dealer/sale?secretKey={secretKey}&toUserId={userId}&coins={coins}
     *
     * Query-string parameters are required even though this is a POST.
     *
     * @param {Object} params
     * @param {string|number} params.userId
     * @param {number} params.coins
     * @returns {Promise<{ success: boolean, rawResponse: object }>}
     */
    async processSale(params = {}) {
        const userId = extractTargetId(params);
        const coins = params.coins ?? params.amount ?? params.quantity;
        const toUserId = Number(userId);
        const coinAmount = Number(coins);

        if (!userId) throw new Error(`[${PROVIDER_NAME}] userId is required`);
        if (!Number.isFinite(toUserId) || toUserId <= 0) {
            throw new Error(`[${PROVIDER_NAME}] toUserId must be a positive number`);
        }
        if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
            throw new Error(`[${PROVIDER_NAME}] coins must be a positive number`);
        }

        const { data } = await this._client.post('/dealer/sale', null, {
            params: {
                secretKey: this.secretKey,
                toUserId,
                coins: coinAmount,
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        assertSuccess(data, 'processSale');

        return {
            success: true,
            rawResponse: data,
        };
    }

    async placeOrder(params = {}) {
        try {
            const targetId = extractTargetId(params);
            if (!targetId) {
                return {
                    success: false,
                    providerOrderId: null,
                    providerStatus: 'Cancelled',
                    unifiedStatus: this.toUnifiedStatus('Cancelled'),
                    rawResponse: {
                        status: 'ERROR',
                        msg: 'Missing provider target/player ID',
                    },
                    errorCode: null,
                    errorMessage: 'Missing provider target/player ID',
                };
            }

            const providerProductId = params.providerProductId ?? params.externalProductId ?? params.productId;
            const isKarakDynamicProduct = String(providerProductId || '').trim() === KARAK_DYNAMIC_PRODUCT_ID;
            const saleParams = isKarakDynamicProduct
                ? {
                    toUserId: targetId,
                    coins: Number(params.quantity),
                }
                : {
                    userId: targetId,
                    coins: params.coins ?? params.amount ?? params.quantity,
                };

            const sale = await this.processSale(saleParams);

            return {
                success: true,
                providerOrderId: params.referenceId ?? null,
                providerStatus: 'Completed',
                unifiedStatus: this.toUnifiedStatus('Completed'),
                rawResponse: sale.rawResponse,
                errorMessage: null,
            };
        } catch (err) {
            return {
                success: false,
                providerOrderId: null,
                providerStatus: 'Cancelled',
                unifiedStatus: this.toUnifiedStatus('Cancelled'),
                rawResponse: err.providerBody ?? { message: err.message },
                errorCode: err.code ?? null,
                errorMessage: err.message,
            };
        }
    }

    /**
     * GET /dealer/list?secretKey={secretKey}&page={page}
     *
     * @param {number} [page=1]
     * @returns {Promise<{ rows: Array, page: number, rawResponse: object }>}
     */
    async getTransactionList(page = 1) {
        const { data } = await this._client.get('/dealer/list', {
            params: {
                secretKey: this.secretKey,
                page,
            },
        });

        assertSuccess(data, 'getTransactionList');

        return {
            rows: Array.isArray(data.data?.rows) ? data.data.rows : [],
            page: Number(page),
            rawResponse: data,
        };
    }

    async listTransactions(page = 1) {
        return this.getTransactionList(page);
    }

    async getProducts() {
        if (isKarakProvider(this.provider)) {
            return [buildKarakDynamicProductDto()];
        }

        return [];
    }

    async checkOrder(orderId) {
        return {
            providerOrderId: String(orderId),
            providerStatus: 'Completed',
            unifiedStatus: this.toUnifiedStatus('Completed'),
            rawResponse: null,
        };
    }

    async checkOrders(orderIds = []) {
        return orderIds.map((orderId) => ({
            providerOrderId: String(orderId),
            providerStatus: 'Completed',
            unifiedStatus: this.toUnifiedStatus('Completed'),
            rawResponse: null,
        }));
    }
}

module.exports = {
    DealerApiAdapter,
    DealerApiError,
    KARAK_DYNAMIC_PRODUCT_ID,
    KARAK_DYNAMIC_PRODUCT,
    buildKarakDynamicProductDto,
    isKarakProvider,
};
