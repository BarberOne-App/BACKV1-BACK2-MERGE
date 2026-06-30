# AresChat + BarberOne multi-tenant

## Objetivo

Permitir que um unico backend BarberOne atenda varias barbearias e que um unico painel AresChat atenda varias empresas, sem usar `barbershopId` fixo em variavel de ambiente.

## Modelo final

```txt
AresChat Empresa A -> token A -> BarberOne -> barbershop_id A
AresChat Empresa B -> token B -> BarberOne -> barbershop_id B
```

O `barbershop_id` nao deve ser enviado pelo AresChat. O BarberOne descobre a barbearia pelo token recebido no header:

```http
Authorization: Bearer <token_da_barbearia>
```

## BarberOne - variaveis de ambiente

Obrigatorias:

```env
DATABASE_URL=postgresql://...
INTEGRATION_TOKEN_PEPPER=valor_forte_e_estavel_por_ambiente
```

Nao existe mais `barbershopId` fixo por env. Toda integracao precisa de uma credencial em `integration_credentials`.

## AresChat - configuracao por empresa

Na tela de integracoes do AresChat, cadastrar uma integracao para cada empresa:

```txt
Empresa: Empresa do AresChat
Nome: BarberOne - Nome da barbearia
Provider: barberone
Base URL: https://dominio-barberone.com/api/integrations/areschat/v1
Autenticacao: Bearer
Token: token gerado no BarberOne para a barbearia correta
Ativa: Sim
```

## Banco BarberOne

Tabela criada:

```txt
integration_credentials
- id
- provider
- barbershop_id
- name
- token_hash
- token_prefix
- active
- last_used_at
- revoked_at
- created_at
- updated_at
```

O token real nao fica salvo no banco. Apenas `token_hash` e `token_prefix`.

## Aplicar em homologacao

```bash
npx prisma migrate deploy
npm run build
```

Validar conexao e tabela:

```bash
node scripts/check-integration-db.mjs
```

Gerar token para uma barbearia:

```bash
node scripts/create-integration-credential.mjs <barbershop_id> "AresChat - Nome da barbearia"
```

O campo `token` aparece apenas uma vez no output. Esse valor deve ser cadastrado no AresChat.

## Aplicar em producao

1. Configurar `DATABASE_URL` de producao.
2. Configurar `INTEGRATION_TOKEN_PEPPER` forte e estavel.
3. Executar `npx prisma migrate deploy`.
4. Executar `npm run build`.
5. Gerar um token por barbearia com `scripts/create-integration-credential.mjs`.
6. Cadastrar cada token na empresa correspondente do AresChat.

## Rotas administrativas BarberOne

Disponiveis para super admin:

```http
GET /super-admin/barbershops/:id/integration-credentials
POST /super-admin/barbershops/:id/integration-credentials
PATCH /super-admin/integration-credentials/:credentialId/revoke
```

O `POST` retorna o token uma unica vez.

## Testes principais

Health publico:

```bash
curl -i https://dominio-barberone.com/api/integrations/areschat/v1/health
```

Rota protegida:

```bash
curl -i https://dominio-barberone.com/api/integrations/areschat/v1/services \
  -H "Authorization: Bearer <token_da_barbearia>"
```

Validar isolamento:

1. Gerar token para barbearia A.
2. Gerar token para barbearia B.
3. Chamar `/services` com token A e confirmar que retorna somente dados da barbearia A.
4. Chamar `/services` com token B e confirmar que retorna somente dados da barbearia B.
