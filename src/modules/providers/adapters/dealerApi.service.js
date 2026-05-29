'use strict';

const axios = require('axios');
const { BaseProviderAdapter } = require('./base.adapter');

const DEFAULT_TIMEOUT_MS = 180_000;
const PROVIDER_NAME = 'DealerApi';
const SUCCESS_CODE = '200';

const ERROR_MESSAGES = Object.freeze({
    131: 'Dealer API rejected the request. Check secretKey and request parameters.',
    138: 'Dealer API rejected the sale. Check target user ID, coin amount, and account balance.',
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
        const secretKey = options.secretKey || this._resolveToken();

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
        const userId = params.userId ?? params.toUserId ?? params.playerId;
        const coins = params.coins ?? params.amount ?? params.quantity;

        if (!userId) throw new Error(`[${PROVIDER_NAME}] userId is required`);
        if (!Number.isFinite(Number(coins)) || Number(coins) <= 0) {
            throw new Error(`[${PROVIDER_NAME}] coins must be a positive number`);
        }

        const { data } = await this._client.post('/dealer/sale', null, {
            params: {
                secretKey: this.secretKey,
                toUserId: userId,
                coins,
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
            const sale = await this.processSale({
                userId: params.userId ?? params.toUserId ?? params.playerId,
                coins: params.coins ?? params.amount ?? params.quantity,
            });

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
};
