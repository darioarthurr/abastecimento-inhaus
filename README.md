⛽ Sistema de Gestao de Abastecimento v2.0
PWA completo para controle de abastecimento de veiculos. Funciona 100% offline com sincronizacao opcional ao Google Sheets.
✨ O que ha de novo na v2.0
100% funcional offline — dados de demonstracao inclusos
Mobile-first — interface otimizada para celular
Zero dependencias externas — graficos nativos em Canvas
CORS resolvido — comunicacao segura com Google Apps Script
Touch-optimized — botoes grandes, gestos suaves, feedback visual
Icones inline — nada de 404, funciona em qualquer host
📱 Telas
Tela	Funcoes
Login	Autenticacao local (demo pre-carregado)
Dashboard	KPIs, alertas de consumo, graficos
Abastecer	Lancamento com fotos, calculo automatico de consumo
Historico	Busca, filtros, detalhes com fotos
Gestao	Cadastro de veiculos, usuarios, relatorios
Perfil	Configuracao de sync, export CSV
🚀 Deploy Rapido (3 minutos)
1. Hospedar o PWA
Suba os arquivos em qualquer host estatico (GitHub Pages, Netlify, Vercel, Cloudflare Pages)
Ou abra o `index.html` direto no navegador para testar
2. Testar imediatamente (Modo Demo)
Acesse o app
Login: `admin@empresa.com`
Senha: `admin123`
Pronto! Ja funciona com 4 veiculos e 6 abastecimentos de demonstracao
3. Conectar ao Google Sheets (opcional)
Crie uma planilha Google Sheets
Va em Extensoes > Apps Script
Cole o conteudo de `Code.gs`
Faca Deploy > Novo deploy > Aplicativo da Web
Execute como: Eu | Acesso: Qualquer pessoa
Copie a URL de execucao
No app, va em Perfil > Configuracoes e cole a URL
Toque em Sincronizar (🔄 no header)
📁 Arquivos
```
sistema-abastecimento-v2/
├── index.html      # Interface PWA
├── styles.css      # Estilos mobile-first
├── app.js          # Logica completa (offline + sync)
├── sw.js           # Service Worker
├── manifest.json   # Manifesto PWA
├── Code.gs         # Backend Google Apps Script
└── README.md       # Este arquivo
```
🔐 Acesso
Perfil	Email	Senha
Admin	admin@empresa.com	admin123
Operacao	op@empresa.com	op1234
📸 Fotos no Celular
O app usa `<input capture="environment">` que abre a camera nativa do celular automaticamente. As fotos ficam:
Salvas no IndexedDB do navegador (offline)
Enviadas para Google Drive (quando sincronizado)
🛠 Tecnologias
HTML5, CSS3, JavaScript (ES6+)
IndexedDB (armazenamento local)
Canvas API (graficos nativos)
Service Worker (PWA offline)
Google Apps Script (backend)
Google Sheets (banco de dados)
Google Drive (armazenamento de fotos)
📄 Licenca
MIT — Use livremente para gestao da sua frota.
