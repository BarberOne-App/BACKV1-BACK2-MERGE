# Backend Barbearia

API backend para o sistema de gerenciamento de barbearia.

## 🚀 Começando

### Pré-requisitos

- Node.js 16+ instalado
- npm ou yarn

### Instalação

1. Clone o repositório
```bash
git clone <seu-repositorio>
cd Backend\ Barbearia
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

### Desenvolvimento

Para iniciar o servidor em modo desenvolvimento com hot reload:
```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

### Build e Produção

Build do projeto:
```bash
npm run build
```

Executar em produção:
```bash
npm start
```

### Linting e Formatação

Executar eslint:
```bash
npm run lint
```

Corrigir problemas automaticamente:
```bash
npm run lint:fix
```

Formatar código:
```bash
npm run format
```

## 📁 Estrutura do Projeto

```
src/
├── index.ts              # Arquivo principal da aplicação
├── controllers/          # Controladores da lógica de negócio
├── routes/              # Definição de rotas
├── middleware/          # Middlewares customizados
├── config/              # Arquivos de configuração
├── types/               # Tipos e interfaces TypeScript
└── utils/               # Funções utilitárias
```

## 🔧 Configuração

### Variáveis de Ambiente

- `PORT`: Porta do servidor (padrão: 3000)
- `NODE_ENV`: Ambiente de execução (development/production)

## 📚 Endpoints

### Health Check
- `GET /api/health` - Verifica o status do servidor

## 🛠️ Stack Tecnológico

- **Express.js** - Framework web
- **TypeScript** - Linguagem de programação
- **ESLint** - Linter
- **Prettier** - Formatador de código
- **CORS** - Suporte para requisições cross-origin

## 📝 Próximos Passos

- [ ] Configurar banco de dados
- [ ] Adicionar autenticação
- [ ] Implementar validação de dados
- [ ] Configurar testes
- [ ] Documentar API com Swagger

## 📄 Licença

MIT
