const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 9080;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// API placeholder (expandir depois)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend funcionando!' });
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Painel Web rodando em http://0.0.0.0:${PORT}`);
});
