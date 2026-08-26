# ⛽ Sistema de Gestao de Abastecimento - PWA

Sistema completo para controle de abastecimento de veiculos, desenvolvido como **Progressive Web App (PWA)** para instalacao direta no celular, funcionando **online e offline**.

## 📋 Funcionalidades

### Para Operacao e Administrador
- ✅ Lancamento de abastecimento com fotos (odometro + nota fiscal)
- ✅ Identificacao do veiculo por placa
- ✅ Registro de KM, litros, tipo de combustivel e valor
- ✅ Funcionamento 100% offline com sincronizacao automatica
- ✅ Bloqueio de botao voltar durante lancamento
- ✅ Bloqueio de swipe/refresh na tela
- ✅ Cache local no celular (IndexedDB)

### Para Administrador (Gestao)
- 👤 Cadastro de usuarios (2 niveis: ADM e Operacao)
- 🚗 Cadastro e gestao da frota de veiculos
- 📊 Dashboard com KPIs em tempo real
- ⚠️ Alertas de consumo anormal (possivel furto/vazamento)
- 📈 Graficos de consumo por veiculo
- 💰 Relatorio de gastos e custo por km
- 🏆 Ranking de eficiencia da frota
- 📥 Exportacao de dados em CSV

## 🏗️ Arquitetura

```
┌─────────────────────────┐
│       CELULAR           │
│       PWA               │
│  HTML + CSS + JS        │
│  Service Worker         │
│  IndexedDB              │
│  Cache Offline          │
└────────────┬────────────┘
             │
     Internet disponivel
             │
             ▼
┌─────────────────────────┐
│   GOOGLE APPS SCRIPT    │
│  API / Backend          │
│  Autenticacao           │
│  Validacoes             │
│  Processamento          │
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────┐   ┌──────────┐
│  SHEETS  │   │  DRIVE   │
│ Dados    │   │  Fotos   │
│ KPIs     │   │          │
└──────────┘   └──────────┘
```

## 📁 Estrutura do Projeto

```
sistema-abastecimento-pwa/
├── index.html          # Interface principal do PWA
├── styles.css          # Estilos (Dark Mode)
├── app.js              # Logica do app (IndexedDB, API, UI)
├── sw.js               # Service Worker (cache offline)
├── manifest.json       # Manifesto do PWA
├── Code.gs             # Google Apps Script (backend)
├── assets/             # Icones do PWA
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
├── README.md           # Este arquivo
└── setup-guide.md      # Guia de deploy passo a passo
```

## 🚀 Deploy

Veja o arquivo [setup-guide.md](setup-guide.md) para instrucoes detalhadas de deploy.

Resumo rapido:
1. Criar planilha Google Sheets
2. Criar projeto Google Apps Script e colar `Code.gs`
3. Fazer deploy como Web App
4. Atualizar `CONFIG.API_URL` no `app.js`
5. Hospedar arquivos PWA (GitHub Pages, Netlify, etc.)
6. Acessar no celular e "Adicionar a Tela Inicial"

## 🔐 Seguranca

- Autenticacao por email/senha
- 2 niveis de acesso (ADM/Operacao)
- Fotos armazenadas no Google Drive com acesso restrito
- Dados sensiveis nao ficam expostos no frontend
- Cache local criptografado por sessao

## 📱 Compatibilidade

- ✅ Android (Chrome)
- ✅ iOS (Safari)
- ✅ Chrome Desktop
- ✅ Edge
- ✅ Funciona offline

## 🛠️ Tecnologias

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Chart.js
- **Backend:** Google Apps Script
- **Banco de Dados:** Google Sheets
- **Armazenamento:** Google Drive (fotos), IndexedDB (cache local)
- **PWA:** Service Worker, Web App Manifest, Cache API

## 📄 Licenca

MIT - Sistema open source para gestao de frota.
