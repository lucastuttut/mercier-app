// CONFIGURAÇÃO FIREBASE
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

window.addEventListener('error', function(e) { console.error("Erro interno blindado:", e.message); });

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], tarefasEquipe=[], historicoAtividades=[];
let proximoID=255, notasMelhoria="", notasEstoque="", cestoItensTemporario=[], filtrandoNaoEnviados=false, filtrandoVendidos=false, cpfValido=true;
let deepLinkVerificado = false;

// NOVO: Controle da Sub-aba de Pedidos
let visaoPedidos = 'ATIVOS';

// --- SISTEMA DE LOGIN E FOCO ---
let usuarioAtual = "";
try { usuarioAtual = localStorage.getItem('mercier_user') || ""; } catch(e) {}
let modoMinhasTarefas = false;
try { modoMinhasTarefas = localStorage.getItem('mercier_so_minhas') === 'true'; } catch(e) {}

window.onload = function() {
    const selectEl = document.getElementById('user-select');
    if(selectEl && usuarioAtual) selectEl.value = usuarioAtual;
    const chkMinhas = document.getElementById('check-minhas-tarefas');
    if(chkMinhas) chkMinhas.checked = modoMinhasTarefas;
    renderFiltrosEquipe();
};

function setUsuario(nome) {
    usuarioAtual = nome;
    if(nome) { try { localStorage.setItem('mercier_user', nome); } catch(e) {} } 
    else { try { localStorage.removeItem('mercier_user'); } catch(e) {} }
    renderFiltrosEquipe(); renderQuadroEquipe();
}

function toggleModoMinhasTarefas() {
    if (!usuarioAtual) {
        alert("Por favor, selecione quem você é no canto superior direito primeiro!");
        document.getElementById('check-minhas-tarefas').checked = false;
        return;
    }
    modoMinhasTarefas = document.getElementById('check-minhas-tarefas').checked;
    try { localStorage.setItem('mercier_so_minhas', modoMinhasTarefas); } catch(e) {}
    if(modoMinhasTarefas) filtrosEquipeAtivos =[];
    renderFiltrosEquipe(); renderQuadroEquipe();
}

const esc = function(str) { return (str || "").toString().replace(/[&<>'"]/g, function(tag) { return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag); }); };
const removeAcentos = function(str) { return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };

const safeArray = function(data) {
    if (!data) return[];
    try {
        let arr = Array.isArray(data) ? data : Object.values(data);
        return arr.filter(function(item) { return item && typeof item === 'object'; });
    } catch (e) { return[]; }
};

const statusEl = document.getElementById('status-db');
db.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) console.log("Conectado!"); else console.log("Tentando...");
});

function registrarAcao(icone, acao, detalhe) {
    const quem = usuarioAtual || "SISTEMA";
    const agora = new Date();
    const dataHora = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

    historicoAtividades.unshift({ uid: Date.now() + Math.random(), dataHora: dataHora, usuario: quem, acao: acao, detalhe: detalhe, icone: icone });
    if(historicoAtividades.length > 150) { historicoAtividades = historicoAtividades.slice(0, 150); }
    salvarColecao('historico', historicoAtividades);
}

function togglePainelHistorico() {
    const painel = document.getElementById('painel-historico');
    const overlay = document.getElementById('overlay-historico');
    const badge = document.getElementById('badge-historico');
    if(painel.classList.contains('translate-x-full')) {
        painel.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); if(badge) badge.classList.add('hidden'); 
    } else {
        painel.classList.add('translate-x-full'); overlay.classList.add('hidden');
    }
}

function renderHistorico() {
    const lista = document.getElementById('lista-historico');
    if(!lista) return;
    if(historicoAtividades.length === 0) {
        lista.innerHTML = '<span class="text-slate-400 text-[10px] font-bold text-center uppercase block mt-10">Nenhuma atividade registrada ainda.</span>'; return;
    }
    lista.innerHTML = historicoAtividades.map(function(h) {
        return `<div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-3 items-start transition-all hover:bg-slate-50"><div class="bg-slate-100 p-2 rounded-lg text-lg">${h.icone}</div><div class="flex flex-col flex-1"><div class="flex justify-between items-center mb-1"><span class="text-[9px] font-black uppercase text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">${esc(h.usuario)}</span><span class="text-[8px] font-bold text-slate-400">${h.dataHora}</span></div><span class="text-[11px] font-black uppercase text-slate-800 leading-tight">${esc(h.acao)}</span><span class="text-[9px] font-bold text-slate-500 uppercase mt-0.5 leading-snug">${esc(h.detalhe)}</span></div></div>`;
    }).join('');
    
    const painel = document.getElementById('painel-historico');
    const badge = document.getElementById('badge-historico');
    if(painel && painel.classList.contains('translate-x-full') && badge) { badge.classList.remove('hidden'); }
}

db.ref('dados').on('value', function(s) {
    try {
        const d = s.val() || {};
        pedidos = safeArray(d.pedidos);
        fornecedores = safeArray(d.fornecedores);
        estoque = safeArray(d.estoque);
        catalogo = safeArray(d.catalogo);
        tarefas = safeArray(d.tarefas);
        assistencias = safeArray(d.assistencias);
        tarefasEquipe = safeArray(d.tarefasEquipe);
        historicoAtividades = safeArray(d.historico); 
        
        proximoID = d.proximoID || 255;
        notasMelhoria = d.notasMelhoria || "";
        notasEstoque = d.notasEstoque || "";

        if(statusEl) { statusEl.innerText = "ONLINE"; statusEl.className = "status-online"; }
        const elMelhorias = document.getElementById('texto-melhorias'); if(elMelhorias) elMelhorias.value = notasMelhoria;
        const elEstoqueNotas = document.getElementById('estoque-notas-gerais'); if(elEstoqueNotas) elEstoqueNotas.value = notasEstoque;

        atualizarSelectsFornecedores(); atualizarSugestoes(); renderAll();
        
        if(!deepLinkVerificado && tarefasEquipe.length > 0) {
            const urlParams = new URLSearchParams(window.location.search);
            const tarefaId = urlParams.get('tarefa');
            if(tarefaId) {
                switchTab('equipe');
                setTimeout(function() {
                    const card = document.getElementById('card-' + tarefaId);
                    if(card) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const bgOriginal = card.style.backgroundColor;
                        card.style.backgroundColor = '#bbf7d0'; 
                        card.style.transition = 'background-color 2s';
                        setTimeout(function() { card.style.backgroundColor = bgOriginal; }, 2000);
                    }
                }, 600); 
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            deepLinkVerificado = true;
        }
    } catch (err) {
        if(statusEl) { statusEl.innerText = "ERRO DE LEITURA"; statusEl.className = "status-offline"; }
        console.error("Erro critico: ", err);
    }
}, function(error) { if(statusEl) { statusEl.innerText = "ERRO DE ACESSO"; statusEl.className = "status-offline"; } });

function salvarColecao(colecao, dados) { db.ref('dados/' + colecao).set(dados); }

async function getProximoID() {
    const ref = db.ref('dados/proximoID');
    const res = await ref.transaction(function(curr) { return (curr || 255) + 1; });
    return res.snapshot.val();
}

function renderAll(){ 
    renderPedidos(); renderTarefas(); renderFornecedores(); 
    renderEstoque(); renderCatalogo(); renderAssistencias(); renderQuadroEquipe(); renderHistorico(); 
}

function activeInlineEdit(element, uid, field, listType) {
    const originalValue = element.innerText;
    const input = document.createElement('input');
    input.value = (originalValue === "-" ? "" : originalValue);
    input.className = "w-full p-1 text-xs font-bold border-2 border-blue-500 rounded bg-white text-black outline-none uppercase";
    if(field === 'custo') input.oninput = function() { let v = input.value.replace(/\D/g,""); v = (v/100).toFixed(2).replace(".",","); v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); input.value = "R$ " + v; };
    element.innerHTML = ''; element.appendChild(input); input.focus();
    
    const save = function() {
        let newValue = input.value.toUpperCase().trim();
        if (newValue === "") newValue = "-";
        let list = pedidos;
        if(listType === 'estoque') list = estoque;
        else if(listType === 'assistencias') list = assistencias;
        const item = list.find(function(x) { return x.uid == uid; });
        if (item) {
            if(field === 'qtd') item[field] = parseInt(newValue) || 1;
            else item[field] = newValue;
            salvarColecao(listType, list);
        } else { element.innerText = originalValue; }
    };
    input.onblur = save; input.onkeydown = function(e) { if(e.key === 'Enter') save(); if(e.key === 'Escape') { input.onblur = null; element.innerText = originalValue; } };
}

function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const ok = validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }
function copyText(v, el){ if(!v || v==="-") return; navigator.clipboard.writeText(v.toUpperCase()); if(el) { el.style.color="#22c55e"; setTimeout(function(){el.style.color="#94a3b8";}, 1000); } }
async function buscarCEP(i){ let cep=i.value.replace(/\D/g,""); if(cep.length===8){ document.getElementById('loading-cep').classList.remove('hidden'); try{ let r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); let d=await r.json(); if(!d.erro){ document.getElementById('t_end').value=d.logradouro.toUpperCase(); document.getElementById('t_bairro').value=d.bairro.toUpperCase(); document.getElementById('t_cidade').value=d.localidade.toUpperCase(); document.getElementById('t_num').focus(); } }catch(e){} finally { document.getElementById('loading-cep').classList.add('hidden'); }}}

function calcP(d, pr){ 
    if(!d) return {dias:0, classe:""}; 
    try { 
        const pA = String(d).split("/"); const dt = new Date(pA[2], pA[1]-1, pA[0]); let dF = new Date(dt); let spr = String(pr || "30");
        if(spr.includes("util")){ let c=0; while(c < parseInt(spr)){ dF.setDate(dF.getDate()+1); if(dF.getDay()!==0 && dF.getDay()!==6) c++; } } else { dF.setDate(dF.getDate() + parseInt(spr)); } 
        const df = Math.ceil((dF - new Date()) / 86400000); 
        let c = df < 0 ? "prazo-vencido" : (df <= 5 ? "prazo-urgente" : (df <= 10 ? "prazo-alerta" : (df <= 20 ? "prazo-atencao" : ""))); 
        return {dias: df, classe: c}; 
    } catch(e) { return {dias:0, classe:""}; } 
}

// =========================================================
// MÁGICA 4: SUB-ABAS DE PEDIDOS COM BOTÃO FINALIZAR (📦)
// =========================================================
function mudarVisaoPedidos(visao) {
    visaoPedidos = visao;
    const btnAtivos = document.getElementById('btn-visao-ativos');
    const btnFinais = document.getElementById('btn-visao-finalizados');
    const btnFiltroNaoEnviados = document.getElementById('btnFiltroNaoEnviado');

    if(visao === 'ATIVOS') {
        btnAtivos.classList.add('border-blue-600', 'text-blue-600');
        btnAtivos.classList.remove('border-transparent', 'text-slate-400');
        btnFinais.classList.remove('border-blue-600', 'text-blue-600');
        btnFinais.classList.add('border-transparent', 'text-slate-400');
        if(btnFiltroNaoEnviados) btnFiltroNaoEnviados.style.display = 'block';
    } else {
        btnFinais.classList.add('border-blue-600', 'text-blue-600');
        btnFinais.classList.remove('border-transparent', 'text-slate-400');
        btnAtivos.classList.remove('border-blue-600', 'text-blue-600');
        btnAtivos.classList.add('border-transparent', 'text-slate-400');
        if(btnFiltroNaoEnviados) btnFiltroNaoEnviados.style.display = 'none'; 
    }
    renderPedidos();
}

function togglePedidoFinalizado(u) {
    const x = pedidos.find(function(y) { return y.uid == u; });
    if (x) {
        if (x.status === "Entregue/Finalizado") x.status = "Pedido na loja"; 
        
        x.finalizado = !x.finalizado;
        salvarColecao('pedidos', pedidos);
        
        const acaoTxt = x.finalizado ? 'FINALIZOU PEDIDO' : 'RESTAUROU PEDIDO';
        const icone = x.finalizado ? '📦' : '🔙';
        registrarAcao(icone, acaoTxt, `CLIENTE: ${x.cliente}`);
        
        renderPedidos();
    }
}

function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); if(!tb) return;
    const elBusca = document.getElementById('busca');
    const b = removeAcentos((elBusca ? elBusca.value : "").toLowerCase());
    
    let lista = pedidos.filter(function(x) { return removeAcentos((x.cliente||"").toLowerCase()).includes(b) || removeAcentos((x.produto||"").toLowerCase()).includes(b) || removeAcentos((x.idDoc||"").toLowerCase()).includes(b) || removeAcentos((x.fornecedor||"").toLowerCase()).includes(b); });
    
    if (visaoPedidos === 'ATIVOS') {
        lista = lista.filter(function(x) { return !x.finalizado && x.status !== "Entregue/Finalizado"; });
        if(filtrandoNaoEnviados) lista=lista.filter(function(x){ return x.status==="Não enviado"; });
    } else {
        lista = lista.filter(function(x) { return x.finalizado || x.status === "Entregue/Finalizado"; });
    }

    document.getElementById('contador').innerText=lista.length+" PEDIDOS";
    
    tb.innerHTML = lista.map(function(x){
        const p=calcP(x.dataPedido, x.prazo); 
        
        let sCls = "bg-blue-600";
        if(x.status === "Não enviado") sCls = "bg-red-600";
        else if(x.status === "Pedido na loja") sCls = "bg-green-700";
        
        if (x.finalizado || x.status === "Entregue/Finalizado") sCls = "bg-slate-500 opacity-70"; 

        const btnFinalizar = (x.finalizado || x.status === "Entregue/Finalizado") 
            ? `<button onclick="togglePedidoFinalizado(${x.uid})" title="Restaurar aos Ativos" class="text-blue-500 font-black text-sm">🔙</button>`
            : `<button onclick="togglePedidoFinalizado(${x.uid})" title="Finalizar/Arquivar Pedido" class="text-green-600 font-black text-sm">📦</button>`;

        return `<tr class="${p.classe}"><td><input type="checkbox" class="ped-check" value="${x.uid}"></td><td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td><td class="text-[10px] text-slate-400 font-black">${esc(x.idDoc)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'pedidos')" class="editable-cell uppercase">${esc(x.cliente)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'dataPedido', 'pedidos')" class="editable-cell text-[10px]">${esc(x.dataPedido)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'pedidos')" class="editable-cell text-center font-black">${esc(x.qtd)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'pedidos')" class="editable-cell uppercase">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'medida', 'pedidos')" class="editable-cell uppercase">${esc(x.medida)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'cor', 'pedidos')" class="editable-cell uppercase">${esc(x.cor)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'custo', 'pedidos')" class="editable-cell">${esc(x.custo)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fornecedor', 'pedidos')" class="editable-cell font-black text-blue-800 uppercase text-[10px]">${esc(x.fornecedor)}</td><td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white">${esc(x.status)}</button></td><td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td><td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td><td class="text-center flex gap-1.5 justify-center items-center"><button onclick="copyText('${x.qtd}x ${esc(x.produto)} ${esc(x.cor)} (${esc(x.idDoc)})', this)" title="Copiar">📋</button>${btnFinalizar}<button onclick="dupPed(${x.uid})" title="Duplicar">➕</button><button onclick="gerarAssistenciaRapida(${x.uid})" title="Assistência">🛠️</button><button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black" title="Excluir">✕</button></td></tr>`;
    }).join('');
}

function cycleStatus(u){ 
    const x=pedidos.find(function(y){ return y.uid==u; }); 
    const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; 
    x.status=s[(s.indexOf(x.status)+1)%s.length]; 
    salvarColecao('pedidos', pedidos); 
}

function adicionarItemAoCesto() { const p = document.getElementById('m_produto').value.trim().toUpperCase(); if(!p) return alert("INFORME PRODUTO!"); cestoItensTemporario.push({ uid: Date.now(), q: document.getElementById('m_qtd').value || 1, p: p, m: document.getElementById('m_medida').value || "-", c: document.getElementById('m_cor').value.toUpperCase() || "-", v: document.getElementById('m_custo').value || "R$ 0,00" }); renderCesto(); document.getElementById('m_produto').value = ""; }
function renderCesto() { document.getElementById('cesto-itens').innerHTML = cestoItensTemporario.map(function(item, idx) { return `<div class="item-cesto"><span>${item.q}x</span><span>${esc(item.p)}</span><button onclick="cestoItensTemporario.splice(${idx},1); renderCesto();" class="text-red-500 font-bold ml-2">✕</button></div>`; }).join(''); }
async function cadastrarManual() { 
    const cli = document.getElementById('m_cliente').value.trim().toUpperCase(); const forn = document.getElementById('m_fornecedor_select').value; 
    if(!cli || cestoItensTemporario.length === 0) return alert("FALTA DADOS!"); 
    const nId = await getProximoID(); const idDoc = "ID#" + nId.toString().padStart(4, '0'); 
    cestoItensTemporario.forEach(function(i) { pedidos.unshift({ uid: Date.now()+Math.random(), idDoc: idDoc, cliente: cli, dataPedido: new Date().toLocaleDateString('pt-BR'), qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, fornecedor: forn, prazo: document.getElementById('m_prazo_select').value, status: "Não enviado", whatsEnviado: false, confirmado: false, finalizado: false }); }); 
    salvarColecao('pedidos', pedidos); registrarAcao('📋', 'NOVO PEDIDO', `CÓDIGO: ${idDoc} | CLIENTE: ${cli}`); cestoItensTemporario =[]; document.getElementById('m_cliente').value = ""; renderCesto(); 
}

function autoSalvarNotasEstoque() { notasEstoque = document.getElementById('estoque-notas-gerais').value; db.ref('dados/notasEstoque').set(notasEstoque); }
function renderEstoque() {
    const tb = document.getElementById('tabelaEstoque'); if(!tb) return;
    const elBusca = document.getElementById('estoque-busca');
    const b = removeAcentos((elBusca ? elBusca.value : "").toLowerCase());
    const elFab = document.getElementById('estoque-filtro-fabrica');
    const fFab = elFab ? elFab.value : "TODAS";
    const elFiltroSit = document.getElementById('estoque-filtro-situacao');
    const fSit = elFiltroSit ? elFiltroSit.value : "TODAS";
    let totEst = 0, totVen = 0;
    let lista = estoque.filter(function(x) {
        const prod = removeAcentos((x.produto||"").toLowerCase());
        const fab = removeAcentos((x.fabrica||"").toLowerCase());
        const sit = x.situacao||"ESTOQUE";
        if(sit === 'ESTOQUE') totEst += parseInt(x.qtd || 0);
        if(sit === 'VENDIDO') totVen += parseInt(x.qtd || 0);
        return (prod.includes(b) || fab.includes(b)) && (fFab === "TODAS" || x.fabrica === fFab) && (fSit === "TODAS" || sit === fSit) && (!filtrandoVendidos || sit === 'VENDIDO');
    });
    if(document.getElementById('resumo-estoque-total')) document.getElementById('resumo-estoque-total').innerText = totEst;
    if(document.getElementById('resumo-estoque-vendidos')) document.getElementById('resumo-estoque-vendidos').innerText = totVen;
    tb.innerHTML = lista.map(function(x) { return `<tr><td class="text-[10px] text-slate-400 font-bold">${esc(x.data) || '-'}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'estoque')" class="editable-cell uppercase font-bold">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'estoque')" class="editable-cell text-blue-600 text-[10px] font-black uppercase">${esc(x.fabrica) || "-"}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'estoque')" class="editable-cell text-center">${esc(x.qtd)}</td><td><button onclick="cycleEstoqueStatus(${x.uid})" class="px-2 py-1 rounded text-[9px] font-black w-full text-center transition ${x.situacao === 'VENDIDO' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}">${esc(x.situacao)}</button></td><td class="text-center flex gap-1 justify-center">${x.situacao === 'ESTOQUE' ? `<button onclick="darBaixaEstoque(${x.uid})" title="Dar Baixa">📉</button>` : ''}<button onclick="if(confirm('EXCLUIR?')){estoque=estoque.filter(function(y){return y.uid!=${x.uid};}); salvarColecao('estoque', estoque);}" class="text-red-500 font-black px-2">✕</button></td></tr>`; }).join('');
}
function cycleEstoqueStatus(u){ const x = estoque.find(function(y) { return y.uid == u; }); if(x) { x.situacao = x.situacao === 'ESTOQUE' ? 'VENDIDO' : 'ESTOQUE'; salvarColecao('estoque', estoque); } }
function darBaixaEstoque(u) { const it = estoque.find(function(x) { return x.uid == u; }); if (!it) return; let qS = prompt(`SAÍDA DE "${it.produto}". QTD?`, "1"); if (!qS) return; qS = parseInt(qS); if (isNaN(qS) || qS <= 0 || qS > it.qtd) return alert("QTD INVÁLIDA!"); if (qS == it.qtd) { it.situacao = "VENDIDO"; it.data = new Date().toLocaleDateString('pt-BR'); } else { it.qtd -= qS; estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: it.produto, fabrica: it.fabrica, qtd: qS, situacao: "VENDIDO" }); } salvarColecao('estoque', estoque); registrarAcao('📉', 'BAIXOU NO ESTOQUE', `DEU BAIXA EM ${qS}x ${it.produto}`); }
function cadastrarEstoque() { const p = document.getElementById('e_produto').value.toUpperCase().trim(), f = document.getElementById('e_fabrica_select').value, q = document.getElementById('e_qtd').value, s = document.getElementById('e_situacao').value; if (p) { estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: p, fabrica: f, qtd: parseInt(q), situacao: s }); salvarColecao('estoque', estoque); registrarAcao('📦', 'ADICIONOU AO ESTOQUE', `${q}x ${p} (${f})`); document.getElementById('e_produto').value = ""; } }
function toggleFiltroVendidos(){ filtrandoVendidos=!filtrandoVendidos; document.getElementById('btnFiltroVendidos').classList.toggle('bg-red-600'); document.getElementById('btnFiltroVendidos').classList.toggle('text-white'); renderEstoque(); }

function renderAssistencias() { 
    const tb = document.getElementById('tabelaAssistencias'); 
    if(!tb) return;
    const elBusca = document.getElementById('busca-assistencia');
    const b = removeAcentos((elBusca ? elBusca.value : "").toLowerCase());
    const elFiltro = document.getElementById('filtro-assistencia-status');
    const fStatus = elFiltro ? elFiltro.value : "TODAS";
    
    let lista = assistencias.filter(function(x) {
        const cliente = removeAcentos((x.cliente || "").toLowerCase());
        const produto = removeAcentos((x.produto || "").toLowerCase());
        const fabrica = removeAcentos((x.fabrica || "").toLowerCase());
        const status = x.status || "Aguardando";
        return (cliente.includes(b) || produto.includes(b) || fabrica.includes(b)) && (fStatus === "TODAS" || status === fStatus);
    });
    const cnt = document.getElementById('contador-assistencia');
    if(cnt) cnt.innerText = lista.length + " ASSISTÊNCIAS";

    tb.innerHTML = lista.map(function(x) {
        let sCls = "bg-slate-200 text-slate-700";
        if(x.status === "Aguardando") sCls = "bg-red-100 text-red-700 hover:bg-red-200";
        else if(x.status === "Peça Solicitada") sCls = "bg-blue-100 text-blue-700 hover:bg-blue-200";
        else if(x.status === "Concluído") sCls = "bg-green-100 text-green-700 hover:bg-green-200";
        return `<tr class="border-b border-slate-50 hover:bg-slate-50 transition">
            <td class="text-[10px] font-bold text-slate-400">${esc(x.data)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'assistencias')" class="editable-cell uppercase font-bold">${esc(x.cliente)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'assistencias')" class="editable-cell uppercase">${esc(x.produto)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'assistencias')" class="editable-cell font-black text-blue-800 uppercase text-[10px]">${esc(x.fabrica)}</td>
            <td class="text-center"><button onclick="cycleAssisStatus(${x.uid})" class="px-2 py-1.5 rounded text-[9px] font-black w-full text-center transition ${sCls}">${esc(x.status)}</button></td>
            <td class="text-center flex gap-1 justify-center"><button onclick="if(confirm('EXCLUIR ASSISTÊNCIA?')){assistencias=assistencias.filter(function(y){return y.uid!=${x.uid};}); salvarColecao('assistencias', assistencias);}" class="text-red-500 font-black px-2 hover:text-red-700 text-lg">✕</button></td>
        </tr>`;
    }).join(''); 
}
function cadastrarAssistencia(){ 
    const c=document.getElementById('as_cliente').value.toUpperCase().trim(), p=document.getElementById('as_produto').value.toUpperCase().trim(), f=document.getElementById('as_fabrica').value; 
    if(c&&p){ 
        assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); 
        salvarColecao('assistencias', assistencias); registrarAcao('🛠️', 'REGISTROU ASSISTÊNCIA', `CLIENTE: ${c} | DEFEITO: ${p}`); document.getElementById('as_cliente').value=""; document.getElementById('as_produto').value=""; 
    } else { alert("PREENCHA O CLIENTE E O PRODUTO/DEFEITO!"); }
}

function renderFornecedores() { const tb = document.getElementById('tabelaFornecedores'); if(!tb) return; tb.innerHTML = fornecedores.map(function(f, i) { return `<tr><td class="font-bold uppercase">${esc(f.nome)}</td><td class="lowercase text-blue-600">${esc(f.email)}</td><td class="text-center"><button onclick="fornecedores.splice(${i},1); salvarColecao('fornecedores', fornecedores);" class="text-red-500 font-black">✕</button></td></tr>`; }).join(''); }
function cadastrarFornecedor(){ const n=document.getElementById('f_nome').value.toUpperCase().trim(), e=document.getElementById('f_email').value.toLowerCase().trim(); if(n&&e){fornecedores.push({nome:n,email:e}); salvarColecao('fornecedores', fornecedores); document.getElementById('f_nome').value=""; document.getElementById('f_email').value="";}}
function renderCatalogo() { const tb=document.getElementById('tabelaCatalogo'); if(!tb) return; tb.innerHTML=catalogo.map(function(c,i){ return `<tr><td class="uppercase">${esc(c.nome)}</td><td class="text-center"><button onclick="catalogo.splice(${i},1); salvarColecao('catalogo', catalogo);">✕</button></td></tr>`; }).join(''); }
function cadastrarCatalogo(){ const n=document.getElementById('cat_nome').value.toUpperCase(); if(n){catalogo.push({nome:n}); salvarColecao('catalogo', catalogo); document.getElementById('cat_nome').value="";}}

// --- ABA EQUIPE KANBAN ---
const coresEquipe = {
    "LUCAS": "bg-emerald-100 text-emerald-700 border-emerald-400",
    "GUILHERME": "bg-blue-100 text-blue-700 border-blue-400",
    "CAROL": "bg-orange-100 text-orange-700 border-orange-400",
    "ISABELLA": "bg-amber-100 text-amber-700 border-amber-400",
    "ANGÉLICA": "bg-purple-100 text-purple-700 border-purple-400"
};

const telefonesEquipe = {
    "LUCAS": "5527996109720",
    "ANGÉLICA": "5527998094627",
    "GUILHERME": "5527999468458",
    "CAROL": "5527999517954",
    "ISABELLA": "5527997452190"
};

let colsMinimizadas = { "TODO": false, "DOING": false, "DONE": false };

function toggleColunaKanban(coluna) { colsMinimizadas[coluna] = !colsMinimizadas[coluna]; renderQuadroEquipe(); }

async function notificarNoGrupoComPrint(tarefa, tipoAcao) {
    const quem = usuarioAtual || "A equipe";
    const baseUrl = window.location.href.split('?')[0];
    const linkAcesso = `${baseUrl}?tarefa=${tarefa.uid}`;
    
    const mapaPrazo = { "AGORA": "🚨 AGORA (Urgente)", "IMEDIATO": "⚡ 1 DIA", "IMPORTANTE": "⚠️ 2 DIAS", "REGULAR": "📅 3 DIAS", "TRANQUILO": "☕ + DIAS", "": "Sem prazo" };

    let msg = "";
    if (tipoAcao === 'NOVA') { msg = `📢 *NOVA TAREFA*\nDesignada para: *${tarefa.responsavel}*\nCriada por: ${quem}\n\n📌 *${tarefa.descricao}*\n🗓️ Prazo: ${mapaPrazo[tarefa.prazo || ""]}\n\n🔗 *Acessar no sistema:*\n${linkAcesso}`; } 
    else if (tipoAcao === 'CONCLUIDA') { msg = `✅ *TAREFA CONCLUÍDA*\nFinalizada por: *${quem}*\n\n📌 *${tarefa.descricao}*\n👤 Resp: ${tarefa.responsavel}\n\n🔗 *Ver histórico no sistema:*\n${linkAcesso}`; }

    if(confirm(`Deseja notificar no WhatsApp da loja e tentar COPIAR A IMAGEM do cartão automaticamente?`)) {
        if(tarefa.minimizada) minimizarTarefaEquipe(tarefa.uid);
        const cardElement = document.getElementById('card-' + tarefa.uid);
        if (cardElement && typeof html2canvas !== 'undefined') {
            try {
                const canvas = await html2canvas(cardElement, { scale: 2, backgroundColor: null });
                canvas.toBlob(async function(blob) {
                    try {
                        if(typeof ClipboardItem !== 'undefined') {
                            const item = new ClipboardItem({ "image/png": blob }); await navigator.clipboard.write([item]);
                            alert("📸 A FOTO DA TAREFA FOI COPIADA!\n\nO WhatsApp será aberto agora. Basta você dar um COLAR (Ctrl+V) antes de enviar para anexar o print.");
                        } else { alert("⚠️ Seu navegador antigo não suporta copiar a foto. O WhatsApp abrirá apenas com o texto."); }
                    } catch (err) { alert("⚠️ O seu navegador bloqueou a cópia automática da foto. O WhatsApp será aberto apenas com o texto."); }
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }, "image/png");
                return; 
            } catch (error) { console.error("Erro html2canvas: ", error); }
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

let filtrosEquipeAtivos =[];
function toggleFiltroEquipe(nome) { if(nome === 'TODOS') { filtrosEquipeAtivos =[]; } else { if(filtrosEquipeAtivos.includes(nome)) filtrosEquipeAtivos = filtrosEquipeAtivos.filter(function(x){ return x !== nome; }); else filtrosEquipeAtivos.push(nome); } renderFiltrosEquipe(); renderQuadroEquipe(); }

function renderFiltrosEquipe() {
    const div = document.getElementById('filtros-equipe'); if(!div) return;
    if(modoMinhasTarefas) { div.style.opacity = '0.3'; div.style.pointerEvents = 'none'; } else { div.style.opacity = '1'; div.style.pointerEvents = 'auto'; }
    let html = `<button onclick="toggleFiltroEquipe('TODOS')" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition border-2 ${filtrosEquipeAtivos.length === 0 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}">🌟 TODOS</button>`;
    Object.keys(coresEquipe).forEach(function(nome) {
        const corAtiva = coresEquipe[nome].split(' ')[1]; const isAtivo = filtrosEquipeAtivos.includes(nome);
        const style = isAtivo ? `${coresEquipe[nome]} border-2 border-transparent shadow-sm` : `bg-white ${corAtiva} border-2 border-slate-200 hover:border-slate-300`;
        html += `<button onclick="toggleFiltroEquipe('${nome}')" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition ${style}">${nome}</button>`;
    });
    div.innerHTML = html;
}

function adicionarTarefaEquipe() {
    const desc = document.getElementById('eq_desc').value.trim().toUpperCase(); const resp = document.getElementById('eq_resp').value; const prazo = document.getElementById('eq_prazo').value; 
    if(!desc) return alert("DIGITE A DESCRIÇÃO DA TAREFA!");
    const novaTarefa = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), descricao: desc, responsavel: resp, prazo: prazo, coluna: "TODO", comentarios:[], minimizada: false };
    tarefasEquipe.push(novaTarefa); salvarColecao('tarefasEquipe', tarefasEquipe); registrarAcao('📌', 'CRIOU NOVA TAREFA', `PARA: ${resp} | TAREFA: ${desc}`); 
    document.getElementById('eq_desc').value = ""; document.getElementById('eq_prazo').value = ""; renderQuadroEquipe(); setTimeout(function() { notificarNoGrupoComPrint(novaTarefa, 'NOVA'); }, 300);
}

function moverTarefaEquipe(uid, novaColuna) {
    const t = tarefasEquipe.find(function(x){ return x.uid == uid; });
    if(t && t.coluna !== novaColuna) {
        const mapa = {"TODO":"A FAZER", "DOING":"EM ANDAMENTO", "DONE":"CONCLUÍDO"}; t.coluna = novaColuna;
        salvarColecao('tarefasEquipe', tarefasEquipe); registrarAcao('🔄', 'MOVEU A TAREFA', `${t.descricao} ➡️ ${mapa[novaColuna]}`); renderQuadroEquipe();
        if (novaColuna === 'DONE') { setTimeout(function() { notificarNoGrupoComPrint(t, 'CONCLUIDA'); }, 300); }
    }
}

function excluirTarefaEquipe(uid) { const t = tarefasEquipe.find(function(x){ return x.uid == uid; }); if(confirm("EXCLUIR ESTA TAREFA DA EQUIPE?")) { if(t) registrarAcao('🗑️', 'APAGOU TAREFA', `TAREFA: ${t.descricao}`); tarefasEquipe = tarefasEquipe.filter(function(x){ return x.uid != uid; }); salvarColecao('tarefasEquipe', tarefasEquipe); } }
function minimizarTarefaEquipe(uid) { const t = tarefasEquipe.find(function(x){ return x.uid == uid; }); if(t) { t.minimizada = !t.minimizada; salvarColecao('tarefasEquipe', tarefasEquipe); renderQuadroEquipe(); } }

let uidUploadPendente = null;
function acionarUploadImagem(uid) { if(!usuarioAtual) return alert("Por favor, selecione quem você é no topo da tela antes de anexar imagens!"); uidUploadPendente = uid; document.getElementById('file-upload-global').click(); }
function processarUploadImagem(event) {
    const file = event.target.files[0]; if(!file || !uidUploadPendente) return;
    const t = tarefasEquipe.find(function(x){ return x.uid == uidUploadPendente; }); if(!t) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; const MAX_HEIGHT = 800; let width = img.width; let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
            const base64Data = canvas.toDataURL('image/jpeg', 0.6); 
            t.comentarios = safeArray(t.comentarios); const agora = new Date(); const strData = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            t.comentarios.push({ id: Date.now(), autor: usuarioAtual, texto: "📷 FOTO ANEXADA", anexo: base64Data, dataHora: strData });
            salvarColecao('tarefasEquipe', tarefasEquipe); registrarAcao('📎', 'ANEXOU FOTO', `NA TAREFA: ${t.descricao}`); renderQuadroEquipe(); event.target.value = ""; 
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}

function adicionarComentarioInline(uid, inputElement) {
    if(!usuarioAtual) return alert("Por favor, selecione quem você é no topo da tela antes de comentar!");
    const txt = inputElement.value.trim().toUpperCase(); if(!txt) return;
    const t = tarefasEquipe.find(function(x){ return x.uid == uid; }); if(!t) return;
    t.comentarios = safeArray(t.comentarios); const agora = new Date(); const strData = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    t.comentarios.push({ id: Date.now(), autor: usuarioAtual, texto: txt, dataHora: strData });
    salvarColecao('tarefasEquipe', tarefasEquipe); registrarAcao('💬', 'COMENTOU NA TAREFA', `${t.descricao} | "${txt}"`); inputElement.value = ""; 
    setTimeout(function() { const chatBox = document.getElementById('chat-' + uid); if(chatBox) chatBox.scrollTop = chatBox.scrollHeight; }, 100);
}

function dragTarefa(ev, uid) { ev.dataTransfer.setData("text/plain", uid); setTimeout(function(){ ev.target.classList.add('opacity-40'); }, 10); }
function dragEndTarefa(ev) { ev.target.classList.remove('opacity-40'); }
function allowDropTarefa(ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; }
function dropTarefa(ev, col) { ev.preventDefault(); const uid = ev.dataTransfer.getData("text/plain"); if(uid) moverTarefaEquipe(uid, col); }

function getBadgePrazo(prazo) {
    if(!prazo) return '';
    if(prazo === 'AGORA') return `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-red-300 shadow-sm">🚨 AGORA</span>`;
    if(prazo === 'IMEDIATO') return `<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-orange-300 shadow-sm">⚡ 1 DIA</span>`;
    if(prazo === 'IMPORTANTE') return `<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-amber-300 shadow-sm">⚠️ 2 DIAS</span>`;
    if(prazo === 'REGULAR') return `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-blue-300 shadow-sm">📅 3 DIAS</span>`;
    if(prazo === 'TRANQUILO') return `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[9px] font-black uppercase border border-emerald-300 shadow-sm">☕ + DIAS</span>`;
    return '';
}

function renderQuadroEquipe() {
    const colTodo = document.getElementById('col-todo'); const colDoing = document.getElementById('col-doing'); const colDone = document.getElementById('col-done'); if(!colTodo) return;['TODO', 'DOING', 'DONE'].forEach(function(col) {
        const container = document.getElementById('col-' + col.toLowerCase() + '-container'); const content = document.getElementById('col-' + col.toLowerCase()); const btn = document.getElementById('btn-toggle-' + col.toLowerCase());
        if(container && content && btn) {
            if(colsMinimizadas[col]) { container.classList.remove('min-h-[500px]'); container.classList.add('h-fit', 'pb-0'); content.classList.add('hidden'); btn.innerText = '➕'; } 
            else { container.classList.add('min-h-[500px]'); container.classList.remove('h-fit', 'pb-0'); content.classList.remove('hidden'); btn.innerText = '➖'; }
        }
    });

    let cTodo = 0, cDoing = 0, cDone = 0; let htmlTodo = "", htmlDoing = "", htmlDone = "";
    const pesoPrazo = { "AGORA": 1, "IMEDIATO": 2, "IMPORTANTE": 3, "REGULAR": 4, "TRANQUILO": 5, "": 6 };
    let tarefasOrdenadas =[...tarefasEquipe].sort(function(a, b) { let pA = pesoPrazo[a.prazo || ""] || 6; let pB = pesoPrazo[b.prazo || ""] || 6; if (pA !== pB) return pA - pB; return b.uid - a.uid; });

    tarefasOrdenadas.forEach(function(t) {
        if (modoMinhasTarefas && usuarioAtual && t.responsavel !== usuarioAtual) return;
        if (!modoMinhasTarefas && filtrosEquipeAtivos.length > 0 && !filtrosEquipeAtivos.includes(t.responsavel)) return;
        const cor = coresEquipe[t.responsavel] || "bg-slate-100 text-slate-700 border-slate-300"; const corBorda = cor.split(' ')[2]; 
        const arrComent = safeArray(t.comentarios); let comentariosHtml = "";
        if (arrComent.length > 0) {
            comentariosHtml = arrComent.map(function(c) {
                const cCor = coresEquipe[c.autor] ? coresEquipe[c.autor].split(' ')[1] : "text-slate-600"; 
                const anexoHtml = c.anexo ? `<br><img src="${c.anexo}" class="mt-2 rounded-lg max-h-40 w-full cursor-pointer object-cover border border-slate-200" onclick="window.open('${c.anexo}', '_blank')" />` : '';
                return `<div class="mb-2 leading-tight bg-white p-2 rounded-md border border-slate-100 shadow-sm"><span class="${cCor} font-black text-[9px] uppercase tracking-tighter">${esc(c.autor)}:</span> <span class="text-[10px] font-bold text-slate-700">${esc(c.texto)}</span>${anexoHtml}</div>`;
            }).join('');
        }
        
        const isMin = t.minimizada || false; const badgePrazo = getBadgePrazo(t.prazo);
        const btnMover = "text-slate-300 hover:text-blue-500 font-black text-xl p-1 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors";
        const btnVoltar = "text-slate-300 hover:text-slate-500 font-black text-xl p-1 bg-slate-50 hover:bg-slate-200 rounded-lg transition-colors";
        const btnConcluir = "text-slate-300 hover:text-green-500 font-black text-xl p-1 ml-1 bg-slate-50 hover:bg-green-50 rounded-lg transition-colors";

        const card = `
            <div id="card-${t.uid}" draggable="true" ondragstart="dragTarefa(event, ${t.uid})" ondragend="dragEndTarefa(event)" class="bg-white p-3.5 rounded-2xl shadow-sm border-t-4 ${corBorda} flex flex-col gap-2 transition hover:shadow-md cursor-grab active:cursor-grabbing relative overflow-hidden">
                <div class="flex justify-between items-start"><div class="flex flex-col gap-1 items-start"><span class="${cor} px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">${esc(t.responsavel)}</span>${badgePrazo}</div><div class="flex gap-1 items-center"><button onclick="minimizarTarefaEquipe(${t.uid})" class="text-slate-400 hover:text-slate-800 font-black text-[12px] mr-2 bg-slate-100 px-3 py-1 rounded-lg transition shadow-sm" title="Minimizar/Expandir">${isMin ? '➕' : '➖'}</button>${t.coluna === 'TODO' ? `<button onclick="moverTarefaEquipe(${t.uid}, 'DOING')" class="${btnMover}" title="Mover p/ Em Andamento">➡️</button>` : ''}${t.coluna === 'DOING' ? `<button onclick="moverTarefaEquipe(${t.uid}, 'TODO')" class="${btnVoltar}" title="Voltar p/ Fazer">⬅️</button> <button onclick="moverTarefaEquipe(${t.uid}, 'DONE')" class="${btnConcluir}" title="Concluir">✅</button>` : ''}${t.coluna === 'DONE' ? `<button onclick="moverTarefaEquipe(${t.uid}, 'DOING')" class="${btnVoltar}" title="Voltar p/ Em Andamento">⬅️</button>` : ''}<button onclick="excluirTarefaEquipe(${t.uid})" class="text-slate-200 hover:text-red-500 font-black text-lg ml-3 p-1" title="Excluir">✕</button></div></div>
                ${!isMin ? `<span class="text-sm font-black uppercase text-slate-800 leading-snug mt-1">${esc(t.descricao)}</span><span class="text-[8px] font-black text-slate-300 border-b border-slate-100 pb-2">Criado em: ${t.data}</span><div class="mt-1 flex flex-col gap-1.5">${arrComent.length > 0 ? `<div id="chat-${t.uid}" class="bg-slate-50 p-2 rounded-lg max-h-48 overflow-y-auto shadow-inner custom-scrollbar">${comentariosHtml}</div>` : ''}<div class="flex gap-1 mt-1 items-center"><input type="text" placeholder="Responder..." onkeydown="if(event.key==='Enter') { adicionarComentarioInline(${t.uid}, this); }" class="flex-1 bg-white border border-slate-200 p-2 text-[10px] font-bold rounded-xl outline-blue-500 uppercase placeholder:text-slate-300 shadow-sm"><button onclick="acionarUploadImagem(${t.uid})" class="bg-slate-100 text-slate-400 hover:text-blue-600 px-2 rounded-xl font-black text-[12px] transition h-full border border-slate-200" title="Anexar Imagem">📎</button><button onclick="adicionarComentarioInline(${t.uid}, this.previousElementSibling.previousElementSibling)" class="bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-600 px-3 rounded-xl font-black text-[12px] transition h-full border border-transparent">➤</button></div></div>` : `<span class="text-[11px] font-black uppercase text-slate-800 leading-snug mt-1 truncate border-t pt-2">${esc(t.descricao)}</span>`}
            </div>
        `;
        if(t.coluna === 'TODO') { htmlTodo += card; cTodo++; } else if(t.coluna === 'DOING') { htmlDoing += card; cDoing++; } else if(t.coluna === 'DONE') { htmlDone += card; cDone++; }
    });

    if(document.getElementById('col-todo')) document.getElementById('col-todo').innerHTML = htmlTodo || '<span class="text-[10px] font-bold text-slate-400 text-center mt-6 uppercase">Limpo 🎉</span>';
    if(document.getElementById('col-doing')) document.getElementById('col-doing').innerHTML = htmlDoing || '<span class="text-[10px] font-bold text-slate-400 text-center mt-6 uppercase">Nada em andamento</span>';
    if(document.getElementById('col-done')) document.getElementById('col-done').innerHTML = htmlDone || '<span class="text-[10px] font-bold text-slate-400 text-center mt-6 uppercase">Nenhuma conclusão</span>';
    if(document.getElementById('count-todo')) document.getElementById('count-todo').innerText = cTodo;
    if(document.getElementById('count-doing')) document.getElementById('count-doing').innerText = cDoing;
    if(document.getElementById('count-done')) document.getElementById('count-done').innerText = cDone;
    tarefasEquipe.forEach(function(t) { const chatBox = document.getElementById('chat-' + t.uid); if(chatBox) chatBox.scrollTop = chatBox.scrollHeight; });
}

function processarFichaWhatsApp(texto) {
    if(!texto) return;
    const mNome = texto.match(/Nome(?: Completo)?\s*[:\-]?\s*(.+)/i); const mCpf = texto.match(/CPF\s*[:\-]?\s*([\d\.\-]+)/i); const mCep = texto.match(/CEP\s*[:\-]?\s*([\d\.\-]+)/i); const mEnd = texto.match(/Endere[çc]o\s*[:\-]?\s*(.+)/i); const mContato = texto.match(/(?:^|\n)\s*Contato(?: 1)?\s*[:\-]?\s*(.+)/i); const mContato2 = texto.match(/(?:^|\n)\s*Contato\s*2\s*[:\-]?\s*(.+)/i); const mNum = texto.match(/(?:^|\n)\s*N(?:[°ºoúu]mero)?\s*[:\-]?\s*([A-Za-z0-9]+)/i); const mObs = texto.match(/(?:OBS|OBSERVA[CÇ][AÃ]O)(?:ES)?\s*[:\-]?\s*([\s\S]+)/i);
    if (mNome) document.getElementById('t_nome').value = mNome[1].trim().toUpperCase(); if (mEnd) document.getElementById('t_end').value = mEnd[1].trim().toUpperCase(); if (mContato) document.getElementById('t_contato').value = mContato[1].trim().toUpperCase(); if (mContato2) document.getElementById('t_contato2').value = mContato2[1].trim().toUpperCase(); if (mNum) document.getElementById('t_num').value = mNum[1].trim().toUpperCase(); if (mObs) document.getElementById('t_obs').value = mObs[1].trim().toUpperCase();
    if (mCpf) { let cpfInput = document.getElementById('t_cpf'); cpfInput.value = mCpf[1].trim(); maskCPF(cpfInput); }
    if (mCep) { let cepInput = document.getElementById('t_cep'); cepInput.value = mCep[1].trim(); buscarCEP(cepInput); }
}

function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`
            <div class="col-span-1 md:col-span-4 mb-2 bg-indigo-50 p-4 rounded-xl border-2 border-dashed border-indigo-300 w-full"><label class="text-[10px] font-black text-indigo-800 uppercase mb-2 block flex items-center gap-2">✨ Cole a ficha do WhatsApp aqui:</label><textarea id="t_magic_box" oninput="processarFichaWhatsApp(this.value)" placeholder="Ficha de Cadastro&#10;Nome Completo:&#10;CPF:&#10;CEP:&#10;Endereço:&#10;N:&#10;Contato 1:&#10;Contato 2:&#10;OBS:" class="w-full border p-3 rounded-lg text-xs font-bold outline-indigo-500 h-24 resize-none shadow-inner"></textarea><p class="text-[9px] font-bold text-indigo-400 mt-1 uppercase">O sistema tentará preencher os dados abaixo sozinho.</p></div>
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
            <div class="col-span-1 md:col-span-4 border-t mt-4 pt-4 w-full"><div id="lista-produtos-tarefa" class="flex flex-col gap-2 w-full"></div><button onclick="addProdutoLinha()" class="text-[10px] font-black text-blue-600 mt-2 uppercase hover:underline">+ MÓVEL</button><div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-xs mt-1 uppercase italic">Total: R$ 0,00</div></div>
            <div class="col-span-1 md:col-span-4 border-t mt-4 pt-4 w-full"><div id="lista-pagamentos-tarefa" class="flex flex-col gap-2 w-full"></div><button onclick="addPagamentoLinha()" class="text-[10px] font-black text-emerald-600 mt-2 uppercase hover:underline">+ PAGAMENTO</button></div>
            <textarea id="t_obs" placeholder="OBSERVAÇÕES DO PEDIDO..." class="col-span-1 md:col-span-4 border-2 p-2 rounded-lg text-xs font-bold h-16 uppercase mt-2 w-full outline-indigo-500"></textarea>
        `;
        addProdutoLinha(); addPagamentoLinha();
    } else { c.innerHTML = `<input id="t_raw" placeholder="DESCRICAO..." class="border-2 p-2 rounded-lg text-xs font-bold col-span-4 uppercase w-full outline-indigo-500">`; }
}
function addProdutoLinha(){ const d = document.getElementById('lista-produtos-tarefa'); const r = document.createElement('div'); r.className = "flex flex-col md:flex-row gap-2 mb-2 items-start md:items-center row-prod bg-slate-50 p-3 rounded-lg border border-dashed w-full"; r.innerHTML = `<div class="flex justify-between w-full md:flex-1 gap-2"><input class="t-p-nome border-2 p-2 rounded text-xs font-bold flex-1 uppercase w-full outline-indigo-500" placeholder="MÓVEL"><button onclick="this.parentElement.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-3 py-1 md:hidden bg-red-100 rounded-lg">✕</button></div><div class="flex w-full md:w-auto gap-2"><input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-1/2 md:w-28 outline-indigo-500" placeholder="ORIGINAL" oninput="maskMoney(this)"><input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-1/2 md:w-28 text-indigo-600 outline-indigo-500" placeholder="DESCONTO" oninput="maskMoney(this)"><button onclick="this.parentElement.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-2 hidden md:block hover:text-red-700">✕</button></div>`; d.appendChild(r); }
function addPagamentoLinha(){
    const d=document.getElementById('lista-pagamentos-tarefa'); let total=0; document.querySelectorAll('.t-v-desc').forEach(function(i){total+=parseMoney(i.value);}); let pago=0; document.querySelectorAll('.t-p-val').forEach(function(i){pago+=parseMoney(i.value);}); let saldo=total-pago; if(saldo<0) saldo=0;
    const r=document.createElement('div'); r.className="flex flex-col bg-slate-50 p-3 rounded-lg border mb-3 row-pag w-full gap-2";
    r.innerHTML=`<div class="flex gap-2 mb-1 flex-wrap md:flex-nowrap w-full"><button onclick="setP(this,'PIX')" class="btn-pag-opt active flex-1 md:flex-none text-center px-1 py-2 text-[10px]">PIX</button><button onclick="setP(this,'CRÉDITO')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">CRÉDITO</button><button onclick="setP(this,'DÉBITO')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">DÉBITO</button><button onclick="setP(this,'CHEQUE')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">CHEQUE</button><input type="hidden" class="t-p-tipo" value="PIX"><select class="t-p-parc hidden border-2 p-1 rounded text-[10px] font-bold bg-white w-full md:w-auto mt-2 md:mt-0 outline-emerald-500">${[...Array(12).keys()].map(function(n){ return `<option value="${n+1}x">${n+1}x</option>`; }).join('')}</select></div><div class="flex flex-col md:flex-row gap-2 w-full"><input class="t-p-val border-2 p-2 rounded-lg text-xs font-bold w-full md:w-48 text-emerald-600 outline-emerald-500" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${saldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}"><div class="flex w-full gap-2 md:flex-1"><input class="t-p-obs border-2 p-2 rounded-lg text-xs font-bold flex-1 uppercase outline-emerald-500" placeholder="OBS/DATA"><button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-red-500 font-black px-3 py-1 bg-red-100 md:bg-transparent rounded-lg md:hover:text-red-700">✕</button></div></div>`;
    d.appendChild(r);
}
function setP(b,v){ const p = b.parentElement; p.querySelectorAll('button').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); p.querySelector('.t-p-tipo').value=v; const s = p.querySelector('.t-p-parc'); if(v === 'CRÉDITO') s.classList.remove('hidden'); else s.classList.add('hidden'); }
function calcTotalTirarPedido(){ let t=0; document.querySelectorAll('.t-v-desc').forEach(function(i){t+=parseMoney(i.value);}); document.getElementById('total-pedido-tarefa').innerText="Total: R$ "+t.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function cadastrarTarefa(){
    const t = document.getElementById('t_tipo').value; let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: t, status: "Não Iniciado" };
    if(t === 'TIRAR PEDIDO'){ 
        const cli = document.getElementById('t_nome').value; if(!cli) return alert("FALTA NOME DO CLIENTE!"); let total=0; document.querySelectorAll('.t-v-desc').forEach(function(i){total+=parseMoney(i.value);}); obj.descricao = "PEDIDO: " + cli.toUpperCase(); obj.detalhes = { cliente: cli.toUpperCase(), cpf: document.getElementById('t_cpf').value, contato: document.getElementById('t_contato').value, contato2: document.getElementById('t_contato2').value, cep: document.getElementById('t_cep').value, end: document.getElementById('t_end').value, bairro: document.getElementById('t_bairro').value, cidade: document.getElementById('t_cidade').value, num: document.getElementById('t_num').value, torre: document.getElementById('t_torre').value, obs: document.getElementById('t_obs').value, totalDesc:"R$ "+total.toLocaleString('pt-BR',{minimumFractionDigits:2}), produtos:[], pagamentos:[] }; document.querySelectorAll('.row-prod').forEach(function(row){ if(row.querySelector('.t-p-nome').value) obj.detalhes.produtos.push({ n: row.querySelector('.t-p-nome').value.toUpperCase(), o: row.querySelector('.t-v-orig').value, d: row.querySelector('.t-v-desc').value }); }); document.querySelectorAll('.row-pag').forEach(function(row){ const tipo = row.querySelector('.t-p-tipo').value; const parcelas = (tipo === 'CRÉDITO') ? row.querySelector('.t-p-parc').value : ""; obj.detalhes.pagamentos.push({ t: tipo + (parcelas ? " " + parcelas : ""), v: row.querySelector('.t-p-val').value, o: row.querySelector('.t-p-obs').value.toUpperCase() }); }); 
        salvarColecao('tarefas', tarefas); registrarAcao('📋', 'NOVA TAREFA DE PEDIDO', `CLIENTE: ${cli}`); 
    }
    else { 
        obj.descricao = (document.getElementById('t_raw') ? document.getElementById('t_raw').value : "").toUpperCase(); 
        salvarColecao('tarefas', tarefas); registrarAcao('📝', 'NOVA ANOTAÇÃO', obj.descricao); 
    }
    if(!obj.descricao) return; tarefas.unshift(obj); salvarColecao('tarefas', tarefas); mostrarCamposTarefa(t); renderTarefas();
}
function renderTarefas() { const tb=document.getElementById('tabelaTarefas'); if(!tb) return; const f=document.getElementById('filtro-tarefa-status').value; let lista=f==='TODAS'?tarefas:tarefas.filter(function(x){return x.status===f;}); tb.innerHTML=lista.map(function(x){ return `<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>${esc(x.data)}</td><td class="font-black text-xs uppercase">${esc(x.descricao)}</td><td class="text-[10px] uppercase">${esc(x.tipo)}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${esc(x.status)}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarColecao('tarefas', tarefas);}" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>`; }).join(''); }

function verDetalhesTarefa(uid){
    const t=tarefas.find(function(x){ return x.uid==uid; }); if(!t) return; document.getElementById('modal-detalhes').style.display='flex'; const c=document.getElementById('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML=`<div class="font-black uppercase">${esc(t.descricao)}</div>`; return; }
    const d = t.detalhes; 
    let enderecoCompleto = `${d.end || ''}${d.num ? ', ' + d.num : ''}${d.torre ? ' - ' + d.torre : ''}${d.bairro ? ' - ' + d.bairro : ''}${d.cidade ? ' - ' + d.cidade : ''}`;
    let h = `<div class="grid grid-cols-2 gap-2">${l_i("CLIENTE", d.cliente)}${l_i("CPF", d.cpf)}${l_i("CONTATO 1", d.contato)}${l_i("CONTATO 2", d.contato2 || "-")}${l_i("CEP", d.cep)}${l_i("ENDEREÇO", enderecoCompleto)}</div><div class="mt-4 font-black text-xs uppercase border-b text-blue-600">Móveis:</div>`;
    const prods = safeArray(d.produtos);
    prods.forEach(function(p){ h += `<div class="text-xs font-bold border-b py-1 flex justify-between items-center"><span>${esc(p.n)} <span class="text-slate-400 line-through text-[10px] ml-1">${esc(p.o)}</span> <span class="text-indigo-600 ml-1">${esc(p.d)}</span></span><button onclick="copyText('${esc(p.n)} - De: ${esc(p.o)} Por: ${esc(p.d)}', this)">📋</button></div>`; });
    h += `<div class="mt-4 font-black text-xs uppercase border-b text-emerald-600">Pagamento:</div>`;
    const pags = safeArray(d.pagamentos);
    pags.forEach(function(p){ h += `<div class="text-xs font-bold border-b py-1 flex justify-between"><span>${esc(p.t)}: ${esc(p.v)} (${esc(p.o)})</span><button onclick="copyText('${esc(p.t)}: ${esc(p.v)}', this)">📋</button></div>`; });
    if(d.obs && d.obs !== "") { h += `<div class="mt-4 font-black text-xs uppercase border-b text-orange-600">Observações:</div><div class="text-xs font-bold py-2 bg-slate-50 p-2 rounded mt-1">${esc(d.obs)}</div>`; }
    c.innerHTML = h;
}
function l_i(l, v){ return `<div class="border p-2 rounded text-[10px] font-bold uppercase flex justify-between"><span>${l}: ${esc(v)}</span><button onclick="copyText('${esc(v)}', this)">📋</button></div>`; }

function switchTab(t){ window.scrollTo(0,0); document.querySelectorAll('main').forEach(function(x){x.classList.add('hidden');}); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(function(x){x.classList.remove('tab-active');}); document.getElementById('tab-'+t).classList.add('tab-active'); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(function(c){c.checked=v;}); }
function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados=!filtrandoNaoEnviados; document.getElementById('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); document.getElementById('btnFiltroNaoEnviado').classList.toggle('text-white'); renderPedidos(); }
function updPed(u,c,v){ pedidos.find(function(x){ return x.uid==u; })[c]=v; salvarColecao('pedidos', pedidos); }
function togPed(u,c){ const x=pedidos.find(function(y){ return y.uid==u; }); if(x) x[c]=!x[c]; salvarColecao('pedidos', pedidos); }
function excluirPedido(u){ if(confirm("EXCLUIR?")){ pedidos=pedidos.filter(function(x){ return x.uid!=u; }); salvarColecao('pedidos', pedidos); } }
function atualizarSelectsFornecedores(){ 
    const h = fornecedores.map(function(f) { return `<option value="${esc(f.nome)}">${esc(f.nome)}</option>`; }).join(''); 
    if(document.getElementById('m_fornecedor_select')) document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>"; 
    if(document.getElementById('as_fabrica')) document.getElementById('as_fabrica').innerHTML = h || "<option>...</option>";
    if(document.getElementById('e_fabrica_select')) document.getElementById('e_fabrica_select').innerHTML = h || "<option>...</option>";
    if(document.getElementById('estoque-filtro-fabrica')) document.getElementById('estoque-filtro-fabrica').innerHTML = '<option value="TODAS">TODAS AS FÁBRICAS</option>' + h;
}
function atualizarSugestoes(){ const n=[...new Set(pedidos.map(function(p){ return p.cliente; }))].sort(); if(document.getElementById('listaSugestaoClientes')) document.getElementById('listaSugestaoClientes').innerHTML=n.map(function(x) { return `<option value="${esc(x)}">`; }).join(''); }
a
