# Parceiro Areschat

## Objetivo

Este documento define o que um parceiro precisa implementar no proprio sistema para se integrar ao Areschat.

O parceiro precisa apenas expor uma API que siga o contrato esperado para que o chatbot consiga:

- consultar informacoes
- responder ao cliente em tempo real
- criar operacoes no sistema do parceiro

## Visao geral

O parceiro continua sendo dono:

- do banco de dados
- do backend
- das regras de negocio
- da operacao interna

O Areschat sera responsavel apenas por:

- conectar o WhatsApp
- operar filas e chatbot
- chamar a API do parceiro
- transformar retorno em resposta na conversa

## O que o parceiro precisa entregar

### Obrigatorio

- API HTTPS publica ou acessivel pelo Areschat
- autenticacao por token ou API key
- ambiente de homologacao
- documentacao da API
- ids estaveis para os recursos
- labels claras para os recursos exibidos ao cliente

### Recomendado

- Swagger ou Postman
- logs internos por request
- `X-Request-Id`
- padrao de erro consistente

## Contrato funcional minimo

O parceiro deve expor recursos que permitam:

- consultar catalogos
- consultar disponibilidade ou estado
- localizar ou criar cliente
- criar a operacao final

Dependendo do dominio, a operacao final muda:

- barbearia: agendamento
- clinica: consulta
- restaurante: reserva ou pedido
- oficina: ordem de servico

## Primeira implementacao: Barbearia

No caso da barbearia, o parceiro deve disponibilizar:

- unidades
- barbeiros ou profissionais
- servicos
- planos
- formas de pagamento
- disponibilidade
- clientes
- agendamentos

## Como o cliente escolhe profissionais, planos e horarios

O cliente nao deve adivinhar o nome do profissional ou o horario.

A API do parceiro deve devolver listas claras para que o Areschat apresente opcoes como:

```txt
Bot: Tenho estes profissionais disponiveis:
1. Carlos
2. Renato
3. Felipe
```

Depois disso, o cliente pode responder:

- pelo numero, exemplo `1`
- pelo nome, exemplo `Carlos`

O Areschat ja possui estrategia de equivalencia de texto. Portanto, o parceiro precisa garantir que os itens retornados tenham nomes claros e consistentes para exibicao.

O mesmo vale para:

- unidades
- servicos
- planos
- horarios disponiveis

## O que o parceiro ganha ao implementar esse contrato

Se o parceiro implementar essas rotas e regras, o Areschat conseguira operar um fluxo completo de conversa no WhatsApp usando os dados reais do sistema da barbearia.

Na pratica, isso significa que o chatbot conseguira:

- consultar os planos diretamente na API do parceiro
- consultar unidades, profissionais e servicos
- consultar horarios disponiveis em tempo real
- localizar ou criar o cliente
- criar o agendamento ao final da conversa
- responder tudo no WhatsApp sem o cliente sair da conversa

## Exemplo de conversa que essa API habilita

### Consulta de planos

```txt
Cliente: Quais planos voces tem?
Bot: Hoje temos os seguintes planos:
1. Plano Corte Mensal - R$ 99,90
2. Plano Corte e Barba - R$ 149,90
```

Nesse caso, o Areschat faz uma consulta como:

- `GET /plans`

O cliente pode responder:

- `1`
- `Plano Corte Mensal`

### Fluxo de agendamento

```txt
Cliente: Quero marcar um corte.
Bot: Qual unidade voce prefere?
1. Centro
2. Bairro

Cliente: 1
Bot: Qual profissional voce prefere?
1. Carlos
2. Renato

Cliente: Carlos
Bot: Para qual data?
Cliente: Sexta-feira
Bot: Tenho horarios disponiveis com Carlos:
1. 09:00
2. 10:20

Cliente: 2
Bot: Como deseja pagar?
1. Pix
2. Pagar no local

Cliente: Pix
Bot: Seu agendamento foi confirmado para sexta-feira as 10:20 com Carlos.
```

Nesse fluxo, o Areschat normalmente vai consumir:

1. `GET /units`
2. `GET /barbers` ou `GET /professionals`
3. `GET /services`
4. `GET /availability`
5. `GET /payment-methods`
6. `GET /customers/by-phone/{phone}` ou `POST /customers`
7. `POST /appointments`

Ou seja, a API do parceiro passa a ser a fonte oficial das respostas dinamicas do chatbot.

## Como as rotas alimentam a selecao do cliente

### Escolha de unidade

O Areschat chama:

- `GET /units`

Exemplo de retorno:

```json
[
  {
    "id": "unit_001",
    "name": "Centro",
    "displayName": "Centro",
    "active": true
  },
  {
    "id": "unit_002",
    "name": "Bairro",
    "displayName": "Bairro",
    "active": true
  }
]
```

Mensagem montada para o cliente:

```txt
Qual unidade voce prefere?
1. Centro
2. Bairro
```

### Escolha de profissional

O Areschat chama:

- `GET /barbers?unitId=unit_001&serviceId=service_001&active=true`

ou

- `GET /professionals?unitId=unit_001&serviceId=service_001&active=true`

Exemplo de retorno:

```json
[
  {
    "id": "professional_001",
    "name": "Carlos",
    "displayName": "Carlos",
    "active": true
  },
  {
    "id": "professional_002",
    "name": "Renato",
    "displayName": "Renato",
    "active": true
  }
]
```

Mensagem montada para o cliente:

```txt
Qual profissional voce prefere?
1. Carlos
2. Renato
```

### Escolha de horario

O Areschat chama:

- `GET /availability?unitId=unit_001&professionalId=professional_001&serviceId=service_001&date=2026-05-16`

Exemplo de retorno:

```json
{
  "unitId": "unit_001",
  "professionalId": "professional_001",
  "serviceId": "service_001",
  "date": "2026-05-16",
  "slots": [
    {
      "id": "slot_001",
      "startAt": "2026-05-16T09:00:00-03:00",
      "endAt": "2026-05-16T09:40:00-03:00",
      "available": true,
      "displayLabel": "09:00"
    },
    {
      "id": "slot_002",
      "startAt": "2026-05-16T10:20:00-03:00",
      "endAt": "2026-05-16T11:00:00-03:00",
      "available": true,
      "displayLabel": "10:20"
    }
  ]
}
```

Mensagem montada para o cliente:

```txt
Tenho horarios disponiveis com Carlos:
1. 09:00
2. 10:20
```

## Regras que a API do parceiro deve seguir para suportar selecao por numero ou texto

1. Retornar listas com nomes claros e consistentes.
2. Retornar ids estaveis para cada item.
3. Retornar apenas itens ativos ou disponiveis quando aplicavel.
4. Permitir filtros para reduzir as opcoes mostradas ao cliente.
5. No caso de horarios, retornar apenas slots validos para selecao.
6. Sempre que possivel, retornar um campo de exibicao como `displayName` ou `displayLabel`.

Na pratica, o Areschat exibira o label do item e guardara o id interno.

Exemplo:

```json
{
  "id": "professional_001",
  "name": "Carlos",
  "displayName": "Carlos"
}
```

No WhatsApp o cliente ve:

```txt
1. Carlos
```

Internamente o Areschat salva:

- numero exibido: `1`
- label exibida: `Carlos`
- id real: `professional_001`

Assim, quando o cliente responder `1` ou `Carlos`, o Areschat consegue apontar para o mesmo profissional.

## Base URL recomendada

Sugestao:

```txt
https://api.parceiro.com/api/integrations/areschat/v1
```

Headers padrao:

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer SEU_TOKEN_DE_INTEGRACAO
X-Partner-Id: areschat
X-Request-Id: 9e7c0b3a-2f4d-4c84-8a74-7d2b20b6a901
```

## Endpoints recomendados para parceiro barbearia

### `GET /health`

Resposta:

```json
{
  "status": "ok",
  "service": "barbearia-api",
  "version": "1.0.0",
  "timestamp": "2026-05-12T14:00:00Z"
}
```

### `GET /units`

```json
[
  {
    "id": "unit_001",
    "name": "Barbearia Centro",
    "displayName": "Centro",
    "timezone": "America/Sao_Paulo",
    "active": true
  }
]
```

### `GET /barbers`

Filtros uteis:

- `unitId`
- `serviceId`
- `active`

```json
[
  {
    "id": "professional_001",
    "unitId": "unit_001",
    "name": "Carlos",
    "displayName": "Carlos",
    "active": true
  }
]
```

### `GET /services`

```json
[
  {
    "id": "service_001",
    "name": "Corte Masculino",
    "displayName": "Corte Masculino",
    "durationMinutes": 40,
    "price": 45.0,
    "active": true
  }
]
```

### `GET /plans`

```json
[
  {
    "id": "plan_001",
    "name": "Plano Corte Mensal",
    "displayName": "Plano Corte Mensal",
    "description": "Direito a 4 cortes por mes",
    "price": 99.9,
    "currency": "BRL",
    "active": true
  }
]
```

### `GET /payment-methods`

```json
[
  {
    "id": "payment_pix",
    "code": "pix",
    "name": "Pix",
    "displayName": "Pix",
    "active": true
  },
  {
    "id": "payment_on_site",
    "code": "pay_on_site",
    "name": "Pagar no local",
    "displayName": "Pagar no local",
    "active": true
  }
]
```

### `GET /availability`

Query params sugeridos:

- `unitId`
- `professionalId`
- `serviceId`
- `date`

```json
{
  "unitId": "unit_001",
  "professionalId": "professional_001",
  "serviceId": "service_001",
  "date": "2026-05-15",
  "slots": [
    {
      "id": "slot_001",
      "startAt": "2026-05-15T09:00:00-03:00",
      "endAt": "2026-05-15T09:40:00-03:00",
      "available": true,
      "displayLabel": "09:00"
    },
    {
      "id": "slot_002",
      "startAt": "2026-05-15T10:20:00-03:00",
      "endAt": "2026-05-15T11:00:00-03:00",
      "available": true,
      "displayLabel": "10:20"
    }
  ]
}
```

### `GET /customers/by-phone/{phone}`

```json
{
  "id": "customer_001",
  "name": "Joao Silva",
  "phone": "+5511991112222"
}
```

### `POST /customers`

```json
{
  "name": "Joao Silva",
  "phone": "+5511991112222",
  "email": "joao@email.com"
}
```

Resposta:

```json
{
  "id": "customer_001",
  "name": "Joao Silva",
  "phone": "+5511991112222"
}
```

### `POST /appointments`

Request:

```json
{
  "unitId": "unit_001",
  "customerId": "customer_001",
  "professionalId": "professional_001",
  "serviceId": "service_001",
  "startAt": "2026-05-15T09:00:00-03:00",
  "paymentMethod": "pix",
  "channel": "whatsapp",
  "externalReference": "areschat-conversation-84521"
}
```

Response:

```json
{
  "id": "appointment_001",
  "status": "confirmed",
  "unitId": "unit_001",
  "customerId": "customer_001",
  "professionalId": "professional_001",
  "serviceId": "service_001",
  "startAt": "2026-05-15T09:00:00-03:00",
  "endAt": "2026-05-15T09:40:00-03:00",
  "paymentMethod": "pix",
  "channel": "whatsapp",
  "externalReference": "areschat-conversation-84521"
}
```

### `GET /appointments/{id}`

### `PATCH /appointments/{id}`

### `POST /appointments/{id}/cancel`

## Regras de negocio obrigatorias no parceiro

- validar conflito de horario
- validar se o profissional executa o servico
- validar unidade
- validar horario de funcionamento
- respeitar bloqueios e indisponibilidades
- devolver erro claro quando nao for possivel concluir a operacao

## Estrutura de erro recomendada

```json
{
  "error": "validation_error",
  "message": "O campo serviceId e obrigatorio",
  "details": [
    {
      "field": "serviceId",
      "message": "required"
    }
  ]
}
```

Exemplo de erro de negocio:

```json
{
  "error": "slot_unavailable",
  "message": "O horario informado nao esta mais disponivel"
}
```

## Backlog tecnico do parceiro

## Epico 1. Banco

### Tarefas

1. Garantir ids estaveis para unidades, profissionais, servicos, clientes e agendamentos.
2. Garantir estrutura que permita consultar disponibilidade por data.
3. Garantir estrutura que relacione profissional e servico.
4. Garantir dados de planos com nome, descricao, preco, status e label de exibicao.
5. Garantir dados de formas de pagamento ativas.
6. Garantir identificador estavel para slot de horario, quando possivel.

## Epico 2. Backend

### Tarefas

1. Criar camada de API de integracao separada das rotas internas.
2. Criar autenticacao por Bearer Token ou API Key.
3. Criar `GET /health`.
4. Criar `GET /units`.
5. Criar `GET /barbers` ou `GET /professionals`.
6. Criar `GET /services`.
7. Criar `GET /plans`.
8. Criar `GET /payment-methods`.
9. Criar `GET /availability`.
10. Criar `GET /customers/by-phone/{phone}`.
11. Criar `POST /customers`.
12. Criar `POST /appointments`.
13. Criar `GET /appointments/{id}`.
14. Criar `PATCH /appointments/{id}`.
15. Criar `POST /appointments/{id}/cancel`.
16. Padronizar respostas e erros.
17. Implementar `X-Request-Id` nos logs.
18. Garantir retorno de labels claros para exibicao ao cliente.
19. Garantir filtros que permitam ao Areschat montar listas menores e mais objetivas.

## Epico 3. Frontend/Painel

### Tarefas

1. Nao e obrigatorio criar tela no painel para o Areschat.
2. Se necessario, criar apenas uma area administrativa para gerar token de integracao.
3. Se necessario, criar apenas uma area para visualizar status da API e logs.

## Epico 4. Chatbot

### Tarefas

1. Nao ha desenvolvimento de chatbot no sistema do parceiro.
2. O parceiro precisa apenas garantir que a API entregue os dados corretos para o chatbot do Areschat.

## Epico 5. Homologacao

### Tarefas

1. Disponibilizar ambiente de homologacao.
2. Disponibilizar token de teste.
3. Validar `GET /plans`.
4. Validar `GET /barbers` ou `GET /professionals` com lista correta.
5. Validar `GET /availability`.
6. Validar exibicao de labels de unidades, profissionais, servicos, planos e horarios.
7. Validar `GET /customers/by-phone/{phone}`.
8. Validar `POST /customers`.
9. Validar `POST /appointments`.
10. Validar erro de conflito de horario.
11. Validar cancelamento.

## Epico 6. Documentacao do parceiro

### Tarefas

1. Publicar documentacao dos endpoints.
2. Publicar exemplos de request e response.
3. Publicar exemplos de erro.
4. Publicar instrucoes de autenticacao.
5. Publicar URL de homologacao.

## Ordem recomendada de implementacao

1. Banco
2. Backend da API de integracao
3. Token e seguranca
4. Homologacao
5. Documentacao

## Checklist final do parceiro

- API HTTPS pronta
- autenticacao pronta
- endpoints do contrato implementados
- ids estaveis
- labels claros para exibicao
- regras de negocio validadas no backend
- ambiente de homologacao pronto
- documentacao entregue

## Conclusao

Para integrar com o Areschat, o parceiro nao precisa alterar o produto inteiro.

Ele precisa modular uma API de integracao, com autenticacao e endpoints padronizados, para que o Areschat consiga consultar dados e criar operacoes durante a conversa no WhatsApp.
