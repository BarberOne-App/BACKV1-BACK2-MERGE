import crypto from 'crypto';
import prisma from '../database/database.js';
import { pagarmeRequest } from './pagarmeApi.js';

interface PhoneData {
    country_code: string;
    area_code: string;
    number: string;
}

interface SplitOptions {
    liable: boolean;
    charge_processing_fee: boolean;
    charge_remainder_fee: boolean;
}

interface SplitItem {
    amount: number;
    recipient_id: string;
    type: 'flat';
    options: SplitOptions;
}

interface BuildSplitParams {
    amountInCents: number;
    barbershopRecipientId: string;
    platformFeeAmountInCents: number;
}

interface Card {
    brand?: string;
    last_four_digits?: string;
    last_digits?: string;
}

interface Transaction {
    card?: Card;
    qr_code?: string;
    qr_code_url?: string;
    qr_code_url_png?: string;
}

interface Charge {
    id?: string;
    status?: string;
    payment_method?: string;
    amount?: number;
    card?: Card;
    last_transaction?: Transaction;
}

interface PagarmeOrder {
    id?: string;
    code?: string;
    status?: string;
    amount?: number;
    charges?: Charge[];
}

interface NormalizedOrder {
    orderId?: string;
    orderCode?: string;
    status?: string;
    chargeId?: string;
    chargeStatus?: string;
    amount: number;
    paymentMethod?: string;
    pixQrCode: string;
    pixQrCodeUrl: string;
    cardBrand: string;
    cardLastDigits: string;
    raw: PagarmeOrder;
}

function onlyNumbers(value: string | number | undefined | null): string {
    return String(value || '').replace(/\D/g, '');
}

function toCents(value: string | number | undefined | null): number {
    return Math.round(Number(value || 0) * 100);
}

function extractPhone(phone: string | undefined | null): PhoneData | null {
    const digits = onlyNumbers(phone);

    if (digits.length < 10) return null;

    const withoutCountry = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;

    return {
        country_code: '55',
        area_code: withoutCountry.slice(0, 2),
        number: withoutCountry.slice(2),
    };
}

function getPlatformFeeAmount(amountInCents: number, bodyFeeAmount: string | number | undefined | null): number {
    if (bodyFeeAmount !== undefined && bodyFeeAmount !== null && bodyFeeAmount !== '') {
        return Math.max(0, toCents(bodyFeeAmount));
    }

    const percent = Number(process.env.PAGARME_PLATFORM_FEE_PERCENT || 10);
    return Math.round(amountInCents * (percent / 100));
}

function buildSplit({ amountInCents, barbershopRecipientId, platformFeeAmountInCents }: BuildSplitParams): SplitItem[] {
    const platformRecipientId = process.env.PAGARME_PLATFORM_RECIPIENT_ID || null;

    if (!barbershopRecipientId) {
        throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
    }

    if (!platformRecipientId || platformFeeAmountInCents <= 0) {
        return [
            {
                amount: amountInCents,
                recipient_id: barbershopRecipientId,
                type: 'flat',
                options: {
                    liable: true,
                    charge_processing_fee: true,
                    charge_remainder_fee: true,
                },
            },
        ];
    }

    const sellerAmount = Math.max(0, amountInCents - platformFeeAmountInCents);

    return [
        {
            amount: sellerAmount,
            recipient_id: barbershopRecipientId,
            type: 'flat',
            options: {
                liable: false,
                charge_processing_fee: false,
                charge_remainder_fee: false,
            },
        },
        {
            amount: platformFeeAmountInCents,
            recipient_id: platformRecipientId,
            type: 'flat',
            options: {
                liable: true,
                charge_processing_fee: true,
                charge_remainder_fee: true,
            },
        },
    ];
}

function normalizePaymentMethod(method: any) {
    const value = String(method || '').trim().toLowerCase();

    if (value === 'pix') return 'pix';

    if (
        value === 'card' ||
        value === 'cartao' ||
        value === 'cartão' ||
        value === 'credit_card' ||
        value === 'creditcard'
    ) {
        return 'credit_card';
    }

    throw new Error(`Método de pagamento inválido: ${method}`);
}

export function normalizePagarmeOrder(order: PagarmeOrder): NormalizedOrder {
    const charge: Charge = order?.charges?.[0] ?? {};
    const lastTx: Transaction = charge?.last_transaction ?? {};
    const card: Card = lastTx?.card ?? charge?.card ?? {};

    // Pagar.me: QR code em charges[0].last_transaction.qr_code (copia-e-cola)
    // e imagem em charges[0].last_transaction.qr_code_url
    const pixQrCode = lastTx?.qr_code ?? '';
    const pixQrCodeUrl = lastTx?.qr_code_url ?? lastTx?.qr_code_url_png ?? '';

    console.log('[normalizePagarmeOrder]', {
        orderId: order?.id,
        orderStatus: order?.status,
        chargeStatus: charge?.status,
        hasPixQrCode: Boolean(pixQrCode),
        hasPixQrCodeUrl: Boolean(pixQrCodeUrl),
    });

    return {
        orderId: order?.id,
        orderCode: order?.code,
        status: order?.status,
        chargeId: charge?.id,
        chargeStatus: charge?.status,
        amount: Number(order?.amount ?? charge?.amount ?? 0) / 100,
        paymentMethod: charge?.payment_method,
        pixQrCode,
        pixQrCodeUrl,
        cardBrand: card?.brand ?? '',
        cardLastDigits: card?.last_four_digits ?? card?.last_digits ?? '',
        raw: order,
    };
}

function orderFailed(order: any): boolean {
    return order?.status === 'failed';
}

export async function createPagarmeOrderService(params: any) {
    console.log("createPagarmeOrderService called with params:", params);

    const amountInCents = toCents(params.amount);
    if (!amountInCents || amountInCents <= 0) {
        throw new Error('Valor do pagamento inválido.');
    }

    // Split é opcional — só aplica se a barbearia tiver recipient_id cadastrado
    const barbershopId = params?.metadata?.barbershopId;
    let barbershopRecipientId: string | null = null;

    if (barbershopId) {
        const shop = await prisma.barbershops.findUnique({
            where: { id: String(barbershopId) },
            select: { pagarme_recipient_id: true },
        });
        barbershopRecipientId = shop?.pagarme_recipient_id || null;
    }

    // Busca CPF e telefone reais do usuário no banco
    const userId = params?.metadata?.userId || params?.customer?.id;
    let dbPhone: string | null = null;
    let dbCpf: string | null = null;

    if (userId) {
        const dbUser = await prisma.users.findUnique({
            where: { id: String(userId) },
            select: { phone: true, cpf: true },
        });
        dbPhone = dbUser?.phone || null;
        dbCpf = dbUser?.cpf || null;
    }

    // customer — obrigatório para PIX conforme documentação Pagar.me
    const resolvedPhone = params?.customer?.phone || dbPhone;
    const resolvedDocument = params?.customer?.document || dbCpf;

    const customerPhone = extractPhone(resolvedPhone);
    const customerDocument = onlyNumbers(resolvedDocument);

    const customer = {
        name: String(params?.customer?.name || 'Cliente').trim(),
        email: String(params?.customer?.email || '').trim() || undefined,
        type: 'individual' as const,
        document: customerDocument || '00000000000',
        phones: customerPhone
            ? { mobile_phone: customerPhone }
            : { mobile_phone: { country_code: '55', area_code: '11', number: '999999999' } },
    };

    const itemName = params?.item?.name || 'Agendamento';
    const itemCode = String(params?.item?.id || '1').slice(0, 52); // Pagar.me limita o code
    const orderCode = `bo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const paymentMethod = normalizePaymentMethod(params.paymentMethod);

    const payment: any = { payment_method: paymentMethod };

    // Inclui split somente quando recipient_id estiver cadastrado
    if (barbershopRecipientId) {
        const platformFeeAmountInCents = getPlatformFeeAmount(amountInCents, params.platformFeeAmount);
        payment.split = buildSplit({ amountInCents, barbershopRecipientId, platformFeeAmountInCents });
    }

    if (paymentMethod === 'pix') {
        payment.pix = {
            expires_in: Number(process.env.PAGARME_PIX_EXPIRES_IN || 3600),
        };
    } else {
        // cartão
        if (!params.cardToken) {
            throw new Error('cardToken é obrigatório para pagamento com cartão.');
        }

        payment.credit_card = {
            operation_type: 'auth_and_capture',
            installments: Number(params.installments || 1),
            statement_descriptor: 'BarberOne',
            card_token: params.cardToken,
            card: {
                billing_address: {
                    line_1: '123, Rua Teste, Centro',
                    zip_code: '01001000',
                    city: 'Sao Paulo',
                    state: 'SP',
                    country: 'BR',
                },
            },
        };
    }

    const payload: any = {
        code: orderCode,
        customer,
        items: [
            {
                amount: amountInCents,
                description: itemName,
                quantity: 1,
                code: itemCode,
            },
        ],
        payments: [payment],
    };

    if (params.metadata && Object.keys(params.metadata).length > 0) {
        payload.metadata = params.metadata;
    }

    console.log('Pagar.me order payload:', JSON.stringify(payload, null, 2));

    const order = await pagarmeRequest('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(payload),
    });

    console.log('Pagar.me order response:', JSON.stringify(order, null, 2));

    // Se o order falhou e havia split, retentar sem split (recipient inválido, sandbox, etc.)
    if (orderFailed(order) && payment.split) {
        console.warn('[Pagar.me] Order falhou com split — retentando sem split...', {
            gatewayErrors: order?.charges?.[0]?.last_transaction?.gateway_response?.errors,
        });
        delete payment.split;
        const retryPayload = { ...payload, code: `bo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`, payments: [payment] };
        const retryOrder = await pagarmeRequest('/orders', {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify(retryPayload),
        });
        console.log('Pagar.me retry response:', JSON.stringify(retryOrder, null, 2));
        return normalizePagarmeOrder(retryOrder);
    }

    return normalizePagarmeOrder(order);
}

export async function getPagarmeOrderStatusService(orderId: string) {
    const order = await pagarmeRequest(`/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
    });

    return normalizePagarmeOrder(order);
}

function normalizeRecipientAmount(value: unknown, fieldLabel: string) {
    if (typeof value === 'number') {
        if (Number.isFinite(value) && value >= 0) return value;
        throw new Error(`${fieldLabel} deve ser um número válido maior ou igual a zero.`);
    }

    let normalized = String(value ?? '').trim().replace(/\s|R\$/gi, '');
    if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
    const amount = Number(normalized);
    if (!normalized || !Number.isFinite(amount) || amount < 0) {
        throw new Error(`${fieldLabel} deve ser um número válido maior ou igual a zero.`);
    }
    return amount;
}

function normalizeRecipientDate(value: unknown, fieldLabel: string) {
    const raw = String(value ?? '').trim();
    const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const normalized = slashMatch ? `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}` : raw.slice(0, 10);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
    if (!match || !date || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
        throw new Error(`${fieldLabel} deve estar no formato YYYY-MM-DD.`);
    }
    // O formulário usa ISO, mas o contrato de recebedores do Pagar.me V5
    // exemplifica e processa as datas cadastrais em DD/MM/YYYY.
    return `${match[3]}/${match[2]}/${match[1]}`;
}

function buildIndividualRecipientPayload(params: any) {
    const register_information = params.register_information ? { ...params.register_information } : {};

    const document = String(register_information.document || '').replace(/\D/g, '');
    const phoneNumbers = register_information.phone_numbers || [];
    const phone = phoneNumbers[0];
    const fullPhone = String(phone?.ddd || '') + String(phone?.number || '');
    const phoneDigits = fullPhone.replace(/\D/g, '');
    const address = register_information.address || {};

    // Validations
    if (!register_information.name || !String(register_information.name).trim()) {
        throw new Error('Nome do responsável é obrigatório para Pessoa Física.');
    }
    if (!/^\S+@\S+\.\S+$/.test(String(register_information.email || '').trim())) {
        throw new Error('E-mail válido do recebedor é obrigatório para Pessoa Física.');
    }
    if (!document || document.length !== 11) {
        throw new Error('Documento inválido. Pessoa Física exige CPF (11 dígitos).');
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error('Telefone do recebedor inválido. Deve conter DDD + número (10 ou 11 dígitos).');
    }
    if (!address.street || !String(address.street).trim() ||
        !address.street_number || !String(address.street_number).trim() ||
        !address.neighborhood || !String(address.neighborhood).trim() ||
        !address.city || !String(address.city).trim() ||
        !address.state || !String(address.state).trim() ||
        !address.zip_code || !String(address.zip_code).trim()) {
        throw new Error('Endereço completo (Rua, Número, Bairro, Cidade, Estado e CEP) é obrigatório.');
    }
    if (!register_information.birthdate) {
        throw new Error('Data de nascimento é obrigatória para Pessoa Física.');
    }
    if (!register_information.professional_occupation || !String(register_information.professional_occupation).trim()) {
        throw new Error('Ocupação profissional é obrigatória para Pessoa Física.');
    }
    if (register_information.monthly_income === undefined || register_information.monthly_income === null || register_information.monthly_income === '') {
        throw new Error('Renda mensal é obrigatória para Pessoa Física.');
    }

    const birthdate = normalizeRecipientDate(register_information.birthdate, 'Data de nascimento');

    return {
        name: register_information.name.trim(),
        email: String(register_information.email || '').trim().toLowerCase(),
        type: 'individual',
        document: document,
        birthdate: birthdate,
        monthly_income: Math.round(normalizeRecipientAmount(register_information.monthly_income, 'Renda mensal')),
        professional_occupation: register_information.professional_occupation.trim(),
        phone_numbers: [{ ddd: phoneDigits.slice(0, 2), number: phoneDigits.slice(2), type: 'mobile' }],
        address: {
            street: address.street.trim(),
            street_number: address.street_number.trim(),
            complementary: address.complementary ? address.complementary.trim() : 'Não informado',
            neighborhood: address.neighborhood.trim(),
            city: address.city.trim(),
            state: address.state.trim().toUpperCase(),
            zip_code: address.zip_code.replace(/\D/g, ''),
            reference_point: address.reference_point ? address.reference_point.trim() : 'Não informado',
        }
    };
}

function buildCorporationRecipientPayload(params: any) {
    const register_information = params.register_information ? { ...params.register_information } : {};

    const document = String(register_information.document || '').replace(/\D/g, '');
    const phoneNumbers = register_information.phone_numbers || [];
    const phone = phoneNumbers[0];
    const fullPhone = String(phone?.ddd || '') + String(phone?.number || '');
    const phoneDigits = fullPhone.replace(/\D/g, '');
    const mainAddress = register_information.main_address || register_information.address || {};

    // Validations
    if (!document || document.length !== 14) {
        throw new Error('Documento inválido. Pessoa Jurídica exige CNPJ (14 dígitos).');
    }
    const companyName = register_information.company_name || register_information.name || '';
    if (!companyName || !String(companyName).trim()) {
        throw new Error('Razão Social (company_name) é obrigatória para Pessoa Jurídica.');
    }
    const tradingName = register_information.trading_name || companyName || '';
    if (!tradingName || !String(tradingName).trim()) {
        throw new Error('Nome Fantasia (trading_name) é obrigatório para Pessoa Jurídica.');
    }
    if (!/^\S+@\S+\.\S+$/.test(String(register_information.email || '').trim())) {
        throw new Error('E-mail válido da empresa é obrigatório para Pessoa Jurídica.');
    }
    if (register_information.annual_revenue === undefined || register_information.annual_revenue === null || register_information.annual_revenue === '') {
        throw new Error('Receita Anual (annual_revenue) é obrigatória para Pessoa Jurídica.');
    }
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
        throw new Error('Telefone da empresa inválido. Deve conter DDD + número (10 ou 11 dígitos).');
    }
    if (!mainAddress.street || !String(mainAddress.street).trim() ||
        (!mainAddress.number && !mainAddress.street_number) ||
        !mainAddress.neighborhood || !String(mainAddress.neighborhood).trim() ||
        !mainAddress.city || !String(mainAddress.city).trim() ||
        !mainAddress.state || !String(mainAddress.state).trim() ||
        !mainAddress.zip_code || !String(mainAddress.zip_code).trim()) {
        throw new Error('Endereço completo da empresa (Rua, Número, Bairro, Cidade, Estado e CEP) é obrigatório.');
    }

    const partners = register_information.managing_partners || [];
    if (!Array.isArray(partners) || partners.length === 0) {
        throw new Error('Pelo menos um sócio administrador (managing_partners) é obrigatório para Pessoa Jurídica.');
    }

    const partner = { ...partners[0] };
    if (!partner.name || !String(partner.name).trim()) {
        throw new Error('Nome do sócio administrador é obrigatório.');
    }
    const partnerDoc = String(partner.document || partner.document_number || '').replace(/\D/g, '');
    if (partnerDoc.length !== 11) {
        throw new Error('CPF do sócio administrador inválido (deve conter 11 dígitos).');
    }
    if (!/^\S+@\S+\.\S+$/.test(String(partner.email || '').trim())) {
        throw new Error('E-mail válido do sócio administrador é obrigatório.');
    }
    if (!partner.birthdate) {
        throw new Error('Data de nascimento do sócio administrador é obrigatória.');
    }
    if (!partner.professional_occupation || !String(partner.professional_occupation).trim()) {
        throw new Error('Profissão do sócio administrador é obrigatória.');
    }
    if (partner.monthly_income === undefined || partner.monthly_income === null || partner.monthly_income === '') {
        throw new Error('Renda mensal do sócio administrador é obrigatória.');
    }

    const partnerAddress = partner.address || {};
    if (!partnerAddress.street || !String(partnerAddress.street).trim() ||
        (!partnerAddress.street_number && !partnerAddress.number) ||
        !partnerAddress.neighborhood || !String(partnerAddress.neighborhood).trim() ||
        !partnerAddress.city || !String(partnerAddress.city).trim() ||
        !partnerAddress.state || !String(partnerAddress.state).trim() ||
        !partnerAddress.zip_code || !String(partnerAddress.zip_code).trim()) {
        throw new Error('Endereço completo do sócio administrador (Rua, Número, Bairro, Cidade, Estado e CEP) é obrigatório.');
    }

    const partnerBirthdate = normalizeRecipientDate(partner.birthdate, 'Data de nascimento do sócio administrador');

    const partnerPhoneNumbers = partner.phone_numbers || [];
    const partnerPhone = partnerPhoneNumbers[0];
    const fullPartnerPhone = String(partnerPhone?.ddd || partner.phone || '') + String(partnerPhone?.number || '');
    const partnerPhoneDigits = fullPartnerPhone.replace(/\D/g, '');
    if (partnerPhoneDigits.length < 10 || partnerPhoneDigits.length > 11) {
        throw new Error('Telefone do sócio administrador inválido. Deve conter DDD + número (10 ou 11 dígitos).');
    }

    const companyNumber = String(mainAddress.number || mainAddress.street_number || '').trim();
    const partnerNumber = String(partnerAddress.street_number || partnerAddress.number || '').trim();

    return {
        type: 'corporation',
        company_name: String(companyName).trim(),
        trading_name: String(tradingName).trim(),
        email: String(register_information.email || '').trim().toLowerCase(),
        document: document,
        annual_revenue: Math.round(normalizeRecipientAmount(register_information.annual_revenue, 'Receita anual')),
        phone_numbers: [{ ddd: phoneDigits.slice(0, 2), number: phoneDigits.slice(2), type: 'mobile' }],
        main_address: {
            street: mainAddress.street.trim(),
            street_number: companyNumber,
            complementary: mainAddress.complementary ? mainAddress.complementary.trim() : 'Não informado',
            neighborhood: mainAddress.neighborhood.trim(),
            city: mainAddress.city.trim(),
            state: mainAddress.state.trim().toUpperCase(),
            zip_code: mainAddress.zip_code.replace(/\D/g, ''),
            reference_point: mainAddress.reference_point ? mainAddress.reference_point.trim() : 'Não informado',
        },
        managing_partners: [
            {
                type: 'individual',
                name: partner.name.trim(),
                document: partnerDoc,
                email: partner.email.trim().toLowerCase(),
                birthdate: partnerBirthdate,
                monthly_income: String(Math.round(normalizeRecipientAmount(partner.monthly_income, 'Renda mensal do sócio administrador'))),
                professional_occupation: partner.professional_occupation.trim(),
                self_declared_legal_representative: true,
                phone_numbers: [{ ddd: partnerPhoneDigits.slice(0, 2), number: partnerPhoneDigits.slice(2), type: 'mobile' }],
                address: {
                    street: partnerAddress.street.trim(),
                    street_number: partnerNumber,
                    complementary: partnerAddress.complementary ? partnerAddress.complementary.trim() : 'Não informado',
                    neighborhood: partnerAddress.neighborhood.trim(),
                    city: partnerAddress.city.trim(),
                    state: partnerAddress.state.trim().toUpperCase(),
                    zip_code: partnerAddress.zip_code.replace(/\D/g, ''),
                    reference_point: partnerAddress.reference_point ? partnerAddress.reference_point.trim() : 'Não informado'
                }
            }
        ]
    };
}

function buildRecipientPayload(params: any) {
    if (!params?.register_information || typeof params.register_information !== 'object') {
        throw new Error('Informações de registro (register_information) são obrigatórias.');
    }
    const register_information = params.register_information;
    const default_bank_account = params.default_bank_account ? { ...params.default_bank_account } : undefined;

    const document = String(register_information.document || '').replace(/\D/g, '');
    const isCPF = document.length === 11;
    const isCNPJ = document.length === 14;

    if (!isCPF && !isCNPJ) {
        throw new Error('Documento do recebedor inválido. Deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).');
    }

    const docTypeLog = isCPF ? 'Pessoa Física (CPF)' : 'Pessoa Jurídica (CNPJ)';
    console.log(`[Pagar.me DEBUG] Documento informado: ${document} | Tipo identificado: ${docTypeLog}`);

    let formattedRegisterInformation: any;
    if (isCPF) {
        formattedRegisterInformation = buildIndividualRecipientPayload(params);
    } else {
        formattedRegisterInformation = buildCorporationRecipientPayload(params);
    }

    if (!default_bank_account) {
        throw new Error('Dados da conta bancária padrão (default_bank_account) são obrigatórios.');
    }

    const bankHolderDoc = String(default_bank_account.holder_document || '').replace(/\D/g, '') || document;
    default_bank_account.holder_document = bankHolderDoc;

    if (bankHolderDoc.length !== document.length) {
        throw new Error('Documento do titular da conta bancária inválido. Deve ser um CPF ou CNPJ.');
    }
    default_bank_account.holder_type = isCPF ? 'individual' : 'company';

    if (!default_bank_account.holder_name || !String(default_bank_account.holder_name).trim()) {
        throw new Error('Nome do titular da conta bancária é obrigatório.');
    }
    default_bank_account.holder_name = String(default_bank_account.holder_name).trim();
    if (default_bank_account.holder_name.length > 29) {
        throw new Error('Nome do titular da conta bancária deve ter no máximo 29 caracteres.');
    }
    if (!default_bank_account.bank || !String(default_bank_account.bank).trim()) {
        throw new Error('Código do banco é obrigatório.');
    }
    if (!default_bank_account.branch_number || !String(default_bank_account.branch_number).trim()) {
        throw new Error('Número da agência bancária é obrigatório.');
    }
    if (!default_bank_account.account_number || !String(default_bank_account.account_number).trim()) {
        throw new Error('Número da conta bancária é obrigatório.');
    }
    if (!default_bank_account.account_check_digit || !String(default_bank_account.account_check_digit).trim()) {
        throw new Error('Dígito verificador da conta bancária é obrigatório.');
    }

    return {
        register_information: formattedRegisterInformation,
        default_bank_account,
        transfer_settings: params.transfer_settings || {
            transfer_enabled: true,
            transfer_interval: 'daily',
            transfer_day: 0,
        },
        metadata: {
            barbershopId: String(params.barbershopId || ''),
            ...(params.metadata || {}),
        },
        code: params.code || `barbershop_${params.barbershopId || crypto.randomUUID()}`,
    };
}

async function linkRecipientToBarbershop(barbershopId: string, recipientId: string, status: string | null) {
    const exists = await prisma.barbershops.findUnique({
        where: { id: String(barbershopId) },
        select: { id: true },
    });
    if (exists) {
        await prisma.barbershops.update({
            where: { id: String(barbershopId) },
            data: {
                pagarme_recipient_id: recipientId,
                pagarme_recipient_status: status || null,
            },
        });
    }
}

export async function createPagarmeRecipientService(params: any) {
    let payload: ReturnType<typeof buildRecipientPayload>;
    try {
        payload = buildRecipientPayload(params);
    } catch (error) {
        if (error instanceof Error) (error as any).status = 400;
        throw error;
    }

    console.log('[Pagar.me DEBUG] Payload final montado para criação de recebedor:', JSON.stringify(payload, null, 2));

    const recipient = await pagarmeRequest('/recipients', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(payload),
    });

    console.log('[Pagar.me DEBUG] Resposta retornada pela API do Pagar.me na criação:', JSON.stringify(recipient, null, 2));

    if (params.linkBarbershop && params.barbershopId && recipient?.id) {
        await linkRecipientToBarbershop(params.barbershopId, recipient.id, recipient.status ?? null);
    }

    return recipient;
}

export async function getPagarmeRecipientService(recipientId: string) {
    if (!recipientId) throw new Error('Recipient ID é obrigatório.');
    return pagarmeRequest(`/recipients/${encodeURIComponent(recipientId)}`, { method: 'GET' });
}

export async function updatePagarmeRecipientService(params: any) {
    const recipientId = String(params.recipientId || params.id || '').trim();
    if (!recipientId) throw new Error('Recipient ID é obrigatório para atualização.');

    let payload: ReturnType<typeof buildRecipientPayload>;
    try {
        payload = buildRecipientPayload(params);
    } catch (error) {
        if (error instanceof Error) (error as any).status = 400;
        throw error;
    }

    // Conforme o contrato oficial do PUT /recipients/{recipient_id}, a edição
    // cadastral recebe register_information e metadata. Conta bancária,
    // transfer_settings e code fazem parte do contrato de criação e não devem
    // ser reenviados neste PUT.
    const updatePayload = {
        register_information: payload.register_information,
        metadata: payload.metadata,
    };

    console.log(`[Pagar.me DEBUG] Payload final montado para atualização do recebedor (${recipientId}):`, JSON.stringify(updatePayload, null, 2));

    const recipient = await pagarmeRequest(`/recipients/${encodeURIComponent(recipientId)}`, {
        method: 'PUT',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(updatePayload),
    });

    console.log(`[Pagar.me DEBUG] Resposta retornada pela API do Pagar.me na atualização (${recipientId}):`, JSON.stringify(recipient, null, 2));

    if (params.linkBarbershop && params.barbershopId && recipient?.id) {
        await linkRecipientToBarbershop(params.barbershopId, recipient.id, recipient.status ?? null);
    }

    return recipient;
}
