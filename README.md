⛽ Sistema de Gestao de Abastecimento v2.1
Correções da v2.1
✅ Scroll/Touch corrigido
Problema: Tela travada, não conseguia rolar
Solução: Bloqueio de pull-to-refresh agora só atua no topo do container de scroll, não mais globalmente. Scroll livre em todas as direções.
✅ Fotos nos detalhes
Problema: Fotos não apareciam ao ver detalhes do abastecimento
Solução: Modal de detalhes agora verifica e exibe corretamente as fotos base64. Grid de fotos com clique para ampliar.
✅ Conexão com Google Sheets
Problema: CORS bloqueando, sync falhando
Solução:
GAS agora responde a `OPTIONS` (preflight CORS)
Headers `Access-Control-Allow-Origin: *` em todas as respostas
App tenta salvar no Sheets PRIMEIRO, fallback IndexedDB se offline
Botão sync envia pendentes e baixa dados atualizados
✅ IDs do usuário embutidos
Spreadsheet: `1oNIv7kL7J0oXky41vUz1_nkf56IBFPpEu9TIYyJIVaA`
Drive Folder: `1O-UMdVh3Ye2zXcwmOOiblQtcInwd`
Apps Script: `AKfycby8YT2SXPf20J5Jq-iJ5E9NhoJCgQGZURVh9A-yg3-tRuOyGk4EBGjZPojfwEJMuDfu`
🚀 Deploy do Backend (Google Apps Script)
Acesse sua planilha: `https://docs.google.com/spreadsheets/d/1oNIv7kL7J0oXky41vUz1_nkf56IBFPpEu9TIYyJIVaA/edit`
Vá em Extensões > Apps Script
Apague todo o código existente
Cole o conteúdo de `Code.gs`
Salve (Ctrl+S)
Clique em Deploy > Novo deploy
Tipo: Aplicativo da Web
Execute como: Eu
Acesso: Qualquer pessoa
Autorize as permissões (Drive + Sheets)
Copie a nova URL e atualize no app (Perfil > Configurações)
🚀 Deploy do Frontend
Suba os arquivos no GitHub Pages (ou qualquer host estático)
Acesse no celular
Adicione à tela inicial
📱 Teste imediato (Demo)
Login: `admin@empresa.com`
Senha: `admin123`
Funciona offline imediatamente. Sincronize quando quiser enviar para a planilha.
