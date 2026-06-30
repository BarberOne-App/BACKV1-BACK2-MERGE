# AresChat Integration V1

## Objetivo

Este arquivo registra a estrutura inicial da API de integracao B2B do BarberOne para consumo pelo AresChat.

Base inicial criada:

- prefixo versionado: `/api/integrations/areschat/v1`
- autenticacao machine-to-machine por bearer token
- resolucao de tenant por token salvo em `integration_credentials`
- endpoints iniciais:
  - `GET /health`
  - `GET /services`
  - `GET /professionals`
  - `GET /plans`
  - `GET /payment-methods`
  - `GET /availability`
  - `POST /customers`
  - `POST /appointments`
  - `GET /appointments/:id`
  - `POST /appointments/:id/cancel`
  - `POST /customers/eligibility`

## Variaveis de ambiente

```env
INTEGRATION_TOKEN_PEPPER=valor_forte_e_estavel_por_ambiente
```

## Decisao atual

A integracao agora usa o modelo multi-tenant por credencial:

- cada barbearia possui uma ou mais credenciais de integracao
- o AresChat envia apenas o Bearer Token
- o BarberOne identifica o `barbershop_id` pelo hash do token
- o token real nao fica salvo no banco
- tokens podem ser revogados e rotacionados

Para detalhes operacionais, ver `ARESCHAT_MULTI_TENANT_SETUP.md`.

## Contrato inicial

### Health

`GET /api/integrations/areschat/v1/health`

### Services

`GET /api/integrations/areschat/v1/services`

Query opcional:

- `q`

### Professionals

`GET /api/integrations/areschat/v1/professionals`

Query opcional:

- `q`
- `serviceId`

### Eligibility

`POST /api/integrations/areschat/v1/customers/eligibility`

Body:

```json
{
  "channel": "whatsapp",
  "identifierType": "phone",
  "identifierValue": "5511999999999",
  "context": {
    "entryPoint": "chatbot"
  }
}
```

### Create Customer

`POST /api/integrations/areschat/v1/customers`

Body:

```json
{
  "name": "Cliente Teste",
  "phone": "5511999999999",
  "email": "cliente@teste.com",
  "document": "12345678900"
}
```

Comportamento:

- exige `name`
- exige ao menos um identificador entre `phone`, `email` ou `document`
- se o cliente ja existir na barbearia, retorna o registro atual com `created: false`
- se o cliente existir globalmente em outra barbearia, vincula na barbearia atual e retorna `created: false`
- se nao existir, cria um novo cliente com `created: true`

Resposta:

```json
{
  "id": "uuid",
  "name": "Cliente Teste",
  "phone": "5511999999999",
  "email": "cliente@teste.com",
  "document": "12345678900",
  "created": true
}
```

### Create Appointment

`POST /api/integrations/areschat/v1/appointments`

Body:

```json
{
  "customerId": "uuid",
  "professionalId": "uuid",
  "date": "2026-05-20",
  "time": "09:00",
  "serviceId": "uuid",
  "notes": "Agendamento via AresChat"
}
```

Tambem aceita:

- `serviceIds`: array de UUIDs
- `dependentId`: quando o agendamento pertence a um dependente

Resposta:

```json
{
  "id": "uuid",
  "status": "scheduled",
  "customerId": "uuid",
  "professionalId": "uuid",
  "dependentId": null,
  "date": "2026-05-20",
  "time": "12:00",
  "startAt": "2026-05-20T15:00:00.000Z",
  "endAt": "2026-05-20T15:30:00.000Z",
  "notes": "Agendamento via AresChat",
  "services": [
    {
      "id": "uuid",
      "appointmentServiceId": "uuid",
      "name": "Corte teste",
      "unitPrice": 100,
      "durationMinutes": 40,
      "quantity": 1
    }
  ],
  "totalAmount": 100
}
```

### Get Appointment By Id

`GET /api/integrations/areschat/v1/appointments/:id`

Retorna o agendamento no mesmo contrato da criacao.

### Cancel Appointment

`POST /api/integrations/areschat/v1/appointments/:id/cancel`

Cancela o agendamento e retorna o mesmo contrato com `status: "cancelled"`.

## Proximos endpoints recomendados
