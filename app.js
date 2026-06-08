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
// MÁGICA: ABAS E BOTÃO DE ARQUIVAR/FINALIZAR PEDIDOS
// =========================================================
function mudarVisaoPedidos(visao) {
    visaoPedidos = visao;
    const btnAtivos = document.getElementById('btn-visao-ativos');
    const btnFinais = document.getElementById('btn-visao-finalizados');
    const btnFiltroNaoEnviados = document.getElementById('btnFiltroNaoEnviado');

    if(visao === 'ATIVOS') {
        btnAtivos.classList.add('border-blue-600', 'text-blue-600', 'bg-white');
        btnAtivos.classList.remove('border-transparent', 'text-slate-400');
        btnFinais.classList.remove('border-blue-600', 'text-blue-600', 'bg-white');
        btnFinais.classList.add('border-transparent', 'text-slate-400');
        if(btnFiltroNaoEnviados) btnFiltroNaoEnviados.style.display = 'block';
    } else {
        btnFinais.classList.add('border-blue-600', 'text-blue-600', 'bg-white');
        btnFinais.classList.remove('border-transparent', 'text-slate-400');
        btnAtivos.classList.remove('border-blue-600', 'text-blue-600', 'bg-white');
        btnAtivos.classList.add('border-transparent', 'text-slate-400');
        if(btnFiltroNaoEnviados) btnFiltroNaoEnviados.style.display = 'none'; 
    }
    renderPedidos();
}

function arquivarPedido(u) {
    const x = pedidos.find(function(y) { return y.uid == u; });
    if (x) {
        x.finalizado = !x.finalizado;
        if (x.finalizado) { x.status = "Entregue/Finalizado"; } else { x.status = "Pedido na loja"; }
        salvarColecao('pedidos', pedidos);
        registrarAcao(x.finalizado ? '📦' : '🔙', x.finalizado ? 'FINALIZOU PEDIDO' : 'RESTAUROU PEDIDO', `CLIENTE: ${x.cliente}`);
        renderPedidos();
    }
}

function excluirPedido(uid) {
    const p = pedidos.find(function(x) { return x.uid == uid; });
    if(!p) return;

    if(p.finalizado) {
        if(confirm("Deseja RETORNAR este pedido para a aba principal (Em Andamento)?")) {
            p.finalizado = false;
            p.status = "Pedido na loja"; 
            salvarColecao('pedidos', pedidos);
            registrarAcao('🔙', 'RESTAUROU PEDIDO', `CLIENTE: ${p.cliente}`);
            renderPedidos();
        }
    } else {
        if(confirm("EXCLUIR ESTE PEDIDO PERMANENTEMENTE?")) {
            pedidos = pedidos.filter(function(x) { return x.uid != uid; });
            salvarColecao('pedidos', pedidos);
            registrarAcao('🗑️', 'EXCLUIU PEDIDO', `CLIENTE: ${p.cliente}`);
            renderPedidos();
        }
    }
}

function cycleStatus(u){ 
    const x=pedidos.find(function(y){ return y.uid==u; }); 
    if(!x) return;
    const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; 
    if(!x.finalizado && x.status !== "Entregue/Finalizado") {
        x.status=s[(s.indexOf(x.status)+1)%s.length]; 
        salvarColecao('pedidos', pedidos); 
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

        let btnAcoes = `<button onclick="copyText('${x.qtd}x ${esc(x.produto)} ${esc(x.cor)} (${esc(x.idDoc)})', this)" title="Copiar">📋</button>`;
        
        if(!x.finalizado && x.status !== "Entregue/Finalizado") {
            btnAcoes += `<button onclick="arquivarPedido(${x.uid})" title="Enviar para Finalizados">📦</button>`;
            btnAcoes += `<button onclick="dupPed(${x.uid})" title="Duplicar">➕</button>`;
            btnAcoes += `<button onclick="gerarAssistenciaRapida(${x.uid})" title="Assistência">🛠️</button>`;
            btnAcoes += `<button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black" title="Excluir Definitivo">✕</button>`;
        } else {
            btnAcoes += `<button onclick="excluirPedido(${x.uid})" class="text-slate-400 hover:text-blue-500 font-black text-lg" title="Retornar para Ativos">🔙</button>`;
        }

        return `<tr class="${p.classe}"><td><input type="checkbox" class="ped-check" value="${x.uid}"></td><td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td><td class="text-[10px] text-slate-400 font-black">${esc(x.idDoc)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'pedidos')" class="editable-cell uppercase">${esc(x.cliente)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'dataPedido', 'pedidos')" class="editable-cell text-[10px]">${esc(x.dataPedido)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'pedidos')" class="editable-cell text-center font-black">${esc(x.qtd)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'pedidos')" class="editable-cell uppercase">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'medida', 'pedidos')" class="editable-cell uppercase">${esc(x.medida)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'cor', 'pedidos')" class="editable-cell uppercase">${esc(x.cor)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'custo', 'pedidos')" class="editable-cell">${esc(x.custo)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fornecedor', 'pedidos')" class="editable-cell font-black text-blue-800 uppercase text-[10px]">${esc(x.fornecedor)}</td><td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white">${esc(x.status)}</button></td><td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td><td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td><td class="text-center flex gap-1.5 justify-center items-center">${btnAcoes}</td></tr>`;
    }).join('');
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
        if(x.status === "Aguardando") sCls = "bg-red-100 te
