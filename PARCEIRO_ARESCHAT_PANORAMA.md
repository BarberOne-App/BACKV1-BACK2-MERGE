# Panorama de integração com o Areschat

## Objetivo deste documento

Este arquivo resume o contrato pedido em ParceiroAresChat.md e cruza esse contrato com o que o backend atual já possui hoje.

O foco é separar em três grupos:

- o que já existe e pode ser reutilizado
- o que existe, mas ainda não encaixa no contrato do parceiro
- o que ainda precisa ser criado para a integração ficar estável e previsível

## Resumo executivo

O backend já possui boa parte da operação interna de barbearia: barbers, services, subscription-plans, appointments, payment-methods, users, blocked-dates e lógica de disponibilidade com fuso de America/Sao_Paulo.

Mesmo assim, ele ainda não expõe uma API de integração dedicada ao Areschat. Hoje o sistema está montado como backend interno com autenticação por JWT de usuário e rotas voltadas ao painel/app próprio, não como contrato público versionado para chatbot.

Em termos práticos:

- já existe base para profissionais, serviços, planos, agendamentos, métodos de pagamento e disponibilidade
- não existe ainda uma camada pública com o formato do Areschat
- não existem endpoints próprios para units, customers/by-phone e customers
- a criação de agendamento atual não bate com o payload esperado pelo parceiro
- falta autenticação por token ou API key dedicada à integração externa

## O que o arquivo ParceiroAresChat pede

### Requisitos obrigatórios do parceiro

- API HTTPS pública ou acessível pelo Areschat
- autenticação por token ou API key
- ambiente de homologação
- documentação da API
- ids estáveis para os recursos
- labels claras para exibição ao cliente

### Contrato funcional mínimo

- consultar catálogos
- consultar disponibilidade ou estado
- localizar ou criar cliente
- criar a operação final

### Primeira implementação: barbearia

O contrato da barbearia pede, no mínimo:

- units
- barbers ou professionals
- services
- plans
- payment-methods
- availability
- customers
- appointments

### Endpoints recomendados pelo parceiro

- GET /health
- GET /units
- GET /barbers ou GET /professionals
- GET /services
- GET /plans
- GET /payment-methods
- GET /availability
- GET /customers/by-phone/{phone}
- POST /customers
- POST /appointments
- GET /appointments/{id}
- PATCH /appointments/{id}
- POST /appointments/{id}/cancel

## Resumo rápido: endpoints pedidos x endpoints atuais

| Endpoint pedido (Areschat) | Endpoint atual no backend | Situação |
|---|---|---|
| GET /health | GET /health | Parcial (já existe, mas formato de resposta ainda diferente do sugerido) |
| GET /units | Sem endpoint equivalente direto | Não existe |
| GET /barbers ou GET /professionals | GET /barbers | Parcial (rota interna com JWT de usuário) |
| GET /services | GET /services | Parcial (rota interna com JWT de usuário) |
| GET /plans | GET /subscription-plans | Parcial (nome e contrato diferentes) |
| GET /payment-methods | GET /payment-methods | Parcial (hoje lista métodos salvos de usuário, não meios de pagamento operacionais) |
| GET /availability | GET /appointments/available-slots | Parcial (formato de request/response diferente) |
| GET /customers/by-phone/{phone} | Sem endpoint equivalente direto | Não existe |
| POST /customers | Sem endpoint equivalente direto (hoje usa POST /users) | Não existe no contrato pedido |
| POST /appointments | POST /appointments | Parcial (payload e resposta diferentes do contrato Areschat) |
| GET /appointments/{id} | GET /appointments/:id | Parcial (rota interna com contrato próprio) |
| PATCH /appointments/{id} | PATCH /appointments/:id | Parcial (rota interna com contrato próprio) |
| POST /appointments/{id}/cancel | DELETE /appointments/:id | Parcial (mesma intenção, método e contrato diferentes) |

### Endpoints principais que você já tem hoje

- GET /health
- GET /barbers
- GET /barbers/:id
- GET /services
- GET /services/:id
- GET /subscription-plans
- GET /subscription-plans/:id
- GET /payment-methods
- GET /appointments
- GET /appointments/:id
- GET /appointments/available-slots
- POST /appointments
- PATCH /appointments/:id
- DELETE /appointments/:id
- GET /users
- GET /users/:id
- POST /users

## O que o backend atual já possui

### 1. Profissionais

Existe o modelo barbers e rotas internas para listagem, detalhe, criação, atualização, vínculo com usuário e remoção.

Cobertura atual:

- já existe entidade persistida para profissionais
- já existe retorno com displayName, specialty, photoUrl, commissionPercent e serviceIds
- já existe filtro por texto na listagem
- já existe vínculo entre profissional e serviços

Ponto importante:

- o contrato do parceiro chama isso de barbers ou professionals, mas hoje a rota é interna e depende de JWT de usuário logado
- ainda não existe uma rota pública específica para integração externa

### 2. Serviços

Existe o modelo services com nome, preço, duração, ativo, imagem e relação com barbershop.

Cobertura atual:

- listagem de serviços
- busca por id
- criação, edição, desativação e reativação
- retorno com basePrice, durationMinutes, covered_by_plan, active e imageUrl

Ponto importante:

- isso atende bem o catálogo de serviços do Areschat, mas ainda está exposto só como rota interna autenticada

### 3. Planos

Existe o modelo subscription_plans e a listagem de planos.

Cobertura atual:

- retorno com id, name, subtitle, price, active, recommended, features e integrações com Stripe/Mercado Pago quando existirem
- suporte a filtros como activeOnly

Ponto importante:

- o contrato do parceiro pede plans de forma explícita, então essa é uma das áreas mais próximas do que já existe
- ainda falta expor isso em contrato de integração, com payload estável e sem dependência do login interno

### 4. Agendamentos

Existe a criação, listagem, consulta, atualização, cancelamento e cálculo de disponibilidade.

Cobertura atual:

- valida conflito de horário
- valida se o barbeiro existe
- valida se o horário está no passado
- respeita bloqueios e disponibilidade da agenda do profissional
- usa horário de America/Sao_Paulo
- calcula slots disponíveis com base em abertura da barbearia e agendamentos existentes
- respeita status de cancelamento e no_show ao calcular conflito

Ponto importante:

- a lógica de negócio é forte e já cobre bem a integridade do agendamento
- mas o contrato atual não bate com o payload do parceiro

Diferenças relevantes para o Areschat:

- o contrato pede unitId, professionalId, serviceId, date e paymentMethod
- o backend atual usa barberId, clientId, date, time, services e products
- o contrato pede POST /appointments com externalReference e channel
- o backend atual não tem essa modelagem pública no endpoint de criação

### 5. Disponibilidade

Existe getAvailableSlotsService e a rota interna /appointments/available-slots.

Cobertura atual:

- entrada por barberId, date e duration
- calcula slots válidos com base na agenda do barbeiro
- ignora horários já ocupados
- respeita o horário atual do fuso de São Paulo para hoje

Ponto importante:

- a lógica já ajuda bastante o chatbot
- porém o retorno ainda não segue o formato do contrato do parceiro, que pede objeto com unitId, professionalId, serviceId, date e uma lista de slots com id, startAt, endAt, available e displayLabel

### 6. Clientes

Existe tabela users com name, email, phone, cpf, birth_date e rotas internas de usuários.

Cobertura atual:

- já existe entidade persistida com telefone
- já existe listagem e busca de usuários por texto
- já existe criação de usuários
- já existe consulta por id
- já existe validação de e-mail duplicado

Ponto importante:

- o contrato do Areschat chama isso de customers, mas hoje o backend trata isso como users
- não existe rota pronta para GET /customers/by-phone/{phone}
- não existe POST /customers com payload e resposta estáveis para o parceiro
- para o chatbot, o ideal é tratar cliente como uma entidade própria na camada de integração, ainda que internamente mapeie para users

### 7. Métodos de pagamento

Existe user_payment_methods e rotas de payment-methods.

Cobertura atual:

- listar métodos salvos por usuário
- criar método salvo
- definir padrão
- remover método

Ponto importante:

- isso não é o mesmo que a lista de formas de pagamento do Areschat
- o contrato do parceiro pede payment-methods da operação, por exemplo Pix e pagar no local
- hoje o backend expõe métodos salvos do usuário, não uma lista pública de meios aceitos pela barbearia para o chatbot

### 8. Health check

Existe GET /health.

Cobertura atual:

- endpoint simples para status do servidor

Ponto importante:

- atende parcialmente a necessidade de health
- o parceiro sugere um retorno mais rico com service, version e timestamp padronizados

### 9. Segurança e autenticação

Existe middleware requireAuth baseado em JWT de usuário, com validação de barbearia atual e papéis.

Cobertura atual:

- autenticação por Bearer JWT
- validação da barbearia ativa do usuário
- checagem de status da barbearia
- controle de papel e permissões

Ponto importante:

- isso funciona para o painel interno
- não atende ainda ao requisito de token ou API key de integração externa dedicado ao Areschat

### 10. Logs e rastreio

Existe uso de x-request-id em webhook, mas não como padrão geral da API.

Cobertura atual:

- há tratamento pontual de x-request-id em webhook

Ponto importante:

- o contrato do parceiro recomenda X-Request-Id de forma geral
- ainda não existe padronização transversal de request id nos logs e respostas

## O que existe só parcialmente

### Units

Estado atual: parcial / mapeável

O backend não tem uma entidade units explícita.

Na prática, o sistema trabalha com barbershop como tenant principal. Isso pode ser suficiente se cada barbearia do parceiro corresponder a uma unidade única, mas não cobre um cenário com várias unidades por barbearia.

Conclusão:

- se a operação do parceiro for multi-unidade real, a modelagem precisa ser criada
- se a operação for uma unidade por barbearia, dá para mapear barbershop como unit no contrato de integração

### Availability

Estado atual: parcial

Existe a lógica de slots, mas o contrato do parceiro pede uma estrutura mais rica e mais amigável ao chatbot.

Falta:

- slot id estável quando possível
- unitId/professionalId/serviceId no payload
- displayLabel explícito
- rota pública com o nome esperado pelo Areschat

### Plans

Estado atual: bom, mas interno

Os planos já existem e estão bem estruturados, mas ainda precisam de um contrato de integração próprio.

### Payment methods

Estado atual: parcial

Existe pagamento salvo do usuário, mas não a lista de meios aceitos no fluxo de chatbot.

## O que ainda falta implementar para integrar da melhor forma

### 1. Camada de integração dedicada

Criar um módulo ou prefixo específico para a API externa do Areschat, separado das rotas internas do painel.

Recomendação:

- versão explícita na URL
- prefixo próprio da integração
- contratos de request e response independentes das rotas internas

### 2. Autenticação própria

Implementar autenticação por API key ou Bearer Token específico para integração.

Isso deve ser separado do JWT de usuário do painel.

### 3. Endpoint de health no formato do parceiro

Atualizar ou criar endpoint que responda com algo próximo de:

- status
- service
- version
- timestamp

### 4. Units

Se houver múltiplas unidades reais, criar modelagem própria.

Se houver apenas uma unidade por barbearia, formalizar o mapeamento para o contrato externo.

### 5. Customers

Criar a superfície pública para cliente:

- buscar por telefone
- criar cliente
- resposta estável com id, name e phone

### 6. Availability no formato do contrato

Criar endpoint público que aceite:

- unitId
- professionalId
- serviceId
- date

E devolva slots com:

- id
- startAt
- endAt
- available
- displayLabel

### 7. Appointments no formato do contrato

Criar endpoint de criação que aceite os campos do parceiro, incluindo:

- unitId
- customerId
- professionalId
- serviceId
- startAt
- paymentMethod
- channel
- externalReference

Hoje o endpoint interno trabalha com outro payload e precisará de adaptação.

### 8. Appointment detail, update e cancelamento públicos

Criar os três endpoints no contrato do Areschat:

- GET /appointments/{id}
- PATCH /appointments/{id}
- POST /appointments/{id}/cancel

### 9. Payment methods do fluxo

Criar endpoint para listar as formas de pagamento aceitas na operação, não os cartões salvos do usuário.

### 10. Padronização de erros

Criar estrutura consistente com:

- error
- message
- details

Hoje o backend devolve mensagens úteis, mas não em um formato único para integração externa.

### 11. X-Request-Id

Padronizar o suporte a X-Request-Id para todas as rotas da integração e refletir isso nos logs.

### 12. Homologação

Disponibilizar ambiente de homologação com:

- dados de teste
- token de teste
- exemplos reais de GET, POST, PATCH e cancelamento

## Mapeamento prático do que já pode ser reaproveitado

### Pode ser reaproveitado quase direto

- services
- subscription-plans
- lógica de slots disponíveis
- validação de conflito de agendamento
- validação de bloqueios e horário de funcionamento
- serializers que já retornam dados amigáveis com labels

### Pode ser reaproveitado com adaptação

- barbers como professionals
- users como customers
- barbershop como unit, se houver apenas uma unidade por operação
- payment-methods internos como base conceitual, mas não como resposta final do chatbot

### Não existe ainda no formato pedido

- API de integração pública
- autenticação por API key ou token do parceiro
- endpoints customers/by-phone e customers
- endpoints publicamente estáveis de appointments no formato do contrato
- contrato de availability com unitId e displayLabel

## Prioridade recomendada de implementação

1. Definir a camada pública da integração e o prefixo de rota
2. Definir autenticação própria
3. Fechar o mapeamento de unit, professional, service, customer e appointment
4. Expor GET /health, GET /plans, GET /services, GET /barbers e GET /availability no novo contrato
5. Implementar customers/by-phone e customers
6. Implementar criação de appointment no formato do parceiro
7. Implementar consulta, edição e cancelamento de appointment
8. Padronizar erros e X-Request-Id
9. Fechar homologação e documentação

## Conclusão

O backend já está forte na operação interna de barbearia, principalmente em profissionais, serviços, planos, disponibilidade e agendamentos.

Para o Areschat, o principal trabalho ainda é de produto de integração: separar uma API pública própria, com autenticação própria, contratos estáveis, recursos de cliente e unidade, e payloads compatíveis com o chatbot.

Em resumo: a base de negócio já existe, mas a camada de integração ainda precisa ser construída.