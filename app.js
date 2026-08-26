// ============================================
// SISTEMA DE ABASTECIMENTO v2.0
// 100% Offline | Mobile First | Zero Dependencies
// ============================================

const CONFIG = {
  API_URL: localStorage.getItem('gas_url') || 'https://script.google.com/macros/s/AKfycby8YT2SXPf20J5Jq-iJ5E9NhoJCgQGZURVh9A-yg3-tRuOyGk4EBGjZPojfwEJMuDfu/exec',
  APP_VERSION: '2.0.0',
  DEMO_MODE: true
};

// ============================================
// INDEXEDDB
// ============================================
class DB {
  constructor() {
    this.name = 'AbastecimentoDB_v2';
    this.ver = 1;
    this.db = null;
  }
  async open() {
    return new Promise((res,rej)=>{
      const r = indexedDB.open(this.name,this.ver);
      r.onerror = ()=>rej(r.error);
      r.onsuccess = ()=>{ this.db=r.result; res(this.db); };
      r.onupgradeneeded = e=>{
        const d = e.target.result;
        ['abastecimentos','veiculos','usuarios','config'].forEach(s=>{
          if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:'id',autoIncrement:true});
        });
      };
    });
  }
  async put(store,obj){ return this._tx(store,'readwrite',s=>s.put(obj)); }
  async getAll(store){ return this._tx(store,'readonly',s=>s.getAll()); }
  async del(store,id){ return this._tx(store,'readwrite',s=>s.delete(id)); }
  async clear(store){ return this._tx(store,'readwrite',s=>s.clear()); }
  async get(store,id){ return this._tx(store,'readonly',s=>s.get(id)); }
  _tx(store,mode,fn){
    return new Promise((res,rej)=>{
      const tx = this.db.transaction([store],mode);
      const os = tx.objectStore(store);
      const r = fn(os);
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
  }
}

// ============================================
// UTILS
// ============================================
const $ = id => document.getElementById(id);
const fmtDate = d => new Date(d).toLocaleDateString('pt-BR');
const fmtDateTime = d => new Date(d).toLocaleString('pt-BR');
const fmtNum = n => parseFloat(n).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const fmtMoney = n => 'R$ ' + parseFloat(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

function toast(msg,type='info',dur=3500){
  const wrap = $('toastWrap');
  const t = document.createElement('div');
  const icons = {ok:'✅',err:'❌',warn:'⚠️',info:'ℹ️'};
  t.className = 'toast '+type;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(-20px)';setTimeout(()=>t.remove(),300);},dur);
}

function loading(show,text='Processando...'){
  $('loadOverlay').classList.toggle('active',show);
  $('loadText').textContent = text;
}

function isOnline(){ return navigator.onLine; }

// ============================================
// DEMO DATA
// ============================================
const DEMO_VEICULOS = [
  {id:'v1',placa:'ABC1D23',marca:'Toyota',modelo:'Hilux',ano:'2022',combustivel:'Diesel',consumoEsperado:10.5,kmAtual:45230,ativo:true},
  {id:'v2',placa:'DEF4G56',marca:'Volkswagen',modelo:'Saveiro',ano:'2021',combustivel:'Gasolina',consumoEsperado:12.0,kmAtual:32100,ativo:true},
  {id:'v3',placa:'GHI7J89',marca:'Fiat',modelo:'Strada',ano:'2023',combustivel:'Flex',consumoEsperado:13.5,kmAtual:18500,ativo:true},
  {id:'v4',placa:'JKL0M12',marca:'Ford',modelo:'Ranger',ano:'2020',combustivel:'Diesel',consumoEsperado:9.8,kmAtual:67800,ativo:true},
];

const DEMO_USERS = [
  {id:'u1',nome:'Administrador',email:'admin@empresa.com',senha:'admin123',nivel:'adm',ativo:true},
  {id:'u2',nome:'Operador',email:'op@empresa.com',senha:'op1234',nivel:'operacao',ativo:true},
];

const DEMO_ABASTECIMENTOS = [
  {id:'a1',placa:'ABC1D23',kmAnterior:44800,km:45010,autonomia:210,litros:20.5,consumo:10.24,combustivel:'Diesel',valor:120.50,posto:'Posto Shell',usuario:'admin@empresa.com',data:'2026-08-01T09:30:00',obs:''},
  {id:'a2',placa:'ABC1D23',kmAnterior:45010,km:45230,autonomia:220,litros:21.0,consumo:10.48,combustivel:'Diesel',valor:126.00,posto:'Posto Ipiranga',usuario:'op@empresa.com',data:'2026-08-10T14:15:00',obs:''},
  {id:'a3',placa:'DEF4G56',kmAnterior:31850,km:32100,autonomia:250,litros:21.5,consumo:11.63,combustivel:'Gasolina',valor:150.00,posto:'Posto BR',usuario:'admin@empresa.com',data:'2026-08-05T11:00:00',obs:''},
  {id:'a4',placa:'GHI7J89',kmAnterior:18300,km:18500,autonomia:200,litros:15.2,consumo:13.16,combustivel:'Etanol',valor:85.00,posto:'Posto Ale',usuario:'op@empresa.com',data:'2026-08-12T08:45:00',obs:''},
  {id:'a5',placa:'JKL0M12',kmAnterior:67500,km:67800,autonomia:300,litros:32.5,consumo:9.23,combustivel:'Diesel',valor:195.00,posto:'Posto Shell',usuario:'admin@empresa.com',data:'2026-08-15T16:20:00',obs:'Tanque cheio'},
  {id:'a6',placa:'ABC1D23',kmAnterior:45230,km:45480,autonomia:250,litros:28.0,consumo:8.93,combustivel:'Diesel',valor:168.00,posto:'Posto Ipiranga',usuario:'op@empresa.com',data:'2026-08-20T10:00:00',obs:''},
];

// ============================================
// APP PRINCIPAL
// ============================================
class App {
  constructor(){
    this.db = new DB();
    this.user = null;
    this.data = {abast:[],veic:[],users:[]};
    this.fotos = {odometro:null,nota:null};
    this.lancando = false;
    this.tabGestao = 'veiculos';
    this.chartInstances = {};
  }

  async init(){
    await this.db.open();

    // Carregar sessao
    const sess = await this.db.get('config','sessao');
    if(sess){
      this.user = sess;
      await this.loadData();
      this.showApp();
    } else {
      this.showLogin();
    }

    this.setupEvents();
    this.setupConnection();
    this.registerSW();
  }

  // ============================================
  // EVENTOS GLOBAIS
  // ============================================
  setupEvents(){
    // Bloquear swipe-to-refresh
    let startY=0;
    document.addEventListener('touchstart',e=>{startY=e.touches[0].clientY;},{passive:true});
    document.addEventListener('touchmove',e=>{
      const st=document.scrollingElement.scrollTop;
      const cy=e.touches[0].clientY;
      if(st<=0 && cy>startY) e.preventDefault();
    },{passive:false});

    // Bloquear botao voltar durante lancamento
    history.pushState(null,'',location.href);
    window.addEventListener('popstate',()=>{
      if(this.lancando){
        history.pushState(null,'',location.href);
        this.openModal('modalBloqueio');
      }
    });

    // Tecla Enter no login
    $('loginSenha').addEventListener('keypress',e=>{if(e.key==='Enter')this.doLogin();});
  }

  setupConnection(){
    const update=()=>{
      $('offlineBar').classList.toggle('active',!isOnline());
    };
    window.addEventListener('online',update);
    window.addEventListener('offline',update);
    update();
  }

  async registerSW(){
    if('serviceWorker' in navigator){
      try{ await navigator.serviceWorker.register('sw.js'); }
      catch(e){ console.log('SW skip'); }
    }
  }

  // ============================================
  // AUTH
  // ============================================
  async doLogin(){
    const email=$('loginEmail').value.trim().toLowerCase();
    const senha=$('loginSenha').value;
    if(!email||!senha){ toast('Preencha email e senha','warn'); return; }

    loading(true,'Autenticando...');
    await new Promise(r=>setTimeout(r,600)); // feedback visual

    // Buscar usuario local
    const users = await this.db.getAll('usuarios');
    let found = users.find(u=>u.email===email && u.senha===senha);

    // Se nao achou e tem demo, popular demo
    if(!found && CONFIG.DEMO_MODE){
      const demoUser = DEMO_USERS.find(u=>u.email===email && u.senha===senha);
      if(demoUser){
        await this.seedDemo();
        found = demoUser;
      }
    }

    loading(false);

    if(found){
      this.user = found;
      await this.db.put('config',{id:'sessao',...found});
      toast('Bem-vindo, '+found.nome+'!','ok');
      this.showApp();
    } else {
      toast('Email ou senha incorretos','err');
    }
  }

  async seedDemo(){
    // Popular dados demo se DB vazio
    const veic = await this.db.getAll('veiculos');
    if(veic.length===0){
      for(const v of DEMO_VEICULOS) await this.db.put('veiculos',v);
    }
    const users = await this.db.getAll('usuarios');
    if(users.length===0){
      for(const u of DEMO_USERS) await this.db.put('usuarios',u);
    }
    const abs = await this.db.getAll('abastecimentos');
    if(abs.length===0){
      for(const a of DEMO_ABASTECIMENTOS) await this.db.put('abastecimentos',a);
    }
  }

  async doLogout(){
    this.user=null;
    await this.db.del('config','sessao');
    this.showLogin();
    toast('Sessao encerrada','info');
  }

  showLogin(){
    $('loginWrap').classList.remove('hidden');
    $('appWrap').classList.remove('active');
    $('appWrap').style.display='none';
    $('loginEmail').value='';
    $('loginSenha').value='';
  }

  showApp(){
    $('loginWrap').classList.add('hidden');
    $('appWrap').style.display='flex';
    $('appWrap').classList.add('active');
    $('navGestao').classList.toggle('hidden',this.user.nivel!=='adm');
    this.nav('dashboard');
  }

  // ============================================
  // NAVEGACAO
  // ============================================
  nav(tab){
    if(this.lancando && tab!=='lancamento'){
      this.openModal('modalBloqueio');
      return;
    }

    // Nav items
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    const map={dashboard:0,lancamento:1,historico:2,gestao:3,perfil:4};
    const items=document.querySelectorAll('.nav-item');
    if(items[map[tab]]) items[map[tab]].classList.add('active');

    // Screens
    document.querySelectorAll('.scroll > .screen').forEach(el=>el.classList.remove('active'));
    $(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.add('active');

    // Titulo
    const titles={dashboard:'Inicio',lancamento:'Abastecer',historico:'Historico',gestao:'Gestao',perfil:'Perfil'};
    $('headerTitle').textContent=titles[tab];

    // Carregar dados
    if(tab==='dashboard') this.loadDashboard();
    if(tab==='lancamento') this.loadLancamento();
    if(tab==='historico') this.loadHistorico();
    if(tab==='gestao') this.loadGestao();
    if(tab==='perfil') this.loadPerfil();

    // Scroll top
    $('scrollArea').scrollTop=0;
  }

  // ============================================
  // DASHBOARD
  // ============================================
  async loadDashboard(){
    await this.loadData();
    const abs=this.data.abast;

    // KPIs
    $('kpiTotal').textContent=abs.length;

    let totKm=0,totL=0,totV=0;
    abs.forEach(a=>{
      if(a.autonomia) totKm+=parseFloat(a.autonomia);
      if(a.litros) totL+=parseFloat(a.litros);
      if(a.valor) totV+=parseFloat(a.valor);
    });
    const cMedio=totL>0?(totKm/totL).toFixed(1):'0,0';
    const cKm=totKm>0?(totV/totKm).toFixed(2):'0,00';
    $('kpiConsumo').textContent=cMedio;
    $('kpiCusto').textContent='R$ '+cKm;

    // Alertas
    const alertas=this.calcAlertas();
    $('kpiAlertas').textContent=alertas.length;
    const alertBox=$('dashAlertas');
    if(alertas.length===0){
      alertBox.innerHTML=`<div class="empty"><div class="empty-ico">✅</div><h3>Tudo certo</h3><p>Nenhum veiculo com consumo anormal</p></div>`;
    } else {
      alertBox.innerHTML=alertas.map((a,i)=>`
        <div class="alert-item" style="animation-delay:${i*0.05}s">
          <div class="alert-ico">⚠️</div>
          <div class="alert-body"><div class="alert-title">${a.placa} - ${a.veiculo}</div><div class="alert-sub">Consumo: ${a.real} km/l (esperado: ${a.esperado} km/l)</div></div>
          <div class="alert-pct">+${a.pct}%</div>
        </div>
      `).join('');
    }

    // Graficos
    this.drawBarChart('chartConsumo',this.buildConsumoData());
    this.drawLineChart('chartGasto',this.buildGastoData());
  }

  calcAlertas(){
    const alertas=[];
    const porPlaca={};
    this.data.abast.forEach(a=>{
      if(!porPlaca[a.placa]) porPlaca[a.placa]=[];
      porPlaca[a.placa].push(a);
    });
    for(const placa in porPlaca){
      const lista=porPlaca[placa].sort((a,b)=>new Date(b.data)-new Date(a.data));
      if(lista.length<2) continue;
      const v=this.data.veic.find(x=>x.placa===placa);
      if(!v||!v.consumoEsperado) continue;
      const recentes=lista.slice(0,3);
      let km=0,l=0;
      recentes.forEach(a=>{if(a.autonomia)km+=parseFloat(a.autonomia);if(a.litros)l+=parseFloat(a.litros);});
      if(l>0){
        const real=km/l;
        const esp=parseFloat(v.consumoEsperado);
        const pct=((real-esp)/esp*100).toFixed(0);
        if(parseFloat(pct)>20){
          alertas.push({placa,veiculo:(v.marca||'')+' '+(v.modelo||''),real:real.toFixed(1),esperado:esp,pct});
        }
      }
    }
    return alertas.sort((a,b)=>parseFloat(b.pct)-parseFloat(a.pct));
  }

  buildConsumoData(){
    const data={},corte=new Date(); corte.setDate(corte.getDate()-30);
    this.data.abast.filter(a=>new Date(a.data)>=corte).forEach(a=>{
      if(!data[a.placa]) data[a.placa]={km:0,l:0};
      if(a.autonomia) data[a.placa].km+=parseFloat(a.autonomia);
      if(a.litros) data[a.placa].l+=parseFloat(a.litros);
    });
    const out=[];
    for(const p in data){
      const d=data[p];
      out.push({label:p,value:d.l>0?(d.km/d.l).toFixed(1):0});
    }
    return out.sort((a,b)=>parseFloat(b.value)-parseFloat(a.value));
  }

  buildGastoData(){
    const meses={};
    this.data.abast.forEach(a=>{
      const m=new Date(a.data).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
      if(!meses[m]) meses[m]=0;
      if(a.valor) meses[m]+=parseFloat(a.valor);
    });
    const labels=Object.keys(meses).slice(-6);
    return {labels,values:labels.map(l=>meses[l].toFixed(2))};
  }

  // ============================================
  // CANVAS CHARTS (nativo, zero deps)
  // ============================================
  drawBarChart(canvasId,data){
    const canvas=$(canvasId); if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const wrap=canvas.parentElement;
    const w=wrap.clientWidth,h=wrap.clientHeight;
    canvas.width=w*2; canvas.height=h*2;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    ctx.scale(2,2);

    if(data.length===0){ ctx.fillStyle='#6b7280'; ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.fillText('Sem dados',w/2,h/2); return; }

    const pad={t:10,r:10,b:30,l:40};
    const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
    const max=Math.max(...data.map(d=>parseFloat(d.value)))||1;
    const barW=(cw/data.length)*0.6;
    const gap=(cw/data.length)*0.4;

    ctx.clearRect(0,0,w,h);

    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.05)';
    ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=pad.t+ch-(i/4)*ch;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
    }

    // Bars
    data.forEach((d,i)=>{
      const x=pad.l+i*(barW+gap)+gap/2;
      const bh=(parseFloat(d.value)/max)*ch;
      const y=pad.t+ch-bh;
      const grad=ctx.createLinearGradient(0,y,0,y+bh);
      grad.addColorStop(0,'#60a5fa'); grad.addColorStop(1,'#3b82f6');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.roundRect(x,y,barW,bh,4); ctx.fill();

      // Label
      ctx.fillStyle='#9ca3af'; ctx.font='11px sans-serif'; ctx.textAlign='center';
      ctx.fillText(d.label,x+barW/2,h-8);

      // Value
      ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
      ctx.fillText(d.value,x+barW/2,y-6);
    });

    // Y axis labels
    ctx.fillStyle='#6b7280'; ctx.font='10px sans-serif'; ctx.textAlign='right';
    for(let i=0;i<=4;i++){
      const val=(max*(i/4)).toFixed(1);
      ctx.fillText(val,pad.l-6,pad.t+ch-(i/4)*ch+3);
    }
  }

  drawLineChart(canvasId,dataObj){
    const canvas=$(canvasId); if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const wrap=canvas.parentElement;
    const w=wrap.clientWidth,h=wrap.clientHeight;
    canvas.width=w*2; canvas.height=h*2;
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    ctx.scale(2,2);

    const labels=dataObj.labels||[], values=dataObj.values||[];
    if(labels.length===0){ ctx.fillStyle='#6b7280'; ctx.font='14px sans-serif'; ctx.textAlign='center'; ctx.fillText('Sem dados',w/2,h/2); return; }

    const pad={t:20,r:10,b:35,l:45};
    const cw=w-pad.l-pad.r, ch=h-pad.t-pad.b;
    const max=Math.max(...values.map(v=>parseFloat(v)))||1;
    const stepX=cw/(labels.length-1||1);

    ctx.clearRect(0,0,w,h);

    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=pad.t+ch-(i/4)*ch;
      ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
    }

    // Line
    ctx.strokeStyle='#22c55e'; ctx.lineWidth=2.5; ctx.lineJoin='round';
    ctx.beginPath();
    values.forEach((v,i)=>{
      const x=pad.l+i*stepX;
      const y=pad.t+ch-(parseFloat(v)/max)*ch;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // Fill area
    ctx.fillStyle='rgba(34,197,94,0.1)';
    ctx.lineTo(pad.l+(values.length-1)*stepX,pad.t+ch);
    ctx.lineTo(pad.l,pad.t+ch);
    ctx.closePath(); ctx.fill();

    // Points
    values.forEach((v,i)=>{
      const x=pad.l+i*stepX;
      const y=pad.t+ch-(parseFloat(v)/max)*ch;
      ctx.fillStyle='#22c55e'; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
      ctx.fillText('R$'+parseFloat(v).toFixed(0),x,y-10);
    });

    // X labels
    ctx.fillStyle='#6b7280'; ctx.font='10px sans-serif'; ctx.textAlign='center';
    labels.forEach((l,i)=>{
      ctx.fillText(l,pad.l+i*stepX,h-10);
    });

    // Y labels
    ctx.textAlign='right';
    for(let i=0;i<=4;i++){
      const val=(max*(i/4)).toFixed(0);
      ctx.fillText('R$'+val,pad.l-6,pad.t+ch-(i/4)*ch+3);
    }
  }

  // ============================================
  // LANCAMENTO
  // ============================================
  async loadLancamento(){
    await this.loadData();
    const sel=$('lancPlaca');
    sel.innerHTML='<option value="">Selecione o veiculo</option>';
    this.data.veic.filter(v=>v.ativo).forEach(v=>{
      const opt=document.createElement('option');
      opt.value=v.placa;
      opt.textContent=v.placa+' - '+(v.marca||'')+' '+(v.modelo||'');
      sel.appendChild(opt);
    });
    this.lancando=true;
    this.clearLanc();
  }

  onVeicChange(){
    const placa=$('lancPlaca').value;
    if(!placa){ $('lancKmAnt').textContent='KM anterior: --'; return; }
    const v=this.data.veic.find(x=>x.placa===placa);
    if(v){
      $('lancKmAnt').textContent='KM anterior: '+(v.kmAtual||0).toLocaleString('pt-BR');
      $('lancComb').value=v.combustivel||'';
    }
  }

  pickPhoto(tipo){ $(`file${tipo}`).click(); }

  onPhoto(input,tipo){
    const file=input.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      this.fotos[tipo]=e.target.result;
      const box=$(`photo${tipo}`);
      box.classList.add('has-img');
      box.innerHTML=`<img src="${e.target.result}"><div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));padding:10px;display:flex;justify-content:space-between;align-items:center;"><span style="color:#fff;font-size:12px;font-weight:600;">✅ ${tipo}</span><button class="btn-icon" style="width:32px;height:32px;background:rgba(255,255,255,0.2);color:#fff;" onclick="event.stopPropagation();app.clearPhoto('${tipo}')">🗑️</button></div>`;
    };
    reader.readAsDataURL(file);
  }

  clearPhoto(tipo){
    this.fotos[tipo]=null;
    const box=$(`photo${tipo}`);
    box.classList.remove('has-img');
    box.innerHTML=`<div class="ph-text"><span class="ph-ico">📷</span><span>Toque para foto do ${tipo}</span></div><input type="file" id="file${tipo}" accept="image/*" capture="environment" onchange="app.onPhoto(this,'${tipo}')">`;
  }

  clearLanc(){
    $('lancPlaca').value='';
    $('lancKm').value='';
    $('lancLitros').value='';
    $('lancComb').value='';
    $('lancValor').value='';
    $('lancPosto').value='';
    $('lancObs').value='';
    $('lancKmAnt').textContent='KM anterior: --';
    this.clearPhoto('odometro');
    this.clearPhoto('nota');
  }

  async saveLanc(){
    const placa=$('lancPlaca').value;
    const km=parseFloat($('lancKm').value);
    const litros=parseFloat($('lancLitros').value);
    const comb=$('lancComb').value;
    const valor=parseFloat($('lancValor').value);
    if(!placa||!km||!litros||!comb||!valor){ toast('Preencha todos os campos obrigatorios','warn'); return; }
    if(!this.fotos.odometro||!this.fotos.nota){ toast('Tire as duas fotos','warn'); return; }

    const v=this.data.veic.find(x=>x.placa===placa);
    const kmAnt=v?parseFloat(v.kmAtual||0):0;
    const aut=km-kmAnt;
    const consumo=aut>0&&litros>0?(aut/litros).toFixed(2):0;

    const obj={
      id:uid(),placa,km,kmAnt,autonomia:aut,litros,combustivel:comb,valor,
      posto:$('lancPosto').value||'',obs:$('lancObs').value||'',
      consumo,usuario:this.user.email,
      data:new Date().toISOString(),
      fotoOdometro:this.fotos.odometro,fotoNota:this.fotos.nota
    };

    loading(true,'Salvando...');
    await new Promise(r=>setTimeout(r,500));

    await this.db.put('abastecimentos',obj);
    if(v){ v.kmAtual=km; await this.db.put('veiculos',v); }

    // Tentar sync se online e URL configurada
    if(isOnline()&&CONFIG.API_URL){
      try{
        await fetch(CONFIG.API_URL+'?acao=salvar&'+new URLSearchParams({json:JSON.stringify(obj)}));
      }catch(e){/*silent*/}
    }

    loading(false);
    toast('Abastecimento salvo!','ok');
    this.lancando=false;
    this.nav('dashboard');
  }

  continuarLanc(){ this.closeModal('modalBloqueio'); }
  descartarLanc(){ this.lancando=false; this.closeModal('modalBloqueio'); this.clearLanc(); this.nav('dashboard'); }

  // ============================================
  // HISTORICO
  // ============================================
  async loadHistorico(){
    await this.loadData();
    this.renderHist(this.data.abast);
  }

  renderHist(lista){
    const box=$('histList');
    if(lista.length===0){ box.innerHTML=`<div class="empty"><div class="empty-ico">📭</div><h3>Nenhum registro</h3></div>`; return; }
    const ord=lista.sort((a,b)=>new Date(b.data)-new Date(a.data));
    box.innerHTML=ord.map((a,i)=>{
      const d=fmtDate(a.data);
      return `<div class="list-item" style="animation-delay:${i*0.03}s" onclick="app.verDetalhe('${a.id}')">
        <div class="list-ico">⛽</div>
        <div class="list-body"><div class="list-title">${a.placa} - ${d}</div><div class="list-sub">${fmtNum(a.litros)}L • ${a.combustivel} • ${fmtMoney(a.valor)}</div></div>
        <span class="list-badge badge-info">${a.consumo||'--'} km/l</span>
      </div>`;
    }).join('');
  }

  filtrarHist(){
    const f=$('histFiltro').value.toLowerCase();
    const fil=this.data.abast.filter(a=>
      (a.placa&&a.placa.toLowerCase().includes(f))||
      fmtDate(a.data).includes(f)||
      (a.combustivel&&a.combustivel.toLowerCase().includes(f))
    );
    this.renderHist(fil);
  }

  verDetalhe(id){
    const a=this.data.abast.find(x=>x.id===id); if(!a) return;
    $('detBody').innerHTML=`
      <div style="font-size:14px;line-height:1.8;color:var(--text-sec)">
        <p><strong style="color:var(--text)">Placa:</strong> ${a.placa}</p>
        <p><strong style="color:var(--text)">Data:</strong> ${fmtDateTime(a.data)}</p>
        <p><strong style="color:var(--text)">KM:</strong> ${a.km} (ant: ${a.kmAnt||0})</p>
        <p><strong style="color:var(--text)">Autonomia:</strong> ${a.autonomia||0} km</p>
        <p><strong style="color:var(--text)">Litros:</strong> ${a.litros} L</p>
        <p><strong style="color:var(--text)">Consumo:</strong> ${a.consumo} km/l</p>
        <p><strong style="color:var(--text)">Combustivel:</strong> ${a.combustivel}</p>
        <p><strong style="color:var(--text)">Valor:</strong> ${fmtMoney(a.valor)}</p>
        <p><strong style="color:var(--text)">Posto:</strong> ${a.posto||'-'}</p>
        <p><strong style="color:var(--text)">Usuario:</strong> ${a.usuario}</p>
        <p><strong style="color:var(--text)">Obs:</strong> ${a.obs||'-'}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        ${a.fotoOdometro?`<img src="${a.fotoOdometro}" style="width:100%;border-radius:10px" onclick="window.open('${a.fotoOdometro}')">`:''}
        ${a.fotoNota?`<img src="${a.fotoNota}" style="width:100%;border-radius:10px" onclick="window.open('${a.fotoNota}')">`:''}
      </div>`;
    this.openModal('modalDetalhe');
  }

  // ============================================
  // GESTAO
  // ============================================
  async loadGestao(){
    if(this.user.nivel!=='adm'){ toast('Acesso restrito','warn'); this.nav('dashboard'); return; }
    await this.loadData();
    this.switchGestaoTab(this.tabGestao);
  }

  switchGestaoTab(tab){
    this.tabGestao=tab;
    document.querySelectorAll('.tab').forEach((el,i)=>{
      el.classList.toggle('active', (tab==='veiculos'&&i===0)||(tab==='usuarios'&&i===1)||(tab==='relatorios'&&i===2) );
    });
    document.querySelectorAll('#gestVeiculos,#gestUsuarios,#gestRelatorios').forEach(el=>el.classList.remove('active'));
    $(`gest${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.add('active');

    if(tab==='veiculos') this.renderVeiculos();
    if(tab==='usuarios') this.renderUsuarios();
    if(tab==='relatorios') this.loadRelatorios();
  }

  renderVeiculos(){
    const box=$('listaVeiculos');
    if(this.data.veic.length===0){ box.innerHTML=`<div class="empty"><div class="empty-ico">🚗</div><h3>Nenhum veiculo</h3></div>`; return; }
    box.innerHTML=this.data.veic.map((v,i)=>{
      const n=this.data.abast.filter(a=>a.placa===v.placa).length;
      return `<div class="list-item" style="animation-delay:${i*0.03}s">
        <div class="list-ico">🚗</div>
        <div class="list-body"><div class="list-title">${v.placa}</div><div class="list-sub">${v.marca||''} ${v.modelo||''} • ${n} abast.</div></div>
        <span class="list-badge badge-info">${(v.kmAtual||0).toLocaleString('pt-BR')} km</span>
      </div>`;
    }).join('');
  }

  renderUsuarios(){
    const box=$('listaUsuarios');
    if(this.data.users.length===0){ box.innerHTML=`<div class="empty"><div class="empty-ico">👥</div><h3>Nenhum usuario</h3></div>`; return; }
    box.innerHTML=this.data.users.map((u,i)=>`
      <div class="list-item" style="animation-delay:${i*0.03}s">
        <div class="list-ico">👤</div>
        <div class="list-body"><div class="list-title">${u.nome}</div><div class="list-sub">${u.email}</div></div>
        <span class="list-badge ${u.nivel==='adm'?'badge-warn':'badge-info'}">${u.nivel==='adm'?'ADM':'OP'}</span>
      </div>
    `).join('');
  }

  async loadRelatorios(){
    const sel=$('relVeiculo');
    sel.innerHTML='<option value="">Todos os veiculos</option>';
    this.data.veic.forEach(v=>{ const o=document.createElement('option'); o.value=v.placa; o.textContent=v.placa; sel.appendChild(o); });
    this.gerarRelatorio();
  }

  gerarRelatorio(){
    const dias=parseInt($('relPeriodo').value);
    const placa=$('relVeiculo').value;
    const corte=new Date(); corte.setDate(corte.getDate()-dias);
    let fil=this.data.abast.filter(a=>new Date(a.data)>=corte);
    if(placa) fil=fil.filter(a=>a.placa===placa);

    let totL=0,totV=0,totKm=0;
    fil.forEach(a=>{ if(a.litros)totL+=parseFloat(a.litros); if(a.valor)totV+=parseFloat(a.valor); if(a.autonomia)totKm+=parseFloat(a.autonomia); });
    const cMed=totL>0?(totKm/totL).toFixed(1):'0,0';
    const cKm=totKm>0?(totV/totKm).toFixed(2):'0,00';
    const pMed=totL>0?(totV/totL).toFixed(2):'0,00';

    $('relResult').innerHTML=`
      <div class="kpi-grid" style="margin-top:12px">
        <div class="kpi"><div class="kpi-val">${fil.length}</div><div class="kpi-lbl">Abastecimentos</div></div>
        <div class="kpi"><div class="kpi-val">${fmtNum(totL)}L</div><div class="kpi-lbl">Total Litros</div></div>
        <div class="kpi"><div class="kpi-val">${fmtMoney(totV)}</div><div class="kpi-lbl">Total Gasto</div></div>
        <div class="kpi"><div class="kpi-val">${cMed}</div><div class="kpi-lbl">km/l Medio</div></div>
      </div>
      <div style="margin-top:14px;font-size:13px;color:var(--text-sec);line-height:1.8">
        <p><strong>Custo por km:</strong> <span style="color:var(--text)">R$ ${cKm}</span></p>
        <p><strong>Preco medio/L:</strong> <span style="color:var(--text)">R$ ${pMed}</span></p>
        <p><strong>KM total:</strong> <span style="color:var(--text)">${totKm.toFixed(0)} km</span></p>
      </div>`;

    this.renderRanking();
    this.drawLineChart('chartEvolucao',this.buildEvolucaoData(fil));
  }

  renderRanking(){
    const rank=[];
    this.data.veic.forEach(v=>{
      const abs=this.data.abast.filter(a=>a.placa===v.placa);
      if(abs.length>=2){
        let km=0,l=0;
        abs.forEach(a=>{if(a.autonomia)km+=parseFloat(a.autonomia);if(a.litros)l+=parseFloat(a.litros);});
        if(l>0) rank.push({placa:v.placa,veic:(v.marca||'')+' '+(v.modelo||''),cons:(km/l).toFixed(1)});
      }
    });
    rank.sort((a,b)=>parseFloat(b.cons)-parseFloat(a.cons));
    const max=Math.max(...rank.map(r=>parseFloat(r.cons)))||1;
    const box=$('rankingBox');
    if(rank.length===0){ box.innerHTML='<p class="txt-center txt-dim" style="padding:20px">Dados insuficientes</p>'; return; }
    box.innerHTML=rank.map((r,i)=>`
      <div class="bar-row">
        <div class="bar-lbl">${i+1}º ${r.placa}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(parseFloat(r.cons)/max*100).toFixed(0)}%;background:${i===0?'var(--success)':'var(--accent)'}">${r.cons} km/l</div></div>
      </div>
    `).join('');
  }

  buildEvolucaoData(fil){
    const ord=fil.sort((a,b)=>new Date(a.data)-new Date(b.data));
    return {
      labels:ord.map(a=>fmtDate(a.data).slice(0,5)),
      values:ord.map(a=>a.consumo||0)
    };
  }

  // ============================================
  // CADASTROS
  // ============================================
  openModalVeiculo(){
    ['veicPlaca','veicMarca','veicModelo','veicAno','veicTanque','veicConsumo','veicKm'].forEach(id=>$(id).value='');
    $('veicComb').value='Gasolina';
    this.openModal('modalVeiculo');
  }

  async saveVeiculo(){
    const obj={
      id:uid(),placa:$('veicPlaca').value.trim().toUpperCase(),
      marca:$('veicMarca').value.trim(),modelo:$('veicModelo').value.trim(),
      ano:$('veicAno').value,tanque:$('veicTanque').value,
      combustivel:$('veicComb').value,consumoEsperado:$('veicConsumo').value,
      kmAtual:parseFloat($('veicKm').value)||0,ativo:true
    };
    if(!obj.placa){ toast('Informe a placa','warn'); return; }
    loading(true,'Salvando...');
    await new Promise(r=>setTimeout(r,400));
    await this.db.put('veiculos',obj);
    await this.loadData();
    this.renderVeiculos();
    this.closeModal('modalVeiculo');
    loading(false);
    toast('Veiculo salvo!','ok');
  }

  openModalUsuario(){
    ['userNome','userEmail','userSenha'].forEach(id=>$(id).value='');
    $('userNivel').value='operacao';
    this.openModal('modalUsuario');
  }

  async saveUsuario(){
    const obj={
      id:uid(),nome:$('userNome').value.trim(),
      email:$('userEmail').value.trim().toLowerCase(),
      senha:$('userSenha').value,nivel:$('userNivel').value,ativo:true
    };
    if(!obj.nome||!obj.email||!obj.senha){ toast('Preencha todos os campos','warn'); return; }
    if(obj.senha.length<6){ toast('Senha minimo 6 caracteres','warn'); return; }
    loading(true,'Salvando...');
    await new Promise(r=>setTimeout(r,400));
    await this.db.put('usuarios',obj);
    await this.loadData();
    this.renderUsuarios();
    this.closeModal('modalUsuario');
    loading(false);
    toast('Usuario salvo!','ok');
  }

  // ============================================
  // PERFIL
  // ============================================
  loadPerfil(){
    $('perfilNome').textContent=this.user.nome;
    $('perfilEmail').textContent=this.user.email;
    $('perfilNivel').textContent=this.user.nivel==='adm'?'ADMINISTRADOR':'OPERACAO';
    $('perfilNivel').className='list-badge '+(this.user.nivel==='adm'?'badge-warn':'badge-info');
    $('cfgGasUrl').value=CONFIG.API_URL;
  }

  async clearCache(){
    if(!confirm('Limpar todos os dados locais?')) return;
    await this.db.clear('abastecimentos');
    await this.db.clear('veiculos');
    await this.db.clear('usuarios');
    toast('Cache limpo!','info');
    await this.seedDemo();
    await this.loadData();
  }

  exportCSV(){
    let csv='Data,Placa,KM Anterior,KM Atual,Autonomia,Litros,Consumo,Combustivel,Valor,Posto,Usuario,Obs\n';
    this.data.abast.forEach(a=>{
      csv+=`${a.data},${a.placa},${a.kmAnt||0},${a.km},${a.autonomia||0},${a.litros},${a.consumo},${a.combustivel},${a.valor},${a.posto||''},${a.usuario},${a.obs||''}\n`;
    });
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='abastecimentos_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    toast('CSV baixado!','ok');
  }

  saveGasUrl(){
    const url=$('cfgGasUrl').value.trim();
    localStorage.setItem('gas_url',url);
    CONFIG.API_URL=url;
    toast('URL salva! Reinicie o app para aplicar.','ok');
  }

  // ============================================
  // SYNC COM GOOGLE APPS SCRIPT
  // ============================================
  async syncNow(){
    if(!CONFIG.API_URL){ toast('Configure a URL do Google Apps Script em Perfil','warn'); return; }
    if(!isOnline()){ toast('Sem conexao com internet','warn'); return; }
    loading(true,'Sincronizando...');
    try{
      const resp=await fetch(CONFIG.API_URL+'?acao=sync&user='+encodeURIComponent(this.user.email));
      const data=await resp.json();
      if(data.sucesso){
        if(data.veiculos) for(const v of data.veiculos) await this.db.put('veiculos',v);
        if(data.abastecimentos) for(const a of data.abastecimentos) await this.db.put('abastecimentos',a);
        if(data.usuarios) for(const u of data.usuarios) await this.db.put('usuarios',u);
        await this.loadData();
        toast('Sincronizado!','ok');
        this.loadDashboard();
      }
    }catch(e){ toast('Erro na sincronizacao: '+e.message,'err'); }
    loading(false);
  }

  // ============================================
  // HELPERS
  // ============================================
  async loadData(){
    this.data.abast=await this.db.getAll('abastecimentos');
    this.data.veic=await this.db.getAll('veiculos');
    this.data.users=await this.db.getAll('usuarios');
  }

  openModal(id){ $(id).classList.add('active'); }
  closeModal(id){ $(id).classList.remove('active'); }
}

// ============================================
// INIT
// ============================================
const app = new App();
document.addEventListener('DOMContentLoaded',()=>app.init());
