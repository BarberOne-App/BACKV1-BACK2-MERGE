const DEFAULT_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://api.pagar.me/core/v5'
    : 'https://sdx-api.pagar.me/core/v5';

export const PAGARME_BASE_URL = String(process.env.PAGARME_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

function getAuthHeader() {
    const secretKey = process.env.PAGARME_SECRET_KEY;

    if (!secretKey) {
        throw new Error('PAGARME_SECRET_KEY não foi definida no .env do backend.');
    }

    return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export async function pagarmeRequest(path: string, options: RequestInit = {}) {
    const response = await fetch(`${PAGARME_BASE_URL}${path}`, {
        ...options,
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: getAuthHeader(),
            ...(options.headers || {}),
        },
    });

    const rawText = await response.text();

    let data: any = {};

    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {
        data = { raw: rawText };
    }

    console.log("DATA AQUI:", data);

    if (!response.ok) {
        console.log("Erro API PAGARME AQUI:", JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            data,
        }, null, 2));

        const message =
            data?.message ||
            data?.details ||
            data?.error ||
            data?.errors?.[0]?.message ||
            'Erro na API Pagar.me.';

        const error: any = new Error(message);
        error.status = response.status;
        error.details = data;
        throw error;
    }

    return data;
}
