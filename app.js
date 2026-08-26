// ============================================
// SISTEMA DE GESTAO DE ABASTECIMENTO - PWA
// Frontend: HTML5 + IndexedDB + Service Worker
// Backend: Google Apps Script
// ============================================

const CONFIG = {
  // SUBSTITUA PELO SEU URL DO GOOGLE APPS SCRIPT (DEPLOY COMO WEB APP)
  API_URL: 'https://script.google.com/macros/s/AKfycbzp-KBJgUypoW7z5_WeTl4ZloQSiPMmgeEtgofLrOb0GCALSqE_xnNsqbrQ4271YlY/exec',

  // ID da pasta do Google Drive para fotos (opcional, pode ser gerenciado pelo GAS)
  DRIVE_FOLDER_ID: '',

  // Versao do app
  VERSION: '1.0.0',

  // Tempo de cache offline (dias)
  CACHE_DIAS: 30,

  // Limite de consumo para alerta (percentual acima do esperado)
  ALERTA_CONSUMO_PERCENTUAL: 20
};

// ============================================
// INDEXEDDB - BANCO DE DADOS LOCAL
// ============================================
class OfflineDB {
  constructor() {
    this.dbName = 'AbastecimentoDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('abastecimentos')) {
          db.createObjectStore('abastecimentos', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('veiculos')) {
          db.createObjectStore('veiculos', { keyPath: 'placa' });
        }
        if (!db.objectStoreNames.contains('usuarios')) {
          db.createObjectStore('usuarios', { keyPath: 'email' });
        }
        if (!db.objectStoreNames.contains('pendentes')) {
          db.createObjectStore('pendentes', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'chave' });
        }
      };
    });
  }

  async salvar(storeName, dados) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(dados);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listar(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async buscar(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletar(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async limpar(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ============================================
// CLASSE PRINCIPAL DO APP
// ============================================
class AppAbastecimento {
  constructor() {
    this.db = new OfflineDB();
    this.usuario = null;
    this.dados = {
      veiculos: [],
      abastecimentos: [],
      usuarios: [],
      pendentes: []
    };
    this.lancamentoEmAndamento = false;
    this.fotos = { odometro: null, nota: null };
    this.charts = {};
    this.abasGestao = 'veiculos';
  }

  // ============================================
  // INICIALIZACAO
  // ============================================
  async init() {
    try {
      await this.db.init();

      // Verificar sessao salva
      const sessao = await this.db.buscar('config', 'sessao');
      if (sessao && sessao.dados) {
        this.usuario = sessao.dados;
        await this.carregarDadosLocais();
        this.mostrarApp();
      }

      // Monitorar conexao
      this.monitorarConexao();

      // Bloquear swipe-to-refresh
      this.bloquearSwipeRefresh();

      // Bloquear botao voltar
      this.bloquearBotaoVoltar();

      // Registrar Service Worker
      this.registrarSW();

    } catch (err) {
      console.error('Erro ao inicializar:', err);
      this.toast('Erro ao inicializar app', 'error');
    }
  }

  // ============================================
  // SERVICE WORKER
  // ============================================
  async registrarSW() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        console.log('SW registrado:', reg.scope);
      } catch (err) {
        console.error('Erro SW:', err);
      }
    }
  }

  // ============================================
  // CONEXAO / OFFLINE
  // ============================================
  monitorarConexao() {
    const updateStatus = () => {
      const offline = !navigator.onLine;
      document.getElementById('offlineBadge').classList.toggle('active', offline);
      document.getElementById('modoOperacao').textContent = offline ? 'Offline' : 'Online';
      if (offline) {
        this.toast('Modo offline ativado. Dados serao sincronizados quando houver internet.', 'warning');
      }
    };
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  estaOnline() {
    return navigator.onLine;
  }

  // ============================================
  // BLOQUEIO DE SWIPE E BOTAO VOLTAR
  // ============================================
  bloquearSwipeRefresh() {
    document.body.addEventListener('touchmove', (e) => {
      if (e.touches[0].clientY > 0 && document.scrollingElement.scrollTop <= 0) {
        e.preventDefault();
      }
    }, { passive: false });

    // Bloquear pull-to-refresh especificamente
    let startY = 0;
    document.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      const scrollTop = document.scrollingElement.scrollTop;
      const currentY = e.touches[0].clientY;
      if (scrollTop <= 0 && currentY > startY) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  bloquearBotaoVoltar() {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', (e) => {
      if (this.lancamentoEmAndamento) {
        history.pushState(null, '', location.href);
        this.abrirModal('modalBloqueio');
      }
    });
  }

  continuarLancamento() {
    this.fecharModal('modalBloqueio');
  }

  descartarLancamento() {
    this.lancamentoEmAndamento = false;
    this.fecharModal('modalBloqueio');
    this.navegar('dashboard');
    this.limparFormLancamento();
  }

  // ============================================
  // NAVEGACAO
  // ============================================
  navegar(aba) {
    if (this.lancamentoEmAndamento && aba !== 'lancamento') {
      this.abrirModal('modalBloqueio');
      return;
    }

    // Atualizar nav
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    const navMap = { dashboard: 0, lancamento: 1, historico: 2, gestao: 3, perfil: 4 };
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    if (navItems[navMap[aba]]) navItems[navMap[aba]].classList.add('active');

    // Atualizar screens
    document.querySelectorAll('#scrollContainer > .screen').forEach(el => el.classList.remove('active'));
    document.getElementById('tab' + aba.charAt(0).toUpperCase() + aba.slice(1)).classList.add('active');

    // Atualizar titulo
    const titulos = {
      dashboard: 'Dashboard',
      lancamento: 'Novo Abastecimento',
      historico: 'Historico',
      gestao: 'Gestao',
      perfil: 'Perfil'
    };
    document.getElementById('headerTitle').textContent = titulos[aba];

    // Carregar dados especificos
    if (aba === 'dashboard') this.carregarDashboard();
    if (aba === 'lancamento') this.carregarLancamento();
    if (aba === 'historico') this.carregarHistorico();
    if (aba === 'gestao') this.carregarGestao();
    if (aba === 'perfil') this.carregarPerfil();
  }

  // ============================================
  // AUTENTICACAO
  // ============================================
  async fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;

    if (!email || !senha) {
      this.toast('Preencha e-mail e senha', 'warning');
      return;
    }

    this.showLoading('Autenticando...');

    try {
      if (this.estaOnline()) {
        const resp = await this.chamarAPI('login', { email, senha });
        if (resp.sucesso) {
          this.usuario = resp.usuario;
          await this.db.salvar('config', { chave: 'sessao', dados: this.usuario });
          await this.sincronizarDadosCompletos();
        } else {
          throw new Error(resp.erro || 'Credenciais invalidas');
        }
      } else {
        // Modo offline - verificar cache
        const user = await this.db.buscar('usuarios', email);
        if (user && user.senha === this.hashSenha(senha)) {
          this.usuario = user;
          await this.db.salvar('config', { chave: 'sessao', dados: user });
        } else {
          throw new Error('Sem conexao. Use credenciais ja sincronizadas.');
        }
      }

      this.hideLoading();
      this.mostrarApp();
      this.toast('Bem-vindo, ' + this.usuario.nome + '!', 'success');
    } catch (err) {
      this.hideLoading();
      this.toast(err.message, 'error');
    }
  }

  async fazerLogout() {
    this.usuario = null;
    await this.db.deletar('config', 'sessao');
    document.getElementById('screenLogin').classList.add('active');
    document.getElementById('screenApp').classList.remove('active');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginSenha').value = '';
    this.toast('Sessao encerrada', 'info');
  }

  hashSenha(senha) {
    // Hash simples para comparacao offline (nao e seguro, mas funciona para cache)
    let hash = 0;
    for (let i = 0; i < senha.length; i++) {
      const char = senha.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  mostrarApp() {
    document.getElementById('screenLogin').classList.remove('active');
    document.getElementById('screenApp').classList.add('active');
    document.getElementById('screenApp').style.display = 'flex';

    // Mostrar/ocultar aba gestao
    document.getElementById('navGestao').classList.toggle('hidden', this.usuario.nivel !== 'adm');

    this.navegar('dashboard');
  }

  // ============================================
  // API - CHAMADAS AO GOOGLE APPS SCRIPT
  // ============================================
  async chamarAPI(acao, dados = {}) {
    const url = CONFIG.API_URL + '?acao=' + encodeURIComponent(acao);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
      redirect: 'follow'
    });

    if (!resp.ok) throw new Error('Erro na comunicacao com servidor');
    return await resp.json();
  }

  // ============================================
  // SINCRONIZACAO
  // ============================================
  async syncDados() {
    if (!this.estaOnline()) {
      this.toast('Sem conexao com internet', 'warning');
      return;
    }

    this.showLoading('Sincronizando...');
    try {
      await this.sincronizarPendentes();
      await this.sincronizarDadosCompletos();
      this.hideLoading();
      this.toast('Sincronizacao concluida!', 'success');
      this.carregarDashboard();
    } catch (err) {
      this.hideLoading();
      this.toast('Erro na sincronizacao: ' + err.message, 'error');
    }
  }

  async sincronizarDadosCompletos() {
    if (!this.estaOnline()) return;

    const resp = await this.chamarAPI('sync', { usuario: this.usuario.email });
    if (resp.sucesso) {
      // Salvar no IndexedDB
      for (const v of resp.veiculos || []) await this.db.salvar('veiculos', v);
      for (const a of resp.abastecimentos || []) await this.db.salvar('abastecimentos', a);
      for (const u of resp.usuarios || []) await this.db.salvar('usuarios', u);

      await this.carregarDadosLocais();
    }
  }

  async sincronizarPendentes() {
    const pendentes = await this.db.listar('pendentes');
    for (const p of pendentes) {
      try {
        const resp = await this.chamarAPI('salvarAbastecimento', p.dados);
        if (resp.sucesso) {
          await this.db.deletar('pendentes', p.id);
        }
      } catch (err) {
        console.error('Erro ao sincronizar pendente:', err);
      }
    }
  }

  async carregarDadosLocais() {
    this.dados.veiculos = await this.db.listar('veiculos');
    this.dados.abastecimentos = await this.db.listar('abastecimentos');
    this.dados.usuarios = await this.db.listar('usuarios');
    this.dados.pendentes = await this.db.listar('pendentes');

    document.getElementById('registrosPendentes').textContent = this.dados.pendentes.length;
  }

  // ============================================
  // DASHBOARD
  // ============================================
  async carregarDashboard() {
    await this.carregarDadosLocais();

    const abastecimentos = this.dados.abastecimentos;
    const veiculos = this.dados.veiculos;

    // KPIs
    document.getElementById('kpiTotalAbastecimentos').textContent = abastecimentos.length;

    // Consumo medio
    let totalKm = 0, totalLitros = 0;
    abastecimentos.forEach(a => {
      if (a.autonomia && a.litros) {
        totalKm += parseFloat(a.autonomia);
        totalLitros += parseFloat(a.litros);
      }
    });
    const consumoMedio = totalLitros > 0 ? (totalKm / totalLitros).toFixed(1) : '0';
    document.getElementById('kpiConsumoMedio').textContent = consumoMedio;

    // Custo por km
    let custoTotal = 0;
    abastecimentos.forEach(a => { if (a.valor) custoTotal += parseFloat(a.valor); });
    const custoKm = totalKm > 0 ? 'R$' + (custoTotal / totalKm).toFixed(2) : 'R$0';
    document.getElementById('kpiCustoKm').textContent = custoKm;

    // Alertas
    const alertas = this.calcularAlertas();
    document.getElementById('kpiAlertas').textContent = alertas.length;

    // Renderizar alertas
    const containerAlertas = document.getElementById('listaAlertas');
    if (alertas.length === 0) {
      containerAlertas.innerHTML = `
        <div class="empty-state">
          <div class="icon">✅</div>
          <h3>Nenhum alerta</h3>
          <p>Todos os veiculos estao dentro do consumo esperado</p>
        </div>`;
    } else {
      containerAlertas.innerHTML = alertas.map(a => `
        <div class="list-item" onclick="app.verDetalhesVeiculo('${a.placa}')">
          <div class="list-icon">⚠️</div>
          <div class="list-content">
            <div class="list-title">${a.placa} - ${a.veiculo || 'Veiculo'}</div>
            <div class="list-subtitle">Consumo: ${a.consumoReal} km/l (esperado: ${a.consumoEsperado} km/l)</div>
          </div>
          <span class="list-badge badge-danger">+${a.diferencaPercentual}%</span>
        </div>
      `).join('');
    }

    // Graficos
    this.renderizarGraficos();
  }

  calcularAlertas() {
    const alertas = [];
    const abastecimentos = this.dados.abastecimentos;

    // Agrupar por veiculo
    const porVeiculo = {};
    abastecimentos.forEach(a => {
      if (!porVeiculo[a.placa]) porVeiculo[a.placa] = [];
      porVeiculo[a.placa].push(a);
    });

    for (const placa in porVeiculo) {
      const lista = porVeiculo[placa].sort((a, b) => new Date(b.data) - new Date(a.data));
      if (lista.length < 2) continue;

      const veiculo = this.dados.veiculos.find(v => v.placa === placa);
      if (!veiculo || !veiculo.consumoEsperado) continue;

      // Calcular consumo dos ultimos 3 abastecimentos
      const recentes = lista.slice(0, 3);
      let kmTotal = 0, litrosTotal = 0;
      recentes.forEach(a => {
        if (a.autonomia) kmTotal += parseFloat(a.autonomia);
        if (a.litros) litrosTotal += parseFloat(a.litros);
      });

      if (litrosTotal > 0) {
        const consumoReal = kmTotal / litrosTotal;
        const esperado = parseFloat(veiculo.consumoEsperado);
        const difPercentual = ((consumoReal - esperado) / esperado * 100).toFixed(0);

        if (parseFloat(difPercentual) > CONFIG.ALERTA_CONSUMO_PERCENTUAL) {
          alertas.push({
            placa,
            veiculo: veiculo.marca + ' ' + veiculo.modelo,
            consumoReal: consumoReal.toFixed(1),
            consumoEsperado: esperado,
            diferencaPercentual: difPercentual
          });
        }
      }
    }

    return alertas;
  }

  // ============================================
  // LANCAMENTO
  // ============================================
  async carregarLancamento() {
    await this.carregarDadosLocais();

    const select = document.getElementById('lancPlaca');
    select.innerHTML = '<option value="">Selecione o veiculo</option>';
    this.dados.veiculos.forEach(v => {
      const option = document.createElement('option');
      option.value = v.placa;
      option.textContent = v.placa + ' - ' + (v.marca || '') + ' ' + (v.modelo || '');
      select.appendChild(option);
    });

    this.lancamentoEmAndamento = true;
  }

  async onVeiculoChange() {
    const placa = document.getElementById('lancPlaca').value;
    if (!placa) {
      document.getElementById('lancKmAnterior').textContent = 'KM anterior: --';
      return;
    }

    const veiculo = this.dados.veiculos.find(v => v.placa === placa);
    if (veiculo) {
      document.getElementById('lancKmAnterior').textContent = 'KM anterior: ' + (veiculo.kmAtual || 0).toLocaleString();
      document.getElementById('lancCombustivel').value = veiculo.combustivel || '';
    }
  }

  abrirCamera(tipo) {
    document.getElementById('file' + tipo.charAt(0).toUpperCase() + tipo.slice(1)).click();
  }

  onFotoSelecionada(input, tipo) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.fotos[tipo] = e.target.result;
      const container = document.getElementById('photo' + tipo.charAt(0).toUpperCase() + tipo.slice(1));
      container.innerHTML = `
        <img src="${e.target.result}" alt="Foto ${tipo}">
        <div class="photo-preview-overlay">
          <span>✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} capturada</span>
          <button class="btn-icon" style="width:32px;height:32px" onclick="event.stopPropagation();app.removerFoto('${tipo}')">🗑️</button>
        </div>
      `;
      container.classList.add('has-image');
    };
    reader.readAsDataURL(file);
  }

  removerFoto(tipo) {
    this.fotos[tipo] = null;
    const container = document.getElementById('photo' + tipo.charAt(0).toUpperCase() + tipo.slice(1));
    container.innerHTML = `
      <div class="placeholder">
        <div class="icon">📷</div>
        <span>Toque para tirar foto do ${tipo}</span>
      </div>
    `;
    container.classList.remove('has-image');
    document.getElementById('file' + tipo.charAt(0).toUpperCase() + tipo.slice(1)).value = '';
  }

  async salvarAbastecimento() {
    const placa = document.getElementById('lancPlaca').value;
    const km = parseFloat(document.getElementById('lancKm').value);
    const litros = parseFloat(document.getElementById('lancLitros').value);
    const combustivel = document.getElementById('lancCombustivel').value;
    const valor = parseFloat(document.getElementById('lancValor').value);
    const posto = document.getElementById('lancPosto').value;
    const obs = document.getElementById('lancObs').value;

    if (!placa || !km || !litros || !combustivel || !valor) {
      this.toast('Preencha todos os campos obrigatorios', 'warning');
      return;
    }
    if (!this.fotos.odometro || !this.fotos.nota) {
      this.toast('Tire as duas fotos obrigatorias', 'warning');
      return;
    }

    // Calcular autonomia
    const veiculo = this.dados.veiculos.find(v => v.placa === placa);
    const kmAnterior = veiculo ? parseFloat(veiculo.kmAtual || 0) : 0;
    const autonomia = km - kmAnterior;
    const consumo = autonomia > 0 && litros > 0 ? (autonomia / litros).toFixed(2) : 0;

    const dados = {
      placa,
      km,
      kmAnterior,
      autonomia,
      litros,
      combustivel,
      valor,
      posto,
      obs,
      consumo,
      usuario: this.usuario.email,
      data: new Date().toISOString(),
      fotoOdometro: this.fotos.odometro,
      fotoNota: this.fotos.nota
    };

    this.showLoading('Salvando...');

    try {
      if (this.estaOnline()) {
        const resp = await this.chamarAPI('salvarAbastecimento', dados);
        if (!resp.sucesso) throw new Error(resp.erro);

        // Atualizar KM do veiculo
        if (veiculo) {
          veiculo.kmAtual = km;
          await this.db.salvar('veiculos', veiculo);
        }
      } else {
        // Salvar como pendente
        await this.db.salvar('pendentes', { dados, dataCriacao: new Date().toISOString() });
        this.toast('Salvo localmente. Sincronizara quando houver internet.', 'warning');
      }

      // Salvar localmente tambem
      await this.db.salvar('abastecimentos', { ...dados, id: Date.now() });

      this.hideLoading();
      this.toast('Abastecimento registrado!', 'success');
      this.lancamentoEmAndamento = false;
      this.limparFormLancamento();
      this.navegar('dashboard');

    } catch (err) {
      this.hideLoading();
      this.toast('Erro: ' + err.message, 'error');
    }
  }

  limparFormLancamento() {
    document.getElementById('lancPlaca').value = '';
    document.getElementById('lancKm').value = '';
    document.getElementById('lancLitros').value = '';
    document.getElementById('lancCombustivel').value = '';
    document.getElementById('lancValor').value = '';
    document.getElementById('lancPosto').value = '';
    document.getElementById('lancObs').value = '';
    document.getElementById('lancKmAnterior').textContent = 'KM anterior: --';
    this.removerFoto('odometro');
    this.removerFoto('nota');
  }

  // ============================================
  // HISTORICO
  // ============================================
  async carregarHistorico() {
    await this.carregarDadosLocais();
    this.renderizarHistorico(this.dados.abastecimentos);
  }

  renderizarHistorico(lista) {
    const container = document.getElementById('listaHistorico');
    if (lista.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <h3>Nenhum registro</h3>
          <p>Os abastecimentos aparecerao aqui</p>
        </div>`;
      return;
    }

    const ordenado = lista.sort((a, b) => new Date(b.data) - new Date(a.data));
    container.innerHTML = ordenado.slice(0, 50).map(a => {
      const data = new Date(a.data).toLocaleDateString('pt-BR');
      return `
        <div class="list-item" onclick="app.verDetalhesAbastecimento(${a.id})">
          <div class="list-icon">⛽</div>
          <div class="list-content">
            <div class="list-title">${a.placa} - ${data}</div>
            <div class="list-subtitle">${a.litros}L • ${a.combustivel} • R$${parseFloat(a.valor).toFixed(2)}</div>
          </div>
          <span class="list-badge badge-info">${a.consumo || '--'} km/l</span>
        </div>
      `;
    }).join('');
  }

  filtrarHistorico() {
    const filtro = document.getElementById('filtroHistorico').value.toLowerCase();
    const filtrados = this.dados.abastecimentos.filter(a => 
      (a.placa && a.placa.toLowerCase().includes(filtro)) ||
      (a.combustivel && a.combustivel.toLowerCase().includes(filtro)) ||
      (a.data && new Date(a.data).toLocaleDateString('pt-BR').includes(filtro))
    );
    this.renderizarHistorico(filtrados);
  }

  async verDetalhesAbastecimento(id) {
    const a = this.dados.abastecimentos.find(x => x.id === id);
    if (!a) return;

    const data = new Date(a.data).toLocaleString('pt-BR');
    const conteudo = `
      <div style="margin-bottom:16px">
        <strong>Placa:</strong> ${a.placa}<br>
        <strong>Data:</strong> ${data}<br>
        <strong>KM:</strong> ${a.km} (anterior: ${a.kmAnterior})<br>
        <strong>Autonomia:</strong> ${a.autonomia} km<br>
        <strong>Litros:</strong> ${a.litros} L<br>
        <strong>Consumo:</strong> ${a.consumo} km/l<br>
        <strong>Combustivel:</strong> ${a.combustivel}<br>
        <strong>Valor:</strong> R$ ${parseFloat(a.valor).toFixed(2)}<br>
        <strong>Posto:</strong> ${a.posto || '-'}<br>
        <strong>Usuario:</strong> ${a.usuario}<br>
        <strong>Obs:</strong> ${a.obs || '-'}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${a.fotoOdometro ? `<img src="${a.fotoOdometro}" style="width:100%;border-radius:8px" alt="Odometro">` : ''}
        ${a.fotoNota ? `<img src="${a.fotoNota}" style="width:100%;border-radius:8px" alt="Nota">` : ''}
      </div>
    `;
    document.getElementById('detalhesConteudo').innerHTML = conteudo;
    this.abrirModal('modalDetalhes');
  }

  // ============================================
  // GESTAO (ADM)
  // ============================================
  async carregarGestao() {
    if (this.usuario.nivel !== 'adm') {
      this.toast('Acesso restrito a administradores', 'warning');
      this.navegar('dashboard');
      return;
    }
    await this.carregarDadosLocais();
    this.switchGestaoTab(this.abasGestao);
  }

  switchGestaoTab(aba) {
    this.abasGestao = aba;
    document.querySelectorAll('#tabGestao .tabs .tab-btn').forEach((el, i) => {
      el.classList.toggle('active', 
        (aba === 'veiculos' && i === 0) ||
        (aba === 'usuarios' && i === 1) ||
        (aba === 'relatorios' && i === 2)
      );
    });
    document.querySelectorAll('#gestaoVeiculos, #gestaoUsuarios, #gestaoRelatorios').forEach(el => el.classList.remove('active'));
    document.getElementById('gestao' + aba.charAt(0).toUpperCase() + aba.slice(1)).classList.add('active');

    if (aba === 'veiculos') this.renderizarVeiculos();
    if (aba === 'usuarios') this.renderizarUsuarios();
    if (aba === 'relatorios') this.carregarRelatorios();
  }

  renderizarVeiculos() {
    const container = document.getElementById('listaVeiculos');
    if (this.dados.veiculos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🚗</div>
          <h3>Nenhum veiculo</h3>
          <p>Cadastre os veiculos da frota</p>
        </div>`;
      return;
    }

    container.innerHTML = this.dados.veiculos.map(v => {
      const abastecimentos = this.dados.abastecimentos.filter(a => a.placa === v.placa).length;
      return `
        <div class="list-item">
          <div class="list-icon">🚗</div>
          <div class="list-content">
            <div class="list-title">${v.placa}</div>
            <div class="list-subtitle">${v.marca || ''} ${v.modelo || ''} • ${abastecimentos} abastecimentos</div>
          </div>
          <span class="list-badge badge-info">${v.kmAtual || 0} km</span>
        </div>
      `;
    }).join('');
  }

  renderizarUsuarios() {
    const container = document.getElementById('listaUsuarios');
    if (this.dados.usuarios.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">👥</div>
          <h3>Nenhum usuario</h3>
          <p>Cadastre os usuarios do sistema</p>
        </div>`;
      return;
    }

    container.innerHTML = this.dados.usuarios.map(u => `
      <div class="list-item">
        <div class="list-icon">👤</div>
        <div class="list-content">
          <div class="list-title">${u.nome}</div>
          <div class="list-subtitle">${u.email}</div>
        </div>
        <span class="list-badge ${u.nivel === 'adm' ? 'badge-warning' : 'badge-info'}">${u.nivel === 'adm' ? 'ADM' : 'OP'}</span>
      </div>
    `).join('');
  }

  async carregarRelatorios() {
    // Preencher select de veiculos
    const select = document.getElementById('relVeiculo');
    select.innerHTML = '<option value="">Todos os veiculos</option>';
    this.dados.veiculos.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.placa;
      opt.textContent = v.placa;
      select.appendChild(opt);
    });

    this.gerarRelatorio();
  }

  gerarRelatorio() {
    const dias = parseInt(document.getElementById('relPeriodo').value);
    const placaFiltro = document.getElementById('relVeiculo').value;
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - dias);

    let filtrados = this.dados.abastecimentos.filter(a => new Date(a.data) >= dataCorte);
    if (placaFiltro) filtrados = filtrados.filter(a => a.placa === placaFiltro);

    // Estatisticas
    let totalLitros = 0, totalValor = 0, totalKm = 0;
    filtrados.forEach(a => {
      if (a.litros) totalLitros += parseFloat(a.litros);
      if (a.valor) totalValor += parseFloat(a.valor);
      if (a.autonomia) totalKm += parseFloat(a.autonomia);
    });

    const consumoMedio = totalLitros > 0 ? (totalKm / totalLitros).toFixed(1) : 0;
    const custoKm = totalKm > 0 ? (totalValor / totalKm).toFixed(2) : 0;
    const precoMedio = totalLitros > 0 ? (totalValor / totalLitros).toFixed(2) : 0;

    document.getElementById('relatorioResultado').innerHTML = `
      <div class="kpi-grid" style="margin-top:12px">
        <div class="kpi-card">
          <div class="kpi-value">${filtrados.length}</div>
          <div class="kpi-label">Abastecimentos</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${totalLitros.toFixed(1)}L</div>
          <div class="kpi-label">Total Litros</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">R$${totalValor.toFixed(2)}</div>
          <div class="kpi-label">Total Gasto</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${consumoMedio}</div>
          <div class="kpi-label">km/l Medio</div>
        </div>
      </div>
      <div style="margin-top:12px;font-size:0.85rem;color:var(--text-secondary)">
        <p><strong>Custo por km:</strong> R$ ${custoKm}</p>
        <p><strong>Preço medio do combustivel:</strong> R$ ${precoMedio}/L</p>
        <p><strong>Quilometragem total:</strong> ${totalKm.toFixed(0)} km</p>
      </div>
    `;

    // Ranking de eficiencia
    this.gerarRanking();

    // Grafico de evolucao
    this.renderizarGraficoCusto(filtrados);
  }

  gerarRanking() {
    const ranking = [];
    this.dados.veiculos.forEach(v => {
      const abs = this.dados.abastecimentos.filter(a => a.placa === v.placa);
      if (abs.length >= 2) {
        let kmTotal = 0, litrosTotal = 0;
        abs.forEach(a => {
          if (a.autonomia) kmTotal += parseFloat(a.autonomia);
          if (a.litros) litrosTotal += parseFloat(a.litros);
        });
        if (litrosTotal > 0) {
          ranking.push({
            placa: v.placa,
            veiculo: (v.marca || '') + ' ' + (v.modelo || ''),
            consumo: (kmTotal / litrosTotal).toFixed(1),
            abastecimentos: abs.length
          });
        }
      }
    });

    ranking.sort((a, b) => parseFloat(b.consumo) - parseFloat(a.consumo));

    const container = document.getElementById('rankingEficiencia');
    if (ranking.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">Dados insuficientes</p>';
      return;
    }

    const maxConsumo = Math.max(...ranking.map(r => parseFloat(r.consumo)));
    container.innerHTML = ranking.map((r, i) => `
      <div class="chart-bar">
        <div class="bar-label">${i + 1}º ${r.placa}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(parseFloat(r.consumo) / maxConsumo * 100).toFixed(0)}%;background:${i === 0 ? 'var(--accent-success)' : 'var(--accent-primary)'}">
            ${r.consumo} km/l
          </div>
        </div>
      </div>
    `).join('');
  }

  // ============================================
  // CADASTROS
  // ============================================
  abrirModalVeiculo() {
    document.getElementById('veicPlaca').value = '';
    document.getElementById('veicMarca').value = '';
    document.getElementById('veicModelo').value = '';
    document.getElementById('veicAno').value = '';
    document.getElementById('veicTanque').value = '';
    document.getElementById('veicCombustivel').value = 'Gasolina';
    document.getElementById('veicConsumoEsperado').value = '';
    document.getElementById('veicKmAtual').value = '';
    this.abrirModal('modalVeiculo');
  }

  async salvarVeiculo() {
    const dados = {
      placa: document.getElementById('veicPlaca').value.trim().toUpperCase(),
      marca: document.getElementById('veicMarca').value.trim(),
      modelo: document.getElementById('veicModelo').value.trim(),
      ano: document.getElementById('veicAno').value,
      tanque: document.getElementById('veicTanque').value,
      combustivel: document.getElementById('veicCombustivel').value,
      consumoEsperado: document.getElementById('veicConsumoEsperado').value,
      kmAtual: document.getElementById('veicKmAtual').value || 0,
      ativo: true
    };

    if (!dados.placa) {
      this.toast('Informe a placa', 'warning');
      return;
    }

    this.showLoading('Salvando...');
    try {
      if (this.estaOnline()) {
        const resp = await this.chamarAPI('salvarVeiculo', dados);
        if (!resp.sucesso) throw new Error(resp.erro);
      }

      await this.db.salvar('veiculos', dados);
      await this.carregarDadosLocais();
      this.renderizarVeiculos();
      this.fecharModal('modalVeiculo');
      this.hideLoading();
      this.toast('Veiculo cadastrado!', 'success');
    } catch (err) {
      this.hideLoading();
      this.toast('Erro: ' + err.message, 'error');
    }
  }

  abrirModalUsuario() {
    document.getElementById('userNome').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('userSenha').value = '';
    document.getElementById('userNivel').value = 'operacao';
    this.abrirModal('modalUsuario');
  }

  async salvarUsuario() {
    const dados = {
      nome: document.getElementById('userNome').value.trim(),
      email: document.getElementById('userEmail').value.trim().toLowerCase(),
      senha: document.getElementById('userSenha').value,
      nivel: document.getElementById('userNivel').value,
      ativo: true
    };

    if (!dados.nome || !dados.email || !dados.senha) {
      this.toast('Preencha todos os campos', 'warning');
      return;
    }
    if (dados.senha.length < 6) {
      this.toast('Senha deve ter no minimo 6 caracteres', 'warning');
      return;
    }

    this.showLoading('Salvando...');
    try {
      if (this.estaOnline()) {
        const resp = await this.chamarAPI('salvarUsuario', dados);
        if (!resp.sucesso) throw new Error(resp.erro);
      }

      await this.db.salvar('usuarios', { ...dados, senha: this.hashSenha(dados.senha) });
      await this.carregarDadosLocais();
      this.renderizarUsuarios();
      this.fecharModal('modalUsuario');
      this.hideLoading();
      this.toast('Usuario cadastrado!', 'success');
    } catch (err) {
      this.hideLoading();
      this.toast('Erro: ' + err.message, 'error');
    }
  }

  // ============================================
  // PERFIL
  // ============================================
  carregarPerfil() {
    document.getElementById('perfilNome').textContent = this.usuario.nome;
    document.getElementById('perfilEmail').textContent = this.usuario.email;
    document.getElementById('perfilNivel').textContent = this.usuario.nivel === 'adm' ? 'ADMIN' : 'OPERACAO';
  }

  async limparCache() {
    if (!confirm('Tem certeza que deseja limpar todos os dados locais?')) return;
    await this.db.limpar('abastecimentos');
    await this.db.limpar('veiculos');
    await this.db.limpar('usuarios');
    await this.db.limpar('pendentes');
    this.toast('Cache limpo! Sincronize para baixar os dados novamente.', 'info');
  }

  exportarDados() {
    const csv = this.gerarCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'abastecimentos_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    this.toast('CSV baixado!', 'success');
  }

  gerarCSV() {
    const abs = this.dados.abastecimentos;
    let csv = 'Data,Placa,KM Anterior,KM Atual,Autonomia,Litros,Consumo,Combustivel,Valor,Posto,Usuario,Obs\\n';
    abs.forEach(a => {
      csv += `${a.data},${a.placa},${a.kmAnterior},${a.km},${a.autonomia},${a.litros},${a.consumo},${a.combustivel},${a.valor},${a.posto || ''},${a.usuario},${a.obs || ''}\\n`;
    });
    return csv;
  }

  // ============================================
  // GRAFICOS
  // ============================================
  renderizarGraficos() {
    this.renderizarGraficoConsumo();
    this.renderizarGraficoGasto();
  }

  renderizarGraficoConsumo() {
    const ctx = document.getElementById('chartConsumo');
    if (!ctx) return;

    if (this.charts.consumo) this.charts.consumo.destroy();

    // Agrupar consumo por veiculo (ultimos 30 dias)
    const porVeiculo = {};
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - 30);

    this.dados.abastecimentos.filter(a => new Date(a.data) >= dataCorte).forEach(a => {
      if (!porVeiculo[a.placa]) porVeiculo[a.placa] = { km: 0, litros: 0 };
      if (a.autonomia) porVeiculo[a.placa].km += parseFloat(a.autonomia);
      if (a.litros) porVeiculo[a.placa].litros += parseFloat(a.litros);
    });

    const labels = Object.keys(porVeiculo);
    const data = labels.map(p => {
      const v = porVeiculo[p];
      return v.litros > 0 ? (v.km / v.litros).toFixed(1) : 0;
    });

    this.charts.consumo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'km/l',
          data,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  renderizarGraficoGasto() {
    const ctx = document.getElementById('chartGasto');
    if (!ctx) return;

    if (this.charts.gasto) this.charts.gasto.destroy();

    // Agrupar gasto por mes
    const porMes = {};
    this.dados.abastecimentos.forEach(a => {
      const mes = new Date(a.data).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!porMes[mes]) porMes[mes] = 0;
      if (a.valor) porMes[mes] += parseFloat(a.valor);
    });

    const labels = Object.keys(porMes).slice(-6);
    const data = labels.map(m => porMes[m].toFixed(2));

    this.charts.gasto = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Gasto (R$)',
          data,
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(34, 197, 94, 1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  renderizarGraficoCusto(abastecimentos) {
    const ctx = document.getElementById('chartCustoEvolucao');
    if (!ctx) return;

    if (this.charts.custo) this.charts.custo.destroy();

    const ordenado = abastecimentos.sort((a, b) => new Date(a.data) - new Date(b.data));
    const labels = ordenado.map(a => new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const dataCusto = ordenado.map(a => a.consumo || 0);
    const dataPreco = ordenado.map(a => a.litros > 0 ? (a.valor / a.litros).toFixed(2) : 0);

    this.charts.custo = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Consumo (km/l)',
            data: dataCusto,
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y',
            tension: 0.3
          },
          {
            label: 'Preco/L (R$)',
            data: dataPreco,
            borderColor: 'rgba(245, 158, 11, 1)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            yAxisID: 'y1',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { type: 'linear', display: true, position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  // ============================================
  // UTILITARIOS
  // ============================================
  abrirModal(id) {
    document.getElementById(id).classList.add('active');
  }

  fecharModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  showLoading(texto = 'Processando...') {
    document.getElementById('loadingText').textContent = texto;
    document.getElementById('loadingOverlay').classList.add('active');
  }

  hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
  }

  toast(mensagem, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast ' + tipo;

    const icones = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span>${icones[tipo] || 'ℹ️'}</span><span>${mensagem}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// ============================================
// INICIALIZACAO
// ============================================
const app = new AppAbastecimento();
document.addEventListener('DOMContentLoaded', () => app.init());
