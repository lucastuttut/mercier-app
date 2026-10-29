// ==========================================
// 1. FUNÇÕES UTILITÁRIAS ESSENCIAIS
// ==========================================
function getEl(id) { return document.getElementById(id); }
function val(id) { const e = getEl(id); return e ? e.value : ""; }

function esc(str) {
    return (str || "").toString().replace(/[&<>'"]/g, function(tag) {
        return ({'&': '&', '<': '<', '>': '>', "'": '&#39;', '"': '&quot;'}[tag] || tag);
    });
}

function noAcc(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function safeArray(data) {
    if (!data) return [];
    try {
        let arr = Array.isArray(data) ? data : Object.values(data);
        return arr.filter(function(i){ return i && typeof i === 'object'; });
    } catch(e){ return []; }
}

// Data local (evita virar o dia errado por causa do fuso horário)
function dataLocalISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hojeLocal() { return dataLocalISO(new Date()); }

// Ordem dos pedidos na aba Pedidos: 'NOVOS_PRIMEIRO' ou 'ANTIGOS_PRIMEIRO'
const ORDEM_PEDIDOS = 'NOVOS_PRIMEIRO';

// ==========================================
// 2. VARIÁVEIS GLOBAIS
// ==========================================
let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[];
let tarefasEquipe=[], entregas=[], lembretes=[], historicoAtividades=[];
let cestoItensTemporario=[], proximoID=255, notasMelhoria="", notasEstoque="";
let usuarioAtual="", modoMinhasTarefas=false, visaoPedidos='ATIVOS', visaoEstoque='ESTOQUE', filtrandoNaoEnviados=false, cpfValido=true;

let dataSelecionadaLogistica = hojeLocal();
let dataAtualCalendario = new Date();
let eventosDoMes = {};

const coresEquipe = {
    "LUCAS":"bg-emerald-100 text-emerald-700 border-emerald-400",
    "GUILHERME":"bg-blue-100 text-blue-700 border-blue-400",
    "CAROL":"bg-orange-100 text-orange-700 border-orange-400",
    "ISABELLA":"bg-amber-100 text-amber-700 border-amber-400",
    "ANGÉLICA":"bg-purple-100 text-purple-700 border-purple-400"
};
let colsMinimizadas = {"TODO":false, "DOING":false, "DONE":false};
let filtrosEquipeAtivos = [];
let deepLinkVerificado = false;

// ==========================================
// 3. NAVEGAÇÃO E INICIALIZAÇÃO
// ==========================================
function switchTab(t) {
    const view = getEl('view-'+t);
    if(!view) return;
    window.scrollTo(0,0);
    document.querySelectorAll('main').forEach(function(x) { x.classList.add('hidden'); });
    view.classList.remove('hidden');

    document.querySelectorAll('nav button').forEach(function(x) { x.classList.remove('tab-active', 'text-white'); });
    const tab = getEl('tab-'+t);
    if(tab) tab.classList.add('tab-active');

    if(t === 'logistica') processarEventosCalendario();
    if(t === 'hoje') { try { renderHoje(); } catch(e) { console.error(e); } }
}

try { usuarioAtual = localStorage.getItem('mercier_user') || ""; } catch(e) {}
try { modoMinhasTarefas = localStorage.getItem('mercier_so_minhas') === 'true'; } catch(e) {}

window.onload = function() {
    if(getEl('user-select') && usuarioAtual) getEl('user-select').value = usuarioAtual;
    if(getEl('check-minhas-tarefas')) getEl('check-minhas-tarefas').checked = modoMinhasTarefas;
    renderFiltrosEquipe();
    mostrarCamposTarefa('SIMPLES');
    if(getEl('ent_data')) getEl('ent_data').value = hojeLocal();
    if(getEl('lem_data')) getEl('lem_data').value = hojeLocal();
};

function setUsuario(nome) {
    usuarioAtual = nome;
    try {
        if(nome) localStorage.setItem('mercier_user', nome);
        else localStorage.removeItem('mercier_user');
    } catch(e) {}
    renderFiltrosEquipe();
    renderQuadroEquipe();
    try { renderHoje(); } catch(e) {}
}

function toggleModoMinhasTarefas() {
    if(!usuarioAtual) return alert("Selecione quem você é no topo primeiro!");
    modoMinhasTarefas = getEl('check-minhas-tarefas').checked;
    try { localStorage.setItem('mercier_so_minhas', modoMinhasTarefas); } catch(e) {}
    if(modoMinhasTarefas) filtrosEquipeAtivos = [];
    renderFiltrosEquipe();
    renderQuadroEquipe();
}

// ==========================================
// 4. CONEXÃO FIREBASE E DIÁRIO DE BORDO
// ==========================================
window.addEventListener('error', function(e) {
    const errEl = getEl('error-log');
    if(errEl) { errEl.classList.remove('hidden'); errEl.innerText = "ERRO DETECTADO: " + e.message; }
});

const firebaseConfig = {
    apiKey: "AIzaSyA_fQSZJJcz5Wszw54W5EhMN9D5rNnjoCo",
    authDomain: "mercier-design.firebaseapp.com",
    projectId: "mercier-design",
    storageBucket: "mercier-design.firebasestorage.app",
    messagingSenderId: "1060891658513",
    appId: "1:1060891658513:web:2eefd15227203af39064b0",
    databaseURL: "https://mercier-design-default-rtdb.firebaseio.com/"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function salvarColecao(col, d) { db.ref('dados/' + col).set(d); }

db.ref('.info/connected').on('value', function(snap) {
    const st = getEl('status-db'); if(!st) return;
    if(snap.val() === true) {
        st.innerText="ONLINE"; st.className="bg-emerald-500 text-white hidden md:flex h-10 items-center px-4 rounded-xl text-[10px] font-black uppercase shadow-inner transition-all";
    } else {
        st.innerText="CONECTANDO..."; st.className="bg-orange-500 text-white hidden md:flex h-10 items-center px-4 rounded-xl text-[10px] font-black uppercase transition-all";
    }
});

db.ref('dados').on('value', function(s) {
    try {
        const d = s.val() || {};
        pedidos=safeArray(d.pedidos); fornecedores=safeArray(d.fornecedores); estoque=safeArray(d.estoque);
        catalogo=safeArray(d.catalogo); tarefas=safeArray(d.tarefas); assistencias=safeArray(d.assistencias);
        tarefasEquipe=safeArray(d.tarefasEquipe); historicoAtividades=safeArray(d.historico);
        entregas=safeArray(d.entregas); lembretes=safeArray(d.lembretes);

        proximoID=d.proximoID||255;

        if(getEl('texto-melhorias')) getEl('texto-melhorias').value = d.notasMelhoria || "";
        if(getEl('estoque-notas-gerais')) getEl('estoque-notas-gerais').value = d.notasEstoque || "";

        atualizarSelectsFornecedores();
        atualizarSugestoes();
        renderAll();
    } catch(e) { console.error("Erro banco:", e); }
});

function registrarAcao(ic, ac, det) {
    const q = usuarioAtual || "SISTEMA"; const d = new Date();
    const dH = d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    historicoAtividades.unshift({ uid:Date.now()+Math.random(), dataHora:dH, usuario:q, acao:ac, detalhe:det, icone:ic });
    if(historicoAtividades.length > 150) historicoAtividades = historicoAtividades.slice(0, 150);
    salvarColecao('historico', historicoAtividades);
}

function togglePainelHistorico() {
    const p = getEl('painel-historico'); const o = getEl('overlay-historico'); const b = getEl('badge-historico');
    if(p.classList.contains('translate-x-full')) {
        p.classList.remove('translate-x-full'); o.classList.remove('hidden'); if(b) b.classList.add('hidden');
    } else {
        p.classList.add('translate-x-full'); o.classList.add('hidden');
    }
}

function renderHistorico() {
    const lst = getEl('lista-historico'); if(!lst) return;
    if(historicoAtividades.length === 0) {
        lst.innerHTML = '<span class="text-slate-400 text-[10px] font-bold text-center uppercase block mt-10">Nenhuma atividade.</span>';
        return;
    }
    let html = "";
    historicoAtividades.forEach(function(h) {
        html += `
        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3 items-start">
            <div class="bg-slate-100 p-2 rounded-lg text-lg">${h.icone}</div>
            <div class="flex flex-col flex-1">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[9px] font-black uppercase text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">${esc(h.usuario)}</span>
                    <span class="text-[8px] font-bold text-slate-400">${h.dataHora}</span>
                </div>
                <span class="text-[11px] font-black uppercase text-slate-800 leading-tight">${esc(h.acao)}</span>
                <span class="text-[9px] font-bold text-slate-500 uppercase mt-0.5">${esc(h.detalhe)}</span>
            </div>
        </div>`;
    });
    lst.innerHTML = html;
}

async function getProximoID() {
    const ref = db.ref('dados/proximoID');
    const res = await ref.transaction(function(c) { return (c||255)+1; });
    return res.snapshot.val();
}

function renderAll() {
    try { renderPedidos(); } catch(e){}
    try { renderTarefas(); } catch(e){}
    try { renderFornecedores(); } catch(e){}
    try { renderEstoque(); } catch(e){}
    try { renderCatalogo(); } catch(e){}
    try { renderAssistencias(); } catch(e){}
    try { renderQuadroEquipe(); } catch(e){}
    try { renderHistorico(); } catch(e){}
    try { processarEventosCalendario(); } catch(e){}
    try { renderHoje(); } catch(e){ console.error("Erro na aba Hoje:", e); }
}

// =========================================================
// 5. MÁSCARAS E CALCULOS MATEMÁTICOS
// =========================================================
function maskMoney(i){
    let v = i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",",");
    i.value="R$ "+v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1.");
    if(i.classList.contains('t-v-desc')) calcTotalTirarPedido();
}

function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }

function maskCPF(i){
    let v = i.value.replace(/\D/g,""); if(v.length > 11) v = v.slice(0,11);
    v = v.replace(/(\d{3})(\d)/,"$1.$2"); v = v.replace(/(\d{3})(\d)/,"$1.$2");
    i.value = v.replace(/(\d{3})(\d{1,2})$/,"$1-$2");
    if(i.value.length === 14) verifCPF(i);
}

function verifCPF(i){ const ok=validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }

function validarCPF(c){
    c = c.replace(/[^\d]+/g,''); if(c.length !== 11 || !!c.match(/(\d)\1{10}/)) return false;
    let a=0; for(let i=0; i<9; i++) a += parseInt(c.charAt(i))*(10-i);
    let r = 11-(a%11); if(r === 10 || r === 11) r=0;
    if(r !== parseInt(c.charAt(9))) return false;
    a=0; for(let i=0; i<10; i++) a += parseInt(c.charAt(i))*(11-i); r = 11-(a%11);
    return (r>=10 ? 0 : r) === parseInt(c.charAt(10));
}

function copyText(v, el){
    if(!v || v==="-") return;
    navigator.clipboard.writeText(v.toUpperCase());
    if(el) { el.style.color="#22c55e"; setTimeout(function() { el.style.color="#94a3b8"; }, 1000); }
}

async function buscarCEP(i){
    let cep = i.value.replace(/\D/g,"");
    if(cep.length === 8){
        getEl('loading-cep').classList.remove('hidden');
        try {
            let r = await fetch(`https://viacep.com.br/ws/${cep}/json/`); let d = await r.json();
            if(!d.erro){
                getEl('t_end').value = d.logradouro.toUpperCase(); getEl('t_bairro').value = d.bairro.toUpperCase();
                getEl('t_cidade').value = d.localidade.toUpperCase(); getEl('t_num').focus();
            }
        } catch(e) {} finally { getEl('loading-cep').classList.add('hidden'); }
    }
}

function calcP(d, pr){
    if(!d) return {dias:0, classe:""};
    try {
        const pA = String(d).split("/"); let dF = new Date(pA[2], pA[1]-1, pA[0]); let s = String(pr||"30");
        if(s.includes("util")){
            let c=0; while(c < parseInt(s)){ dF.setDate(dF.getDate()+1); if(dF.getDay()!==0 && dF.getDay()!==6) c++; }
        } else { dF.setDate(dF.getDate() + parseInt(s)); }
        const df = Math.ceil((dF - new Date()) / 86400000);
        let cl = df < 0 ? "prazo-vencido" : (df <= 5 ? "prazo-urgente" : (df <= 10 ? "prazo-alerta" : (df <= 20 ? "prazo-atencao" : "")));
        return {dias:df, classe:cl};
    } catch(e) { return {dias:0, classe:""}; }
}

function calcDataExata(dataBR, pr) {
    if(!dataBR) return null;
    try {
        const pA = dataBR.split("/"); let dF = new Date(pA[2], pA[1]-1, pA[0]); let s = String(pr||"30");
        if(s.includes("util")){
            let c=0, lim=parseInt(s); while(c < lim){ dF.setDate(dF.getDate()+1); if(dF.getDay()!==0 && dF.getDay()!==6) c++; }
        } else { dF.setDate(dF.getDate() + parseInt(s)); }
        return `${dF.getFullYear()}-${String(dF.getMonth()+1).padStart(2,'0')}-${String(dF.getDate()).padStart(2,'0')}`;
    } catch(e) { return null; }
}

// =========================================================
// 6. ABA PEDIDOS
// =========================================================
function activeInlineEdit(el, uid, fld, lstType) {
    const oV = el.innerText;
    const i = document.createElement('input');
    i.value = oV === '-' ? '' : oV;
    i.className="w-full p-1 text-xs font-bold border-2 border-blue-500 rounded text-black outline-none uppercase";
    if(fld === 'custo') i.oninput = function() { maskMoney(i); };
    el.innerHTML=''; el.appendChild(i); i.focus();

    const sv = function() {
        let nV = i.value.toUpperCase().trim(); if(nV === "") nV = "-";
        let lst = lstType === 'estoque' ? estoque : (lstType === 'assistencias' ? assistencias : pedidos);
        const it = lst.find(function(x) { return x.uid == uid; });
        if(it) { it[fld] = fld === 'qtd' ? (parseInt(nV)||1) : nV; salvarColecao(lstType, lst); } else { el.innerText = oV; }
    };
    i.onblur=sv; i.onkeydown=function(e) { if(e.key === 'Enter') sv(); if(e.key === 'Escape'){ i.onblur=null; el.innerText=oV; } };
}

function mudarVisaoPedidos(v) {
    visaoPedidos = v;
    const bA = getEl('btn-visao-ativos'), bF = getEl('btn-visao-finalizados'), bFn = getEl('btnFiltroNaoEnviado');
    if(v === 'ATIVOS') {
        bA.classList.add('border-blue-600', 'text-blue-600', 'bg-white'); bA.classList.remove('border-transparent', 'text-slate-400');
        bF.classList.remove('border-blue-600', 'text-blue-600', 'bg-white'); bF.classList.add('border-transparent', 'text-slate-400');
        if(bFn) bFn.style.display = 'block';
    } else {
        bF.classList.add('border-blue-600', 'text-blue-600', 'bg-white'); bF.classList.remove('border-transparent', 'text-slate-400');
        bA.classList.remove('border-blue-600', 'text-blue-600', 'bg-white'); bA.classList.add('border-transparent', 'text-slate-400');
        if(bFn) bFn.style.display = 'none';
    }
    renderPedidos();
}

function arquivarPedido(u) {
    const x = pedidos.find(function(y){ return y.uid == u; });
    if(x){
        x.finalizado = !x.finalizado; x.status = x.finalizado ? "Entregue/Finalizado" : "Pedido na loja";
        salvarColecao('pedidos', pedidos); registrarAcao(x.finalizado ? '📦':'🔙', x.finalizado ? 'FINALIZOU':'RESTAUROU', `PEDIDO: ${x.cliente}`); renderPedidos();
    }
}

function excluirPedido(uid) {
    const p = pedidos.find(function(x) { return x.uid == uid; }); if(!p) return;
    if(p.finalizado) {
        if(confirm("RETORNAR pedido para ativos?")) { p.finalizado=false; p.status="Pedido na loja"; salvarColecao('pedidos', pedidos); renderPedidos(); }
    } else {
        if(confirm("EXCLUIR PERMANENTEMENTE?")) { pedidos = pedidos.filter(function(x){ return x.uid != uid; }); salvarColecao('pedidos', pedidos); renderPedidos(); }
    }
}

function cycleStatus(u){
    const x = pedidos.find(function(y){ return y.uid == u; }); if(!x || x.finalizado || x.status==="Entregue/Finalizado") return;
    const s = ["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; x.status = s[(s.indexOf(x.status)+1)%s.length]; salvarColecao('pedidos', pedidos);
}

function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(function(c) { c.checked = v; }); }
function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados = !filtrandoNaoEnviados; getEl('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); getEl('btnFiltroNaoEnviado').classList.toggle('text-white'); renderPedidos(); }
function updPed(u,c,v){ pedidos.find(function(x){ return x.uid == u; })[c] = v; salvarColecao('pedidos', pedidos); }
function togPed(u,c){ const x = pedidos.find(function(y){ return y.uid == u; }); if(x) { x[c] = !x[c]; salvarColecao('pedidos', pedidos); } }
async function dupPed(u){ const x = pedidos.find(function(y){ return y.uid == u; }); const nId = await getProximoID(); const idDoc = "ID#" + nId.toString().padStart(4,'0'); pedidos.unshift({...x, uid: Date.now()+Math.random(), idDoc}); salvarColecao('pedidos', pedidos); }

function gerarAssistenciaRapida(u) {
    const x = pedidos.find(function(y){ return y.uid == u; }); if(!x) return;
    if(!confirm("Abrir uma assistência para " + x.cliente + " (" + x.produto + ")?")) return;
    assistencias.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), cliente: x.cliente, produto: x.produto, fabrica: x.fornecedor, status: "Aguardando" });
    salvarColecao('assistencias', assistencias);
    registrarAcao('🛠️', 'NOVA ASSISTÊNCIA', 'CLIENTE: ' + x.cliente);
    renderAssistencias();
}

// Número do pedido (ID#0260 -> 260)
function numeroPedido(p) { return parseInt(String(p.idDoc || '').replace(/\D/g, ''), 10) || 0; }

// Mais novo no topo (ou o contrário, conforme ORDEM_PEDIDOS).
// Itens do mesmo pedido ficam na ordem em que foram digitados.
function compararPedidos(a, b) {
    const d = numeroPedido(a) - numeroPedido(b);
    if (d !== 0) return ORDEM_PEDIDOS === 'NOVOS_PRIMEIRO' ? -d : d;
    return (Number(a.uid) || 0) - (Number(b.uid) || 0);
}

// Ordem crescente simples (usada no texto do e-mail para a fábrica)
function compararPedidosCrescente(a, b) {
    const d = numeroPedido(a) - numeroPedido(b);
    if (d !== 0) return d;
    return (Number(a.uid) || 0) - (Number(b.uid) || 0);
}

function renderPedidos() {
    const tb = getEl('tabelaPedidos'); if(!tb) return;
    const b = noAcc(val('busca').toLowerCase());
    let lst = pedidos.filter(function(x) {
        return noAcc((x.cliente||"").toLowerCase()).includes(b) || noAcc((x.produto||"").toLowerCase()).includes(b) || noAcc((x.idDoc||"").toLowerCase()).includes(b) || noAcc((x.fornecedor||"").toLowerCase()).includes(b);
    });

    if (visaoPedidos === 'ATIVOS') {
        lst = lst.filter(function(x) { return !x.finalizado && x.status !== "Entregue/Finalizado"; });
        if(filtrandoNaoEnviados) lst = lst.filter(function(x) { return x.status === "Não enviado"; });
    } else {
        lst = lst.filter(function(x) { return x.finalizado || x.status === "Entregue/Finalizado"; });
    }

    lst.sort(compararPedidos);

    getEl('contador').innerText = lst.length + " PEDIDOS";

    let html = "";
    lst.forEach(function(x) {
        const p = calcP(x.dataPedido, x.prazo); let sC = "bg-blue-600";
        if(x.status === "Não enviado") sC = "bg-red-600"; else if(x.status === "Pedido na loja") sC = "bg-green-700";
        if (x.finalizado || x.status === "Entregue/Finalizado") sC = "bg-slate-500 opacity-70";

        let btn = `<button onclick="copyText('${x.qtd}x ${esc(x.produto)} ${esc(x.cor)} (${esc(x.idDoc)})', this)" title="Copiar">📋</button>`;
        if(!x.finalizado && x.status !== "Entregue/Finalizado") {
            btn += `<button onclick="arquivarPedido(${x.uid})" title="Finalizar">📦</button>`;
            btn += `<button onclick="dupPed(${x.uid})" title="Duplicar">➕</button>`;
            btn += `<button onclick="gerarAssistenciaRapida(${x.uid})" title="Assistência">🛠️</button>`;
            btn += `<button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black" title="Excluir Definitivo">✕</button>`;
        } else {
            btn += `<button onclick="excluirPedido(${x.uid})" class="text-slate-400 font-black text-lg" title="Retornar">🔙</button>`;
        }

        html += `
        <tr class="${p.classe}">
            <td><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="bg-black text-white text-[8px] font-black rounded px-1 outline-none"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td>
            <td class="text-[10px] text-slate-400 font-black">${esc(x.idDoc)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'pedidos')" class="cursor-pointer uppercase">${esc(x.cliente)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'dataPedido', 'pedidos')" class="cursor-pointer text-[10px]">${esc(x.dataPedido)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'pedidos')" class="cursor-pointer text-center font-black">${esc(x.qtd)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'pedidos')" class="cursor-pointer uppercase">${esc(x.produto)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'medida', 'pedidos')" class="cursor-pointer uppercase">${esc(x.medida)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cor', 'pedidos')" class="cursor-pointer uppercase">${esc(x.cor)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'custo', 'pedidos')" class="cursor-pointer">${esc(x.custo)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'fornecedor', 'pedidos')" class="cursor-pointer font-black text-blue-800 uppercase text-[10px]">${esc(x.fornecedor)}</td>
            <td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sC} text-white w-full">${esc(x.status)}</button></td>
            <td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'bg-green-700':'bg-red-700'} text-white w-full">${x.whatsEnviado?'SIM':'NÃO'}</button></td>
            <td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'bg-green-700':'bg-red-700'} text-white w-full">${x.confirmado?'SIM':'NÃO'}</button></td>
            <td class="text-center flex gap-1.5 justify-center items-center">${btn}</td>
        </tr>`;
    });
    tb.innerHTML = html;
}

function adicionarItemAoCesto() {
    const p = val('m_produto').trim().toUpperCase();
    if(!p) return alert("INFORME PRODUTO!");
    cestoItensTemporario.push({ uid: Date.now(), q: val('m_qtd') || 1, p: p, m: val('m_medida') || "-", c: val('m_cor').toUpperCase() || "-", v: val('m_custo') || "R$ 0,00" });
    renderCesto(); getEl('m_produto').value = "";
}

function renderCesto() {
    getEl('cesto-itens').innerHTML = cestoItensTemporario.map(function(i, id) {
        return `<div class="bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg text-[10px] font-black text-blue-800 flex items-center gap-2"><span>${i.q}x</span><span>${esc(i.p)}</span><button onclick="cestoItensTemporario.splice(${id},1); renderCesto();" class="text-red-500 hover:text-red-700 ml-1">✕</button></div>`;
    }).join('');
}

async function cadastrarManual() {
    const cli = val('m_cliente').trim().toUpperCase(); const forn = val('m_fornecedor_select');
    if(!cli || cestoItensTemporario.length === 0) return alert("FALTA DADOS!");
    const nId = await getProximoID(); const idDoc = "ID#" + nId.toString().padStart(4, '0');
    const baseUid = Date.now();
    cestoItensTemporario.forEach(function(i, idx) {
        pedidos.unshift({ uid: baseUid + idx, idDoc: idDoc, cliente: cli, dataPedido: new Date().toLocaleDateString('pt-BR'), qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, fornecedor: forn, prazo: val('m_prazo_select'), status: "Não enviado", whatsEnviado: false, confirmado: false, finalizado: false });
    });
    salvarColecao('pedidos', pedidos); registrarAcao('📋', 'NOVO PEDIDO', `CÓDIGO: ${idDoc} | CLIENTE: ${cli}`);
    cestoItensTemporario = []; getEl('m_cliente').value = ""; renderCesto();
}

function gerarEmailLote() {
    const checks = document.querySelectorAll('.ped-check:checked');
    if (!checks.length) return alert("Nenhum pedido selecionado!");

    const uids = Array.from(checks).map(function(c) { return c.value; });
    const sel = pedidos.filter(function(p) { return uids.includes(String(p.uid)); }).sort(compararPedidosCrescente);
    const fab = sel[0].fornecedor || "NÃO INFORMADA";

    let txt = `Olá, segue pedido para fábrica ${fab}:\n\n`;

    sel.forEach(function(p) {
        let prd = p.produto;
        if(p.medida && p.medida!=="-") prd += ` | Medida: ${p.medida}`;
        if(p.cor && p.cor!=="-") prd += ` | Cor: ${p.cor}`;
        txt += `Qtde: ${String(p.qtd).padStart(2, '0')} - ${prd}\n`;
        txt += `REF: ID# ${String(p.idDoc||'').replace('ID#','').trim()}\n\n`;
    });

    txt += `Forma de pagamento: 30/60/90.\n\n`;
    txt += `IDs para controle interno, favor desconsiderar.\n\n`;
    txt += `Favor confirmar o recebimento e nos enviar o documento de confirmação dos itens acima para conferência.\n\n`;
    txt += `Atenciosamente,\nLucas Mercier..`;

    navigator.clipboard.writeText(txt).then(function() {
        if (confirm("✅ Texto gerado com as exigências!\nDeseja alterar o status dos pedidos para 'Pedido enviado'?")) {
            sel.forEach(function(p) { if(p.status === "Não enviado") p.status = "Pedido enviado"; });
            salvarColecao('pedidos', pedidos); registrarAcao('📧', 'ENVIOU LOTE', `Marcou ${sel.length} pedidos como enviados.`);
            if(getEl('check-todos')) getEl('check-todos').checked = false; renderPedidos();
        }
    }).catch(function() { alert("Falha ao copiar automaticamente."); });
}

// =========================================================
// 7. ABA TAREFAS / VENDAS
// =========================================================
function processarFichaWhatsApp(tx) {
    if(!tx) return; const m = function(r){ return tx.match(r); };
    const mN=m(/Nome(?: Completo)?\s*[:\-]?\s*(.+)/i), mCp=m(/CPF\s*[:\-]?\s*([\d\.\-]+)/i), mCe=m(/CEP\s*[:\-]?\s*([\d\.\-]+)/i), mE=m(/Endere[çc]o\s*[:\-]?\s*(.+)/i), mC1=m(/(?:^|\n)\s*Contato(?: 1)?\s*[:\-]?\s*(.+)/i), mC2=m(/(?:^|\n)\s*Contato\s*2\s*[:\-]?\s*(.+)/i), mNu=m(/(?:^|\n)\s*N(?:[°ºoúu]mero)?\s*[:\-]?\s*([A-Za-z0-9]+)/i), mO=m(/(?:OBS|OBSERVA[CÇ][AÃ]O)(?:ES)?\s*[:\-]?\s*([\s\S]+)/i), mP=m(/Previs[ãa]o(?: de Entrega)?\s*[:\-]?\s*([\d]{2}\/[\d]{2}\/[\d]{4})/i);

    if(mN) getEl('t_nome').value = mN[1].trim().toUpperCase();
    if(mE) getEl('t_end').value = mE[1].trim().toUpperCase();
    if(mC1) getEl('t_contato').value = mC1[1].trim().toUpperCase();
    if(mC2) getEl('t_contato2').value = mC2[1].trim().toUpperCase();
    if(mNu) getEl('t_num').value = mNu[1].trim().toUpperCase();
    if(mO) getEl('t_obs').value = mO[1].trim().toUpperCase();

    if(mCp) { getEl('t_cpf').value = mCp[1].trim(); maskCPF(getEl('t_cpf')); }
    if(mCe) { getEl('t_cep').value = mCe[1].trim(); buscarCEP(getEl('t_cep')); }
    if(mP) { let ps = mP[1].split('/'); if(ps.length===3) getEl('t_previsao').value = `${ps[2]}-${ps[1]}-${ps[0]}`; }
}

function mostrarCamposTarefa(t){
    const c=getEl('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`
        <div class="col-span-1 md:col-span-4 mb-2 bg-indigo-50 p-4 rounded-xl border-2 border-dashed border-indigo-300 w-full"><label class="text-[10px] font-black text-indigo-800 uppercase mb-2 block">✨ Cole a ficha do WhatsApp aqui:</label><textarea id="t_magic_box" oninput="processarFichaWhatsApp(this.value)" placeholder="Ficha de Cadastro..." class="w-full border p-3 rounded-lg text-xs font-bold outline-indigo-500 h-24 resize-none shadow-inner"></textarea></div>
        <input id="t_nome" placeholder="CLIENTE" class="border-2 p-2 rounded-lg text-xs font-bold md:col-span-2 w-full uppercase outline-indigo-500">
        <input id="t_cpf" placeholder="CPF" class="border-2 p-2 rounded-lg text-xs font-bold w-full outline-indigo-500" oninput="maskCPF(this)">
        <input id="t_contato" placeholder="CONTATO 1" class="border-2 p-2 rounded-lg text-xs font-bold w-full outline-indigo-500">
        <input id="t_contato2" placeholder="CONTATO 2" class="border-2 p-2 rounded-lg text-xs font-bold w-full outline-indigo-500">
        <input id="t_cep" placeholder="CEP" class="border-2 p-2 rounded-lg text-xs font-bold w-full outline-indigo-500" oninput="buscarCEP(this)">
        <input id="t_end" placeholder="RUA" class="border-2 p-2 rounded-lg text-xs font-bold md:col-span-2 w-full uppercase outline-indigo-500">
        <input id="t_bairro" placeholder="BAIRRO" class="border-2 p-2 rounded-lg text-xs font-bold w-full uppercase outline-indigo-500">
        <input id="t_cidade" placeholder="CIDADE" class="border-2 p-2 rounded-lg text-xs font-bold w-full uppercase outline-indigo-500">
        <input id="t_num" placeholder="NÚMERO" class="border-2 p-2 rounded-lg text-xs font-bold w-full outline-indigo-500">
        <input id="t_torre" placeholder="TORRE" class="border-2 p-2 rounded-lg text-xs font-bold w-full uppercase outline-indigo-500">
        <div class="md:col-span-2 flex flex-col justify-center"><label class="text-[9px] font-black text-slate-400 uppercase mb-1">Previsão Entrega *</label><input type="date" id="t_previsao" class="border-2 p-2 rounded-lg text-xs font-bold w-full outline-indigo-500 bg-white"></div>
        <div class="col-span-1 md:col-span-4 border-t mt-4 pt-4 w-full"><div id="lista-produtos-tarefa" class="flex flex-col gap-2 w-full"></div><button onclick="addProdutoLinha()" class="text-[10px] font-black text-blue-600 mt-2 uppercase hover:underline">+ MÓVEL</button><div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-xs mt-1 uppercase italic">Total: R$ 0,00</div></div>
        <div class="col-span-1 md:col-span-4 border-t mt-4 pt-4 w-full"><div id="lista-pagamentos-tarefa" class="flex flex-col gap-2 w-full"></div><button onclick="addPagamentoLinha()" class="text-[10px] font-black text-emerald-600 mt-2 uppercase hover:underline">+ PAGAMENTO</button></div>
        <textarea id="t_obs" placeholder="OBSERVAÇÕES DO PEDIDO..." class="col-span-1 md:col-span-4 border-2 p-2 rounded-lg text-xs font-bold h-16 uppercase mt-2 w-full outline-indigo-500"></textarea>`;
        addProdutoLinha(); addPagamentoLinha();
    } else {
        c.innerHTML=`<input id="t_raw" placeholder="DESCRICAO..." class="border-2 p-2 rounded-lg text-xs font-bold col-span-4 uppercase w-full outline-indigo-500">`;
    }
}

function addProdutoLinha(){
    const d = getEl('lista-produtos-tarefa'); const r = document.createElement('div'); r.className = "flex flex-col md:flex-row gap-2 mb-2 items-start md:items-center row-prod bg-slate-50 p-3 rounded-lg border w-full";
    r.innerHTML = `<div class="flex justify-between w-full md:flex-1 gap-2"><input class="t-p-nome border-2 p-2 rounded text-xs font-bold flex-1 uppercase outline-indigo-500" placeholder="MÓVEL"><button onclick="this.parentElement.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-3 py-1 md:hidden bg-red-100 rounded-lg">✕</button></div><div class="flex w-full md:w-auto gap-2"><input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-1/2 md:w-28 outline-indigo-500" placeholder="ORIGINAL" oninput="maskMoney(this)"><input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-1/2 md:w-28 text-indigo-600 outline-indigo-500" placeholder="DESCONTO" oninput="maskMoney(this)"><button onclick="this.parentElement.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-2 hidden md:block">✕</button></div>`;
    d.appendChild(r);
}

function addPagamentoLinha(){
    const d = getEl('lista-pagamentos-tarefa'); let t=0, p=0; document.querySelectorAll('.t-v-desc').forEach(function(i){t+=parseMoney(i.value);}); document.querySelectorAll('.t-p-val').forEach(function(i){p+=parseMoney(i.value);});
    let s=t-p; if(s<0) s=0; const r = document.createElement('div'); r.className="flex flex-col bg-slate-50 p-3 rounded-lg border mb-3 row-pag w-full gap-2";
    r.innerHTML=`<div class="flex gap-2 mb-1 flex-wrap w-full"><button onclick="setP(this,'PIX')" class="btn-pag-opt active flex-1 md:flex-none text-center px-1 py-2 text-[10px]">PIX</button><button onclick="setP(this,'CRÉDITO')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">CRÉDITO</button><button onclick="setP(this,'DÉBITO')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">DÉBITO</button><button onclick="setP(this,'CHEQUE')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">CHEQUE</button><input type="hidden" class="t-p-tipo" value="PIX"><select class="t-p-parc hidden border-2 p-1 rounded text-[10px] font-bold bg-white w-full md:w-auto outline-emerald-500">${[...Array(12).keys()].map(function(n){ return `<option value="${n+1}x">${n+1}x</option>`; }).join('')}</select></div><div class="flex flex-col md:flex-row gap-2 w-full"><input class="t-p-val border-2 p-2 rounded-lg text-xs font-bold w-full md:w-48 text-emerald-600 outline-emerald-500" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${s.toLocaleString('pt-BR',{minimumFractionDigits:2})}"><div class="flex w-full gap-2 md:flex-1"><input class="t-p-obs border-2 p-2 rounded-lg text-xs font-bold flex-1 uppercase outline-emerald-500" placeholder="OBS/DATA"><button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-red-500 font-black px-3 py-1 bg-red-100 md:bg-transparent rounded-lg">✕</button></div></div>`;
    d.appendChild(r);
}

function setP(b,v){ const p=b.parentElement; p.querySelectorAll('button').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); p.querySelector('.t-p-tipo').value=v; const s=p.querySelector('.t-p-parc'); if(v==='CRÉDITO') s.classList.remove('hidden'); else s.classList.add('hidden'); }
function calcTotalTirarPedido(){ let t=0; document.querySelectorAll('.t-v-desc').forEach(function(i){t+=parseMoney(i.value);}); getEl('total-pedido-tarefa').innerText = "Total: R$ "+t.toLocaleString('pt-BR',{minimumFractionDigits:2}); }

function cadastrarTarefa(){
    const t=val('t_tipo'); let obj = { uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), tipo:t, status:"Não Iniciado" };
    if(t==='TIRAR PEDIDO'){
        const cli=val('t_nome'), pv=getEl('t_previsao')?val('t_previsao'):"";
        if(!cli) return alert("FALTA NOME!"); if(!pv) return alert("FALTA PREVISÃO!");
        let tot=0; document.querySelectorAll('.t-v-desc').forEach(function(i){tot+=parseMoney(i.value);});
        obj.descricao="PEDIDO: "+cli.toUpperCase();
        obj.detalhes={cliente:cli.toUpperCase(), cpf:val('t_cpf'), contato:val('t_contato'), contato2:val('t_contato2'), cep:val('t_cep'), end:val('t_end'), bairro:val('t_bairro'), cidade:val('t_cidade'), num:val('t_num'), torre:val('t_torre'), obs:val('t_obs'), previsao:pv.split('-').reverse().join('/'), totalDesc:"R$ "+tot.toLocaleString('pt-BR',{minimumFractionDigits:2}), produtos:[], pagamentos:[]};
        document.querySelectorAll('.row-prod').forEach(function(r){ if(r.querySelector('.t-p-nome').value) obj.detalhes.produtos.push({n:r.querySelector('.t-p-nome').value.toUpperCase(), o:r.querySelector('.t-v-orig').value, d:r.querySelector('.t-v-desc').value}); });
        document.querySelectorAll('.row-pag').forEach(function(r){ const tp=r.querySelector('.t-p-tipo').value, pc=(tp==='CRÉDITO')?r.querySelector('.t-p-parc').value:""; obj.detalhes.pagamentos.push({t:tp+(pc?" "+pc:""), v:r.querySelector('.t-p-val').value, o:r.querySelector('.t-p-obs').value.toUpperCase()}); });
    } else {
        obj.descricao = val('t_raw').toUpperCase();
    }
    if(!obj.descricao) return; tarefas.unshift(obj); salvarColecao('tarefas', tarefas); registrarAcao('📝', 'NOVA TAREFA', obj.descricao); mostrarCamposTarefa(t); renderTarefas();
}

function renderTarefas() {
    const tb=getEl('tabelaTarefas'); if(!tb) return;
    const f=val('filtro-tarefa-status'); let lst=(f==='TODAS')?tarefas:tarefas.filter(function(x){return x.status===f;});
    tb.innerHTML=lst.map(function(x){ return `<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>${esc(x.data)}</td><td class="font-black text-xs uppercase">${esc(x.descricao)}</td><td class="text-[10px] uppercase">${esc(x.tipo)}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${esc(x.status)}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(function(y){return y.uid!=${x.uid}}); salvarColecao('tarefas', tarefas);}" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>`; }).join('');
}

function cycleTarefaStatus(u){ const x = tarefas.find(function(y){ return y.uid == u; }); const s = ["Não Iniciado","Em Andamento","Feito"]; x.status = s[(s.indexOf(x.status)+1)%s.length]; salvarColecao('tarefas', tarefas); renderTarefas(); }

function verDetalhesTarefa(uid){
    const t = tarefas.find(function(x){ return x.uid == uid; }); if(!t) return;
    getEl('modal-detalhes').style.display='flex'; const c = getEl('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML = `<div class="font-black uppercase">${esc(t.descricao)}</div>`; return; }
    const d=t.detalhes; let eC=`${d.end||''}${d.num?', '+d.num:''}${d.torre?' - '+d.torre:''}${d.bairro?' - '+d.bairro:''}${d.cidade?' - '+d.cidade:''}`;
    let h=`<div class="grid grid-cols-2 gap-2">${l_i("CLIENTE", d.cliente)}${l_i("PREVISÃO", d.previsao||"NÃO INFORMADA")}${l_i("CPF", d.cpf)}${l_i("CONTATO 1", d.contato)}${l_i("CONTATO 2", d.contato2||"-")}${l_i("CEP", d.cep)}${l_i("ENDEREÇO", eC)}</div><div class="mt-4 font-black text-xs uppercase border-b text-blue-600">Móveis:</div>`;
    safeArray(d.produtos).forEach(function(p){ h+=`<div class="text-xs font-bold border-b py-1 flex justify-between items-center"><span>${esc(p.n)} <span class="text-slate-400 line-through text-[10px] ml-1">${esc(p.o)}</span> <span class="text-indigo-600 ml-1">${esc(p.d)}</span></span><button onclick="copyText('${esc(p.n)} - De: ${esc(p.o)} Por: ${esc(p.d)}', this)">📋</button></div>`; });
    h+=`<div class="mt-4 font-black text-xs uppercase border-b text-emerald-600">Pagamento:</div>`;
    safeArray(d.pagamentos).forEach(function(p){ h+=`<div class="text-xs font-bold border-b py-1 flex justify-between"><span>${esc(p.t)}: ${esc(p.v)} (${esc(p.o)})</span><button onclick="copyText('${esc(p.t)}: ${esc(p.v)}', this)">📋</button></div>`; });
    if(d.obs) h+=`<div class="mt-4 font-black text-xs uppercase border-b text-orange-600">Observações:</div><div class="text-xs font-bold py-2 bg-slate-50 p-2 rounded mt-1">${esc(d.obs)}</div>`;
    c.innerHTML=h;
}
function l_i(l, v){ return `<div class="border p-2 rounded text-[10px] font-bold uppercase flex justify-between"><span>${l}: ${esc(v)}</span><button onclick="copyText('${esc(v)}', this)">📋</button></div>`; }

// =========================================================
// 8. ABA EQUIPE / KANBAN
// =========================================================
function renderFiltrosEquipe() {
    const d = getEl('filtros-equipe'); if(!d) return;
    if(modoMinhasTarefas){ d.style.opacity='0.3'; d.style.pointerEvents='none'; } else { d.style.opacity='1'; d.style.pointerEvents='auto'; }
    let ht=`<button onclick="toggleFiltroEquipe('TODOS')" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition border-2 ${filtrosEquipeAtivos.length===0?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}">🌟 TODOS</button>`;
    Object.keys(coresEquipe).forEach(function(n) {
        const cA = coresEquipe[n].split(' ')[1]; const iA = filtrosEquipeAtivos.includes(n);
        ht += `<button onclick="toggleFiltroEquipe('${n}')" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition border-2 ${iA?`${coresEquipe[n]} border-transparent shadow-sm`:`bg-white ${cA} border-slate-200 hover:border-slate-300`}">${n}</button>`;
    });
    d.innerHTML = ht;
}

function toggleFiltroEquipe(n) {
    if(n==='TODOS') filtrosEquipeAtivos=[];
    else { if(filtrosEquipeAtivos.includes(n)) filtrosEquipeAtivos=filtrosEquipeAtivos.filter(function(x){return x!==n;}); else filtrosEquipeAtivos.push(n); }
    renderFiltrosEquipe(); renderQuadroEquipe();
}

function toggleColunaKanban(c) { colsMinimizadas[c] = !colsMinimizadas[c]; renderQuadroEquipe(); }

function renderQuadroEquipe() {
    ['TODO','DOING','DONE'].forEach(function(c) {
        const ct=getEl('col-'+c.toLowerCase()+'-container'), el=getEl('col-'+c.toLowerCase()), bt=getEl('btn-toggle-'+c.toLowerCase());
        if(ct&&el&&bt){
            if(colsMinimizadas[c]){ ct.classList.remove('min-h-[500px]'); ct.classList.add('h-fit','pb-0'); el.classList.add('hidden'); bt.innerText='➕'; }
            else { ct.classList.add('min-h-[500px]'); ct.classList.remove('h-fit','pb-0'); el.classList.remove('hidden'); bt.innerText='➖'; }
        }
    });

    let htmlTodo = "", htmlDoing = "", htmlDone = "";
    let countTodo = 0, countDoing = 0, countDone = 0;

    const pP = {"AGORA":1, "IMEDIATO":2, "IMPORTANTE":3, "REGULAR":4, "TRANQUILO":5, "":6};
    let ord = [...tarefasEquipe].sort(function(a,b) { let pA=pP[a.prazo||""]||6, pB=pP[b.prazo||""]||6; return pA!==pB ? pA-pB : b.uid-a.uid; });

    ord.forEach(function(t) {
        if(modoMinhasTarefas&&usuarioAtual&&t.responsavel!==usuarioAtual) return;
        if(!modoMinhasTarefas&&filtrosEquipeAtivos.length>0&&!filtrosEquipeAtivos.includes(t.responsavel)) return;

        const c = coresEquipe[t.responsavel]||"bg-slate-100 text-slate-700 border-slate-300"; const cB = c.split(' ')[2];
        let cH = safeArray(t.comentarios).map(function(cm) {
            const cC=coresEquipe[cm.autor]?coresEquipe[cm.autor].split(' ')[1]:"text-slate-600";
            const aH=cm.anexo?`<br><img src="${cm.anexo}" class="mt-2 rounded-lg max-h-40 w-full cursor-pointer object-cover border" onclick="window.open('${cm.anexo}')"/>`:'';
            return `<div class="mb-2 bg-white p-2 rounded-md border shadow-sm"><span class="${cC} font-black text-[9px] uppercase">${esc(cm.autor)}:</span> <span class="text-[10px] font-bold text-slate-700">${esc(cm.texto)}</span>${aH}</div>`;
        }).join('');

        const iM = t.minimizada||false;

        let bdg = '';
        const mP = {"AGORA":"bg-red-100 text-red-700 🚨 AGORA","IMEDIATO":"bg-orange-100 text-orange-700 ⚡ 1 DIA","IMPORTANTE":"bg-amber-100 text-amber-700 ⚠️ 2 DIAS","REGULAR":"bg-blue-100 text-blue-700 📅 3 DIAS","TRANQUILO":"bg-emerald-100 text-emerald-700 ☕ + DIAS"};
        if(mP[t.prazo]) { let pts = mP[t.prazo].split(' '); bdg = `<span class="${pts[0]} ${pts[1]} px-2 py-0.5 rounded text-[9px] font-black uppercase shadow-sm border">${pts[2]} ${pts[3]||''} ${pts[4]||''}</span>`; }

        let bDs = `<button onclick="minimizarTarefaEquipe(${t.uid})" class="text-slate-400 font-black text-[12px] bg-slate-100 px-2 py-1 rounded-lg">${iM?'➕':'➖'}</button>`;
        if(t.coluna==='TODO') bDs += `<button onclick="moverTarefaEquipe(${t.uid},'DOING')" class="text-slate-300 hover:text-blue-500 font-black px-1">➡️</button>`;
        if(t.coluna==='DOING') bDs += `<button onclick="moverTarefaEquipe(${t.uid},'TODO')" class="text-slate-300 hover:text-slate-500 font-black px-1">⬅️</button><button onclick="moverTarefaEquipe(${t.uid},'DONE')" class="text-slate-300 hover:text-green-500 font-black px-1">✅</button>`;
        if(t.coluna==='DONE') bDs += `<button onclick="moverTarefaEquipe(${t.uid},'DOING')" class="text-slate-300 hover:text-slate-500 font-black px-1">⬅️</button>`;
        bDs += `<button onclick="excluirTarefaEquipe(${t.uid})" class="text-slate-200 hover:text-red-500 font-black px-1">✕</button>`;

        let cd = `
        <div id="card-${t.uid}" draggable="true" ondragstart="dragTarefa(event,${t.uid})" ondragend="dragEndTarefa(event)" class="bg-white p-3.5 rounded-2xl shadow-sm border-t-4 ${cB} flex flex-col gap-2 relative overflow-hidden">
            <div class="flex justify-between items-start">
                <div class="flex flex-col gap-1 items-start"><span class="${c} px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">${esc(t.responsavel)}</span>${bdg}</div>
                <div class="flex gap-1 items-center">${bDs}</div>
            </div>`;

        if(!iM) {
            cd += `
            <span class="text-sm font-black text-slate-800 mt-1 uppercase leading-snug">${esc(t.descricao)}</span>
            <span class="text-[8px] font-black text-slate-300 border-b pb-2">Criado em: ${t.data}</span>
            <div class="mt-1 flex flex-col gap-1.5">
                ${cH?`<div id="chat-${t.uid}" class="bg-slate-50 p-2 rounded-lg max-h-48 overflow-y-auto custom-scrollbar shadow-inner">${cH}</div>`:''}
                <div class="flex gap-1 mt-1 items-center">
                    <input type="text" placeholder="Responder..." onkeydown="if(event.key==='Enter') adicionarComentarioInline(${t.uid}, this)" class="flex-1 bg-white border p-2 text-[10px] font-bold rounded-xl outline-blue-500 uppercase">
                    <button onclick="acionarUploadImagem(${t.uid})" class="bg-slate-100 px-2 rounded-xl text-[12px] border h-full">📎</button>
                    <button onclick="adicionarComentarioInline(${t.uid}, this.previousElementSibling.previousElementSibling)" class="bg-blue-100 text-blue-600 px-3 rounded-xl text-[12px] h-full">➤</button>
                </div>
            </div>`;
        } else {
            cd += `<span class="text-[11px] font-black text-slate-800 truncate border-t pt-2 uppercase">${esc(t.descricao)}</span>`;
        }
        cd += `</div>`;

        if(t.coluna==='TODO') { htmlTodo+=cd; countTodo++; }
        else if(t.coluna==='DOING') { htmlDoing+=cd; countDoing++; }
        else if(t.coluna==='DONE') { htmlDone+=cd; countDone++; }
    });

    if(getEl('col-todo')) getEl('col-todo').innerHTML = htmlTodo || '<span class="text-[10px] text-center mt-6 uppercase text-slate-400 font-bold">Limpo 🎉</span>';
    if(getEl('col-doing')) getEl('col-doing').innerHTML = htmlDoing || '<span class="text-[10px] text-center mt-6 uppercase text-slate-400 font-bold">Nada</span>';
    if(getEl('col-done')) getEl('col-done').innerHTML = htmlDone || '<span class="text-[10px] text-center mt-6 uppercase text-slate-400 font-bold">Nada</span>';

    if(getEl('count-todo')) getEl('count-todo').innerText = countTodo;
    if(getEl('count-doing')) getEl('count-doing').innerText = countDoing;
    if(getEl('count-done')) getEl('count-done').innerText = countDone;

    tarefasEquipe.forEach(function(t) { const cx=getEl('chat-'+t.uid); if(cx) cx.scrollTop=cx.scrollHeight; });
}

function adicionarTarefaEquipe() {
    const d=val('eq_desc').toUpperCase().trim(), r=val('eq_resp'), p=val('eq_prazo');
    if(!d) return alert("Digite a tarefa!");
    const nT = {uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), descricao:d, responsavel:r, prazo:p, coluna:"TODO", comentarios:[], minimizada:false};
    tarefasEquipe.push(nT); salvarColecao('tarefasEquipe', tarefasEquipe); registrarAcao('📌', 'CRIOU TAREFA', `PARA: ${r}`);
    getEl('eq_desc').value=""; renderQuadroEquipe(); setTimeout(function(){notificarNoGrupoComPrint(nT,'NOVA');}, 300);
}

function moverTarefaEquipe(uid, nC) {
    const t=tarefasEquipe.find(function(x){return x.uid==uid;});
    if(t && t.coluna!==nC) { t.coluna=nC; salvarColecao('tarefasEquipe', tarefasEquipe); renderQuadroEquipe(); if(nC==='DONE') setTimeout(function(){notificarNoGrupoComPrint(t,'CONCLUIDA');},300); }
}

function excluirTarefaEquipe(uid) { if(confirm("EXCLUIR TAREFA?")) { tarefasEquipe = tarefasEquipe.filter(function(x){return x.uid!=uid;}); salvarColecao('tarefasEquipe', tarefasEquipe); } }
function minimizarTarefaEquipe(uid) { const t=tarefasEquipe.find(function(x){return x.uid==uid;}); if(t) { t.minimizada = !t.minimizada; salvarColecao('tarefasEquipe', tarefasEquipe); renderQuadroEquipe(); } }
function dragTarefa(ev, uid) { ev.dataTransfer.setData("text/plain", uid); setTimeout(function(){ev.target.classList.add('opacity-40');}, 10); }
function dragEndTarefa(ev) { ev.target.classList.remove('opacity-40'); }
function allowDropTarefa(ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; }
function dropTarefa(ev, col) { ev.preventDefault(); const uid=ev.dataTransfer.getData("text/plain"); if(uid) moverTarefaEquipe(uid, col); }

async function notificarNoGrupoComPrint(t, tp) {
    const q = usuarioAtual||"Equipe", l = `${window.location.href.split('?')[0]}?tarefa=${t.uid}`;
    let m = tp==='NOVA'?`📢 *NOVA TAREFA*\nPara: *${t.responsavel}*\nPor: ${q}\n\n📌 *${t.descricao}*\n🔗 ${l}`:`✅ *CONCLUÍDA*\nPor: *${q}*\n\n📌 *${t.descricao}*\n🔗 ${l}`;
    if(confirm("Deseja abrir WhatsApp e tentar COPIAR A IMAGEM do cartão?")) {
        if(t.minimizada) minimizarTarefaEquipe(t.uid);
        const cE = getEl('card-'+t.uid);
        if(cE && typeof html2canvas!=='undefined') {
            try {
                const cv = await html2canvas(cE, {scale:2, backgroundColor:null});
                cv.toBlob(async function(b) {
                    try { if(typeof ClipboardItem!=='undefined') { await navigator.clipboard.write([new ClipboardItem({"image/png":b})]); alert("📸 FOTO COPIADA!"); } } catch(e){}
                    window.open(`https://wa.me/?text=${encodeURIComponent(m)}`,'_blank');
                }, "image/png");
                return;
            } catch(e){}
        } window.open(`https://wa.me/?text=${encodeURIComponent(m)}`,'_blank');
    }
}

let uidUploadPendente = null;
function acionarUploadImagem(uid) { if(!usuarioAtual) return alert("Identifique-se primeiro!"); uidUploadPendente = uid; getEl('file-upload-global').click(); }
function processarUploadImagem(e) {
    const f = e.target.files[0]; if(!f||!uidUploadPendente) return;
    const t = tarefasEquipe.find(function(x){return x.uid==uidUploadPendente;}); if(!t) return;
    const r = new FileReader();
    r.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
            const cv = document.createElement('canvas'); const MW = 800, MH = 800; let w = img.width, h = img.height;
            if(w>h) { if(w>MW) { h*=MW/w; w=MW; } } else { if(h>MH) { w*=MH/h; h=MH; } }
            cv.width = w; cv.height = h; const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h); const b64 = cv.toDataURL('image/jpeg', 0.6);
            t.comentarios = safeArray(t.comentarios); const a = new Date();
            t.comentarios.push({ id:Date.now(), autor:usuarioAtual, texto:"📷 FOTO ANEXADA", anexo:b64, dataHora:a.toLocaleDateString('pt-BR')+' '+a.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) });
            salvarColecao('tarefasEquipe', tarefasEquipe); renderQuadroEquipe(); e.target.value = "";
        }; img.src = ev.target.result;
    }; r.readAsDataURL(f);
}
function adicionarComentarioInline(uid, i) {
    if(!usuarioAtual) return alert("Identifique-se!"); const x = i.value.trim().toUpperCase(); if(!x) return;
    const t = tarefasEquipe.find(function(y){return y.uid==uid;}); if(!t) return;
    t.comentarios = safeArray(t.comentarios); const a = new Date();
    t.comentarios.push({ id:Date.now(), autor:usuarioAtual, texto:x, dataHora:a.toLocaleDateString('pt-BR')+' '+a.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) });
    salvarColecao('tarefasEquipe', tarefasEquipe); i.value = "";
    setTimeout(function() { const c = getEl('chat-'+uid); if(c) c.scrollTop = c.scrollHeight; }, 100);
}

// =========================================================
// 10. ABA LOGÍSTICA & AGENDA (UNIFICADA)
// =========================================================
function processarEventosCalendario() {
    eventosDoMes = {};
    const cE = getEl('filtro-cal-entregas'); const mostraEnt = cE ? cE.checked : true;
    const cL = getEl('filtro-cal-lembretes'); const mostraLem = cL ? cL.checked : true;
    const cP = getEl('filtro-cal-prazos'); const mostraPrz = cP ? cP.checked : true;

    if(mostraEnt) {
        entregas.forEach(function(e) {
            if(!e.dataOrdem) return;
            if(!eventosDoMes[e.dataOrdem]) eventosDoMes[e.dataOrdem]=[];
            eventosDoMes[e.dataOrdem].push({ tipo:'ENTREGA', obj:e, cor: e.status==='Entregue'?'bg-emerald-200 text-emerald-800 opacity-60 line-through border-emerald-300':'bg-emerald-500 text-white border-emerald-600', icone:'🚚', titulo:e.cliente });
        });
    }

    if(mostraLem) {
        lembretes.forEach(function(l) {
            if(!l.dataOrdem) return;
            if(!eventosDoMes[l.dataOrdem]) eventosDoMes[l.dataOrdem]=[];
            const cM={"GERAL":"bg-yellow-400 text-yellow-900","FINANCEIRO":"bg-emerald-400 text-emerald-900","FABRICA":"bg-blue-400 text-blue-900","CLIENTE":"bg-pink-400 text-pink-900"};
            const iM={"GERAL":"🔔","FINANCEIRO":"💰","FABRICA":"🏭","CLIENTE":"❤️"};
            eventosDoMes[l.dataOrdem].push({ tipo:'LEMBRETE', obj:l, cor:l.concluido?'bg-slate-200 text-slate-500 opacity-60 line-through':cM[l.categoria], icone:iM[l.categoria], titulo:l.titulo });
        });
    }

    if(mostraPrz) {
        pedidos.forEach(function(p) {
            if(p.finalizado || p.status==="Entregue/Finalizado") return;
            const dP = calcDataExata(p.dataPedido, p.prazo);
            if(dP){
                if(!eventosDoMes[dP]) eventosDoMes[dP]=[];
                eventosDoMes[dP].push({ tipo:'PRAZO', obj:p, cor:'bg-blue-100 text-blue-800 border-blue-200', icone:'📋', titulo:`Prazo: ${p.cliente}` });
            }
        });
    }
    renderCalendario(); renderPainelDia();
}

function renderCalendario() {
    const a = dataAtualCalendario.getFullYear(), m = dataAtualCalendario.getMonth();
    const nm = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    getEl('mes-ano-display').innerText = `${nm[m]} ${a}`;

    const pD = new Date(a, m, 1).getDay(), dM = new Date(a, m+1, 0).getDate();
    let html = "";
    for (let i=0; i<pD; i++) html += `<div class="border-b border-r border-slate-200 bg-slate-50 opacity-40 min-h-[80px]"></div>`;

    const hj = hojeLocal();

    for (let d=1; d<=dM; d++) {
        const dK = `${a}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let eH = "";
        if(eventosDoMes[dK]) {
            eventosDoMes[dK].slice(0,3).forEach(function(ev) {
                eH += `<div class="${ev.cor} text-[8px] font-black truncate px-1 rounded shadow-sm mb-0.5 leading-tight py-0.5" title="${esc(ev.titulo)}">${ev.icone} ${esc(ev.titulo)}</div>`;
            });
            if(eventosDoMes[dK].length>3) eH += `<div class="text-[8px] font-black text-slate-400 text-center">+${eventosDoMes[dK].length-3} itens</div>`;
        }

        let cClass = (dK===hj) ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600';
        let bClass = (dK===dataSelecionadaLogistica) ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-slate-50';

        html += `<div onclick="selecionarDiaLogistica('${dK}', '${d} de ${nm[m]}')" class="border-b border-r border-slate-200 p-1.5 min-h-[80px] transition cursor-pointer flex flex-col gap-1 ${bClass}"><div class="flex justify-end"><span class="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${cClass}">${d}</span></div><div class="flex-1 overflow-hidden flex flex-col gap-0.5">${eH}</div></div>`;
    }
    const grid = getEl('grid-dias'); if(grid) grid.innerHTML = html;
}

function mudarMes(dr) { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + dr); processarEventosCalendario(); }
function selecionarDiaLogistica(dK, dtF) { dataSelecionadaLogistica = dK; renderCalendario(); renderPainelDia(); }

function renderPainelDia() {
    const pn = getEl('lista-eventos-dia'); if(!pn) return;
    const dObj = new Date(dataSelecionadaLogistica+"T12:00:00");
    getEl('titulo-painel-dia').innerText = "Dia " + dObj.toLocaleDateString('pt-BR');

    let evs = eventosDoMes[dataSelecionadaLogistica] || [];
    evs.sort(function(a,b) {
        let pA = a.tipo==='ENTREGA'?1:(a.tipo==='LEMBRETE'?2:3);
        let pB = b.tipo==='ENTREGA'?1:(b.tipo==='LEMBRETE'?2:3);
        if(pA!==pB) return pA-pB;
        if(a.tipo==='ENTREGA' && b.tipo==='ENTREGA') return (a.obj.hora||"23:59").localeCompare(b.obj.hora||"23:59");
        return 0;
    });

    getEl('badge-qtd-dia').innerText = evs.length + (evs.length===1 ? " Item" : " Itens");
    if(evs.length===0) { pn.innerHTML = '<div class="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl"><span class="text-3xl block mb-2">🎈</span><span class="text-xs font-black text-slate-400 uppercase">Dia Livre!</span></div>'; return; }

    let html = "";
    evs.forEach(function(ev) {
        if(ev.tipo === 'ENTREGA') {
            const e = ev.obj;
            let cS = e.status==='Agendado' ? "bg-blue-100 text-blue-700 border-blue-200" : (e.status==='Em Rota' ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-emerald-100 text-emerald-700 border-emerald-200");
            let hB = e.hora ? `<span class="bg-emerald-600 text-white px-2 py-0.5 rounded shadow-sm text-[9px] font-black ml-2">🕒 ${e.hora}</span>` : '';
            let contHtml = e.contato ? `<p class="text-[9px] font-bold text-slate-500 uppercase mt-1">📞 ${esc(e.contato)}</p>` : '';

            html += `
            <div class="bg-white border-l-4 border-emerald-500 rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col ${e.status==='Entregue'?'opacity-60':''}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-black uppercase text-emerald-600 flex items-center">🚚 Entrega ${hB}</span>
                    <button onclick="cycleStatusEntrega(${e.uid})" class="${cS} border px-2 py-0.5 rounded text-[9px] font-black uppercase">${esc(e.status)}</button>
                </div>
                <h4 class="font-black text-sm uppercase text-slate-800 leading-tight">${esc(e.cliente)}</h4>
                ${contHtml}
                <p class="text-[9px] font-bold text-slate-500 uppercase mt-1 mb-2">📍 ${esc(e.endereco)}</p>
                <div class="bg-emerald-50 p-2 rounded border border-emerald-100 text-[10px] font-bold text-emerald-800 uppercase mb-3 leading-snug">${esc(e.produtos).replace(/\n/g,'<br>• ')}</div>
                <div class="flex justify-between items-center border-t border-slate-100 pt-3">
                    <button onclick="abrirGPS('${esc(e.endereco)}')" class="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 hover:bg-blue-100">🗺️ GPS</button>
                    <div class="flex gap-2">
                        <button onclick="abrirWhatsAppEntrega('${esc(e.cliente)}', '${esc(e.endereco)}', '${esc(e.produtos)}', '${esc(e.contato||"")}')" class="bg-green-50 text-green-600 p-1.5 rounded-lg hover:bg-green-100">💬</button>
                        <button onclick="editarEntrega(${e.uid})" class="bg-amber-50 text-amber-500 p-1.5 rounded-lg hover:bg-amber-100">✏️</button>
                        <button onclick="excluirEntrega(${e.uid})" class="bg-red-50 text-red-500 p-1.5 rounded-lg hover:bg-red-100">🗑️</button>
                    </div>
                </div>
            </div>`;
        } else if(ev.tipo === 'LEMBRETE') {
            const l = ev.obj;
            html += `
            <div class="bg-white border-l-4 border-amber-500 rounded-xl p-4 shadow-sm border border-slate-200 flex flex-col gap-2 ${l.concluido?'opacity-50':''}">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black uppercase text-amber-600">${ev.icone} Lembrete</span>
                    <button onclick="toggleConcluidoLembrete(${l.uid})" class="${l.concluido?'bg-slate-200 text-slate-500':'bg-green-100 text-green-700 border-green-200'} border px-2 py-0.5 rounded text-[9px] font-black uppercase">${l.concluido?'🔙':'✅ Feito'}</button>
                </div>
                <h4 class="font-black text-xs uppercase ${l.concluido?'line-through text-slate-400':'text-slate-800'}">${esc(l.titulo)}</h4>
                <div class="flex justify-end pt-1 mt-1 border-t border-slate-100"><button onclick="excluirLembrete(${l.uid})" class="text-red-400 hover:text-red-600 font-black text-xs">✕ Apagar</button></div>
            </div>`;
        } else {
            const p = ev.obj;
            html += `
            <div class="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-3 shadow-sm border border-blue-100">
                <span class="text-[9px] font-black uppercase text-blue-600 mb-1 block">📋 Vencimento de Prazo</span>
                <h4 class="font-black text-xs uppercase text-slate-800">${esc(p.cliente)}</h4>
                <p class="text-[9px] font-bold text-slate-500 uppercase mt-1">${p.qtd}x ${esc(p.produto)}</p>
            </div>`;
        }
    });
    pn.innerHTML = html;
}

function abrirModalNovaEntrega() {
    getEl('titulo-modal-entrega').innerText = "🚚 Agendar Entrega";
    getEl('ent_uid').value = ""; getEl('ent_data').value=dataSelecionadaLogistica; getEl('ent_hora').value=""; getEl('ent_contato').value=""; getEl('ent_cliente').value=""; getEl('ent_endereco').value=""; getEl('ent_produtos').value="";
    getEl('modal-nova-entrega').style.display='flex';
}

function editarEntrega(uid) {
    const e = entregas.find(function(x){ return x.uid == uid; }); if(!e) return;
    getEl('titulo-modal-entrega').innerText = "✏️ Editar Entrega"; getEl('ent_uid').value = e.uid; getEl('ent_data').value = e.dataOrdem; getEl('ent_hora').value = e.hora || ""; getEl('ent_cliente').value = e.cliente; getEl('ent_contato').value = e.contato || ""; getEl('ent_endereco').value = e.endereco; getEl('ent_produtos').value = e.produtos;
    getEl('modal-nova-entrega').style.display='flex';
}

function buscarDadosInteligentes() {
    const n = val('ent_cliente').toUpperCase().trim(); if(!n) return;
    const a = getEl('aviso-magico'); let f = false;
    const t = tarefas.find(function(x) { return x.detalhes && x.detalhes.cliente && x.detalhes.cliente.includes(n); });
    const eE = getEl('ent_endereco'); const eC = getEl('ent_contato');
    if(t) {
        if(!eE.value) { const num = t.detalhes.num?`, ${t.detalhes.num}`:''; const br = t.detalhes.bairro?` - ${t.detalhes.bairro}`:''; const cd = t.detalhes.cidade?` - ${t.detalhes.cidade}`:''; eE.value = `${t.detalhes.end}${num}${br}${cd}`.toUpperCase(); f = true; }
        if(!eC.value && t.detalhes.contato) { eC.value = t.detalhes.contato; f = true; }
    }
    const ps = pedidos.filter(function(p) { return p.cliente && p.cliente.includes(n) && !p.finalizado; });
    const eP = getEl('ent_produtos');
    if(ps.length>0 && !eP.value) { eP.value = ps.map(function(p) { return `${p.qtd}x ${p.produto} ${p.cor}`; }).join('\n').toUpperCase(); f = true; }
    if(f) { a.classList.remove('hidden'); setTimeout(function() { a.classList.add('hidden'); }, 3000); }
}

function salvarEntrega() {
    const uid = val('ent_uid'), d=val('ent_data'), h=val('ent_hora'), c=val('ent_cliente').toUpperCase().trim(), e=val('ent_endereco').toUpperCase().trim(), p=val('ent_produtos').toUpperCase().trim(), cont=val('ent_contato').toUpperCase().trim();
    if(!d||!c||!p) return alert("Preencha Data, Cliente e Produtos!");
    if(uid) {
        const it = entregas.find(function(x){ return x.uid == uid; });
        if(it) { it.dataOrdem = d; it.hora = h; it.cliente = c; it.endereco = e; it.produtos = p; it.contato = cont; }
    } else { entregas.push({ uid:Date.now(), dataOrdem:d, hora:h, cliente:c, contato:cont, endereco:e||"Não informado", produtos:p, status:"Agendado" }); }
    salvarColecao('entregas', entregas); fecharModaisLogistica(); processarEventosCalendario();
}

function cycleStatusEntrega(uid) { const t = entregas.find(function(x){ return x.uid == uid; }); if(t) { const s = ["Agendado", "Em Rota", "Entregue"]; t.status = s[(s.indexOf(t.status)+1)%s.length]; salvarColecao('entregas', entregas); processarEventosCalendario(); } }
function excluirEntrega(uid) { if(confirm("Deseja apagar esta entrega?")) { entregas = entregas.filter(function(x){ return x.uid != uid; }); salvarColecao('entregas', entregas); processarEventosCalendario(); } }
function abrirWhatsAppEntrega(c, e, p, tel) { const msg = `🚚 *Aviso de Entrega - Mercier Design*\n\nOlá ${c}! O seu pedido está a caminho.\n\n📦 *Itens:*\n${p}\n\n📍 *Endereço registrado:*\n${e}`; if(tel) { let telLimpo = tel.replace(/\D/g, ''); if(telLimpo.length === 10 || telLimpo.length === 11) telLimpo = "55" + telLimpo; window.open(`https://wa.me/${telLimpo}?text=${encodeURIComponent(msg)}`, '_blank'); } else { window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); } }
function abrirGPS(e) { if(!e || e==="NÃO INFORMADO") return alert("Sem endereço para rota."); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}`, '_blank'); }

function abrirModalNovoLembrete() { getEl('lem_data').value=dataSelecionadaLogistica; getEl('modal-novo-lembrete').style.display='flex'; }
function salvarLembrete() { const t=val('lem_titulo').toUpperCase().trim(), d=val('lem_data'), c=val('lem_categoria'); if(!t||!d) return alert("Preencha título e data!"); lembretes.push({ uid:Date.now(), titulo:t, dataOrdem:d, categoria:c, concluido:false }); salvarColecao('lembretes', lembretes); fecharModaisLogistica(); processarEventosCalendario(); }
function toggleConcluidoLembrete(uid) { const l = lembretes.find(function(x){ return x.uid == uid; }); if(l){ l.concluido=!l.concluido; salvarColecao('lembretes', lembretes); processarEventosCalendario(); } }
function excluirLembrete(uid) { if(confirm("Apagar lembrete?")) { lembretes = lembretes.filter(function(x){ return x.uid != uid; }); salvarColecao('lembretes', lembretes); processarEventosCalendario(); } }
function fecharModaisLogistica() { getEl('modal-nova-entrega').style.display='none'; getEl('modal-novo-lembrete').style.display='none'; getEl('ent_uid').value=""; getEl('ent_cliente').value=""; getEl('ent_endereco').value=""; getEl('ent_produtos').value=""; getEl('ent_hora').value=""; getEl('ent_contato').value=""; getEl('lem_titulo').value=""; }

// =========================================================
// 11. ABA: ESTOQUE (INTELIGENTE)
// =========================================================
function autoSalvarNotasEstoque() { notasEstoque = val('estoque-notas-gerais'); db.ref('dados/notasEstoque').set(notasEstoque); }

function mudarVisaoEstoque(v) {
    visaoEstoque = v; const bD = getEl('btn-estoque-disponivel'), bS = getEl('btn-estoque-saidas');
    if(v==='ESTOQUE') { bD.classList.add('border-green-500','text-green-600','bg-white'); bD.classList.remove('border-transparent','text-slate-400'); bS.classList.remove('border-green-500','text-green-600','bg-white'); bS.classList.add('border-transparent','text-slate-400'); }
    else { bS.classList.add('border-green-500','text-green-600','bg-white'); bS.classList.remove('border-transparent','text-slate-400'); bD.classList.remove('border-green-500','text-green-600','bg-white'); bD.classList.add('border-transparent','text-slate-400'); }
    renderEstoque();
}

function renderEstoque() {
    const tb = getEl('tabelaEstoque'); if(!tb) return;
    const b = noAcc(val('estoque-busca').toLowerCase()); const fF = val('estoque-filtro-fabrica')||"TODAS"; let tE=0, tV=0;

    let lst = estoque.filter(function(x) {
        const p=noAcc((x.produto||"").toLowerCase()), f=noAcc((x.fabrica||"").toLowerCase()), s=x.situacao||"ESTOQUE";
        if(s==='ESTOQUE') tE+=parseInt(x.qtd||0); else tV+=parseInt(x.qtd||0);
        return (p.includes(b)||f.includes(b))&&(fF==="TODAS"||x.fabrica===fF);
    });

    if(visaoEstoque==='ESTOQUE') lst=lst.filter(function(x){ return x.situacao==='ESTOQUE'; });
    else lst=lst.filter(function(x){ return x.situacao!=='ESTOQUE'; });

    if(getEl('resumo-estoque-total')) getEl('resumo-estoque-total').innerText = tE;
    if(getEl('resumo-estoque-vendidos')) getEl('resumo-estoque-vendidos').innerText = tV;

    let html = "";
    lst.forEach(function(x) {
        let sC="bg-green-100 text-green-700", tS="DISPONÍVEL";
        if(x.situacao==='VENDIDO'){ sC="bg-red-100 text-red-700"; tS="VENDIDO"; }
        else if(x.situacao==='ASSISTÊNCIA'){ sC="bg-orange-100 text-orange-700"; tS="ASSISTÊNCIA"; }
        else if(x.situacao==='DEVOLUÇÃO FÁBRICA'){ sC="bg-purple-100 text-purple-700"; tS="DEVOLVIDO"; }

        let btnAcao = x.situacao==='ESTOQUE' ? `<button onclick="abrirModalSaidaEstoque(${x.uid})" class="bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-[10px] shadow-sm">📉 Saída</button>` : '';
        html += `<tr class="border-b transition hover:bg-slate-50"><td class="text-[10px] text-slate-400">${esc(x.data)||'-'}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'estoque')" class="cursor-pointer uppercase font-bold">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'estoque')" class="cursor-pointer text-blue-600 text-[10px] font-black uppercase">${esc(x.fabrica)||"-"}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'estoque')" class="cursor-pointer text-center font-bold">${esc(x.qtd)}</td><td class="text-center"><span class="px-2 py-1 rounded text-[9px] font-black w-full inline-block ${sC}">${tS}</span></td><td class="text-center flex gap-1 justify-center">${btnAcao}<button onclick="if(confirm('EXCLUIR REGISTRO?')){estoque=estoque.filter(function(y){return y.uid!=${x.uid};}); salvarColecao('estoque', estoque);}" class="text-slate-300 hover:text-red-500 font-black px-2">✕</button></td></tr>`;
    });
    tb.innerHTML = html;
}

function abrirModalSaidaEstoque(uid) {
    const i = estoque.find(function(x){ return x.uid == uid; }); if(!i) return;
    getEl('saida-uid').value=uid; getEl('saida-produto-nome').innerText=i.produto; getEl('saida-qtd').value=i.qtd; getEl('saida-qtd').max=i.qtd; getEl('saida-obs').value=""; getEl('saida-motivo').value="VENDIDO"; getEl('modal-saida-estoque').style.display='flex';
}

function confirmarSaidaEstoque() {
    const uid=val('saida-uid'), qS=parseInt(val('saida-qtd')), m=val('saida-motivo'), o=val('saida-obs').toUpperCase().trim();
    const it = estoque.find(function(x){ return x.uid == uid; });
    if(!it||isNaN(qS)||qS<=0||qS>it.qtd) return alert("Quantidade inválida!");

    let nF = it.produto; if(o) nF+=` (${o})`;

    if(qS==it.qtd){ it.situacao=m; it.produto=nF; it.data=new Date().toLocaleDateString('pt-BR'); }
    else { it.qtd-=qS; estoque.unshift({ uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), produto:nF, fabrica:it.fabrica, qtd:qS, situacao:m }); }

    salvarColecao('estoque', estoque); registrarAcao('📉', `SAÍDA: ${m}`, `${qS}x ${it.produto}`); getEl('modal-saida-estoque').style.display='none';
}

function processarEstoqueMassa() {
    const txt = val('e_massa'); if(!txt||txt.trim()==="") return alert("Cole a lista na caixa mágica!");
    const lins = txt.split('\n'); let ad = 0;

    lins.forEach(function(l) {
        l=l.trim().replace(/^[\•\-\*]\s*/, ''); if(!l) return;
        let pts=l.split(/;| , /); let p1=pts[0]?pts[0].trim().toUpperCase():"", p2=pts[1]?pts[1].trim().toUpperCase():"", p3=pts[2]?pts[2].trim().toUpperCase():"";
        let q=1, pT=p1; let mQ=p1.match(/^(\d+)\s*(?:X|\-|UN|PÇ|MÓD)?\s+(.+)/i);
        if(mQ && parseInt(mQ[1])>0){ q=parseInt(mQ[1]); pT=mQ[2].trim(); }
        let f=p2, oS=p3, st="ESTOQUE";

        if(oS) {
            if(oS.includes("VENDID")){ st="VENDIDO"; let qm=oS.replace(/VENDID[AOOS]*\s*(PARA|P\/)?\s*/i, '').trim(); pT+=qm?" (VENDIDO: "+qm+")":" (VENDIDO)"; }
            else if(oS.includes("ASSIST")){ st="ASSISTÊNCIA"; pT+=" (ASSISTÊNCIA)"; }
            else if(oS.includes("DEVOL")){ st="DEVOLUÇÃO FÁBRICA"; pT+=" (DEVOLUÇÃO)"; }
            else pT+=" ("+oS+")";
        }

        if(pT) { estoque.unshift({uid:Date.now()+Math.random(), data:new Date().toLocaleDateString('pt-BR'), produto:pT, fabrica:f, qtd:q, situacao:st}); ad++; }
    });

    if(ad>0) { salvarColecao('estoque', estoque); registrarAcao('📦', 'CADASTRO EM MASSA', `${ad} itens.`); getEl('e_massa').value = ""; alert(`✅ ${ad} itens cadastrados!`); }
}

function cadastrarEstoque() {
    const p=val('e_produto').toUpperCase().trim(), f=val('e_fabrica_select'), q=val('e_qtd');
    if(p) { estoque.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), produto:p, fabrica:f, qtd:parseInt(q), situacao:'ESTOQUE'}); salvarColecao('estoque', estoque); registrarAcao('📦', 'ADICIONOU AO ESTOQUE', `${q}x ${p}`); getEl('e_produto').value = ""; }
}

// =========================================================
// 12. ASSISTÊNCIAS, FORNECEDORES E CATÁLOGO
// =========================================================
function renderAssistencias() {
    const tb=getEl('tabelaAssistencias'); if(!tb) return;
    const b=noAcc(val('busca-assistencia').toLowerCase()), f=val('filtro-assistencia-status')||"TODAS";

    let lst = assistencias.filter(function(x) {
        return (noAcc((x.cliente||"").toLowerCase()).includes(b)||noAcc((x.produto||"").toLowerCase()).includes(b)||noAcc((x.fabrica||"").toLowerCase()).includes(b))&&(f==="TODAS"||(x.status||"Aguardando")===f);
    });

    if(getEl('contador-assistencia')) getEl('contador-assistencia').innerText = lst.length + " ASSISTÊNCIAS";

    tb.innerHTML = lst.map(function(x) {
        let sC="bg-slate-200 text-slate-700"; if(x.status==="Aguardando") sC="bg-red-100 text-red-700"; else if(x.status==="Peça Solicitada") sC="bg-blue-100 text-blue-700"; else if(x.status==="Concluído") sC="bg-green-100 text-green-700";
        return `<tr class="border-b transition hover:bg-slate-50"><td class="text-[10px] font-bold text-slate-400">${esc(x.data)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'assistencias')" class="uppercase font-bold cursor-pointer">${esc(x.cliente)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'assistencias')" class="uppercase cursor-pointer">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'assistencias')" class="font-black text-blue-800 uppercase text-[10px] cursor-pointer">${esc(x.fabrica)}</td><td class="text-center"><button onclick="cycleAssisStatus(${x.uid})" class="px-2 py-1.5 rounded text-[9px] font-black w-full transition ${sC}">${esc(x.status)}</button></td><td class="text-center"><button onclick="if(confirm('EXCLUIR ASSISTÊNCIA?')){ assistencias=assistencias.filter(function(y){return y.uid!=${x.uid}}); salvarColecao('assistencias', assistencias); }" class="text-red-500 font-black text-lg">✕</button></td></tr>`;
    }).join('');
}

function cadastrarAssistencia(){
    const c=val('as_cliente').toUpperCase().trim(), p=val('as_produto').toUpperCase().trim(), f=val('as_fabrica');
    if(c&&p){ assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); salvarColecao('assistencias', assistencias); getEl('as_cliente').value=""; getEl('as_produto').value=""; }
    else alert("PREENCHA CLIENTE E PRODUTO!");
}

function cycleAssisStatus(u){ const x = assistencias.find(function(y){ return y.uid == u; }); const s = ["Aguardando","Peça Solicitada","Concluído"]; x.status = s[(s.indexOf(x.status||"Aguardando")+1)%s.length]; salvarColecao('assistencias', assistencias); renderAssistencias(); }

function renderFornecedores() { const tb=getEl('tabelaFornecedores'); if(!tb) return; tb.innerHTML=fornecedores.map(function(f,i){ return `<tr><td class="font-bold uppercase">${esc(f.nome)}</td><td class="lowercase text-blue-600">${esc(f.email)}</td><td class="text-center"><button onclick="fornecedores.splice(${i},1); salvarColecao('fornecedores', fornecedores);" class="text-red-500 font-black">✕</button></td></tr>`; }).join(''); }
function cadastrarFornecedor(){ const n=val('f_nome').toUpperCase().trim(), e=val('f_email').toLowerCase().trim(); if(n&&e){ fornecedores.push({nome:n,email:e}); salvarColecao('fornecedores', fornecedores); getEl('f_nome').value=""; getEl('f_email').value=""; } }
function renderCatalogo() { const tb=getEl('tabelaCatalogo'); if(!tb) return; tb.innerHTML=catalogo.map(function(c,i){ return `<tr><td class="uppercase">${esc(c.nome)}</td><td class="text-center"><button onclick="catalogo.splice(${i},1); salvarColecao('catalogo', catalogo);">✕</button></td></tr>`; }).join(''); }
function cadastrarCatalogo(){ const n=val('cat_nome').toUpperCase(); if(n){ catalogo.push({nome:n}); salvarColecao('catalogo', catalogo); getEl('cat_nome').value=""; } }
function atualizarSelectsFornecedores(){ const h = fornecedores.map(function(f){ return `<option value="${esc(f.nome)}">${esc(f.nome)}</option>`; }).join(''); if(getEl('m_fornecedor_select')) getEl('m_fornecedor_select').innerHTML=h||"<option>...</option>"; if(getEl('as_fabrica')) getEl('as_fabrica').innerHTML=h||"<option>...</option>"; if(getEl('e_fabrica_select')) getEl('e_fabrica_select').innerHTML=h||"<option>...</option>"; if(getEl('estoque-filtro-fabrica')) getEl('estoque-filtro-fabrica').innerHTML='<option value="TODAS">TODAS AS FÁBRICAS</option>'+h; }
function atualizarSugestoes(){ const n = [...new Set(pedidos.map(function(p){ return p.cliente; }))].sort(); if(getEl('listaSugestaoClientes')) getEl('listaSugestaoClientes').innerHTML=n.map(function(x){ return `<option value="${esc(x)}">`; }).join(''); }
function togglePainelSugestoes(){ const p=getEl('painel-sugestoes'); p.style.display=(p.style.display==='flex')?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=val('texto-melhorias'); db.ref('dados/notasMelhoria').set(notasMelhoria); }

const painelS = getEl('painel-sugestoes'); const dragH = getEl('drag-handle'); let isDrag=false, offX, offY;
if(dragH) dragH.addEventListener('mousedown', function(e) { isDrag=true; offX=e.clientX-painelS.getBoundingClientRect().left; offY=e.clientY-painelS.getBoundingClientRect().top; painelS.style.bottom='auto'; painelS.style.right='auto'; });
document.addEventListener('mousemove', function(e) { if(!isDrag) return; painelS.style.left=(e.clientX-offX)+'px'; painelS.style.top=(e.clientY-offY)+'px'; });
document.addEventListener('mouseup', function() { isDrag=false; });

// =========================================================
// A aba Hoje agora é montada pelo bloco EXTRAS (mdRenderHoje)
function renderHoje() {}


// =====================================================================
// EXTRAS — cole TUDO isto no FINAL do app.js (depois da última linha)
// =====================================================================
(function () {
  function boot(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  function hojeBR() { return new Date().toLocaleDateString('pt-BR'); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function norm(s) { return noAcc(String(s || '').toLowerCase()).replace(/\s+/g, ' ').trim(); }
  function tsBR(s) { const p = String(s || '').split('/'); return p.length === 3 ? new Date(p[2], p[1] - 1, p[0]).getTime() : 0; }
  function irAba(texto) {
    const alvo = norm(texto);
    const b = Array.from(document.querySelectorAll('nav button')).find(function (x) { return norm(x.textContent).includes(alvo); });
    if (b) b.click();
  }

  // ===================================================================
  // 1. PEDIDOS: mais novos em cima, mais antigos embaixo
  // ===================================================================
  function numPed(p) { return parseInt(String(p.idDoc || '').replace(/\D/g, ''), 10) || 0; }
  function ordenarPedidos(lst) {
    const pos = new Map(pedidos.map(function (p, i) { return [p, i]; }));
    return lst.slice().sort(function (a, b) {
      return (numPed(b) - numPed(a)) || ((pos.get(b) || 0) - (pos.get(a) || 0));
    });
  }
  const _renderPedidos = window.renderPedidos;
  window.renderPedidos = function () {
    const orig = pedidos;
    pedidos = ordenarPedidos(orig);
    try { _renderPedidos(); } finally { pedidos = orig; }
  };

  // ===================================================================
  // 2. TAREFAS: comentários
  // ===================================================================
  let tarefaAberta = null;
  function corAutor(a) { const c = coresEquipe[a]; return c ? c.split(' ').slice(0, 2).join(' ') : 'bg-slate-100 text-slate-700'; }

  function renderComentariosTarefa() {
    const box = getEl('tarefa-comentarios-box'); if (!box) return;
    const t = tarefas.find(function (x) { return x.uid == tarefaAberta; });
    if (!t) { box.innerHTML = ''; return; }
    const antigo = getEl('tarefa-coment-input');
    const txt = antigo ? antigo.value : '';
    const foco = antigo && document.activeElement === antigo;
    const lista = safeArray(t.comentarios);
    const itens = lista.map(function (c) {
      return '<div class="bg-slate-50 border rounded-lg p-2">' +
        '<div class="flex justify-between items-center mb-1"><span class="' + corAutor(c.autor) + ' px-2 py-0.5 rounded text-[9px] font-black uppercase">' + esc(c.autor) + '</span>' +
        '<span class="text-[9px] font-bold text-slate-400">' + esc(c.dataHora) + ' <button data-cdel="' + esc(c.id) + '" class="text-red-400 hover:text-red-600 font-black ml-1">✕</button></span></div>' +
        '<div class="text-xs font-bold text-slate-700 whitespace-pre-wrap">' + esc(c.texto) + '</div></div>';
    }).join('');
    box.innerHTML =
      '<div class="text-xs font-black uppercase text-indigo-600 mb-2">💬 Comentários (' + lista.length + ')</div>' +
      '<div id="tarefa-coment-lista" class="flex flex-col gap-2 max-h-56 overflow-y-auto mb-3">' +
      (itens || '<div class="text-[10px] font-bold text-slate-400 uppercase text-center py-3">Nenhum comentário ainda.</div>') + '</div>' +
      '<div class="flex gap-2"><input id="tarefa-coment-input" placeholder="Escreva um comentário..." class="flex-1 border-2 p-2 rounded-lg text-xs font-bold outline-indigo-500">' +
      '<button id="tarefa-coment-btn" class="bg-indigo-600 text-white px-4 rounded-lg text-xs font-black">Enviar</button></div>';
    const inp = getEl('tarefa-coment-input');
    inp.value = txt; if (foco) inp.focus();
    inp.onkeydown = function (e) { if (e.key === 'Enter') enviarComentarioTarefa(); };
    getEl('tarefa-coment-btn').onclick = enviarComentarioTarefa;
    box.querySelectorAll('[data-cdel]').forEach(function (b) { b.onclick = function () { apagarComentarioTarefa(b.dataset.cdel); }; });
    const l = getEl('tarefa-coment-lista'); if (l) l.scrollTop = l.scrollHeight;
  }

  function enviarComentarioTarefa() {
    if (!usuarioAtual) return alert('Identifique-se no topo (quem é você) para comentar!');
    const inp = getEl('tarefa-coment-input'); if (!inp) return;
    const texto = inp.value.trim(); if (!texto) return;
    const t = tarefas.find(function (x) { return x.uid == tarefaAberta; }); if (!t) return;
    t.comentarios = safeArray(t.comentarios);
    const a = new Date();
    t.comentarios.push({ id: Date.now(), autor: usuarioAtual, texto: texto, dataHora: a.toLocaleDateString('pt-BR') + ' ' + a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    inp.value = '';
    salvarColecao('tarefas', tarefas);
    registrarAcao('💬', 'COMENTOU NA TAREFA', t.descricao || '');
    renderComentariosTarefa(); window.renderTarefas();
  }

  function apagarComentarioTarefa(id) {
    if (!confirm('Apagar este comentário?')) return;
    const t = tarefas.find(function (x) { return x.uid == tarefaAberta; }); if (!t) return;
    t.comentarios = safeArray(t.comentarios).filter(function (c) { return String(c.id) !== String(id); });
    salvarColecao('tarefas', tarefas);
    renderComentariosTarefa(); window.renderTarefas();
  }

  const _verDet = window.verDetalhesTarefa;
  window.verDetalhesTarefa = function (uid) {
    _verDet(uid);
    if (!tarefas.find(function (x) { return x.uid == uid; })) return;
    tarefaAberta = uid;
    const c = getEl('detalhe-corpo'); if (!c) return;
    const box = document.createElement('div');
    box.id = 'tarefa-comentarios-box';
    box.className = 'mt-5 border-t-2 border-slate-200 pt-4';
    c.appendChild(box);
    renderComentariosTarefa();
  };

  window.excluirTarefaSimples = function (uid) {
    if (confirm('Excluir?')) { tarefas = tarefas.filter(function (y) { return y.uid != uid; }); salvarColecao('tarefas', tarefas); }
  };

  window.renderTarefas = function () {
    const tb = getEl('tabelaTarefas'); if (!tb) return;
    const f = val('filtro-tarefa-status');
    const lst = (!f || f === 'TODAS') ? tarefas : tarefas.filter(function (x) { return x.status === f; });
    tb.innerHTML = lst.map(function (x) {
      const n = safeArray(x.comentarios).length;
      const badge = n ? '<span class="ml-2 bg-indigo-100 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full text-[9px] font-black">💬 ' + n + '</span>' : '';
      return '<tr onclick="verDetalhesTarefa(' + x.uid + ')" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>' + esc(x.data) + '</td><td class="font-black text-xs uppercase">' + esc(x.descricao) + badge + '</td><td class="text-[10px] uppercase">' + esc(x.tipo) + '</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(' + x.uid + ')" class="status-badge bg-slate-100">' + esc(x.status) + '</button></td><td class="text-center"><button onclick="event.stopPropagation(); excluirTarefaSimples(' + x.uid + ')" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>';
    }).join('');
    if (tarefaAberta && getEl('tarefa-comentarios-box')) renderComentariosTarefa();
  };

  // ===================================================================
  // 3. ESTOQUE (reformulado)
  // ===================================================================
  const E = { busca: '', fabrica: 'TODAS', visao: 'ESTOQUE', motivo: 'TODOS', parados: false, fechados: {} };
  let estRoot = null;

  function sit(x) { return x.situacao || 'ESTOQUE'; }
  function nomeFab(x) { return (x.fabrica && x.fabrica !== '-') ? x.fabrica : 'SEM FÁBRICA'; }
  function qtdDe(x) { return parseInt(x.qtd) || 0; }
  function diasEstoque(x) {
    const t = tsBR(x.data); if (!t) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
  }
  function chave(p, f) { return norm(p) + '|' + norm(f); }
  function porNome(a, b) { return String(a).localeCompare(String(b), 'pt-BR'); }

  function montarEstoque() {
    const ref = getEl('tabelaEstoque');
    const main = getEl('view-estoque') || (ref ? ref.closest('main') : null);
    if (!main) return false;
    const inp = 'border-2 p-2 rounded-lg text-xs font-bold outline-none focus:border-green-500 bg-white';
    main.innerHTML =
      '<div class="w-full max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-4">' +
      '<div id="est-resumo" class="grid grid-cols-2 md:grid-cols-4 gap-3"></div>' +
      '<div id="est-alertas" class="flex flex-col gap-2"></div>' +
      '<div class="card-premium p-4 md:p-5">' +
        '<h3 class="text-xs font-black uppercase text-slate-500 mb-3">➕ Entrada rápida</h3>' +
        '<div class="grid grid-cols-2 md:grid-cols-12 gap-2">' +
          '<input id="est-a-prod" list="est-dl-prod" placeholder="PRODUTO / MODELO" class="col-span-2 md:col-span-4 uppercase ' + inp + '">' +
          '<select id="est-a-fab" class="col-span-2 md:col-span-3 ' + inp + '"></select>' +
          '<input id="est-a-qtd" type="number" min="1" value="1" class="md:col-span-1 ' + inp + '">' +
          '<input id="est-a-obs" placeholder="LOCAL / OBS (opcional)" class="md:col-span-2 uppercase ' + inp + '">' +
          '<button data-act="add" class="col-span-2 md:col-span-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-black uppercase py-2">Adicionar</button>' +
        '</div>' +
        '<datalist id="est-dl-prod"></datalist><datalist id="est-dl-cli"></datalist>' +
        '<details class="mt-3"><summary class="cursor-pointer text-[10px] font-black uppercase text-indigo-600">✨ Cadastro em massa (colar lista)</summary>' +
          '<p class="text-[10px] text-slate-500 font-bold mt-2">Uma linha por item: PRODUTO ; FÁBRICA ; OBS. No lugar da obs pode usar VENDIDO, ASSISTÊNCIA ou DEVOLUÇÃO. Ex: 2x SOFÁ ROMA ; ESTOFADOS X ; MOSTRUÁRIO</p>' +
          '<textarea id="est-massa" class="w-full border-2 border-dashed border-indigo-300 rounded-lg p-3 text-xs font-bold h-28 mt-2 outline-indigo-500"></textarea>' +
          '<button data-act="massa" class="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-[11px] font-black uppercase">⚡ Processar lista</button>' +
        '</details>' +
      '</div>' +
      '<div class="card-premium p-4 md:p-5">' +
        '<div class="flex flex-wrap gap-2 items-center mb-4">' +
          '<button data-act="visao" data-v="ESTOQUE" id="est-v-estoque"></button>' +
          '<button data-act="visao" data-v="SAIDAS" id="est-v-saidas"></button>' +
          '<input id="est-busca" placeholder="🔍 Buscar produto, fábrica, cliente..." class="flex-1 min-w-[180px] ' + inp + '">' +
          '<select id="est-f-fab" class="' + inp + '"></select>' +
          '<select id="est-f-motivo" class="hidden ' + inp + '"><option value="TODOS">TODOS OS MOTIVOS</option><option value="VENDIDO">VENDIDOS</option><option value="ASSISTÊNCIA">ASSISTÊNCIA</option><option value="DEVOLUÇÃO FÁBRICA">DEVOLVIDOS</option></select>' +
          '<label id="est-l-parados" class="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 cursor-pointer"><input type="checkbox" id="est-parados"> Parados +90d</label>' +
          '<button data-act="copiar" class="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg text-[10px] font-black uppercase">📋 Copiar lista</button>' +
        '</div>' +
        '<div id="est-lista"></div>' +
      '</div>' +
      '<details class="card-premium p-4"><summary class="cursor-pointer text-xs font-black uppercase text-slate-500">📝 Notas do estoque</summary>' +
        '<textarea id="estoque-notas-gerais" oninput="autoSalvarNotasEstoque()" class="w-full border-2 rounded-lg p-3 text-xs font-bold h-32 mt-3 outline-blue-500" placeholder="Anotações gerais sobre o estoque..."></textarea>' +
      '</details>' +
      '</div>';
    estRoot = main;
    main.addEventListener('click', onClickEstoque);
    getEl('est-busca').addEventListener('input', function (e) { E.busca = e.target.value; renderLista(); });
    getEl('est-f-fab').addEventListener('change', function (e) { E.fabrica = e.target.value; renderLista(); });
    getEl('est-f-motivo').addEventListener('change', function (e) { E.motivo = e.target.value; renderLista(); });
    getEl('est-parados').addEventListener('change', function (e) { E.parados = e.target.checked; renderLista(); });
    try {
      db.ref('dados/notasEstoque').once('value', function (s) {
        const ta = getEl('estoque-notas-gerais');
        if (ta && s.val() && !ta.value) ta.value = s.val();
      });
    } catch (e) {}
    return true;
  }

  function atualizarSelects() {
    const nomesForn = fornecedores.map(function (f) { return f.nome; }).filter(Boolean);
    const todas = Array.from(new Set(nomesForn.concat(estoque.map(nomeFab)))).sort(porNome);
    const fa = getEl('est-a-fab'), antA = fa.value;
    fa.innerHTML = '<option value="">SEM FÁBRICA</option>' + nomesForn.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
    if (antA) fa.value = antA;
    const ff = getEl('est-f-fab');
    ff.innerHTML = '<option value="TODAS">TODAS AS FÁBRICAS</option>' + todas.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
    if (todas.indexOf(E.fabrica) < 0) E.fabrica = 'TODAS';
    ff.value = E.fabrica;
    const prods = Array.from(new Set(catalogo.map(function (c) { return c.nome; }).concat(estoque.filter(function (x) { return sit(x) === 'ESTOQUE'; }).map(function (x) { return x.produto; })))).filter(Boolean).sort(porNome);
    getEl('est-dl-prod').innerHTML = prods.map(function (p) { return '<option value="' + esc(p) + '">'; }).join('');
    getEl('est-dl-cli').innerHTML = Array.from(new Set(pedidos.map(function (p) { return p.cliente; }))).filter(Boolean).sort(porNome).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    const nEst = estoque.filter(function (x) { return sit(x) === 'ESTOQUE'; }).length;
    const bE = getEl('est-v-estoque'), bS = getEl('est-v-saidas');
    const on = 'px-4 py-2 rounded-lg text-[11px] font-black uppercase bg-slate-800 text-white';
    const off = 'px-4 py-2 rounded-lg text-[11px] font-black uppercase bg-slate-100 text-slate-500 hover:bg-slate-200';
    bE.className = E.visao === 'ESTOQUE' ? on : off; bS.className = E.visao === 'SAIDAS' ? on : off;
    bE.textContent = '🟢 Em estoque (' + nEst + ')'; bS.textContent = '🔴 Saídas (' + (estoque.length - nEst) + ')';
    getEl('est-f-motivo').classList.toggle('hidden', E.visao !== 'SAIDAS');
    getEl('est-l-parados').classList.toggle('hidden', E.visao !== 'ESTOQUE');
    getEl('est-parados').checked = E.parados;
  }

  function renderResumo() {
    const disp = estoque.filter(function (x) { return sit(x) === 'ESTOQUE'; });
    const pecas = disp.reduce(function (s, x) { return s + qtdDe(x); }, 0);
    const parados = disp.filter(function (x) { return diasEstoque(x) >= 90; }).length;
    const agora = new Date(), mes = agora.getMonth() + 1, ano = agora.getFullYear();
    const saidasMes = estoque.filter(function (x) {
      if (sit(x) === 'ESTOQUE') return false;
      const d = String(x.dataSaida || x.data || '').split('/');
      return Number(d[1]) === mes && Number(d[2]) === ano;
    }).reduce(function (s, x) { return s + qtdDe(x); }, 0);
    const card = function (t, v, c, sub) {
      return '<div class="card-premium p-4"><div class="text-[9px] font-black uppercase text-slate-400">' + t + '</div><div class="text-3xl font-black ' + c + '">' + v + '</div><div class="text-[9px] font-bold text-slate-400 uppercase mt-1">' + sub + '</div></div>';
    };
    getEl('est-resumo').innerHTML =
      card('Peças disponíveis', pecas, 'text-green-600', 'no estoque agora') +
      card('Modelos diferentes', disp.length, 'text-blue-600', 'itens cadastrados') +
      card('Parados +90 dias', parados, parados ? 'text-red-600' : 'text-slate-300', 'precisam de atenção') +
      card('Saídas no mês', saidasMes, 'text-orange-600', 'peças que saíram');
  }

  function casa(a, b) {
    const x = norm(a), y = norm(b); if (!x || !y) return false;
    if (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))) return true;
    const par = x.length <= y.length ? [x, y] : [y, x];
    const toks = par[0].split(' ').filter(function (t) { return t.length >= 3; });
    return toks.length >= 2 && toks.every(function (t) { return par[1].includes(t); });
  }

  function renderAlertas() {
    const disp = estoque.filter(function (x) { return sit(x) === 'ESTOQUE' && qtdDe(x) > 0; });
    const achados = [];
    pedidos.filter(function (p) { return !p.finalizado && p.status !== 'Entregue/Finalizado' && p.status !== 'Pedido na loja'; }).forEach(function (p) {
      const it = disp.find(function (x) { return casa(x.produto, p.produto); });
      if (it) achados.push({ p: p, it: it });
    });
    let html = '';
    if (achados.length) {
      html += '<div class="bg-amber-50 border-2 border-amber-300 rounded-xl p-3"><div class="text-[10px] font-black uppercase text-amber-700 mb-2">💡 Pode sair do estoque (' + achados.length + ')</div>' +
        achados.slice(0, 5).map(function (a) {
          return '<div class="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700 py-1"><span><b class="uppercase">' + esc(a.p.cliente) + '</b> pediu <b class="uppercase">' + esc(a.p.produto) + '</b> e há ' + qtdDe(a.it) + ' em estoque (' + esc(nomeFab(a.it)) + ')</span>' +
            '<button data-act="alerta" data-uid="' + a.it.uid + '" data-cli="' + esc(a.p.cliente) + '" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap">Dar saída</button></div>';
        }).join('') + (achados.length > 5 ? '<div class="text-[9px] font-black text-amber-600 uppercase mt-1">+ ' + (achados.length - 5) + ' outros</div>' : '') + '</div>';
    }
    const parados = disp.filter(function (x) { return diasEstoque(x) >= 90; }).length;
    if (parados) {
      html += '<div class="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-center justify-between gap-2"><span class="text-[11px] font-black uppercase text-red-700">⏳ ' + parados + ' modelo(s) parado(s) há mais de 90 dias</span><button data-act="parados" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase">Ver</button></div>';
    }
    getEl('est-alertas').innerHTML = html;
  }

  function filtrar() {
    const b = norm(E.busca);
    return estoque.filter(function (x) {
      const s = sit(x);
      if (E.visao === 'ESTOQUE' ? s !== 'ESTOQUE' : s === 'ESTOQUE') return false;
      if (E.fabrica !== 'TODAS' && nomeFab(x) !== E.fabrica) return false;
      if (E.visao === 'SAIDAS' && E.motivo !== 'TODOS' && s !== E.motivo) return false;
      if (E.parados && (E.visao !== 'ESTOQUE' || diasEstoque(x) < 90)) return false;
      if (b && !norm([x.produto, x.fabrica, x.obs, x.cliente, x.obsSaida].join(' ')).includes(b)) return false;
      return true;
    });
  }

  function renderLista() {
    const box = getEl('est-lista'); if (!box) return;
    const lst = filtrar();
    if (!lst.length) { box.innerHTML = '<div class="text-center p-10 border-2 border-dashed border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-400">Nada encontrado.</div>'; return; }
    const mini = 'w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-sm';
    let html = '';
    if (E.visao === 'ESTOQUE') {
      const grupos = {};
      lst.forEach(function (x) { const g = nomeFab(x); (grupos[g] = grupos[g] || []).push(x); });
      Object.keys(grupos).sort(porNome).forEach(function (g) {
        const itens = grupos[g].sort(function (a, b) { return porNome(a.produto, b.produto); });
        const pecas = itens.reduce(function (s, x) { return s + qtdDe(x); }, 0);
        const fechado = !!E.fechados[g];
        html += '<div class="mb-4"><button data-act="grupo" data-g="' + esc(g) + '" class="w-full flex justify-between items-center bg-slate-800 text-white rounded-lg px-4 py-2 mb-1"><span class="font-black text-xs uppercase">🏭 ' + esc(g) + '</span><span class="text-[10px] font-bold">' + pecas + ' peças · ' + itens.length + ' modelos ' + (fechado ? '▸' : '▾') + '</span></button>';
        if (!fechado) {
          itens.forEach(function (x) {
            const d = diasEstoque(x);
            const cor = d >= 90 ? 'bg-red-100 text-red-700' : (d >= 30 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700');
            html += '<div class="flex items-center gap-2 py-2 px-2 border-b border-slate-100 hover:bg-slate-50">' +
              '<div class="flex-1 min-w-0"><div data-edit="produto" data-uid="' + x.uid + '" class="font-black text-xs uppercase cursor-pointer hover:text-blue-600">' + esc(x.produto) + '</div>' +
              '<div data-edit="obs" data-uid="' + x.uid + '" class="text-[10px] font-bold uppercase cursor-pointer ' + (x.obs ? 'text-slate-500' : 'text-slate-300') + ' hover:text-blue-600">' + (x.obs ? esc(x.obs) : '+ local / obs') + '</div></div>' +
              '<span title="Entrada em ' + esc(x.data || '-') + '" class="px-2 py-1 rounded text-[9px] font-black ' + cor + '">' + d + 'd</span>' +
              '<div class="flex items-center gap-1"><button data-act="menos" data-uid="' + x.uid + '" class="' + mini + '">−</button><span class="font-black text-sm w-7 text-center">' + qtdDe(x) + '</span><button data-act="mais" data-uid="' + x.uid + '" class="' + mini + '">+</button></div>' +
              '<button data-act="saida" data-uid="' + x.uid + '" class="bg-slate-100 hover:bg-orange-100 px-2 py-1 rounded-lg text-[10px] font-black">📉 Saída</button>' +
              '<button data-act="del" data-uid="' + x.uid + '" class="text-slate-300 hover:text-red-500 font-black px-1">✕</button></div>';
          });
        }
        html += '</div>';
      });
    } else {
      const cores = { 'VENDIDO': ['bg-red-100 text-red-700', 'VENDIDO'], 'ASSISTÊNCIA': ['bg-orange-100 text-orange-700', 'ASSISTÊNCIA'], 'DEVOLUÇÃO FÁBRICA': ['bg-purple-100 text-purple-700', 'DEVOLVIDO'] };
      lst.slice().sort(function (a, b) { return tsBR(b.dataSaida || b.data) - tsBR(a.dataSaida || a.data); }).forEach(function (x) {
        const c = cores[sit(x)] || ['bg-slate-100 text-slate-600', sit(x)];
        const detalhe = [nomeFab(x), x.cliente, x.obsSaida].filter(Boolean).join(' · ');
        html += '<div class="flex flex-wrap items-center gap-2 py-2 px-2 border-b border-slate-100 hover:bg-slate-50">' +
          '<span class="text-[10px] font-bold text-slate-400 w-20">' + esc(x.dataSaida || x.data || '-') + '</span>' +
          '<div class="flex-1 min-w-0"><div class="font-black text-xs uppercase">' + esc(x.produto) + '</div><div class="text-[10px] font-bold uppercase text-slate-500">' + esc(detalhe) + '</div></div>' +
          '<span class="font-black text-xs">' + qtdDe(x) + 'x</span>' +
          '<span class="px-2 py-1 rounded text-[9px] font-black ' + c[0] + '">' + c[1] + '</span>' +
          '<button data-act="voltar" data-uid="' + x.uid + '" title="Voltar ao estoque" class="bg-slate-100 hover:bg-green-100 px-2 py-1 rounded-lg text-[10px] font-black">↩ Voltar</button>' +
          '<button data-act="del" data-uid="' + x.uid + '" class="text-slate-300 hover:text-red-500 font-black px-1">✕</button></div>';
      });
    }
    box.innerHTML = html;
  }

  function entrada(p, f, q, o) {
    const k = chave(p, f);
    const ex = estoque.find(function (x) { return sit(x) === 'ESTOQUE' && chave(x.produto, x.fabrica) === k; });
    if (ex) { ex.qtd = qtdDe(ex) + q; if (o && !ex.obs) ex.obs = o; return ex; }
    const n = { uid: Date.now() + Math.random(), data: hojeBR(), produto: p, fabrica: f || '', qtd: q, situacao: 'ESTOQUE', obs: o || '', cliente: '', dataSaida: '', obsSaida: '' };
    estoque.unshift(n); return n;
  }

  function adicionarUnitario() {
    const p = val('est-a-prod').toUpperCase().trim(), f = val('est-a-fab'), q = parseInt(val('est-a-qtd')) || 1, o = val('est-a-obs').toUpperCase().trim();
    if (!p) return alert('Informe o produto!');
    entrada(p, f, q, o);
    salvarColecao('estoque', estoque);
    registrarAcao('📦', 'ENTRADA NO ESTOQUE', q + 'x ' + p);
    getEl('est-a-prod').value = ''; getEl('est-a-qtd').value = 1; getEl('est-a-obs').value = '';
    window.renderEstoque();
    getEl('est-a-prod').focus();
  }

  function processarMassa() {
    const txt = val('est-massa'); if (!txt.trim()) return alert('Cole a lista primeiro!');
    let n = 0;
    txt.split('\n').forEach(function (l) {
      l = l.trim().replace(/^[•\-*]\s*/, ''); if (!l) return;
      const pts = l.split(/;| , /).map(function (s) { return s.trim().toUpperCase(); });
      let prod = pts[0] || '', fab = pts[1] || '', extra = pts[2] || '', q = 1;
      const m = prod.match(/^(\d+)\s*(?:X|\-|UN|PÇ|PC)?\s+(.+)/i);
      if (m && parseInt(m[1]) > 0) { q = parseInt(m[1]); prod = m[2].trim(); }
      if (!prod) return;
      const fm = fornecedores.find(function (x) { return norm(fab) && (norm(x.nome) === norm(fab) || norm(x.nome).includes(norm(fab))); });
      if (fm) fab = fm.nome;
      let st = 'ESTOQUE', obs = extra, cli = '';
      if (extra.includes('VENDID')) { st = 'VENDIDO'; cli = extra.replace(/VENDID[AO]S?\s*(PARA|P\/)?\s*/i, '').trim(); obs = ''; }
      else if (extra.includes('ASSIST')) { st = 'ASSISTÊNCIA'; obs = ''; }
      else if (extra.includes('DEVOL')) { st = 'DEVOLUÇÃO FÁBRICA'; obs = ''; }
      if (st === 'ESTOQUE') entrada(prod, fab, q, obs);
      else estoque.unshift({ uid: Date.now() + Math.random(), data: hojeBR(), dataSaida: hojeBR(), produto: prod, fabrica: fab, qtd: q, situacao: st, obs: '', cliente: cli, obsSaida: '' });
      n++;
    });
    if (!n) return alert('Nenhuma linha válida encontrada.');
    salvarColecao('estoque', estoque);
    registrarAcao('📦', 'CADASTRO EM MASSA', n + ' itens.');
    getEl('est-massa').value = '';
    alert('✅ ' + n + ' itens processados!');
    window.renderEstoque();
  }

  function abrirSaida(it, cliente) {
    let m = getEl('est-modal-saida');
    if (!m) { m = document.createElement('div'); m.id = 'est-modal-saida'; m.className = 'modal-overlay'; document.body.appendChild(m); }
    const campo = 'w-full border-2 p-2 rounded-lg text-xs font-bold outline-blue-500';
    const lab = 'text-[10px] font-black uppercase text-slate-400';
    m.innerHTML =
      '<div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-2">' +
      '<div class="flex justify-between items-start"><h3 class="font-black uppercase text-sm text-slate-800">📉 Dar saída do estoque</h3><button id="est-s-x" class="text-slate-400 font-black">✕</button></div>' +
      '<div class="bg-slate-50 border rounded-lg p-3 text-xs font-black uppercase text-slate-700">' + esc(it.produto) + ' <span class="text-slate-400">· ' + esc(nomeFab(it)) + ' · ' + qtdDe(it) + ' disponível</span></div>' +
      '<label class="' + lab + '">Quantidade</label><input id="est-s-qtd" type="number" min="1" max="' + qtdDe(it) + '" value="' + qtdDe(it) + '" class="' + campo + '">' +
      '<label class="' + lab + '">Motivo</label><select id="est-s-motivo" class="' + campo + ' bg-white"><option value="VENDIDO">🛒 Vendido (cliente)</option><option value="ASSISTÊNCIA">🛠️ Assistência / troca</option><option value="DEVOLUÇÃO FÁBRICA">🏭 Devolução p/ fábrica</option></select>' +
      '<label class="' + lab + '">Cliente / destino</label><input id="est-s-cli" list="est-dl-cli" value="' + esc(cliente) + '" class="' + campo + ' uppercase">' +
      '<label class="' + lab + '">Observação (opcional)</label><input id="est-s-obs" class="' + campo + ' uppercase">' +
      '<div class="flex gap-2 mt-3"><button id="est-s-cancel" class="flex-1 bg-slate-100 py-2 rounded-lg text-[11px] font-black uppercase">Cancelar</button><button id="est-s-ok" class="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-[11px] font-black uppercase">Confirmar saída</button></div></div>';
    m.style.display = 'flex';
    const fechar = function () { m.style.display = 'none'; };
    getEl('est-s-x').onclick = fechar; getEl('est-s-cancel').onclick = fechar;
    getEl('est-s-ok').onclick = function () {
      const alvo = estoque.find(function (x) { return x.uid == it.uid; }); if (!alvo) return fechar();
      const q = parseInt(val('est-s-qtd'));
      if (isNaN(q) || q < 1 || q > qtdDe(alvo)) return alert('Quantidade inválida!');
      const motivo = val('est-s-motivo'), cli = val('est-s-cli').toUpperCase().trim(), obs = val('est-s-obs').toUpperCase().trim();
      if (q >= qtdDe(alvo)) { alvo.situacao = motivo; alvo.cliente = cli; alvo.obsSaida = obs; alvo.dataSaida = hojeBR(); }
      else {
        alvo.qtd = qtdDe(alvo) - q;
        estoque.unshift({ uid: Date.now() + Math.random(), data: alvo.data || hojeBR(), dataSaida: hojeBR(), produto: alvo.produto, fabrica: alvo.fabrica || '', qtd: q, situacao: motivo, obs: alvo.obs || '', cliente: cli, obsSaida: obs });
      }
      salvarColecao('estoque', estoque);
      registrarAcao('📉', 'SAÍDA: ' + motivo, q + 'x ' + alvo.produto + (cli ? ' | ' + cli : ''));
      fechar(); window.renderEstoque();
    };
  }

  function voltarAoEstoque(it) {
    if (!confirm('Devolver este item ao estoque?')) return;
    it.situacao = 'ESTOQUE'; it.cliente = ''; it.obsSaida = ''; it.dataSaida = '';
    const k = chave(it.produto, it.fabrica);
    const ex = estoque.find(function (x) { return x !== it && sit(x) === 'ESTOQUE' && chave(x.produto, x.fabrica) === k; });
    if (ex) { ex.qtd = qtdDe(ex) + qtdDe(it); estoque = estoque.filter(function (x) { return x !== it; }); }
    salvarColecao('estoque', estoque);
    registrarAcao('🔙', 'VOLTOU AO ESTOQUE', it.produto);
    window.renderEstoque();
  }

  function editarInline(el) {
    const uid = el.dataset.uid, campo = el.dataset.edit;
    const it = estoque.find(function (x) { return x.uid == uid; }); if (!it) return;
    const i = document.createElement('input');
    i.value = it[campo] || '';
    i.className = 'w-full border-2 border-blue-500 rounded p-1 text-xs font-bold uppercase outline-none';
    el.replaceWith(i); i.focus(); i.select();
    let feito = false;
    const fim = function (salvar) {
      if (feito) return; feito = true;
      if (salvar) {
        const v = i.value.toUpperCase().trim();
        if (!(campo === 'produto' && !v)) { it[campo] = v; salvarColecao('estoque', estoque); }
      }
      window.renderEstoque();
    };
    i.onblur = function () { fim(true); };
    i.onkeydown = function (e) { if (e.key === 'Enter') fim(true); if (e.key === 'Escape') fim(false); };
  }

  function copiarLista() {
    const disp = estoque.filter(function (x) { return sit(x) === 'ESTOQUE'; });
    if (!disp.length) return alert('Estoque vazio.');
    const g = {};
    disp.forEach(function (x) { const f = nomeFab(x); (g[f] = g[f] || []).push(x); });
    let t = '📦 ESTOQUE MERCIER DESIGN - ' + hojeBR() + '\n';
    Object.keys(g).sort(porNome).forEach(function (f) {
      t += '\n*' + f + '*\n';
      g[f].sort(function (a, b) { return porNome(a.produto, b.produto); }).forEach(function (x) {
        t += qtdDe(x) + 'x ' + x.produto + (x.obs ? ' (' + x.obs + ')' : '') + '\n';
      });
    });
    navigator.clipboard.writeText(t).then(function () { alert('✅ Lista copiada!'); }).catch(function () { alert('Não foi possível copiar.'); });
  }

  function onClickEstoque(e) {
    const el = e.target.closest('[data-act],[data-edit]');
    if (!el) return;
    if (el.dataset.edit) return editarInline(el);
    const a = el.dataset.act, uid = el.dataset.uid;
    const it = uid ? estoque.find(function (x) { return x.uid == uid; }) : null;
    if (a === 'visao') { E.visao = el.dataset.v; window.renderEstoque(); }
    else if (a === 'grupo') { E.fechados[el.dataset.g] = !E.fechados[el.dataset.g]; renderLista(); }
    else if (a === 'add') adicionarUnitario();
    else if (a === 'massa') processarMassa();
    else if (a === 'copiar') copiarLista();
    else if (a === 'parados') { E.visao = 'ESTOQUE'; E.parados = true; window.renderEstoque(); }
    else if (a === 'mais' && it) { it.qtd = qtdDe(it) + 1; salvarColecao('estoque', estoque); window.renderEstoque(); }
    else if (a === 'menos' && it) { if (qtdDe(it) > 1) { it.qtd = qtdDe(it) - 1; salvarColecao('estoque', estoque); window.renderEstoque(); } else alert('Para retirar a última peça, use o botão "Saída".'); }
    else if (a === 'saida' && it) abrirSaida(it, '');
    else if (a === 'alerta' && it) abrirSaida(it, el.dataset.cli || '');
    else if (a === 'voltar' && it) voltarAoEstoque(it);
    else if (a === 'del' && it) {
      if (confirm('EXCLUIR este registro?')) { estoque = estoque.filter(function (x) { return x.uid != it.uid; }); salvarColecao('estoque', estoque); window.renderEstoque(); }
    }
  }

  window.renderEstoque = function () {
    try {
      if (!estRoot && !montarEstoque()) return;
      atualizarSelects(); renderResumo(); renderAlertas(); renderLista();
    } catch (err) { console.error('Erro no estoque:', err); }
  };

  // ===================================================================
  // 4. ABA HOJE
  // ===================================================================
  function criarAbaHoje() {
    if (getEl('view-hoje')) return true;
    const nav = document.querySelector('nav');
    const refBtn = nav ? nav.querySelector('button') : null;
    const refMain = document.querySelector('main');
    if (!refBtn || !refMain) return false;
    const b = document.createElement('button');
    b.id = 'tab-hoje'; b.innerHTML = '🏠 Hoje';
    b.className = refBtn.className.replace(/\btab-active\b/g, '');
    b.onclick = function () { switchTab('hoje'); };
    refBtn.parentNode.insertBefore(b, refBtn);
    const m = document.createElement('main');
    m.id = 'view-hoje'; m.className = refMain.className; m.classList.add('hidden');
    refMain.parentNode.insertBefore(m, refMain);
    m.addEventListener('click', onClickHoje);
    return true;
  }

  function secao(titulo, cor, n, corpo) {
    return '<div class="card-premium p-4 flex flex-col gap-2"><div class="flex justify-between items-center"><h3 class="text-xs font-black uppercase ' + cor + '">' + titulo + '</h3><span class="bg-slate-100 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">' + n + '</span></div>' +
      (corpo || '<div class="text-[10px] font-black uppercase text-slate-300 text-center py-4">Tudo em dia ✅</div>') + '</div>';
  }
  function linha(go, attrs, html, cor) {
    return '<div data-go="' + go + '" ' + attrs + ' class="cursor-pointer rounded-xl border-2 ' + cor + ' p-2.5 transition hover:shadow-md">' + html + '</div>';
  }
  function maisTxt(arr, n) { return arr.length > n ? '<div class="text-[9px] font-black text-slate-400 uppercase text-center">+ ' + (arr.length - n) + ' outros</div>' : ''; }

  function mdRenderHoje() {
    const m = getEl('view-hoje'); if (!m) return;
    const hoje = iso(new Date());
    const ativos = ordenarPedidos(pedidos.filter(function (p) { return !p.finalizado && p.status !== 'Entregue/Finalizado'; }));
    const hr = new Date().getHours();
    const saud = hr < 12 ? 'Bom dia' : (hr < 18 ? 'Boa tarde' : 'Boa noite');
    const quem = usuarioAtual ? ', ' + usuarioAtual.charAt(0) + usuarioAtual.slice(1).toLowerCase() : '';
    const dataTxt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    // Pedidos não enviados
    const grp = {};
    ativos.filter(function (p) { return p.status === 'Não enviado'; }).forEach(function (p) { const k = p.cliente || '-'; (grp[k] = grp[k] || []).push(p); });
    const clientes = Object.keys(grp);
    const htmlNaoEnv = clientes.slice(0, 10).map(function (c) {
      const tags = grp[c].map(function (p) { return '<span class="bg-white border border-red-300 text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">' + esc(p.qtd) + 'x ' + esc(p.produto) + '</span>'; }).join('');
      const fabs = Array.from(new Set(grp[c].map(function (p) { return p.fornecedor; }).filter(Boolean))).join(' · ');
      return linha('pedidos', 'data-q="' + esc(c) + '"', '<div class="text-sm font-black uppercase text-slate-900">' + esc(c) + '</div><div class="flex flex-wrap gap-1 mt-1">' + tags + '</div><div class="text-[9px] font-bold text-slate-400 uppercase mt-1">' + esc(fabs) + '</div>', 'border-red-100 bg-red-50 hover:border-red-400');
    }).join('') + maisTxt(clientes, 10);

    // Entregas e lembretes
    const ent = entregas.filter(function (e) { return e.dataOrdem === hoje && e.status !== 'Entregue'; }).sort(function (a, b) { return (a.hora || '99').localeCompare(b.hora || '99'); });
    const htmlEnt = ent.map(function (e) {
      return linha('agenda', 'data-d="' + hoje + '"', '<div class="text-sm font-black uppercase text-slate-900">' + (e.hora ? '🕒 ' + esc(e.hora) + ' · ' : '') + esc(e.cliente) + '</div><div class="text-[10px] font-bold text-slate-500 uppercase">📍 ' + esc(e.endereco) + '</div>', 'border-emerald-100 bg-emerald-50 hover:border-emerald-400');
    }).join('');
    const lem = lembretes.filter(function (l) { return !l.concluido && l.dataOrdem && l.dataOrdem <= hoje; });
    const htmlLem = lem.map(function (l) {
      return linha('agenda', 'data-d="' + esc(l.dataOrdem) + '"', '<div class="text-xs font-black uppercase text-slate-800">🔔 ' + esc(l.titulo) + '</div>' + (l.dataOrdem < hoje ? '<div class="text-[9px] font-black text-red-600 uppercase">atrasado · ' + esc(l.dataOrdem.split('-').reverse().join('/')) + '</div>' : ''), 'border-amber-100 bg-amber-50 hover:border-amber-400');
    }).join('');

    // Tarefas da equipe
    const pP = { AGORA: 1, IMEDIATO: 2, IMPORTANTE: 3, REGULAR: 4, TRANQUILO: 5, '': 6 };
    const rot = { AGORA: '🚨 AGORA', IMEDIATO: '⚡ 1 DIA', IMPORTANTE: '⚠️ 2 DIAS', REGULAR: '📅 3 DIAS', TRANQUILO: '☕ + DIAS' };
    const teq = tarefasEquipe.filter(function (t) { return t.coluna !== 'DONE' && (!usuarioAtual || t.responsavel === usuarioAtual); })
      .sort(function (a, b) { return (pP[a.prazo || ''] || 6) - (pP[b.prazo || ''] || 6); });
    const htmlEq = teq.slice(0, 8).map(function (t) {
      const nc = safeArray(t.comentarios).length;
      return linha('equipe', 'data-uid="' + t.uid + '"', '<div class="flex flex-wrap items-center gap-1 mb-1"><span class="' + corAutor(t.responsavel) + ' px-2 py-0.5 rounded text-[8px] font-black uppercase">' + esc(t.responsavel) + '</span>' + (rot[t.prazo] ? '<span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[8px] font-black">' + rot[t.prazo] + '</span>' : '') + (nc ? '<span class="text-[9px] font-black text-indigo-600">💬 ' + nc + '</span>' : '') + '</div><div class="text-xs font-black uppercase text-slate-800">' + esc(t.descricao) + '</div>', 'border-slate-100 bg-slate-50 hover:border-blue-400');
    }).join('') + maisTxt(teq, 8);

    // Tarefas / vendas em aberto
    const tar = tarefas.filter(function (t) { return t.status !== 'Feito'; });
    const htmlTar = tar.slice(0, 8).map(function (t) {
      const nc = safeArray(t.comentarios).length;
      return linha('tarefas', 'data-uid="' + t.uid + '"', '<div class="text-xs font-black uppercase text-slate-800">' + esc(t.descricao) + (nc ? ' <span class="text-[9px] text-indigo-600">💬 ' + nc + '</span>' : '') + '</div><div class="text-[9px] font-bold text-slate-400 uppercase">' + esc(t.tipo) + ' · ' + esc(t.status) + '</div>', 'border-slate-100 bg-slate-50 hover:border-indigo-400');
    }).join('') + maisTxt(tar, 8);

    // Prazos
    const pr = {};
    ativos.forEach(function (p) {
      if (!p.dataPedido) return;
      const d = calcP(p.dataPedido, p.prazo).dias;
      if (d <= 5) { const k = p.idDoc || p.uid; if (!pr[k]) pr[k] = { cliente: p.cliente, dias: d, itens: [] }; pr[k].itens.push(p.qtd + 'x ' + p.produto); }
    });
    const prazos = Object.values(pr).sort(function (a, b) { return a.dias - b.dias; });
    const htmlPr = prazos.slice(0, 8).map(function (p) {
      const venc = p.dias < 0;
      return linha('pedidos', 'data-q="' + esc(p.cliente) + '"', '<div class="flex justify-between items-center gap-2"><span class="text-sm font-black uppercase text-slate-900">' + esc(p.cliente) + '</span><span class="px-2 py-0.5 rounded text-[9px] font-black ' + (venc ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-700') + '">' + (venc ? Math.abs(p.dias) + 'd atrasado' : p.dias + 'd') + '</span></div><div class="text-[10px] font-bold text-slate-500 uppercase">' + esc(p.itens.join(' · ')) + '</div>', venc ? 'border-red-200 bg-red-50 hover:border-red-500' : 'border-orange-100 bg-orange-50 hover:border-orange-400');
    }).join('') + maisTxt(prazos, 8);

    // Assistências
    const ass = assistencias.filter(function (a) { return (a.status || 'Aguardando') !== 'Concluído'; });
    const htmlAs = ass.slice(0, 8).map(function (a) {
      return linha('assist', 'data-q="' + esc(a.cliente) + '"', '<div class="text-sm font-black uppercase text-slate-900">' + esc(a.cliente) + '</div><div class="text-[10px] font-bold text-slate-500 uppercase">' + esc(a.produto) + ' · ' + esc(a.status || 'Aguardando') + '</div>', 'border-purple-100 bg-purple-50 hover:border-purple-400');
    }).join('') + maisTxt(ass, 8);

    m.innerHTML =
      '<div class="w-full max-w-7xl mx-auto p-3 md:p-6 flex flex-col gap-4">' +
      '<div><h2 class="text-2xl font-black text-slate-800">' + saud + quem + '! 👋</h2><div class="text-xs font-bold text-slate-400 uppercase">' + esc(dataTxt) + '</div></div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">' +
      secao('<span data-go="pedidos" data-nao="1" data-q="" class="cursor-pointer hover:underline">📧 Pedidos não enviados à fábrica →</span>', 'text-red-600', clientes.length, htmlNaoEnv) +
      secao('⏰ Prazos de pedidos (5 dias ou menos)', 'text-orange-600', prazos.length, htmlPr) +
      secao('🚚 Entregas de hoje', 'text-emerald-600', ent.length, htmlEnt) +
      secao('🔔 Lembretes de hoje e atrasados', 'text-amber-600', lem.length, htmlLem) +
      secao(usuarioAtual ? '👤 Minhas tarefas (equipe)' : '👥 Tarefas da equipe', 'text-blue-600', teq.length, htmlEq) +
      secao('📝 Tarefas e vendas em aberto', 'text-indigo-600', tar.length, htmlTar) +
      secao('🛠️ Assistências abertas', 'text-purple-600', ass.length, htmlAs) +
      '</div></div>';
  }

  function onClickHoje(e) {
    const el = e.target.closest('[data-go]'); if (!el) return;
    const go = el.dataset.go;
    if (go === 'pedidos') {
      irAba('Pedidos');
      try { mudarVisaoPedidos('ATIVOS'); } catch (x) {}
      const b = getEl('busca'); if (b) b.value = el.dataset.q || '';
      const quer = el.dataset.nao === '1';
      if (!!filtrandoNaoEnviados !== quer) toggleFiltroNaoEnviado(); else renderPedidos();
    } else if (go === 'equipe') {
      irAba('Equipe');
      setTimeout(function () {
        const c = getEl('card-' + el.dataset.uid);
        if (c) {
          c.scrollIntoView({ behavior: 'smooth', block: 'center' });
          c.classList.add('ring-4', 'ring-blue-400');
          setTimeout(function () { c.classList.remove('ring-4', 'ring-blue-400'); }, 2500);
        }
      }, 150);
    } else if (go === 'agenda') {
      irAba('Agenda');
      const p = el.dataset.d.split('-');
      dataSelecionadaLogistica = el.dataset.d;
      dataAtualCalendario = new Date(p[0], p[1] - 1, 1);
      processarEventosCalendario();
    } else if (go === 'tarefas') {
      irAba('Tarefas');
      window.verDetalhesTarefa(el.dataset.uid);
    } else if (go === 'assist') {
      irAba('Assist');
      const b = getEl('busca-assistencia'); if (b) { b.value = el.dataset.q || ''; renderAssistencias(); }
    }
  }

  const _switchTab = window.switchTab;
  window.switchTab = function (t) { _switchTab(t); if (t === 'hoje') { try { mdRenderHoje(); } catch (e) { console.error(e); } } };

  const _setUsuario = window.setUsuario;
  window.setUsuario = function (n) { _setUsuario(n); try { mdRenderHoje(); } catch (e) {} };

  const _renderAll = window.renderAll;
  window.renderAll = function () {
    _renderAll();
    try { mdRenderHoje(); } catch (e) { console.error('Erro na aba Hoje:', e); }
  };

  boot(function () {
    try { if (criarAbaHoje()) { mdRenderHoje(); switchTab('hoje'); } } catch (e) { console.error(e); }
    try { window.renderEstoque(); } catch (e) { console.error(e); }
      // =====================================================================
// CORREÇÃO: clique nas tarefas da aba Hoje — cole no FINAL do app.js
// =====================================================================
(function () {
  function irParaTarefas() {
    if (getEl('view-tarefas')) { switchTab('tarefas'); return; }
    const b = Array.from(document.querySelectorAll('nav button')).find(function (x) {
      return noAcc(x.textContent.toLowerCase()).includes('tarefas');
    });
    if (b) b.click();
  }

  document.addEventListener('click', function (e) {
    const el = e.target.closest('#view-hoje [data-go="tarefas"]');
    if (!el) return;
    e.stopPropagation();

    el.classList.add('ring-4', 'ring-indigo-400');
    setTimeout(function () { el.classList.remove('ring-4', 'ring-indigo-400'); }, 1500);

    const uid = el.dataset.uid;
    const modal = getEl('modal-detalhes');
    if (modal && modal.parentElement !== document.body) document.body.appendChild(modal);

    irParaTarefas();
    setTimeout(function () {
      try { window.verDetalhesTarefa(uid); }
      catch (err) { console.error(err); alert('Erro ao abrir a tarefa: ' + err.message); }
    }, 60);
  }, true);
})();
  });
})();

// =====================================================================
// NOVIDADES: comentário no estoque + botão copiar entrega
// Cole TUDO isto no FINAL do app.js
// =====================================================================
(function () {

  // ---------------------------------------------------------------
  // 1. COMENTÁRIO EM CADA ITEM DO ESTOQUE
  // ---------------------------------------------------------------
  function pintarComentario(bloco) {
    const uid = bloco.dataset.uid;
    const it = estoque.find(function (x) { return x.uid == uid; });
    const txt = it && it.comentario ? String(it.comentario) : '';
    bloco.innerHTML = txt
      ? '<div class="est-ct cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold text-amber-900 whitespace-pre-wrap" title="Clique para editar">💬 ' + esc(txt) + '</div>'
      : '<div class="est-ct cursor-pointer text-[10px] font-black uppercase text-slate-300 hover:text-blue-600">💬 + adicionar comentário</div>';
  }

  function editarComentario(bloco) {
    const uid = bloco.dataset.uid;
    const atual = estoque.find(function (x) { return x.uid == uid; });
    if (!atual) return;

    const i = document.createElement('input');
    i.value = atual.comentario || '';
    i.placeholder = 'Escreva o comentário e aperte Enter...';
    i.className = 'w-full border-2 border-blue-500 rounded-lg p-2 text-xs font-bold outline-none';
    bloco.innerHTML = '';
    bloco.appendChild(i);
    i.focus();

    let feito = false;
    function fim(salvar) {
      if (feito) return;
      feito = true;
      if (salvar) {
        const v = i.value.trim();
        const it = estoque.find(function (x) { return x.uid == uid; });
        if (it && v !== (it.comentario || '')) {
          it.comentario = v;
          salvarColecao('estoque', estoque);
        }
      }
      pintarComentario(bloco);
    }
    i.onblur = function () { fim(true); };
    i.onkeydown = function (e) {
      if (e.key === 'Enter') fim(true);
      if (e.key === 'Escape') fim(false);
    };
  }

  function decorarEstoque() {
    const lista = getEl('est-lista');
    if (!lista) return;
    lista.querySelectorAll('[data-act="del"][data-uid]').forEach(function (btn) {
      const linha = btn.parentElement;
      if (!linha) return;
      const prox = linha.nextElementSibling;
      if (prox && prox.classList.contains('est-coment')) return;
      const bloco = document.createElement('div');
      bloco.className = 'est-coment px-3 pb-2 border-b border-slate-100';
      bloco.dataset.uid = btn.dataset.uid;
      pintarComentario(bloco);
      linha.insertAdjacentElement('afterend', bloco);
    });
  }

  // Sempre que a lista do estoque for redesenhada (busca, filtro, banco), recoloca os comentários
  let agendado = false;
  new MutationObserver(function () {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(function () {
      agendado = false;
      try { decorarEstoque(); } catch (e) { console.error(e); }
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { try { decorarEstoque(); } catch (e) {} }, 500);

  // ---------------------------------------------------------------
  // 2. BOTÃO COPIAR INFORMAÇÕES DA ENTREGA
  // ---------------------------------------------------------------
  function textoEntrega(e) {
    const p = String(e.dataOrdem || '').split('-');
    const dataBR = p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '-';
    let dia = '';
    try { dia = new Date(e.dataOrdem + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }); } catch (x) {}
    const itens = String(e.produtos || '').split('\n')
      .map(function (l) { return l.trim(); })
      .filter(Boolean)
      .map(function (l) { return '• ' + l; })
      .join('\n');

    let t = '🚚 *ENTREGA AGENDADA - MERCIER DESIGN*\n\n';
    t += '📅 Data: ' + dataBR + (dia ? ' (' + dia + ')' : '') + '\n';
    if (e.hora) t += '🕒 Horário: ' + e.hora + '\n';
    t += '👤 Cliente: ' + (e.cliente || '-') + '\n';
    if (e.contato) t += '📞 Contato: ' + e.contato + '\n';
    t += '📍 Endereço: ' + (e.endereco || 'Não informado') + '\n\n';
    t += '📦 *Produtos:*\n' + itens + '\n';
    return t;
  }

  function copiarTexto(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (ok, erro) {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? ok() : erro(); } catch (x) { erro(x); }
      ta.remove();
    });
  }

  function copiarEntrega(btn) {
    const e = entregas.find(function (x) { return x.uid == btn.dataset.copyEnt; });
    if (!e) return alert('Entrega não encontrada.');
    copiarTexto(textoEntrega(e)).then(function () {
      const antes = btn.textContent;
      btn.textContent = '✅ Copiado';
      setTimeout(function () { btn.textContent = antes; }, 1500);
    }).catch(function () { alert('Não foi possível copiar.'); });
  }

  // Acrescenta o botão em cada cartão de entrega do painel do dia
  const _renderPainelDia = window.renderPainelDia;
  window.renderPainelDia = function () {
    _renderPainelDia();
    const pn = getEl('lista-eventos-dia');
    if (!pn) return;
    pn.querySelectorAll('button[onclick^="editarEntrega("]').forEach(function (ed) {
      const ant = ed.previousElementSibling;
      if (ant && ant.hasAttribute('data-copy-ent')) return;
      const b = document.createElement('button');
      b.setAttribute('data-copy-ent', ed.getAttribute('onclick').replace(/\D/g, ''));
      b.className = 'bg-indigo-50 text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-100 text-[10px] font-black uppercase';
      b.title = 'Copiar informações da entrega';
      b.textContent = '📋 Copiar';
      ed.parentElement.insertBefore(b, ed);
    });
  };

  // ---------------------------------------------------------------
  // Cliques (um único ouvinte para os dois recursos)
  // ---------------------------------------------------------------
  document.addEventListener('click', function (e) {
    const ct = e.target.closest('.est-coment .est-ct');
    if (ct) { editarComentario(ct.parentElement); return; }
    const cp = e.target.closest('[data-copy-ent]');
    if (cp) copiarEntrega(cp);
  });

  try { window.renderPainelDia(); } catch (e) {}
})();

// =====================================================================
// CATEGORIA: DEFEITO / AVARIA / ASSISTÊNCIA (separa do estoque real)
// Cole TUDO isto no FINAL do app.js
// =====================================================================
(function () {

  var REGEX_DEF = /ASSIST|DEFEIT|AVARI/;
  var modoDef = false;

  function semAcento(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  }

  // Item em estoque cujo nome ou comentário tenha defeito, avaria ou assistência
  function ehDefeito(it) {
    if (!it) return false;
    if ((it.situacao || 'ESTOQUE') !== 'ESTOQUE') return false;
    return REGEX_DEF.test(semAcento(it.produto) + ' ' + semAcento(it.comentario));
  }

  function pecas(lista) {
    return lista.reduce(function (t, it) { return t + (parseInt(it.qtd) || 0); }, 0);
  }

  // ---------------------------------------------------------------
  // Barra com os dois botões, no topo da aba Estoque
  // ---------------------------------------------------------------
  function getBarra() {
    var v = getEl('view-estoque');
    if (!v) return null;
    var b = getEl('est-cat-bar');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'est-cat-bar';
    b.className = 'mb-4';
    v.insertBefore(b, v.firstChild);
    return b;
  }

  function atualizarBarra(todos, soDef) {
    var b = getBarra();
    if (!b) return;
    var base = 'px-4 py-2 rounded-xl text-[11px] font-black uppercase border-2 transition ';
    var defeitos = todos.filter(ehDefeito);
    var reais = todos.filter(function (it) {
      return (it.situacao || 'ESTOQUE') === 'ESTOQUE' && !ehDefeito(it);
    });

    b.innerHTML =
      '<div class="flex gap-2 flex-wrap">' +
        '<button data-estcat="real" class="' + base +
          (!soDef ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400') + '">' +
          '📦 Estoque real · ' + pecas(reais) + ' peças</button>' +
        '<button data-estcat="def" class="' + base +
          (soDef ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-600 border-orange-200 hover:border-orange-400') + '">' +
          '⚠️ Defeito / Avaria / Assistência · ' + pecas(defeitos) + ' peças</button>' +
      '</div>' +
      (soDef
        ? '<div class="mt-2 text-[10px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">' +
          'Estes itens NÃO entram na contagem de estoque disponível. Para devolver um item ao estoque real, apague a palavra defeito, avaria ou assistência do nome ou do comentário.</div>'
        : '');
  }

  // ---------------------------------------------------------------
  // A tela do estoque passa a enxergar só a categoria escolhida
  // ---------------------------------------------------------------
  var _renderEstoque = window.renderEstoque;
  window.renderEstoque = function () {
    if (typeof _renderEstoque !== 'function') return;
    var todos = estoque;
    var visao = (typeof visaoEstoque !== 'undefined') ? visaoEstoque : 'ESTOQUE';
    var soDef = modoDef && visao === 'ESTOQUE';

    estoque = todos.filter(function (it) {
      return soDef ? ehDefeito(it) : !ehDefeito(it);
    });
    try { _renderEstoque(); } finally { estoque = todos; }

    try { atualizarBarra(todos, soDef); } catch (e) { console.error(e); }
  };

  // ---------------------------------------------------------------
  // Cadastro em massa: "ASSISTÊNCIA" na 3ª coluna vira item em estoque
  // da categoria de defeito (e não uma saída)
  // ---------------------------------------------------------------
  var _massa = window.processarEstoqueMassa;
  if (typeof _massa === 'function') {
    window.processarEstoqueMassa = function () {
      var antes = {};
      estoque.forEach(function (it) { antes[it.uid] = true; });
      var r = _massa.apply(this, arguments);
      var ajustou = false;
      estoque.forEach(function (it) {
        if (antes[it.uid]) return;
        if (it.situacao === 'ASSISTÊNCIA' && REGEX_DEF.test(semAcento(it.produto))) {
          it.situacao = 'ESTOQUE';
          ajustou = true;
        }
      });
      if (ajustou) salvarColecao('estoque', estoque);
      return r;
    };
  }

  // ---------------------------------------------------------------
  // Cliques nos botões da barra
  // ---------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-estcat]');
    if (t) {
      modoDef = t.dataset.estcat === 'def';
      if (typeof visaoEstoque !== 'undefined' && visaoEstoque !== 'ESTOQUE' && typeof mudarVisaoEstoque === 'function') {
        mudarVisaoEstoque('ESTOQUE');
      } else {
        window.renderEstoque();
      }
      return;
    }
    // Ao clicar nas abas "Em estoque" ou "Saídas", volta para o estoque real
    if (e.target.closest('#btn-estoque-disponivel, #btn-estoque-saidas')) modoDef = false;
  }, true);

  try { window.renderEstoque(); } catch (e) {}

    // =====================================================================
// NOVIDADES: categoria Avarias/Assistência + importar NF-e (XML)
// Cole TUDO isto no FINAL do app.js (depois da última linha)
// =====================================================================
(function () {

  var RX_AVARIA = /\b(ASSISTENCIA|DEFEITO|DEFEITUOSO|DEFEITUOSA|AVARIA|AVARIADO|AVARIADA|DANIFICADO|DANIFICADA)\b/;
  var jaVerificou = false;

  function aviso(msg) {
    var d = document.createElement('div');
    d.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-black px-4 py-3 rounded-xl shadow-lg z-[300]';
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 4000);
  }

  // ---------------------------------------------------------------
  // 1. CATEGORIA AVARIAS / DEFEITOS / ASSISTÊNCIA
  // ---------------------------------------------------------------
  function motivoDe(texto) {
    var t = noAcc(String(texto || '').toUpperCase());
    var m = t.match(RX_AVARIA);
    if (!m) return '';
    if (m[1].indexOf('ASSIST') === 0) return 'ASSISTÊNCIA';
    if (m[1].indexOf('DEFEIT') === 0) return 'DEFEITO';
    return 'AVARIA';
  }

  function reclassificar() {
    var mudou = 0;
    estoque.forEach(function (it) {
      if ((it.situacao || 'ESTOQUE') !== 'ESTOQUE' || it.liberado) return;
      var mv = motivoDe(it.produto);
      if (mv) { it.situacao = 'ASSISTÊNCIA'; it.motivo = mv; mudou++; }
    });
    if (mudou) {
      salvarColecao('estoque', estoque);
      registrarAcao('⚠️', 'MOVIDO PARA AVARIAS', mudou + ' item(ns)');
      aviso('⚠️ ' + mudou + ' item(ns) separado(s) do estoque real (avaria/defeito/assistência).');
    }
  }

  function pintarAvarias() {
    var tb = getEl('tabelaEstoque');
    var tabela = tb ? tb.closest('table') : null;
    var ancora = tabela ? tabela.parentElement : getEl('est-lista');
    if (!ancora) return;

    var box = getEl('painel-avarias');
    if (!box) {
      box = document.createElement('div');
      box.id = 'painel-avarias';
      box.className = 'mt-6 bg-white border-2 border-orange-300 rounded-2xl p-4';
      ancora.insertAdjacentElement('afterend', box);

      box.addEventListener('click', function (e) {
        var b = e.target.closest('[data-av]');
        if (!b) return;
        var it = estoque.find(function (x) { return x.uid == b.dataset.uid; });
        if (!it) return;
        var a = b.dataset.av;
        if (a === 'volta') {
          if (!confirm('Voltar este item para o estoque real?')) return;
          it.situacao = 'ESTOQUE';
          it.liberado = true;
          delete it.motivo;
        } else if (a === 'fabrica') {
          if (!confirm('Marcar como devolvido para a fábrica?')) return;
          it.situacao = 'DEVOLUÇÃO FÁBRICA';
          it.data = new Date().toLocaleDateString('pt-BR');
        } else if (a === 'del') {
          if (!confirm('EXCLUIR REGISTRO?')) return;
          estoque = estoque.filter(function (x) { return x.uid != b.dataset.uid; });
        }
        salvarColecao('estoque', estoque);
      });
    }

    var lista = estoque.filter(function (x) { return x.situacao === 'ASSISTÊNCIA' || x.situacao === 'AVARIA'; });
    var total = lista.reduce(function (s, x) { return s + (parseInt(x.qtd) || 0); }, 0);

    var h = '<div class="flex justify-between items-center mb-3">' +
      '<h3 class="font-black text-sm uppercase text-orange-700">⚠️ Avarias / Defeitos / Assistência</h3>' +
      '<span class="text-[10px] font-black uppercase text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded">' + total + ' peça(s) fora do estoque real</span></div>';

    if (!lista.length) {
      h += '<div class="text-center text-[11px] font-bold uppercase text-slate-400 py-4">Nenhum item com avaria.</div>';
    } else {
      lista.forEach(function (x) {
        h += '<div class="flex flex-wrap items-center gap-2 border-b border-orange-100 py-2">' +
          '<span class="text-[10px] text-slate-400 font-bold w-20">' + esc(x.data || '-') + '</span>' +
          '<span class="flex-1 min-w-[160px] text-[11px] font-black uppercase text-slate-800">' + esc(x.produto) + '</span>' +
          '<span class="text-[10px] font-black uppercase text-blue-600">' + esc(x.fabrica || '-') + '</span>' +
          '<span class="text-[11px] font-black">' + esc(x.qtd) + 'x</span>' +
          '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">' + esc(x.motivo || 'ASSISTÊNCIA') + '</span>' +
          '<button data-av="volta" data-uid="' + x.uid + '" class="bg-green-50 text-green-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-green-100">↩ Voltar ao estoque</button>' +
          '<button data-av="fabrica" data-uid="' + x.uid + '" class="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase hover:bg-purple-100">🏭 Devolvido</button>' +
          '<button data-av="del" data-uid="' + x.uid + '" class="text-slate-300 hover:text-red-500 font-black px-2">✕</button>' +
          '</div>';
      });
    }
    box.innerHTML = h;
  }

  // Depois de cadastrar (unitário ou em massa), separa automaticamente o que for avaria
  ['cadastrarEstoque', 'processarEstoqueMassa'].forEach(function (nome) {
    var orig = window[nome];
    if (typeof orig !== 'function') return;
    window[nome] = function () {
      var r = orig.apply(this, arguments);
      try { reclassificar(); } catch (e) { console.error(e); }
      return r;
    };
  });

  // ---------------------------------------------------------------
  // 2. IMPORTAR NOTA FISCAL (XML)
  // ---------------------------------------------------------------
  function lerXML(texto) {
    var doc = new DOMParser().parseFromString(texto, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('arquivo XML inválido');
    var T = function (pai, tag) {
      var n = pai.getElementsByTagNameNS('*', tag)[0];
      return n ? n.textContent.trim() : '';
    };
    var inf = doc.getElementsByTagNameNS('*', 'infNFe')[0];
    if (!inf) throw new Error('não é um XML de NF-e');
    var emit = inf.getElementsByTagNameNS('*', 'emit')[0];
    var numero = T(inf, 'nNF');
    var emitente = emit ? T(emit, 'xNome') : '';
    var chave = (inf.getAttribute('Id') || '').replace(/\D/g, '') || ('nf' + numero + emitente.replace(/\W/g, ''));
    var nota = { chave: chave, numero: numero, emitente: emitente, itens: [] };
    Array.prototype.forEach.call(inf.getElementsByTagNameNS('*', 'det'), function (det) {
      var p = det.getElementsByTagNameNS('*', 'prod')[0];
      if (!p) return;
      nota.itens.push({
        nome: T(p, 'xProd'),
        qtd: Math.round(parseFloat(T(p, 'qCom'))) || 1
      });
    });
    return nota;
  }

  function fabricaDaNota(emitente) {
    var e = noAcc(String(emitente || '').toUpperCase());
    var achou = fornecedores.find(function (f) {
      var n = noAcc(String(f.nome || '').toUpperCase());
      var p = n.split(/\s+/)[0];
      return n && (e.indexOf(n) >= 0 || (p.length >= 4 && e.indexOf(p) >= 0));
    });
    return achou ? achou.nome : '';
  }

  function opcoesFab(emitente) {
    var sel = fabricaDaNota(emitente);
    var h = fornecedores.map(function (f) {
      return '<option value="' + esc(f.nome) + '"' + (f.nome === sel ? ' selected' : '') + '>' + esc(f.nome) + '</option>';
    }).join('');
    if (!sel) {
      var em = String(emitente || '').toUpperCase();
      h = '<option value="' + esc(em) + '" selected>' + esc(em || 'SEM FÁBRICA') + ' (da nota)</option>' + h;
    }
    return h;
  }

  function mostrarPrevia(notas, erros) {
    var pv = getEl('nf-previa');
    if (!pv) return;
    var h = '';
    erros.forEach(function (e) {
      h += '<div class="bg-red-50 border border-red-200 text-red-700 text-[10px] font-black uppercase rounded-lg p-2 mb-2">⚠️ ' + esc(e) + '</div>';
    });
    notas.forEach(function (n) {
      h += '<div class="mt-2 mb-1 text-[11px] font-black uppercase text-indigo-800">NF ' + esc(n.numero) + ' — ' + esc(n.emitente) + ' (' + n.itens.length + ' itens)</div>';
      if (n.jaImportada) {
        h += '<div class="bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-black uppercase rounded-lg p-2 mb-1">⚠️ Esta nota já foi importada em ' + esc(n.jaImportada.data || '-') + '. Os itens vieram desmarcados.</div>';
      }
      n.itens.forEach(function (it) {
        h += '<div class="nf-linha flex flex-wrap items-center gap-2 bg-white border border-indigo-100 rounded-xl p-2 mb-1" data-chave="' + esc(n.chave) + '" data-numero="' + esc(n.numero) + '">' +
          '<input type="checkbox" class="nf-ok" ' + (n.jaImportada ? '' : 'checked') + '>' +
          '<input class="nf-nome flex-1 min-w-[200px] border p-1.5 rounded-lg text-[11px] font-bold uppercase outline-indigo-500" value="' + esc(it.nome) + '">' +
          '<input type="number" min="1" class="nf-qtd w-16 border p-1.5 rounded-lg text-[11px] font-black text-center outline-indigo-500" value="' + it.qtd + '">' +
          '<select class="nf-fab border p-1.5 rounded-lg text-[10px] font-black uppercase bg-white outline-indigo-500">' + opcoesFab(n.emitente) + '</select>' +
          '</div>';
      });
    });
    if (notas.length) {
      h += '<div class="flex gap-2 mt-3">' +
        '<button data-nf="ok" class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700">✅ Cadastrar selecionados no estoque</button>' +
        '<button data-nf="cancel" class="bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-300">Cancelar</button></div>' +
        '<div class="text-[9px] font-bold text-indigo-500 mt-2 uppercase">Desmarque o que for de pedido de cliente. Itens iguais (mesmo nome e fábrica) somam a quantidade.</div>';
    }
    pv.innerHTML = h;
  }

  function lerArquivos(files) {
    var arqs = Array.prototype.slice.call(files);
    if (!arqs.length) return;
    Promise.all(arqs.map(function (f) {
      return f.text().then(function (t) { return { nome: f.name, texto: t }; });
    })).then(function (lidos) {
      var notas = [], erros = [];
      lidos.forEach(function (a) {
        try { notas.push(lerXML(a.texto)); }
        catch (e) { erros.push(a.nome + ': ' + e.message); }
      });
      return Promise.all(notas.map(function (n) {
        return db.ref('dados/nfImportadas/' + n.chave).once('value').then(function (s) {
          n.jaImportada = s.val();
          return n;
        });
      })).then(function () { mostrarPrevia(notas, erros); });
    }).catch(function (e) {
      alert('Não foi possível ler o arquivo: ' + e.message);
    });
  }

  function cadastrarSelecionados() {
    var hoje = new Date().toLocaleDateString('pt-BR');
    var itens = 0, notas = {};
    document.querySelectorAll('#nf-previa .nf-linha').forEach(function (l) {
      if (!l.querySelector('.nf-ok').checked) return;
      var nome = l.querySelector('.nf-nome').value.toUpperCase().trim();
      var q = parseInt(l.querySelector('.nf-qtd').value) || 0;
      var fab = l.querySelector('.nf-fab').value;
      if (!nome || q <= 0) return;
      var existente = estoque.find(function (x) {
        return (x.situacao || 'ESTOQUE') === 'ESTOQUE' && x.produto === nome && x.fabrica === fab;
      });
      if (existente) existente.qtd = (parseInt(existente.qtd) || 0) + q;
      else estoque.unshift({ uid: Date.now() + Math.random(), data: hoje, produto: nome, fabrica: fab, qtd: q, situacao: 'ESTOQUE', nf: l.dataset.numero });
      itens++;
      notas[l.dataset.chave] = l.dataset.numero;
    });
    if (!itens) return alert('Nenhum item selecionado.');

    salvarColecao('estoque', estoque);
    Object.keys(notas).forEach(function (c) {
      db.ref('dados/nfImportadas/' + c).set({ numero: notas[c], data: hoje });
    });
    registrarAcao('🧾', 'IMPORTOU NF', itens + ' item(ns) | NF ' + Object.keys(notas).map(function (c) { return notas[c]; }).join(', '));
    getEl('nf-previa').innerHTML = '';
    getEl('nf-arquivo').value = '';
    aviso('✅ ' + itens + ' item(ns) cadastrados no estoque.');
    reclassificar();
  }

  function montarImportador() {
    if (getEl('painel-nf')) return;
    var tb = getEl('tabelaEstoque');
    var tabela = tb ? tb.closest('table') : null;
    var ancora = tabela ? tabela.parentElement : getEl('est-lista');
    if (!ancora) return;

    var box = document.createElement('div');
    box.id = 'painel-nf';
    box.className = 'mb-4 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-2xl p-4';
    box.innerHTML =
      '<div class="flex flex-wrap items-center gap-3 justify-between">' +
      '<div><div class="text-[11px] font-black uppercase text-indigo-800">🧾 Importar Nota Fiscal (XML)</div>' +
      '<div class="text-[10px] font-bold text-indigo-500">Escolha o XML da NF-e da fábrica. Você confere os itens antes de cadastrar.</div></div>' +
      '<label class="cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700">Escolher XML' +
      '<input id="nf-arquivo" type="file" accept=".xml,text/xml" multiple class="hidden"></label></div>' +
      '<div id="nf-previa" class="mt-3"></div>';
    ancora.insertAdjacentElement('beforebegin', box);

    getEl('nf-arquivo').addEventListener('change', function (e) { lerArquivos(e.target.files); });
    getEl('nf-previa').addEventListener('click', function (e) {
      var b = e.target.closest('[data-nf]');
      if (!b) return;
      if (b.dataset.nf === 'ok') cadastrarSelecionados();
      if (b.dataset.nf === 'cancel') { getEl('nf-previa').innerHTML = ''; getEl('nf-arquivo').value = ''; }
    });
  }

  // ---------------------------------------------------------------
  // Gancho na tela de estoque
  // ---------------------------------------------------------------
  var _renderEstoque = window.renderEstoque;
  window.renderEstoque = function () {
    if (typeof _renderEstoque === 'function') _renderEstoque.apply(this, arguments);
    try { montarImportador(); pintarAvarias(); } catch (e) { console.error(e); }
    if (!jaVerificou && estoque.length) {
      jaVerificou = true;
      try { reclassificar(); } catch (e) { console.error(e); }
    }
  };
  try { window.renderEstoque(); } catch (e) {}
})();
  setTimeout(function () { try { window.renderEstoque(); } catch (e) {} }, 800);
})();
