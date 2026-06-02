# 📋 Especificação Completa do Backend — SGA Barbearia (Multi-Tenant)

> Documento gerado a partir da análise completa do frontend React.
> Objetivo: fornecer tudo que é necessário para construir o backend Node.js do zero.

---

## 📑 Índice

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura Multi-Tenant](#2-arquitetura-multi-tenant)
3. [Modelagem do Banco de Dados](#3-modelagem-do-banco-de-dados)
4. [Autenticação e Autorização](#4-autenticação-e-autorização)
5. [Rotas da API (Endpoints)](#5-rotas-da-api-endpoints)
6. [Serviços do Backend (Camada de Negócio)](#6-serviços-do-backend-camada-de-negócio)
7. [Integrações Externas (Pagamento e Notificações)](#7-integrações-externas-pagamento-e-notificações)
8. [Middleware e Infraestrutura](#8-middleware-e-infraestrutura)
9. [Validações e Regras de Negócio](#9-validações-e-regras-de-negócio)
10. [Estrutura de Pastas Sugerida](#10-estrutura-de-pastas-sugerida)
11. [Stack Tecnológica Recomendada](#11-stack-tecnológica-recomendada)
12. [Variáveis de Ambiente](#12-variáveis-de-ambiente)
13. [Resumo de Endpoints por Módulo](#13-resumo-de-endpoints-por-módulo)
14. [Observações e Pendências do Frontend](#14-observações-e-pendências-do-frontend)

---

## 1. Visão Geral do Sistema

O SGA Barbearia é um sistema de gestão para barbearias com modelo **multi-tenant**, onde cada barbearia (tenant) opera de forma isolada com seus próprios dados.

### Funcionalidades Principais

| Módulo | Descrição |
|--------|-----------|
| **Autenticação** | Login, cadastro, sessão com JWT, roles e permissões granulares |
| **Agendamentos** | Calendário com slots de 30min, conflitos, barbeiro fixo mensal para assinantes |
| **Serviços** | CRUD de serviços oferecidos (corte, barba, luzes etc.) |
| **Barbeiros** | CRUD + vinculação com conta de usuário, comissão %, especialidade |
| **Produtos** | CRUD com estoque, categorias, desconto para assinantes |
| **Assinaturas** | Planos mensais com cobrança recorrente, benefícios, barbeiro fixo |
| **Pagamentos** | PIX, Crédito, Débito, Dinheiro — integração Mercado Pago |
| **Notificações** | WhatsApp (confirmação, lembrete, atraso de pagamento) |
| **Admin** | Dashboard financeiro, gestão de funcionários, permissões, configurações |
| **Painel Barbeiro** | Agenda pessoal, dashboard de ganhos e comissões |

### Roles de Usuário

| Role | Descrição |
|------|-----------|
| `admin` | Acesso total ao sistema, bypass de permissões |
| `barber` | Acesso ao painel do barbeiro + admin se `permissions.viewAdmin === true` |
| `receptionist` | Acesso ao painel admin conforme permissões atribuídas |
| `client` | Agendamento, visualização de seus agendamentos, assinatura de planos |

---

## 2. Arquitetura Multi-Tenant

### Estratégia Recomendada: Tenant por Banco/Schema

O frontend **ainda não implementa multi-tenant**, mas o backend já deve estar preparado.

### Opções de Implementação

| Estratégia | Descrição | Prós | Contras |
|-----------|-----------|------|---------|
| **Coluna `tenantId`** | Todos os dados na mesma tabela, filtrados por `tenantId` | Simples, menos infra | Risco de vazamento de dados |
| **Schema por tenant** | Um schema PostgreSQL por barbearia | Bom isolamento, mesma instância | Gerência de migrations |
| **Banco por tenant** | Um banco separado por barbearia | Isolamento total | Mais complexo e custoso |

### Recomendação: **Coluna `tenantId`** (para começar)

- Adicionar campo `tenantId` em **TODAS** as tabelas
- Criar middleware que extrai o `tenantId` do JWT ou subdomínio
- Filtrar automaticamente todas as queries pelo tenant

### Identificação do Tenant

```
Opção 1: Subdomínio → barbearia-joao.sga.com.br → tenantId extraído do sub
Opção 2: Header customizado → X-Tenant-Id no request
Opção 3: Claim no JWT → tenantId salvo no token
Opção 4: Slug na URL → /api/v1/:tenantSlug/appointments
```

### Tabela de Tenants

```sql
tenants
├── id             (UUID, PK)
├── name           (string) — "Barbearia Rodrigues"
├── slug           (string, unique) — "barbearia-rodrigues"
├── subdomain      (string, unique, nullable)
├── email          (string) — email do dono
├── phone          (string)
├── logo           (string, url)
├── address        (string)
├── city           (string)
├── state          (string)
├── plan           (enum: free, pro, enterprise)
├── isActive       (boolean)
├── createdAt      (timestamp)
└── updatedAt      (timestamp)
```

---

## 3. Modelagem do Banco de Dados

> Todas as tabelas abaixo devem conter a coluna `tenantId` (UUID, FK → tenants.id).

### 3.1 `users`

```sql
users
├── id               (UUID, PK)
├── tenantId         (UUID, FK → tenants.id)
├── name             (string, not null)
├── email            (string, unique por tenant)
├── password         (string, hash bcrypt — NUNCA plaintext)
├── cpf              (string, 11 chars, unique por tenant)
├── phone            (string)
├── photo            (string, url, nullable)
├── role             (enum: 'admin', 'barber', 'receptionist', 'client')
├── isAdmin          (boolean, default false)
├── permissions      (JSONB) — ver detalhes abaixo
├── createdAt        (timestamp)
└── updatedAt        (timestamp)
```

**Objeto `permissions`** (para roles barber/receptionist):
```json
{
  "viewAdmin": true,
  "manageEmployees": true,
  "manageProducts": true,
  "addProducts": true,
  "editProducts": false,
  "manageServices": true,
  "addServices": true,
  "editServices": false,
  "managePayments": false,
  "manageAgendamentos": true,
  "manageBenefits": false,
  "manageSettings": false
}
```

### 3.2 `barbers`

```sql
barbers
├── id                (UUID, PK)
├── tenantId          (UUID, FK → tenants.id)
├── userId            (UUID, FK → users.id, unique) — conta de acesso vinculada
├── name              (string, not null)
├── specialty         (string)
├── photo             (string, url, nullable)
├── commissionPercent (integer, 0-100, default 50)
├── isActive          (boolean, default true)
├── createdAt         (timestamp)
└── updatedAt         (timestamp)
```

### 3.3 `services`

```sql
services
├── id               (UUID, PK)
├── tenantId         (UUID, FK → tenants.id)
├── name             (string, not null)
├── price            (decimal, not null) — armazenar em centavos ou decimal(10,2)
├── promotionalPrice (decimal, nullable) — preço para assinantes
├── coveredByPlan    (boolean, default false) — incluído na assinatura
├── image            (string, url)
├── duration         (integer, minutos, not null) — usado para cálculo de slots
├── isActive         (boolean, default true)
├── createdAt        (timestamp)
└── updatedAt        (timestamp)
```

### 3.4 `products`

```sql
products
├── id                  (UUID, PK)
├── tenantId            (UUID, FK → tenants.id)
├── name                (string, not null)
├── category            (enum: 'Bebidas', 'Pomadas', 'Óleos', 'Cuidados', 'Acessórios', 'Outros')
├── description         (text, nullable)
├── price               (decimal, not null)
├── subscriberDiscount  (integer, 0-100, default 0) — desconto % para assinantes
├── stock               (integer, default 0)
├── image               (string, url, nullable)
├── isActive            (boolean, default true)
├── createdAt           (timestamp)
└── updatedAt           (timestamp)
```

### 3.5 `appointments`

```sql
appointments
├── id            (UUID, PK)
├── tenantId      (UUID, FK → tenants.id)
├── clientId      (UUID, FK → users.id)
├── clientName    (string) — desnormalizado para facilidade
├── barberId      (UUID, FK → barbers.id)
├── barberName    (string) — desnormalizado
├── date          (date, not null) — "YYYY-MM-DD"
├── time          (string, not null) — "HH:MM"
├── status        (enum: 'pending', 'confirmed', 'completed', 'cancelled')
├── createdAt     (timestamp)
└── updatedAt     (timestamp)
```

### 3.6 `appointment_services` (tabela N:N)

```sql
appointment_services
├── id              (UUID, PK)
├── appointmentId   (UUID, FK → appointments.id, ON DELETE CASCADE)
├── serviceId       (UUID, FK → services.id)
├── serviceName     (string) — snapshot no momento do agendamento
├── servicePrice    (decimal) — snapshot do preço
├── duration        (integer) — snapshot da duração
└── createdAt       (timestamp)
```

### 3.7 `appointment_products` (tabela N:N)

```sql
appointment_products
├── id              (UUID, PK)
├── appointmentId   (UUID, FK → appointments.id, ON DELETE CASCADE)
├── productId       (UUID, FK → products.id)
├── productName     (string) — snapshot
├── productPrice    (decimal) — snapshot
├── quantity        (integer, default 1)
├── discount        (decimal, default 0) — desconto aplicado
└── createdAt       (timestamp)
```

### 3.8 `subscription_plans`

```sql
subscription_plans
├── id            (UUID, PK)
├── tenantId      (UUID, FK → tenants.id)
├── name          (string, not null) — "Básico", "Premium", "VIP"
├── subtitle      (string, nullable)
├── price         (decimal, not null) — valor mensal
├── color         (string, hex) — cor do badge no front
├── cutsPerMonth  (integer) — cortes incluídos por mês
├── features      (JSONB, array de strings) — lista de benefícios
├── active        (boolean, default true)
├── recommended   (boolean, default false) — destaque "Mais Popular"
├── sortOrder     (integer, default 0)
├── createdAt     (timestamp)
└── updatedAt     (timestamp)
```

### 3.9 `subscriptions`

```sql
subscriptions
├── id                       (UUID, PK)
├── tenantId                 (UUID, FK → tenants.id)
├── userId                   (UUID, FK → users.id)
├── userName                 (string)
├── planId                   (UUID, FK → subscription_plans.id)
├── planName                 (string) — snapshot
├── planPrice                (decimal) — snapshot
├── amount                   (decimal) — valor cobrado
├── status                   (enum: 'active', 'overdue', 'cancelled', 'inactive')
├── startDate                (timestamp)
├── nextBillingDate          (timestamp)
├── lastBillingDate          (timestamp)
├── paymentMethod            (string)
├── isRecurring              (boolean, default true)
├── autoRenewal              (boolean, default true)
├── daysOverdue              (integer, default 0)
├── monthlyBarberId          (UUID, FK → barbers.id, nullable) — barbeiro fixo do mês
├── monthlyBarberName        (string, nullable)
├── monthlyBarberSetDate     (string, nullable)
├── overdueNotificationSent  (boolean, default false)
├── lastNotificationDate     (timestamp, nullable)
├── cancelledAt              (timestamp, nullable)
├── createdAt                (timestamp)
└── updatedAt                (timestamp)
```

### 3.10 `payments` (pagamentos de assinaturas)

```sql
payments
├── id              (UUID, PK)
├── tenantId        (UUID, FK → tenants.id)
├── userId          (UUID, FK → users.id)
├── userName        (string)
├── subscriptionId  (UUID, FK → subscriptions.id, nullable)
├── planId          (UUID, FK → subscription_plans.id, nullable)
├── planName        (string, nullable)
├── amount          (decimal, not null)
├── paymentMethod   (enum: 'pix', 'credito', 'debito', 'dinheiro')
├── status          (enum: 'pending', 'approved', 'rejected', 'refunded')
├── type            (enum: 'subscription', 'subscription_renewal')
├── transactionId   (string, unique) — "TRX-{timestamp}-{random}"
├── cardData        (JSONB, nullable) — {brand, lastDigits, holderName}
├── installments    (integer, nullable)
├── installmentAmount (decimal, nullable)
├── pixCode         (text, nullable) — código PIX copia-e-cola
├── pixQrCode       (text, nullable) — QR code base64
├── pixExpiresAt    (timestamp, nullable)
├── approvedAt      (timestamp, nullable)
├── createdAt       (timestamp)
└── updatedAt       (timestamp)
```

### 3.11 `appointment_payments` (pagamentos de agendamentos)

```sql
appointment_payments
├── id                (UUID, PK)
├── tenantId          (UUID, FK → tenants.id)
├── appointmentId     (UUID, FK → appointments.id)
├── userId            (UUID, FK → users.id)
├── userName          (string)
├── amount            (decimal)
├── serviceName       (string)
├── barberName        (string)
├── appointmentDate   (string) — "YYYY-MM-DD"
├── appointmentTime   (string) — "HH:MM"
├── status            (enum: 'pending', 'pendinglocal', 'paid', 'plancovered', 'approved')
├── paymentMethod     (enum: 'pix', 'credito', 'debito', 'dinheiro', 'cartao', 'local', 'subscription', nullable)
├── paidAt            (timestamp, nullable)
├── type              (string, default 'appointment')
├── products          (JSONB, array) — produtos comprados junto
├── cardData          (JSONB, nullable) — {brand, lastDigits}
├── transactionId     (string, nullable)
├── installments      (integer, nullable)
├── installmentAmount (decimal, nullable)
├── createdAt         (timestamp)
└── updatedAt         (timestamp)
```

### 3.12 `saved_cards`

```sql
saved_cards
├── id           (UUID, PK)
├── tenantId     (UUID, FK → tenants.id)
├── userId       (UUID, FK → users.id)
├── lastDigits   (string, 4 chars) — NUNCA armazenar número completo
├── holderName   (string)
├── expiryMonth  (string, 2 chars)
├── expiryYear   (string, 4 chars)
├── brand        (string) — "visa", "mastercard", "elo" etc.
├── isMain       (boolean, default false)
├── mpCardToken  (string, nullable) — token do Mercado Pago para cobrar
├── createdAt    (timestamp)
└── updatedAt    (timestamp)
```

> ⚠️ **IMPORTANTE:** O frontend salva o número completo do cartão no db.json. No backend real, **NUNCA** armazene o número do cartão. Use tokenização do Mercado Pago.

### 3.13 `payment_methods` (métodos salvos)

```sql
payment_methods
├── id          (UUID, PK)
├── tenantId    (UUID, FK → tenants.id)
├── userId      (UUID, FK → users.id)
├── type        (string) — "credit", "debit"
├── brand       (string) — bandeira do cartão
├── lastDigits  (string, 4 chars)
├── holderName  (string)
├── expiryMonth (string)
├── expiryYear  (string)
├── isDefault   (boolean, default false)
├── mpToken     (string, nullable) — token Mercado Pago
├── createdAt   (timestamp)
└── updatedAt   (timestamp)
```

### 3.14 `blocked_dates`

```sql
blocked_dates
├── id          (UUID, PK)
├── tenantId    (UUID, FK → tenants.id)
├── date        (date, not null) — "YYYY-MM-DD"
├── reason      (string, nullable)
├── barberId    (UUID, FK → barbers.id, nullable) — null = todos os barbeiros
├── createdBy   (UUID, FK → users.id)
├── createdAt   (timestamp)
└── updatedAt   (timestamp)
```

### 3.15 `gallery`

```sql
gallery
├── id        (UUID, PK)
├── tenantId  (UUID, FK → tenants.id)
├── url       (string, not null)
├── alt       (string, nullable)
├── sortOrder (integer, default 0)
├── createdAt (timestamp)
└── updatedAt (timestamp)
```

### 3.16 `settings` (configurações por tenant)

```sql
settings
├── id                  (UUID, PK)
├── tenantId            (UUID, FK → tenants.id, unique)
├── pixKey              (string, nullable) — CPF/CNPJ/Email/Telefone/Chave Aleatória
├── pixKeyType          (enum: 'cpf', 'cnpj', 'email', 'phone', 'random', nullable)
├── termsDocumentUrl    (string, nullable) — URL do arquivo (S3/Cloudinary)
├── termsDocumentName   (string, nullable)
├── whatsappNumber      (string, nullable) — número para notificações
├── createdAt           (timestamp)
└── updatedAt           (timestamp)
```

### 3.17 `home_info` (informações da landing page por tenant)

```sql
home_info
├── id               (UUID, PK)
├── tenantId         (UUID, FK → tenants.id, unique)
├── aboutTitle       (string)
├── aboutText1       (text)
├── aboutText2       (text)
├── aboutText3       (text)
├── scheduleTitle    (string)
├── scheduleLine1    (string)
├── scheduleLine2    (string)
├── scheduleLine3    (string)
├── locationTitle    (string)
├── locationAddress  (string)
├── locationCity     (string)
├── createdAt        (timestamp)
└── updatedAt        (timestamp)
```

---

## 4. Autenticação e Autorização

### 4.1 Autenticação — JWT

O frontend atualmente faz login buscando **todos os usuários** e comparando email/senha no client-side. O backend deve implementar autenticação real:

```
POST /api/auth/login
  Body: { email, password }
  Response: { user, accessToken, refreshToken }

POST /api/auth/register
  Body: { name, email, cpf, phone, password }
  Response: { user, accessToken, refreshToken }

POST /api/auth/refresh
  Body: { refreshToken }
  Response: { accessToken, refreshToken }

POST /api/auth/logout
  Body: { refreshToken }
  Response: { message }
```

**Estrutura do JWT Payload:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "role": "admin",
  "isAdmin": true,
  "permissions": { ... },
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 4.2 Autorização — Middleware de Roles e Permissões

```javascript
// Middleware de autenticação
authenticate(req, res, next) → verifica JWT, injeta req.user e req.tenantId

// Middleware de roles
authorize('admin', 'receptionist') → verifica se user.role está na lista

// Middleware de permissões granulares
checkPermission('manageProducts') → verifica user.permissions[perm] === true
                                    OU user.role === 'admin' (bypass)

// Middleware de tenant
tenantFilter(req, res, next) → injeta tenantId em todas as queries
```

### 4.3 Mapa de Permissões por Rota

| Permissão | Permite |
|-----------|---------|
| `viewAdmin` | Acessar o painel admin |
| `manageEmployees` | CRUD de barbeiros, recepcionistas, admins |
| `manageProducts` | Ver lista de produtos |
| `addProducts` | Criar novos produtos |
| `editProducts` | Editar/excluir produtos |
| `manageServices` | Ver lista de serviços |
| `addServices` | Criar novos serviços |
| `editServices` | Editar/excluir serviços |
| `managePayments` | Dashboard financeiro, marcar pagamentos |
| `manageAgendamentos` | Gerenciar agendamentos (admin) |
| `manageBenefits` | Editar benefícios dos planos |
| `manageSettings` | Chave PIX, termos, info do site |

---

## 5. Rotas da API (Endpoints)

### 5.1 Auth

```
POST   /api/auth/register          → Cadastrar novo usuário (client)
POST   /api/auth/login             → Login com email + senha
POST   /api/auth/refresh           → Renovar accessToken
POST   /api/auth/logout            → Invalidar tokens
GET    /api/auth/me                → Dados do usuário logado
```

### 5.2 Users

```
GET    /api/users                  → Listar todos (admin/receptionist)
GET    /api/users/:id              → Buscar por ID
POST   /api/users                  → Criar usuário (admin cria barber/receptionist)
PATCH  /api/users/:id              → Atualizar dados
DELETE /api/users/:id              → Remover usuário
GET    /api/users/check-email/:email  → Verificar se email existe
PATCH  /api/users/:id/permissions  → Atualizar permissões (admin only)
```

### 5.3 Barbers

```
GET    /api/barbers                → Listar barbeiros (público — usado na Home e agendamento)
GET    /api/barbers/:id            → Buscar barbeiro por ID
POST   /api/barbers                → Criar barbeiro + conta de usuário vinculada
PUT    /api/barbers/:id            → Atualizar dados do barbeiro
DELETE /api/barbers/:id            → Remover barbeiro
PATCH  /api/barbers/:id/link-user  → Vincular barbeiro a um userId
```

### 5.4 Services

```
GET    /api/services               → Listar serviços (público)
GET    /api/services/:id           → Buscar serviço por ID
POST   /api/services               → Criar serviço (perm: addServices)
PUT    /api/services/:id           → Atualizar serviço (perm: editServices)
DELETE /api/services/:id           → Remover serviço (perm: editServices)
```

### 5.5 Products

```
GET    /api/products               → Listar produtos (público)
GET    /api/products/:id           → Buscar produto por ID
POST   /api/products               → Criar produto (perm: addProducts)
PUT    /api/products/:id           → Atualizar produto (perm: editProducts)
DELETE /api/products/:id           → Remover produto (perm: editProducts)
PATCH  /api/products/:id/stock     → Atualizar estoque (decremento ao agendar)
```

### 5.6 Appointments

```
GET    /api/appointments                      → Listar todos (admin/receptionist)
GET    /api/appointments?barberId=:id         → Filtrar por barbeiro
GET    /api/appointments?clientId=:id         → Filtrar por cliente
GET    /api/appointments/:id                  → Buscar por ID
POST   /api/appointments                      → Criar agendamento
PUT    /api/appointments/:id                  → Atualizar completo
PATCH  /api/appointments/:id                  → Atualizar parcial (status, barbeiro etc.)
DELETE /api/appointments/:id                  → Cancelar/remover agendamento
GET    /api/appointments/available-slots       → Buscar horários disponíveis
         ?barberId=:id&date=:date&duration=:min
```

**Body do POST /api/appointments:**
```json
{
  "barberId": "uuid",
  "barberName": "João",
  "clientId": "uuid",
  "client": "Lucas",
  "date": "2026-03-15",
  "time": "14:00",
  "services": [
    { "id": "uuid", "name": "Corte Clássico", "price": 40.00, "duration": 30 }
  ],
  "products": [
    { "id": "uuid", "name": "Pomada", "price": 25.00, "quantity": 1 }
  ],
  "status": "pending"
}
```

### 5.7 Blocked Dates

```
GET    /api/blocked-dates                     → Listar datas bloqueadas
GET    /api/blocked-dates?date=:date          → Verificar se data específica está bloqueada
POST   /api/blocked-dates                     → Bloquear data
DELETE /api/blocked-dates/:id                 → Desbloquear data
```

**Body do POST:**
```json
{
  "date": "2026-03-20",
  "reason": "Feriado",
  "barberId": null  // null = todos os barbeiros
}
```

### 5.8 Subscription Plans

```
GET    /api/subscription-plans                → Listar planos (público)
GET    /api/subscription-plans/:id            → Buscar plano por ID
POST   /api/subscription-plans                → Criar plano (admin)
PUT    /api/subscription-plans/:id            → Atualizar plano
PATCH  /api/subscription-plans/:id            → Atualizar parcial (ex: features)
DELETE /api/subscription-plans/:id            → Remover plano
```

### 5.9 Subscriptions

```
GET    /api/subscriptions                     → Listar todas (admin)
GET    /api/subscriptions?userId=:id          → Assinaturas do usuário
GET    /api/subscriptions?userId=:id&status=active → Assinatura ativa do usuário
GET    /api/subscriptions/:id                 → Buscar por ID
POST   /api/subscriptions                     → Criar assinatura
PATCH  /api/subscriptions/:id                 → Atualizar (status, barbeiro mensal, etc.)
PATCH  /api/subscriptions/:id/cancel          → Cancelar assinatura
PATCH  /api/subscriptions/:id/renew           → Renovar assinatura
PATCH  /api/subscriptions/:id/toggle-recurring → Alternar modo recorrente/manual
POST   /api/subscriptions/check-overdue       → Job: verificar assinaturas vencidas
```

**Body do POST /api/subscriptions:**
```json
{
  "userId": "uuid",
  "userName": "Lucas",
  "planId": "uuid",
  "planName": "Premium",
  "planPrice": 150.00,
  "amount": 150.00,
  "paymentMethod": "credito",
  "isRecurring": true,
  "autoRenewal": true
}
```

### 5.10 Payments (Assinaturas)

```
GET    /api/payments                          → Listar todos (admin)
GET    /api/payments?userId=:id               → Histórico do usuário
GET    /api/payments/:id                      → Buscar por ID
POST   /api/payments                          → Registrar pagamento
POST   /api/payments/process                  → Processar pagamento (integração MP)
```

### 5.11 Appointment Payments

```
GET    /api/appointment-payments                          → Listar todos (admin)
GET    /api/appointment-payments?appointmentId=:id        → Buscar por agendamento
POST   /api/appointment-payments                          → Criar pagamento de agendamento
PATCH  /api/appointment-payments/:id                      → Atualizar (marcar como pago etc.)
```

### 5.12 Saved Cards

```
GET    /api/saved-cards?userId=:id            → Listar cartões do usuário
POST   /api/saved-cards                       → Salvar cartão (tokenizado!)
DELETE /api/saved-cards/:id                   → Remover cartão
PATCH  /api/saved-cards/:id/set-main          → Definir como principal
```

### 5.13 Payment Methods

```
GET    /api/payment-methods?userId=:id        → Listar métodos do usuário
POST   /api/payment-methods                   → Salvar método
DELETE /api/payment-methods/:id               → Remover método
PATCH  /api/payment-methods/:id/set-default   → Definir como padrão
```

### 5.14 Gallery

```
GET    /api/gallery                           → Listar fotos (público)
POST   /api/gallery                           → Upload de foto
DELETE /api/gallery/:id                       → Remover foto
```

### 5.15 Settings

```
GET    /api/settings                          → Buscar configurações do tenant
PATCH  /api/settings                          → Atualizar configurações
GET    /api/settings/pix-key                  → Buscar chave PIX
PATCH  /api/settings/pix-key                  → Atualizar chave PIX
POST   /api/settings/terms-document           → Upload do PDF de termos
DELETE /api/settings/terms-document            → Remover PDF
GET    /api/settings/terms-document            → Download do PDF
```

### 5.16 Home Info

```
GET    /api/home-info                         → Buscar info da home (público)
PUT    /api/home-info                         → Atualizar info da home (admin)
```

### 5.17 Notifications

```
POST   /api/notifications/whatsapp/send       → Enviar mensagem WhatsApp
POST   /api/notifications/overdue-check       → Verificar e notificar atrasos
```

### 5.18 Tenant Management (Super Admin)

```
POST   /api/tenants                           → Criar novo tenant (super admin)
GET    /api/tenants                           → Listar tenants
GET    /api/tenants/:id                       → Buscar tenant
PATCH  /api/tenants/:id                       → Atualizar tenant
DELETE /api/tenants/:id                       → Desativar tenant
```

---

## 6. Serviços do Backend (Camada de Negócio)

### 6.1 `AuthService`

| Método | Descrição |
|--------|-----------|
| `register(userData)` | Validar dados, hash senha (bcrypt), verificar email único por tenant, criar user |
| `login(email, password)` | Buscar user por email+tenant, comparar hash, gerar JWT (access + refresh) |
| `refreshToken(token)` | Validar refresh token, gerar novo par |
| `logout(refreshToken)` | Invalidar refresh token (blacklist ou removê-lo do BD) |

### 6.2 `UserService`

| Método | Descrição |
|--------|-----------|
| `getAll(tenantId)` | Listar users do tenant |
| `getById(id, tenantId)` | Buscar user |
| `create(userData, tenantId)` | Criar user (usado quando admin cria barber/receptionist) |
| `update(id, data, tenantId)` | Atualizar dados |
| `delete(id, tenantId)` | Soft-delete ou remover |
| `updatePermissions(id, permissions)` | Atualizar permissões granulares |
| `existsByEmail(email, tenantId)` | Check de email existente |

### 6.3 `BarberService`

| Método | Descrição |
|--------|-----------|
| `getAll(tenantId)` | Listar barbeiros ativos |
| `getById(id, tenantId)` | Buscar barbeiro |
| `create(data, tenantId)` | Criar barbeiro + criar conta de user vinculada |
| `update(id, data, tenantId)` | Atualizar |
| `delete(id, tenantId)` | Remover barbeiro + desativar conta |
| `linkToUser(barberId, userId)` | Vincular barbeiro a user existente |
| `getEarnings(barberId, startDate, endDate)` | Calcular ganhos por período |

### 6.4 `ServiceService`

| Método | Descrição |
|--------|-----------|
| `getAll(tenantId)` | Listar serviços |
| `getById(id, tenantId)` | Buscar serviço |
| `create(data, tenantId)` | Criar |
| `update(id, data, tenantId)` | Atualizar |
| `delete(id, tenantId)` | Remover |

### 6.5 `ProductService`

| Método | Descrição |
|--------|-----------|
| `getAll(tenantId)` | Listar produtos |
| `getById(id, tenantId)` | Buscar produto |
| `create(data, tenantId)` | Criar |
| `update(id, data, tenantId)` | Atualizar |
| `delete(id, tenantId)` | Remover |
| `updateStock(id, quantity, tenantId)` | Decrementar estoque |

### 6.6 `AppointmentService`

| Método | Descrição |
|--------|-----------|
| `getAll(tenantId, filters)` | Listar com filtros (barbeiro, cliente, data, mês) |
| `getById(id, tenantId)` | Buscar agendamento |
| `create(data, tenantId)` | Criar — validar conflitos, datas bloqueadas, barbeiro fixo |
| `update(id, data, tenantId)` | Atualizar |
| `delete(id, tenantId)` | Cancelar (soft-delete: status=cancelled) |
| `getAvailableSlots(barberId, date, duration, tenantId)` | **Lógica crítica** — ver abaixo |
| `transferBarber(appointmentId, newBarberId)` | Transferir agendamento para outro barbeiro |

**Lógica de slots disponíveis:**
```
1. Horários de funcionamento: 09:00 às 20:00 (configurável por tenant)
2. Slots de 30 minutos: [09:00, 09:30, 10:00, ...]
3. Buscar agendamentos do barbeiro na data
4. Para cada slot, verificar se o serviço "cabe" sem colidir:
   - slotInício + duraçãoServiço <= próximoAgendamentoInício
   - slotInício >= agendamentoAnteriorFim
5. Verificar se a data está bloqueada para o barbeiro (ou todos)
6. Retornar apenas slots livres
```

### 6.7 `SubscriptionService`

| Método | Descrição |
|--------|-----------|
| `getPlans(tenantId)` | Listar planos |
| `getPlanById(id, tenantId)` | Buscar plano |
| `createPlan(data, tenantId)` | Criar plano (admin) |
| `updatePlan(id, data, tenantId)` | Atualizar plano/features |
| `getAll(tenantId)` | Listar todas as assinaturas |
| `getByUser(userId, tenantId)` | Assinaturas do usuário |
| `getActiveByUser(userId, tenantId)` | Assinatura ativa do usuário |
| `create(data, tenantId)` | Criar assinatura + registrar pagamento |
| `cancel(id, tenantId)` | Cancelar assinatura |
| `renew(id, paymentData, tenantId)` | Renovar (atualizar nextBillingDate, registrar pagamento) |
| `toggleRecurring(id, isRecurring)` | Alternar modo recorrente |
| `setMonthlyBarber(id, barberId, barberName)` | Definir barbeiro fixo do mês |
| `checkOverdue(tenantId)` | **CRON JOB** — verificar vencidas e marcar como overdue |
| `markAsOverdue(id)` | Marcar como atrasada + calcular dias de atraso |

### 6.8 `PaymentService`

| Método | Descrição |
|--------|-----------|
| `processPayment(data)` | Processar pagamento via Mercado Pago |
| `createAppointmentPayment(data)` | Criar registro de pagamento para agendamento |
| `updateAppointmentPayment(id, data)` | Atualizar status (pago, etc.) |
| `getAllAppointmentPayments(tenantId)` | Listar todos (admin) |
| `getPaymentHistory(userId, tenantId)` | Histórico do usuário |
| `getPaymentById(id, tenantId)` | Buscar pagamento |
| `generatePixPayment(amount, description)` | Gerar QR code PIX via Mercado Pago |
| `getFinancialSummary(tenantId, month, year)` | Dashboard: totais por método, pendentes, pagos |

### 6.9 `CardService`

| Método | Descrição |
|--------|-----------|
| `getUserCards(userId, tenantId)` | Listar cartões salvos |
| `saveCard(data, tenantId)` | Salvar (tokenizado) |
| `deleteCard(id, tenantId)` | Remover |
| `setMainCard(userId, cardId, tenantId)` | Definir principal (desmarca os outros) |

### 6.10 `NotificationService`

| Método | Descrição |
|--------|-----------|
| `sendWhatsAppConfirmation(appointment)` | Enviar confirmação de agendamento |
| `sendWhatsAppReminder(appointment)` | Lembrete 15min antes |
| `sendOverdueNotification(subscription)` | Notificar atraso de assinatura |
| `sendSubscriptionActivated(subscription)` | Notificar ativação de assinatura |

### 6.11 `SettingsService`

| Método | Descrição |
|--------|-----------|
| `get(tenantId)` | Buscar configurações |
| `update(tenantId, data)` | Atualizar |
| `getPixKey(tenantId)` | Buscar chave PIX |
| `savePixKey(tenantId, pixKey)` | Salvar chave PIX |
| `uploadTerms(tenantId, file)` | Upload PDF termos |
| `getTerms(tenantId)` | Download PDF |
| `deleteTerms(tenantId)` | Remover PDF |

### 6.12 `HomeInfoService`

| Método | Descrição |
|--------|-----------|
| `get(tenantId)` | Buscar informações da home |
| `update(tenantId, data)` | Atualizar informações |

### 6.13 `GalleryService`

| Método | Descrição |
|--------|-----------|
| `getAll(tenantId)` | Listar fotos |
| `upload(tenantId, file)` | Upload de foto |
| `delete(id, tenantId)` | Remover foto |

---

## 7. Integrações Externas (Pagamento e Notificações)

### 7.1 WhatsApp — Opções de Integração

O frontend usa links `wa.me` (abre WhatsApp Web). Para o backend enviar automaticamente:

| Opção | Descrição | Custo |
|-------|-----------|-------|
| **WhatsApp Business API (oficial)** | Via Meta Cloud API ou provedor (Twilio, MessageBird) | ~R$0,25/msg |
| **Evolution API** | API open-source self-hosted | Gratuito (self-hosted) |
| **Z-API** | API brasileira popular | A partir de R$65/mês |
| **Baileys (lib)** | Library Node.js não oficial | Gratuito, risco de ban |

#### Recomendação: **Evolution API** (para começar) ou **WhatsApp Business API** (produção)

```
POST /api/notifications/whatsapp
{
  "phone": "5585982299499",
  "message": "Olá, seu agendamento foi confirmado!"
}
```

### 7.3 Upload de Arquivos — Serviço de Storage

Para imagens (galeria, produtos, barbeiros) e PDFs (termos):

| Opção | Descrição |
|-------|-----------|
| **AWS S3** | Padrão de mercado |
| **Cloudinary** | Ótimo para imagens, plano free generoso |
| **MinIO** | S3-compatible self-hosted |
| **DigitalOcean Spaces** | S3-compatible, mais barato |

```
POST /api/upload
  Body: multipart/form-data (file)
  Response: { url: "https://cdn.../imagem.jpg" }
```

---

## 8. Middleware e Infraestrutura

### 8.1 Middlewares Necessários

```javascript
// 1. CORS
cors({
  origin: ['https://barbearia.com', 'http://localhost:5173'],
  credentials: true
})

// 2. Rate Limiting
rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100  // 100 requests por IP
})

// 3. Autenticação JWT
const authenticate = (req, res, next) => {
  // Verificar header Authorization: Bearer <token>
  // Decodificar JWT, validar, injetar req.user
}

// 4. Autorização por Role
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403)...
}

// 5. Permissão Granular
const checkPermission = (permission) => (req, res, next) => {
  if (req.user.role === 'admin') return next(); // bypass
  if (!req.user.permissions?.[permission]) return res.status(403)...
}

// 6. Tenant Isolation
const tenantMiddleware = (req, res, next) => {
  req.tenantId = req.user.tenantId; // do JWT
  // OU extrair de subdomínio/header
}

// 7. Validação (express-validator ou Joi/Zod)
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400)...
}

// 8. Error Handler Global
const errorHandler = (err, req, res, next) => {
  // Logar erro, retornar resposta padronizada
}

// 9. Request Logger (Morgan/Winston)
app.use(morgan('combined'))

// 10. Helmet (segurança HTTP)
app.use(helmet())
```

### 8.2 CRON Jobs

```javascript
// Job: Verificar assinaturas vencidas (diário, 00:00)
cron.schedule('0 0 * * *', async () => {
  // Para cada tenant:
  // 1. Buscar assinaturas ativas com nextBillingDate < hoje
  // 2. Marcar como 'overdue'
  // 3. Calcular diasAtraso
  // 4. Enviar notificação WhatsApp (se não enviada)
});

// Job: Lembrete de agendamento (a cada 5 min)
cron.schedule('*/5 * * * *', async () => {
  // Buscar agendamentos nas próximas 15 min
  // Enviar lembrete WhatsApp para o cliente
});

// Job: Reset do barbeiro fixo mensal (1° de cada mês)
cron.schedule('0 0 1 * *', async () => {
  // Limpar monthlyBarberId das assinaturas ativas
  // permitir nova escolha no mês
});
```

---

## 9. Validações e Regras de Negócio

### 9.1 Cadastro de Usuário

- [x] Nome: obrigatório, min 2 caracteres
- [x] Email: obrigatório, formato válido, **único por tenant**
- [x] CPF: obrigatório, validação algorítmica (dígitos verificadores), **único por tenant**
- [x] Telefone: obrigatório
- [x] Senha: obrigatória, min 4 caracteres, armazená-la com **bcrypt**
- [x] Código admin secreto: se informado, cadastrar como admin

### 9.2 Agendamento

- [x] Data não pode ser no passado
- [x] Data não pode estar bloqueada (para o barbeiro ou para todos)
- [x] Horário deve estar dentro do funcionamento (09:00-20:00)
- [x] Sem conflito de horário com outros agendamentos do barbeiro
- [x] Considerar duração total dos serviços selecionados para calcular slots
- [x] Assinante deve usar o barbeiro fixo do mês (`monthlyBarberId`)
  - Exceto admins (podem agendar com qualquer barbeiro)
  - No 1° agendamento do mês, o barbeiro escolhido é fixado na assinatura
- [x] Decrementar estoque dos produtos selecionados

### 9.3 Assinatura

- [x] Apenas uma assinatura ativa por usuário por tenant
- [x] `nextBillingDate` = data atual + 1 mês
- [x] Assinatura vencida: status muda para `overdue`, calcular `daysOverdue`
- [x] Serviços com `coveredByPlan: true` são gratuitos para assinantes
- [x] Preço promocional (`promotionalPrice`) dos serviços aplicado para assinantes
- [x] Desconto em produtos (`subscriberDiscount`) aplicado para assinantes
- [x] Barbeiro fixo mensal: definido no 1° agendamento e travado até o fim do mês

### 9.4 Pagamento

- [x] PIX: gerar QR Code real via Mercado Pago, expiração de 30 minutos
- [x] Crédito: aceitar parcelas, taxa de 5% adicionada
- [x] Validar dados do cartão (comprimento, CVV, expiração)
- [x] **Nunca armazenar número completo do cartão** — usar tokenização do MP
- [x] Status possíveis de agendamento: `pending` → `pendinglocal` | `paid` | `plancovered`

### 9.5 Chave PIX (nas settings)

O front valida os seguintes formatos:
- CPF: 11 dígitos numéricos
- CNPJ: 14 dígitos numéricos
- Email: formato de email válido
- Telefone: +55 + DDD + número
- Chave aleatória: formato UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

---

## 10. Estrutura de Pastas Sugerida

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Conexão com o BD
│   │   ├── multer.js            # Config upload de arquivos
│   │   └── env.js               # Variáveis de ambiente
│   │
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   ├── authorize.js         # Role-based authorization
│   │   ├── permission.js        # Granular permissions
│   │   ├── tenant.js            # Tenant isolation
│   │   ├── validate.js          # Request validation
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── errorHandler.js      # Error handling global
│   │
│   ├── models/
│   │   ├── Tenant.js
│   │   ├── User.js
│   │   ├── Barber.js
│   │   ├── Service.js
│   │   ├── Product.js
│   │   ├── Appointment.js
│   │   ├── AppointmentService.js
│   │   ├── AppointmentProduct.js
│   │   ├── SubscriptionPlan.js
│   │   ├── Subscription.js
│   │   ├── Payment.js
│   │   ├── AppointmentPayment.js
│   │   ├── SavedCard.js
│   │   ├── PaymentMethod.js
│   │   ├── BlockedDate.js
│   │   ├── Gallery.js
│   │   ├── Settings.js
│   │   └── HomeInfo.js
│   │
│   ├── routes/
│   │   ├── index.js             # Centraliza todas as rotas
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── barber.routes.js
│   │   ├── service.routes.js
│   │   ├── product.routes.js
│   │   ├── appointment.routes.js
│   │   ├── blockedDate.routes.js
│   │   ├── subscriptionPlan.routes.js
│   │   ├── subscription.routes.js
│   │   ├── payment.routes.js
│   │   ├── appointmentPayment.routes.js
│   │   ├── savedCard.routes.js
│   │   ├── paymentMethod.routes.js
│   │   ├── gallery.routes.js
│   │   ├── settings.routes.js
│   │   ├── homeInfo.routes.js
│   │   ├── notification.routes.js
│   │   ├── webhook.routes.js
│   │   └── tenant.routes.js
│   │
│   ├── controllers/
│   │   ├── AuthController.js
│   │   ├── UserController.js
│   │   ├── BarberController.js
│   │   ├── ServiceController.js
│   │   ├── ProductController.js
│   │   ├── AppointmentController.js
│   │   ├── BlockedDateController.js
│   │   ├── SubscriptionPlanController.js
│   │   ├── SubscriptionController.js
│   │   ├── PaymentController.js
│   │   ├── AppointmentPaymentController.js
│   │   ├── SavedCardController.js
│   │   ├── PaymentMethodController.js
│   │   ├── GalleryController.js
│   │   ├── SettingsController.js
│   │   ├── HomeInfoController.js
│   │   ├── NotificationController.js
│   │   ├── WebhookController.js
│   │   └── TenantController.js
│   │
│   ├── services/
│   │   ├── AuthService.js
│   │   ├── UserService.js
│   │   ├── BarberService.js
│   │   ├── ServiceService.js
│   │   ├── ProductService.js
│   │   ├── AppointmentService.js
│   │   ├── SubscriptionService.js
│   │   ├── PaymentService.js
│   │   ├── CardService.js
│   │   ├── NotificationService.js
│   │   ├── SettingsService.js
│   │   ├── HomeInfoService.js
│   │   ├── GalleryService.js
│   │   ├── WhatsAppService.js
│   │   ├── UploadService.js
│   │   └── TenantService.js
│   │
│   ├── validators/
│   │   ├── authValidator.js     # Schemas Zod/Joi para auth
│   │   ├── userValidator.js
│   │   ├── appointmentValidator.js
│   │   ├── paymentValidator.js
│   │   ├── subscriptionValidator.js
│   │   └── cpfValidator.js      # Validação algorítmica de CPF
│   │
│   ├── utils/
│   │   ├── generateId.js        # Gerar IDs de transação "TRX-..."
│   │   ├── formatCurrency.js    # Formatar moeda BRL
│   │   ├── dateHelpers.js       # Funções de data
│   │   ├── slotCalculator.js    # Calcular slots disponíveis
│   │   └── cardBrandDetector.js # Detectar bandeira do cartão
│   │
│   ├── jobs/
│   │   ├── checkOverdueSubscriptions.js  # CRON diário
│   │   ├── sendAppointmentReminders.js   # CRON a cada 5 min
│   │   └── resetMonthlyBarber.js         # CRON mensal
│   │
│   └── app.js                   # Express app setup
│
├── prisma/                      # Se usar Prisma
│   ├── schema.prisma
│   └── migrations/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env
├── .env.example
├── package.json
├── tsconfig.json               # Se usar TypeScript (recomendado)
└── README.md
```

---

## 11. Stack Tecnológica Recomendada

### Runtime e Framework

| Tecnologia | Versão | Motivo |
|-----------|--------|--------|
| **Node.js** | 20 LTS | Runtime |
| **Express.js** | 4.x | Framework HTTP (ou Fastify para performance) |
| **TypeScript** | 5.x | Tipagem estática (fortemente recomendado) |

### Banco de Dados

| Tecnologia | Motivo |
|-----------|--------|
| **PostgreSQL** | Robusto, JSONB para campos flexíveis, schemas para multi-tenant |
| **Prisma ORM** | Melhor DX em Node/TS, migrations, type-safe queries |
| **Redis** | Cache, rate limiting, filas, sessões, refresh tokens |

### Autenticação

| Tecnologia | Motivo |
|-----------|--------|
| **jsonwebtoken** | Geração e verificação de JWT |
| **bcryptjs** | Hash de senhas |
| **passport.js** (opcional) | Se precisar OAuth (Google login etc.) |

### Pagamento

| Tecnologia | Motivo |
|-----------|--------|
### Validação

| Tecnologia | Motivo |
|-----------|--------|
| **Zod** | Validação + inferência de tipos TypeScript |

### Upload de Arquivos

| Tecnologia | Motivo |
|-----------|--------|
| **multer** | Middleware para multipart/form-data |
| **@aws-sdk/client-s3** | Upload para S3/Spaces |
| **cloudinary** (alternativa) | Upload + transformações de imagem |

### Jobs/Tarefas Agendadas

| Tecnologia | Motivo |
|-----------|--------|
| **node-cron** | Cron jobs simples |
| **BullMQ** (alternativa) | Filas robustas com Redis |

### Notificações

| Tecnologia | Motivo |
|-----------|--------|
| **evolution-api** | WhatsApp self-hosted |
| **axios** | HTTP client para APIs externas |

### Outros

| Tecnologia | Motivo |
|-----------|--------|
| **helmet** | Headers de segurança HTTP |
| **cors** | Cross-Origin Resource Sharing |
| **morgan** / **winston** | Logging |
| **express-rate-limit** | Rate limiting |
| **dotenv** | Variáveis de ambiente |
| **uuid** | Geração de UUIDs |

---

## 12. Variáveis de Ambiente

```env
# ========== APP ==========
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# ========== DATABASE ==========
DATABASE_URL=postgresql://user:password@localhost:5432/sga_barbearia

# ========== JWT ==========
JWT_SECRET=sua-chave-secreta-muito-segura-aqui
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=outra-chave-secreta-para-refresh
JWT_REFRESH_EXPIRES_IN=7d

# ========== REDIS ==========
REDIS_URL=redis://localhost:6379

# ========== MERCADO PAGO ==========
MP_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MP_PUBLIC_KEY=APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MP_WEBHOOK_SECRET=webhook-secret-para-validacao

# ========== STORAGE (S3/Cloudinary) ==========
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_BUCKET_NAME=sga-barbearia
AWS_REGION=sa-east-1
# OU
CLOUDINARY_URL=cloudinary://xxx:xxx@xxx

# ========== WHATSAPP ==========
WHATSAPP_API_URL=http://localhost:8080    # Evolution API
WHATSAPP_API_KEY=sua-api-key
WHATSAPP_INSTANCE=barbearia

# ========== ADMIN SECRETO ==========
ADMIN_SECRET_CODE=ADDEV2024

# ========== CRON ==========
CRON_OVERDUE_CHECK=0 0 * * *        # Todo dia à meia-noite
CRON_REMINDER_CHECK=*/5 * * * *     # A cada 5 minutos
CRON_MONTHLY_RESET=0 0 1 * *        # 1° de cada mês
```

---

## 13. Resumo de Endpoints por Módulo

### Total: ~70 endpoints

| Módulo | Endpoints | Auth |
|--------|-----------|------|
| Auth | 5 | Público (register/login) + Autenticado (me/refresh/logout) |
| Users | 7 | Admin/Receptionist |
| Barbers | 6 | Público (GET) + Admin (CRUD) |
| Services | 5 | Público (GET) + Admin (CRUD) |
| Products | 6 | Público (GET) + Admin (CRUD) |
| Appointments | 7 | Autenticado (todos os roles) |
| Blocked Dates | 4 | Admin |
| Subscription Plans | 5 | Público (GET) + Admin (CRUD) |
| Subscriptions | 9 | Autenticado (cliente vê suas) + Admin (todas) |
| Payments | 4 | Autenticado |
| Appointment Payments | 4 | Autenticado |
| Saved Cards | 4 | Autenticado (próprios cartões) |
| Payment Methods | 4 | Autenticado |
| Gallery | 3 | Público (GET) + Admin (CRUD) |
| Settings | 7 | Admin |
| Home Info | 2 | Público (GET) + Admin (PUT) |
| Notifications | 2 | Admin/Sistema |
| Webhooks | 1 | Mercado Pago (assinatura) |
| Tenants | 5 | Super Admin |

---

## 14. Observações e Pendências do Frontend

### Problemas de Segurança a Corrigir no Backend

| Problema no Frontend | Solução no Backend |
|---------------------|-------------------|
| Senha armazenada em plaintext no db.json | **bcrypt** com salt rounds 12 |
| Número completo do cartão salvo em `savedCards` | **Tokenização** via Mercado Pago, só salvar `lastDigits` |
| Login faz GET /users e compara no client-side | Autenticação real com `POST /auth/login` no server-side |
| Sessão só no localStorage (sem token) | **JWT** com accessToken + refreshToken |
| Sem HTTPS | Configurar TLS/SSL obrigatório |
| Sem rate limiting | Implementar rate limiting por IP e por tenant |
| Public Key do Mercado Pago hardcoded no front | Servir via API `/api/settings/mp-public-key` |

### O que o Frontend Espera Mas Ainda Não Tem

| Feature | Status no Front | O Que o Back Precisa |
|---------|----------------|---------------------|
| **Multi-tenant** | Não implementado | Todas as tabelas com `tenantId`, middleware de isolamento |
| **Upload real de imagens** | Usa URLs externas | Endpoint de upload + storage (S3/Cloudinary) |
| **Pagamento real Mercado Pago** | Simulado (mock + Bricks parcial) | Integração completa com API do MP |
| **PIX real** | QR code fake / chave fixa | Gerar PIX via Mercado Pago API |
| **WhatsApp automático** | Abre link wa.me (manual) | Envio automático via API WhatsApp |
| **Notificação de lembrete** | Verificação client-side com timer | CRON job no backend |
| **Password reset** | Não existe | Endpoint + email/SMS para reset |
| **Email verification** | Não existe | Confirmação de email no cadastro |
| **Paginação** | Não implementada | Requests paginados em todas as listagens |
| **Busca/Filtros avançados** | Filtros básicos no front | Query params com filtros, sort, pagination |

### Ajustes Recomendados no Frontend (Após Backend Pronto)

1. Trocar `localStorage` por cookies httpOnly para tokens
2. Remover lógica de autenticação client-side (comparação de senha)
3. Enviar `Authorization: Bearer <token>` em todas as requests
4. Adicionar interceptor axios para refresh automático de token
5. Armazenar preços como números (não strings "R$ 40,00")
6. Adicionar `tenantId` ou slug na URL/header das requests
8. Implementar paginação nas listagens

---

> **Documento gerado em:** 20 de fevereiro de 2026
> **Base:** Análise completa do frontend React (SGA Barbearia)
> **Próximo passo:** Iniciar o backend seguindo esta especificação
