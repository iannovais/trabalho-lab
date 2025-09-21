# Sistema de Lista de Compras com Microsserviços

## Descrição do Projeto

Sistema distribuído para gerenciamento de listas de compras utilizando arquitetura de microsserviços com API Gateway, Service Discovery e bancos NoSQL independentes, desenvolvido como parte da disciplina Laboratório de Desenvolvimento de Aplicações Móveis e Distribuídas da PUC Minas.

## Arquitetura do Sistema

### Microsserviços Implementados

| Serviço | Porta | Descrição | Database |
|---------|-------|-----------|----------|
| **API Gateway** | 3000 | Ponto único de entrada e roteamento | - |
| **User Service** | 3001 | Gerenciamento de usuários e autenticação | JSON-NoSQL |
| **Item Service** | 3002 | Catálogo de produtos e categorias | JSON-NoSQL |
| **List Service** | 3003 | Gerenciamento de listas de compras | JSON-NoSQL |

## Como Executar

### Pré-requisitos
- Node.js instalado
- NPM

### Instalação e Execução

```bash

# 1. Instale as dependências de cada serviço
npm run install:all

# 2. Execute os serviços em terminais separados:

# Terminal 1 - User Service (3001)
cd services/user-service && npm start

# Terminal 2 - Item Service (3002)
cd services/item-service && npm start

# Terminal 3 - List Service (3003)  
cd services/list-service && npm start

# Terminal 4 - API Gateway (3000)
cd services/api-gateway && npm start

# 3. Execute a demonstração
node cliente-demo.js
```

### Verificação da Instalação

```bash
# Health Check
curl http://localhost:3000/health

# Service Registry
curl http://localhost:3000/registry
```

## Endpoints da API

### Autenticação (User Service)
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/validate` - Validar token JWT

### Usuários (User Service)
- `GET /api/users/:id` - Buscar usuário por ID
- `PUT /api/users/:id` - Atualizar dados do usuário

### Itens (Item Service)
- `GET /api/items` - Listar itens com paginação
- `GET /api/items/:id` - Buscar item específico
- `GET /api/items/categories` - Listar categorias
- `POST /api/items` - Criar novo item (autenticação requerida)

### Listas (List Service)
- `POST /api/lists` - Criar nova lista
- `GET /api/lists` - Listar listas do usuário
- `GET /api/lists/:id` - Buscar lista específica
- `PUT /api/lists/:id` - Atualizar lista
- `DELETE /api/lists/:id` - Deletar lista
- `POST /api/lists/:id/items` - Adicionar item à lista

### Busca e Dashboard (API Gateway)
- `GET /api/search?q=termo` - Busca global em itens e listas
- `GET /api/dashboard` - Dashboard com estatísticas do usuário
- `GET /health` - Status de saúde dos serviços
- `GET /registry` - Serviços registrados

## Funcionalidades Implementadas

### Parte 1: User Service
- [x] Registro de usuários com validação de email único
- [x] Login com JWT e hash de senha (bcrypt)
- [x] Middleware de autenticação
- [x] CRUD completo de usuários

### Parte 2: Item Service  
- [x] Catálogo com 25+ itens em 5 categorias
- [x] Busca por nome e categoria
- [x] Gestão completa de produtos
- [x] Dados iniciais automáticos

### Parte 3: List Service
- [x] Criação e gestão de listas de compras
- [x] Adição/remoção de itens com validação
- [x] Cálculo automático de totais
- [x] Controle de permissões (usuário só acessa suas listas)

### Parte 4: API Gateway
- [x] Roteamento inteligente para microsserviços
- [x] Circuit breaker (3 falhas → abre circuito)
- [x] Health checks automáticos a cada 30s
- [x] Dashboard agregado
- [x] Busca global unificada

### Parte 5: Service Registry
- [x] Registro automático de serviços
- [x] Descoberta dinâmica por nome
- [x] Health checks distribuídos
- [x] Cleanup automático
