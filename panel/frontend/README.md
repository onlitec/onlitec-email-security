# Frontend React - Onlitec Email Panel

## 🎨 Frontend React Completo Criado!

Interface administrativa moderna com:
- ✅ Autenticação JWT
- ✅ Dashboard com estatísticas
- ✅ Layout responsivo
- ✅ Tailwind CSS moderno
- ✅ React Router
- ✅ Axios API integration

## 📦 Estrutura

```
panel/frontend/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── api.js
    ├── components/
    │   └── Layout.jsx
    └── pages/
        ├── Login.jsx
        └── Dashboard.jsx
```

## 🚀 Como Usar

### Desenvolvimento Local

```bash
cd panel/frontend

# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Acesse: http://localhost:3000
```

### Build para Produção

```bash
cd panel/frontend

# Build (gera arquivos em ../backend/public)
npm run build
```

## 🔧 Próximos Passos

O frontend básico está criado. Para completar:

1. **Implementar páginas adicionais:**
   - Tenants (CRUD)
   - Domains (CRUD)
   - Users (CRUD)
   - Quarantine (visualizar/liberar)
   - Logs (filtros e busca)
   - Settings

2. **Adicionar ao Docker:**
   - Descomentar serviço no docker-compose.yml
   - Build frontend no Dockerfile

3. **Melhorias:**
   - Gráficos com Recharts
   - Tabelas paginadas
   - Filtros avançados
   - Real-time updates (WebSocket)

## 📱 Componentes Criados

- **Login**: Autenticação comcredenciais padrão
- **Dashboard**: Overview com cards de estatísticas
- **Layout**: Navegação e estrutura principal
- **API Client**: Axios configurado com interceptors

## 🎯 Credenciais Padrão

- Email: `admin@onlitec.local`
- Senha: `changeme123!`

## 🛠️ Tecnologias

- React 18
- Vite (build tool)
- React Router v6
- Axios
- Tailwind CSS
- Recharts (para gráficos)

---

**Status:** ✅ Frontend básico funcional criado!
