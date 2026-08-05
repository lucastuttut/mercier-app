// =========================================================
// 1. UTILITÁRIOS E VARIÁVEIS GLOBAIS
// =========================================================
function getEl(id) { return document.getElementById(id); }
function val(id) { const e = getEl(id); return e ? e.value : ""; }
function esc(str) { return (str || "").toString().replace(/[&<>'"]/g, function(tag) { return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag); }); }
function noAcc(str) { return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function safeArr(data) { if (!data) return []; try { let arr = Array.isArray(data) ? data : Object.values(data); return arr.filter(function(i){ return i && typeof i === 'object'; }); } catch(e){ return []; } }

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], tarefasEquipe=[], entregas=[], lembretes=[], historicoAtividades=[];
let cestoItensTemporario=[], proximoID=255, notasMelhoria="", notasEstoque="";
let usuarioAtual="", modoMinhasTarefas=false, visaoPedidos='ATIVOS', visaoEstoque='ESTOQUE', filtrandoNaoEnviados=false, cpfValido=true;
let dataSelecionadaLogistica = new Date().toISOString().split('T')[0];
let dataAtualCalendario = new Date();
let eventosDoMes = {};

const coresEquipe = {
    "LUCAS": "bg-emerald-100 text-emerald-700 border-emerald-400",
    "GUILHERME": "bg-blue-100 text-blue-700 border-blue-400",
    "CAROL": "bg-orange-100 text-orange-700 border-orange-400",
    "ISABELLA": "bg-amber-100 text-amber-700 border-amber-400",
    "ANGÉLICA": "bg-purple-100 text-purple-700 border-purple-400"
};
let colsMinimizadas = {"TODO":false, "DOING":false, "DONE":false};
let filtrosEquipeAtivos = [];
let deepLinkVerificado = false;

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
try { usuarioAtual = localStorage.getItem('mercier_user') || ""; } catch(e) {}
try { modoMinhasTarefas = localStorage.getItem('mercier_so_minhas') === 'true'; } catch(e) {}

window.onload = function() { 
    if(getEl('user-select') && usuarioAtual) getEl('user-select').value = usuarioAtual; 
    if(getEl('check-minhas-tarefas')) getEl('check-minhas-tarefas').checked = modoMinhasTarefas; 
    renderFiltrosEquipe(); 
    mostrarCamposTarefa('SIMPLES'); 
    if(getEl('ent_data')) getEl('ent_data').valueAsDate = new Date(); 
    if(getEl('lem_data')) getEl('lem_data').valueAsDate = new Date();
};

function switchTab(t) { 
    window.scrollTo(0,0); 
    document.querySelectorAll('main').forEach(function(x) { x.classList.add('hidden'); }); 
    getEl('view-'+t).classList.remove('hidden'); 
    document.querySelectorAll('nav button').forEach(function(x) { x.classList.remove('tab-active', 'text-white'); }); 
    getEl('tab-'+t).classList.add('tab-active'); 
    if(t === 'logistica') processarEventosCalendario(); 
}

// =========================================================
// 3. FIREBASE E CONEXÃO
// =========================================================
window.addEventListener('error', function(e) { 
    const errEl = getEl('error-log'); 
    if(errEl) { errEl.classList.remove('hidden'); errEl.innerText = "ERRO: " + e.message; } 
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

function salvarColecao(col, d) { 
    db.ref('dados/' + col).set(d); 
}

db.ref('.info/connected').on('value', function(snap) { 
    const st = getEl('status-db'); 
    if(!st) return;
    if(snap.val() === true) { 
        st.innerText="ONLINE"; 
        st.className="bg-emerald-500 text-white hidden md:flex h-10 items-center px-4 rounded-xl text-[10px] font-black uppercase shadow-inner transition-all"; 
    } else { 
        st.innerText="CONECTANDO..."; 
        st.className="bg-orange-500 text-white hidden md:flex h-10 items-center px-4 rounded-xl text-[10px] font-black uppercase transition-all"; 
    }
});

db.ref('dados').on('value', function(s) { 
    try { 
        const d = s.val() || {}; 
        pedidos = safeArr(d.pedidos); fornecedores = safeArr(d.fornecedores); estoque = safeArr(d.estoque); 
        catalogo = safeArr(d.catalogo); tarefas = safeArr(d.tarefas); assistencias = safeArr(d.assistencias); 
        tarefasEquipe = safeArr(d.tarefasEquipe); historicoAtividades = safeArr(d.historico); 
        entregas = safeArr(d.entregas); lembretes = safeArr(d.lembretes); 
        
        proximoID = d.proximoID || 255; 
        
        if(getEl('texto-melhorias')) getEl('texto-melhorias').value = d.notasMelhoria || ""; 
        if(getEl('estoque-notas-gerais')) getEl('estoque-notas-gerais').value = d.notasEstoque || ""; 
        
        atualizarSelectsFornecedores(); 
        atualizarSugestoes(); 
        renderAll(); 
    } catch(e) { 
        console.error("Erro banco:", e); 
    } 
});

async function getProximoID() { 
    const ref = db.ref('dados/proximoID'); 
    const res = await ref.transaction(function(c) { return (c || 255) + 1; }); 
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
}

// =========================================================
// 4. DIÁRIO DE BORDO E USUÁRIOS
// =========================================================
function setUsuario(nome) { 
    usuarioAtual = nome; 
    try { 
        if(nome) localStorage.setItem('mercier_user', nome); else localStorage.removeItem('mercier_user'); 
    } catch(e) {} 
    renderFiltrosEquipe(); 
    renderQuadroEquipe(); 
}

function registrarAcao(ic, ac, det) { 
    const q = usuarioAtual || "SISTEMA"; 
    const d = new Date(); 
    const dH = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}); 
    historicoAtividades.unshift({ uid: Date.now() + Math.random(), dataHora: dH, usuario: q, acao: ac, detalhe: det, icone: ic }); 
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

// =========================================================
// 5. MÁSCARAS E FERRAMENTAS
// =========================================================
function maskMoney(i){ 
    let v = i.value.replace(/\D/g,""); 
    v = (v/100).toFixed(2).replace(".",","); 
    i.value = "R$ " + v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); 
    if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); 
}

function parseMoney(v){ 
    return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; 
}

function maskCPF(i){ 
    let v = i.value.replace(/\D/g,""); 
    if(v.length > 11) v = v.slice(0,11); 
    v = v.replace(/(\d{3})(\d)/,"$1.$2"); 
    v = v.replace(/(\d{3})(\d)/,"$1.$2"); 
    i.value = v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); 
    if(i.value.length === 14) verifCPF(i); 
}

function verifCPF(i){ 
    const ok = validarCPF(i.value); 
    i.style.borderColor = ok ? "#22c55e" : "#ef4444"; 
    cpfValido = ok; 
}

function validarCPF(c){ 
    c = c.replace(/[^\d]+/g,''); 
    if(c.length !== 11 || !!c.match(/(\d)\1{10}/)) return false; 
    let a=0; for(let i=0; i<9; i++) a += parseInt(c.charAt(i))*(10-i); 
    let r = 11-(a%11); if(r === 10 || r === 11) r=0; 
    if(r !== parseInt(c.charAt(9))) return false; 
    a=0; for(let i=0; i<10; i++) a += parseInt(c.charAt(i))*(11-i); 
    r = 11-(a%11); return (r>=10 ? 0 : r) === parseInt(c.charAt(10)); 
}

function copyText(v, el){ 
    if(!v || v==="-") return; 
    navigator.clipboard.writeText(v.toUpperCase()); 
    if(el) { 
        el.style.color="#22c55e"; 
        setTimeout(function() { el.style.color="#94a3b8"; }, 1000); 
    } 
}

async function buscarCEP(i){ 
    let cep = i.value.replace(/\D/g,""); 
    if(cep.length === 8){ 
        getEl('loading-cep').classList.remove('hidden'); 
        try { 
            let r = await fetch(`https://viacep.com.br/ws/${cep}/json/`); 
            let d = await r.json(); 
            if(!d.erro){ 
                getEl('t_end').value = d.logradouro.toUpperCase(); 
                getEl('t_bairro').value = d.bairro.toUpperCase(); 
                getEl('t_cidade').value = d.localidade.toUpperCase(); 
                getEl('t_num').focus(); 
            } 
        } catch(e) {} finally { getEl('loading-cep').classList.add('hidden'); } 
    } 
}

function calcP(d, pr){ 
    if(!d) return {dias:0, classe:""}; 
    try { 
        const pA = String(d).split("/"); 
        let dF = new Date(pA[2], pA[1]-1, pA[0]); 
        let s = String(pr||"30"); 
        if(s.includes("util")){ 
            let c=0; 
            while(c < parseInt(s)){ 
                dF.setDate(dF.getDate()+1); 
                if(dF.getDay()!==0 && dF.getDay()!==6) c++; 
            } 
        } else { 
            dF.setDate(dF.getDate() + parseInt(s)); 
        } 
        const df = Math.ceil((dF - new Date()) / 86400000); 
        let cl = df < 0 ? "prazo-vencido" : (df <= 5 ? "prazo-urgente" : (df <= 10 ? "prazo-alerta" : (df <= 20 ? "prazo-atencao" : ""))); 
        return {dias:df, classe:cl}; 
    } catch(e) { return {dias:0, classe:""}; } 
}

function calcDataExata(dataBR, pr) { 
    if(!dataBR) return null; 
    try { 
        const pA = dataBR.split("/"); 
        let dF = new Date(pA[2], pA[1]-1, pA[0]); 
        let s = String(pr||"30"); 
        if(s.includes("util")){ 
            let c=0, lim=parseInt(s); 
            while(c < lim){ 
                dF.setDate(dF.getDate()+1); 
                if(dF.getDay()!==0 && dF.getDay()!==6) c++; 
            } 
        } else { 
            dF.setDate(dF.getDate() + parseInt(s)); 
        } 
        return `${dF.getFullYear()}-${String(dF.getMonth()+1).padStart(2,'0')}-${String(dF.getDate()).padStart(2,'0')}`; 
    } catch(e) { return null; } 
}

// =========================================================
// 6. ABA: PEDIDOS
// =========================================================
function activeInlineEdit(el, uid, fld, lstType) { 
    const oV = el.innerText; 
    const i = document.createElement('input'); 
    i.value = oV === '-' ? '' : oV; 
    i.className="w-full p-1 text-xs font-bold border-2 border-blue-500 rounded text-black outline-none uppercase"; 
    if(fld === 'custo') i.oninput = function() { maskMoney(i); }; 
    el.innerHTML=''; el.appendChild(i); i.focus(); 
    
    const sv = function() { 
        let nV = i.value.toUpperCase().trim(); 
        if(nV === "") nV = "-"; 
        let lst = lstType === 'estoque' ? estoque : (lstType === 'assistencias' ? assistencias : pedidos); 
        const it = lst.find(function(x) { return x.uid == uid; }); 
        if(it) { 
            it[fld] = fld === 'qtd' ? (parseInt(nV)||1) : nV; 
            salvarColecao(lstType, lst); 
        } else { 
            el.innerText = oV; 
        } 
    }; 
    i.onblur=sv; 
    i.onkeydown=function(e) { 
        if(e.key === 'Enter') sv(); 
        if(e.key === 'Escape'){ i.onblur=null; el.innerText=oV; } 
    }; 
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
        x.finalizado = !x.finalizado; 
        x.status = x.finalizado ? "Entregue/Finalizado" : "Pedido na loja"; 
        salvarColecao('pedidos', pedidos); 
        registrarAcao(x.finalizado ? '📦':'🔙', x.finalizado ? 'FINALIZOU':'RESTAUROU', `PEDIDO: ${x.cliente}`); 
        renderPedidos(); 
    } 
}

function excluirPedido(uid) { 
    const p = pedidos.find(function(x) { return x.uid == uid; }); 
    if(!p) return; 
    if(p.finalizado) { 
        if(confirm("RETORNAR pedido para ativos?")) { 
            p.finalizado=false; p.status="Pedido na loja"; 
            salvarColecao('pedidos', pedidos); 
            renderPedidos(); 
        } 
    } else { 
        if(confirm("EXCLUIR PERMANENTEMENTE?")) { 
            pedidos = pedidos.filter(function(x){ return x.uid != uid; }); 
            salvarColecao('pedidos', pedidos); 
            renderPedidos(); 
        } 
    } 
}

function cycleStatus(u){ 
    const x = pedidos.find(function(y){ return y.uid == u; }); 
    if(!x || x.finalizado || x.status==="Entregue/Finalizado") return; 
    const s = ["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; 
    x.status = s[(s.indexOf(x.status)+1)%s.length]; 
    salvarColecao('pedidos', pedidos); 
}

function marcarTodos(v){ 
    document.querySelectorAll('.ped-check').forEach(function(c) { c.checked = v; }); 
}

function toggleFiltroNaoEnviado(){ 
    filtrandoNaoEnviados = !filtrandoNaoEnviados; 
    getEl('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); 
    getEl('btnFiltroNaoEnviado').classList.toggle('text-white'); 
    renderPedidos(); 
}

function updPed(u,c,v){ pedidos.find(function(x){ return x.uid == u; })[c] = v; salvarColecao('pedidos', pedidos); }
function togPed(u,c){ const x = pedidos.find(function(y){ return y.uid == u; }); if(x) { x[c] = !x[c]; salvarColecao('pedidos', pedidos); } }
async function dupPed(u){ const x = pedidos.find(function(y){ return y.uid == u; }); const nId = await getProximoID(); const idDoc = "ID#" + nId.toString().padStart(4,'0'); pedidos.unshift({...x, uid: Date.now()+Math.random(), idDoc}); salvarColecao('pedidos', pedidos); }

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
    
    getEl('contador').innerText = lst.length + " PEDIDOS"; 
    
    let html = "";
    lst.forEach(function(x) { 
        const p = calcP(x.dataPedido, x.prazo); 
        let sC = "bg-blue-600"; 
        if(x.status === "Não enviado") sC = "bg-red-600"; else if(x.status === "Pedido na loja") sC = "bg-green-700"; 
        if (x.finalizado || x.status === "Entregue/Finalizado") sC = "bg-slate-500 opacity-70"; 
        
        let btn = `<button onclick="copyText('${x.qtd}x ${esc(x.produto)} ${esc(x.cor)} (${esc(x.idDoc)})', this)">📋</button>`; 
        if(!x.finalizado && x.status !== "Entregue/Finalizado") { 
            btn += `<button onclick="arquivarPedido(${x.uid})">📦</button><button onclick="dupPed(${x.uid})">➕</button><button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button><button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✕</button>`; 
        } else { 
            btn += `<button onclick="excluirPedido(${x.uid})" class="text-slate-400 font-black text-lg">🔙</button>`; 
        } 
        
        html += `
        <tr class="${p.classe}">
            <td><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td>
                <div class="flex flex-col gap-1 items-center">
                    <span class="font-black text-[9px]">${p.dias}D</span>
                    <select onchange="updPed(${x.uid},'prazo',this.value)" class="bg-black text-white text-[8px] font-black rounded px-1 outline-none">
                        <option value="15" ${x.prazo=='15'?'selected':''}>15C</option>
                        <option value="20" ${x.prazo=='20'?'selected':''}>20C</option>
                        <option value="30" ${x.prazo=='30'?'selected':''}>30C</option>
                        <option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option>
                        <option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option>
                    </select>
                </div>
            </td>
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
    cestoItensTemporario.forEach(function(i) { 
        pedidos.unshift({ uid: Date.now()+Math.random(), idDoc: idDoc, cliente: cli, dataPedido: new Date().toLocaleDateString('pt-BR'), qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, fornecedor: forn, prazo: val('m_prazo_select'), status: "Não enviado", whatsEnviado: false, confirmado: false, finalizado: false }); 
    }); 
    salvarColecao('pedidos', pedidos); registrarAcao('📋', 'NOVO PEDIDO', `CÓDIGO: ${idDoc} | CLIENTE: ${cli}`); 
    cestoItensTemporario = []; getEl('m_cliente').value = ""; renderCesto(); 
}

function gerarEmailLote() {
    const checks = document.querySelectorAll('.ped-check:checked');
    if (!checks.length) return alert("Nenhum pedido selecionado!");
    
    const uids = Array.from(checks).map(function(c) { return c.value; });
    const sel = pedidos.filter(function(p) { return uids.includes(String(p.uid)); });
    const fab = sel[0].fornecedor || "NÃO INFORMADA";
    
    let txt = `Olá, segue pedido para fábrica ${fab}:\n\n`;
    sel.forEach(function(p) {
        let prd = p.produto; 
        if(p.medida && p.medida!=="-") prd += ` | Medida: ${p.medida}`; 
        if(p.cor && p.cor!=="-") prd += ` | Cor: ${p.cor}`;
        txt += `Qtde: ${String(p.qtd).padStart(2, '0')} - ${prd}\n`;
        txt += `REF: ID# ${p.idDoc.replace('ID#','').trim()}\n\n`;
    });
    
    txt += `Forma de pagamento: 30/60/90.\n\n`;
    txt += `IDs para controle interno, favor desconsiderar.\n\n`;
    txt += `Favor confirmar o recebimento e nos enviar o documento de confirmação dos itens acima para conferência.\n\n`;
    txt += `Atenciosamente,\nLucas Mercier..`;

    navigator.clipboard.writeText(txt).then(function() {
        if (confirm("✅ Texto gerado com as exigências!\nDeseja alterar o status dos pedidos para 'Pedido enviado'?")) {
            sel.forEach(function(p) { if(p.status === "Não enviado") p.status = "Pedido enviado"; });
            salvarColecao('pedidos', pedidos); 
            registrarAcao('📧', 'ENVIOU LOTE', `Marcou ${sel.length} pedidos como enviados.`);
            if(getEl('check-todos')) getEl('check-todos').checked = false; 
            renderPedidos();
        }
    }).catch(function() { alert("Falha ao copiar automaticamente."); });
}

// =========================================================
// 7. ABA: LOGÍSTICA & AGENDA (Unificada com hora e F5 corrigido)
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
    renderCalendario(); 
    renderPainelDia();
}

function renderCalendario() {
    const a = dataAtualCalendario.getFullYear(), m = dataAtualCalendario.getMonth(); 
    const nm = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    getEl('mes-ano-display').innerText = `${nm[m]} ${a}`;
    
    const pD = new Date(a, m, 1).getDay(), dM = new Date(a, m+1, 0).getDate(); 
    let h = "";
    for (let i=0; i<pD; i++) h += `<div class="border-b border-r border-slate-200 bg-slate-50 opacity-40 min-h-[80px]"></div>`;
    
    const hj = new Date().toISOString().split('T')[0];
    
    for (let d=1; d<=dM; d++) {
        const dK = `${a}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        let eH = ""; 
        if(eventosDoMes[dK]) { 
            eventosDoMes[dK].slice(0,3).forEach(function(ev) { 
                eH+=`<div class="${ev.cor} text-[8px] font-black truncate px-1 rounded shadow-sm mb-0.5 leading-tight py-0.5">${ev.icone} ${esc(ev.titulo)}</div>`; 
            }); 
            if(eventosDoMes[dK].length>3) eH+=`<div class="text-[8px] font-black text-slate-400 text-center">+${eventosDoMes[dK].length-3} itens</div>`; 
        }
        
        let cClass = (dK===hj) ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600';
        let bClass = (dK===dataSelecionadaLogistica) ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-slate-50';
        
        h += `
        <div onclick="selecionarDiaLogistica('${dK}')" class="border-b border-r border-slate-200 p-1.5 min-h-[80px] cursor-pointer flex flex-col gap-1 ${bClass}">
            <div class="flex justify-end"><span class="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${cClass}">${d}</span></div>
            <div class="flex-1 overflow-hidden flex flex-col gap-0.5">${eH}</div>
        </div>`;
    }
    const grid = getEl('grid-dias'); if(grid) grid.innerHTML = h;
}

function mudarMes(dr) { dataAtualCalendario.setMonth(dataAtualCalendario.getMonth() + dr); processarEventosCalendario(); }
function selecionarDiaLogistica(dK) { dataSelecionadaLogistica = dK; renderCalendario(); renderPainelDia(); }

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
            let cS = e.status==='Agendado'?"bg-blue-100 text-blue-700 border-blue-200":(e.status==='Em Rota'?"bg-orange-100 text-orange-700 border-orange-200":"bg-emerald-100 text-emerald-700 border-emerald-200");
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
                <div class="flex justify-end pt-1 mt-1 border-t border-slate-100">
                    <button onclick="excluirLembrete(${l.uid})" class="text-red-400 hover:text-red-600 font-black text-xs">✕ Apagar</button>
                </div>
            </div>`;
        } else {
            html += `
            <div class="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-3 shadow-sm border border-blue-100">
                <span class="text-[9px] font-black uppercase text-blue-600 mb-1 block">📋 Vencimento de Prazo</span>
                <h4 class="font-black text-xs uppercase text-slate-800">${esc(ev.obj.cliente)}</h4>
                <p class="text-[9px] font-bold text-slate-500 uppercase mt-1">${ev.obj.qtd}x ${esc(ev.obj.produto)}</p>
            </div>`;
        }
    });
    pn.innerHTML = html;
}

function abrirModalNovaEntrega() { 
    getEl('ent_data').value=dataSelecionadaLogistica; 
    getEl('ent_hora').value=""; getEl('ent_contato').value=""; 
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
    const d=val('ent_data'), h=val('ent_hora'), c=val('ent_cliente').toUpperCase().trim(), e=val('ent_endereco').toUpperCase().trim(), p=val('ent_produtos').toUpperCase().trim(), cont=val('ent_contato').toUpperCase().trim(); 
    if(!d||!c||!p) return alert("Preencha Data, Cliente e Produtos!"); 
    entregas.push({ uid:Date.now(), dataOrdem:d, hora:h, cliente:c, contato:cont, endereco:e||"Não informado", produtos:p, status:"Agendado" }); 
    salvarColecao('entregas', entregas); fecharModaisLogistica(); processarEventosCalendario();
}

function cycleStatusEntrega(uid) { 
    const t = entregas.find(function(x){ return x.uid == uid; }); 
    if(t) { const s = ["Agendado", "Em Rota", "Entregue"]; t.status = s[(s.indexOf(t.status)+1)%s.length]; salvarColecao('entregas', entregas); processarEventosCalendario(); } 
}

function excluirEntrega(uid) { 
    if(confirm("Apagar entrega?")) { entregas = entregas.filter(function(x){ return x.uid != uid; }); salvarColecao('entregas', entregas); processarEventosCalendario(); } 
}

function abrirWhatsAppEntrega(c, e, p, tel) { 
    const msg = `🚚 *Aviso de Entrega - Mercier Design*\n\nOlá ${c}! O seu pedido está a caminho.\n\n📦 *Itens:*\n${p}\n\n📍 *Endereço registrado:*\n${e}`; 
    if(tel) {
        let telLimpo = tel.replace(/\D/g, '');
        if(telLimpo.length === 10 || telLimpo.length === 11) telLimpo = "55" + telLimpo;
        window.open(`https://wa.me/${telLimpo}?text=${encodeURIComponent(msg)}`, '_blank');
    } else { window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); }
}

function abrirGPS(e) { 
    if(!e || e==="NÃO INFORMADO") return alert("Sem endereço para rota."); 
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}`, '_blank'); 
}

function abrirModalNovoLembrete() { getEl('lem_data').value=dataSelecionadaLogistica; getEl('modal-novo-lembrete').style.display='flex'; }

function salvarLembrete() { 
    const t=val('lem_titulo').toUpperCase().trim(), d=val('lem_data'), c=val('lem_categoria'); 
    if(!t||!d) return alert("Preencha título e data!"); 
    lembretes.push({ uid:Date.now(), titulo:t, dataOrdem:d, categoria:c, concluido:false }); 
    salvarColecao('lembretes', lembretes); fecharModaisLogistica(); processarEventosCalendario(); 
}

function toggleConcluidoLembrete(uid) { 
    const l = lembretes.find(function(x){ return x.uid == uid; }); 
    if(l){ l.concluido=!l.concluido; salvarColecao('lembretes', lembretes); processarEventosCalendario(); } 
}

function excluirLembrete(uid) { 
    if(confirm("Apagar lembrete?")) { lembretes = lembretes.filter(function(x){ return x.uid != uid; }); salvarColecao('lembretes', lembretes); processarEventosCalendario(); } 
}

function fecharModaisLogistica() { 
    getEl('modal-nova-entrega').style.display='none'; getEl('modal-novo-lembrete').style.display='none'; 
    getEl('ent_cliente').value=""; getEl('ent_endereco').value=""; getEl('ent_produtos').value=""; getEl('ent_hora').value=""; getEl('ent_contato').value=""; getEl('lem_titulo').value=""; 
}


// =========================================================
// 8. ABA: ESTOQUE (INTELIGENTE)
// =========================================================
function autoSalvarNotasEstoque() { notasEstoque = val('estoque-notas-gerais'); db.ref('dados/notasEstoque').set(notasEstoque); }

function mudarVisaoEstoque(v) { 
    visaoEstoque = v; const bD = getEl('btn-estoque-disponivel'), bS = getEl('btn-estoque-saidas'); 
    if(v==='ESTOQUE') { 
        bD.classList.add('border-green-500','text-green-600','bg-white'); bD.classList.remove('border-transparent','text-slate-400'); 
        bS.classList.remove('border-green-500','text-green-600','bg-white'); bS.classList.add('border-transparent','text-slate-400'); 
    } else { 
        bS.classList.add('border-green-500','text-green-600','bg-white'); bS.classList.remove('border-transparent','text-slate-400'); 
        bD.classList.remove('border-green-500','text-green-600','bg-white'); bD.classList.add('border-transparent','text-slate-400'); 
    } 
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
        html += `
        <tr class="border-b transition hover:bg-slate-50">
            <td class="text-[10px] text-slate-400">${esc(x.data)||'-'}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'estoque')" class="cursor-pointer uppercase font-bold">${esc(x.produto)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'estoque')" class="cursor-pointer text-blue-600 text-[10px] font-black uppercase">${esc(x.fabrica)||"-"}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'estoque')" class="cursor-pointer text-center font-bold">${esc(x.qtd)}</td>
            <td class="text-center"><span class="px-2 py-1 rounded text-[9px] font-black w-full inline-block ${sC}">${tS}</span></td>
            <td class="text-center flex gap-1 justify-center">${btnAcao}<button onclick="if(confirm('EXCLUIR REGISTRO?')){estoque=estoque.filter(function(y){return y.uid!=${x.uid};}); salvarColecao('estoque', estoque);}" class="text-slate-300 hover:text-red-500 font-black px-2">✕</button></td>
        </tr>`;
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
    if(ad>0) { salvarColecao('estoque', estoque); getEl('e_massa').value=""; alert(`✅ ${ad} itens cadastrados!`); } 
}

function cadastrarEstoque() { 
    const p=val('e_produto').toUpperCase().trim(), f=val('e_fabrica_select'), q=val('e_qtd'); 
    if(p) { estoque.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), produto:p, fabrica:f, qtd:parseInt(q), situacao:'ESTOQUE'}); salvarColecao('estoque', estoque); getEl('e_produto').value=""; } 
}

// =========================================================
// 9. ABA: EQUIPE KANBAN
// =========================================================
function renderFiltrosEquipe() { 
    const d = getEl('filtros-equipe'); if(!d) return; 
    if(modoMinhasTarefas){ d.style.opacity='0.3'; d.style.pointerEvents='none'; } else { d.style.opacity='1'; d.style.pointerEvents='auto'; } 
    let ht=`<button onclick="toggleFiltroEquipe('TODOS')" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition border-2 ${filtrosEquipeAtivos.length===0?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-500 border-slate-200'}">🌟 TODOS</button>`; 
    Object.keys(coresEquipe).forEach(function(n) { 
        const cA = coresEquipe[n].split(' ')[1]; const iA = filtrosEquipeAtivos.includes(n); 
        ht += `<button onclick="toggleFiltroEquipe('${n}')" class="px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition border-2 ${iA?`${coresEquipe[n]} border-transparent shadow-sm`:`bg-white ${cA} border-slate-200`}">${n}</button>`; 
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
    
    let cT=0, cDg=0, cDn=0, hT="", hDg="", hDn=""; 
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

        let cd = `<div id="card-${t.uid}" draggable="true" ondragstart="dragTarefa(event,${t.uid})" ondragend="dragEndTarefa(event)" class="bg-white p-3.5 rounded-2xl shadow-sm border-t-4 ${cB} flex flex-col gap-2 relative overflow-hidden"><div class="flex justify-between items-start"><div class="flex flex-col gap-1 items-start"><span class="${c} px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">${esc(t.responsavel)}</span>${bdg}</div><div class="flex gap-1 items-center">${bDs}</div></div>`;
        if(!iM) {
            cd += `<span class="text-sm font-black text-slate-800 mt-1 uppercase leading-snug">${esc(t.descricao)}</span><span class="text-[8px] font-black text-slate-300 border-b pb-2">Criado em: ${t.data}</span><div class="mt-1 flex flex-col gap-1.5">${cH?`<div id="chat-${t.uid}" class="bg-slate-50 p-2 rounded-lg max-h-48 overflow-y-auto custom-scrollbar shadow-inner">${cH}</div>`:''}<div class="flex gap-1 mt-1 items-center"><input type="text" placeholder="Responder..." onkeydown="if(event.key==='Enter') adicionarComentarioInline(${t.uid}, this)" class="flex-1 bg-white border p-2 text-[10px] font-bold rounded-xl outline-blue-500 uppercase"><button onclick="acionarUploadImagem(${t.uid})" class="bg-slate-100 px-2 rounded-xl text-[12px] border h-full">📎</button><button onclick="adicionarComentarioInline(${t.uid}, this.previousElementSibling.previousElementSibling)" class="bg-blue-100 text-blue-600 px-3 rounded-xl text-[12px] h-full">➤</button></div></div>`;
        } else {
            cd += `<span class="text-[11px] font-black text-slate-800 truncate border-t pt-2 uppercase">${esc(t.descricao)}</span>`;
        }
        cd += `</div>`;

        if(t.coluna==='TODO') { htmlTodo+=cd; cTodo++; } else if(t.coluna==='DOING') { htmlDoing+=cd; cDoing++; } else if(t.coluna==='DONE') { htmlDone+=cd; cDone++; } 
    }); 
    
    if(getEl('col-todo')) getEl('col-todo').innerHTML = htmlTodo || '<span class="text-[10px] text-center mt-6 uppercase text-slate-400 font-bold">Limpo 🎉</span>'; 
    if(getEl('col-doing')) getEl('col-doing').innerHTML = htmlDoing || '<span class="text-[10px] text-center mt-6 uppercase text-slate-400 font-bold">Nada</span>'; 
    if(getEl('col-done')) getEl('col-done').innerHTML = htmlDone || '<span class="text-[10px] text-center mt-6 uppercase text-slate-400 font-bold">Nada</span>'; 
    if(getEl('count-todo')) getEl('count-todo').innerText=cTodo; 
    if(getEl('count-doing')) getEl('count-doing').innerText=cDoing; 
    if(getEl('count-done')) getEl('count-done').innerText=cDone; 
    tarefasEquipe.forEach(function(t) { const cx=getEl('chat-'+t.uid); if(cx) cx.scrollTop=cx.scrollHeight; }); 
}

function adicionarTarefaEquipe() { const d=val('eq_desc').toUpperCase().trim(), r=val('eq_resp'), p=val('eq_prazo'); if(!d) return alert("Digite a tarefa!"); const nT = {uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), descricao:d, responsavel:r, prazo:p, coluna:"TODO", comentarios:[], minimizada:false}; tarefasEquipe.push(nT); salvarColecao('tarefasEquipe', tarefasEquipe); registrarAcao('📌', 'CRIOU TAREFA', `PARA: ${r}`); getEl('eq_desc').value=""; renderQuadroEquipe(); setTimeout(function(){notificarNoGrupoComPrint(nT,'NOVA');}, 300); }
function moverTarefaEquipe(uid, nC) { const t=tarefasEquipe.find(function(x){return x.uid==uid;}); if(t && t.coluna!==nC) { t.coluna=nC; salvarColecao('tarefasEquipe', tarefasEquipe); renderQuadroEquipe(); if(nC==='DONE') setTimeout(function(){notificarNoGrupoComPrint(t,'CONCLUIDA');},300); } }
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

// ---------------------------------------------
// TAREFAS / VENDAS (Anotação / Processar WhatsApp)
// ---------------------------------------------
function processarFichaWhatsApp(tx) {
    if(!tx) return; const m = function(r){ return tx.match(r); };
    const mN=m(/Nome(?: Completo)?\s*[:\-]?\s*(.+)/i), mCp=m(/CPF\s*[:\-]?\s*([\d\.\-]+)/i), mCe=m(/CEP\s*[:\-]?\s*([\d\.\-]+)/i), mE=m(/Endere[çc]o\s*[:\-]?\s*(.+)/i), mC1=m(/(?:^|\n)\s*Contato(?: 1)?\s*[:\-]?\s*(.+)/i), mC2=m(/(?:^|\n)\s*Contato\s*2\s*[:\-]?\s*(.+)/i), mNu=m(/(?:^|\n)\s*N(?:[°ºoúu]mero)?\s*[:\-]?\s*([A-Za-z0-9]+)/i), mO=m(/(?:OBS|OBSERVA[CÇ][AÃ]O)(?:ES)?\s*[:\-]?\s*([\s\S]+)/i), mP=m(/Previs[ãa]o(?: de Entrega)?\s*[:\-]?\s*([\d]{2}\/[\d]{2}\/[\d]{4})/i);
    if(mN) getEl('t_nome').value = mN[1].trim().toUpperCase(); if(mE) getEl('t_end').value = mE[1].trim().toUpperCase(); if(mC1) getEl('t_contato').value = mC1[1].trim().toUpperCase(); if(mC2) getEl('t_contato2').value = mC2[1].trim().toUpperCase(); if(mNu) getEl('t_num').value = mNu[1].trim().toUpperCase(); if(mO) getEl('t_obs').value = mO[1].trim().toUpperCase();
    if(mCp) { getEl('t_cpf').value = mCp[1].trim(); maskCPF(getEl('t_cpf')); } if(mCe) { getEl('t_cep').value = mCe[1].trim(); buscarCEP(getEl('t_cep')); } if(mP) { let ps = mP[1].split('/'); if(ps.length===3) getEl('t_previsao').value = `${ps[2]}-${ps[1]}-${ps[0]}`; }
}

function mostrarCamposTarefa(t){
    const c=getEl('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`
        <div class="col-span-1 md:col-span-4 mb-2 bg-indigo-50 p-4 rounded-xl border-2 border-dashed border-indigo-300 w-full"><label class="text-[10px] font-black text-indigo-800 uppercase mb-2 block">✨ Cole a ficha do WhatsApp aqui:</label><textarea id="t_magic_box" oninput="processarFichaWhatsApp(this.value)" class="w-full border p-3 rounded-lg text-xs font-bold outline-indigo-500 h-24 resize-none shadow-inner"></textarea></div>
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

function addProdutoLinha(){ const d = getEl('lista-produtos-tarefa'); const r = document.createElement('div'); r.className = "flex flex-col md:flex-row gap-2 mb-2 items-start md:items-center row-prod bg-slate-50 p-3 rounded-lg border w-full"; r.innerHTML = `<div class="flex justify-between w-full md:flex-1 gap-2"><input class="t-p-nome border-2 p-2 rounded text-xs font-bold flex-1 uppercase outline-indigo-500" placeholder="MÓVEL"><button onclick="this.parentElement.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-3 py-1 md:hidden bg-red-100 rounded-lg">✕</button></div><div class="flex w-full md:w-auto gap-2"><input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-1/2 md:w-28 outline-indigo-500" placeholder="ORIGINAL" oninput="maskMoney(this)"><input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-1/2 md:w-28 text-indigo-600 outline-indigo-500" placeholder="DESCONTO" oninput="maskMoney(this)"><button onclick="this.parentElement.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-2 hidden md:block">✕</button></div>`; d.appendChild(r); }
function addPagamentoLinha(){ const d = getEl('lista-pagamentos-tarefa'); let t=0, p=0; document.querySelectorAll('.t-v-desc').forEach(function(i){t+=parseMoney(i.value);}); document.querySelectorAll('.t-p-val').forEach(function(i){p+=parseMoney(i.value);}); let s=t-p; if(s<0) s=0; const r = document.createElement('div'); r.className="flex flex-col bg-slate-50 p-3 rounded-lg border mb-3 row-pag w-full gap-2"; r.innerHTML=`<div class="flex gap-2 mb-1 flex-wrap w-full"><button onclick="setP(this,'PIX')" class="btn-pag-opt active flex-1 md:flex-none text-center px-1 py-2 text-[10px]">PIX</button><button onclick="setP(this,'CRÉDITO')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">CRÉDITO</button><button onclick="setP(this,'DÉBITO')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">DÉBITO</button><button onclick="setP(this,'CHEQUE')" class="btn-pag-opt flex-1 md:flex-none text-center px-1 py-2 text-[10px]">CHEQUE</button><input type="hidden" class="t-p-tipo" value="PIX"><select class="t-p-parc hidden border-2 p-1 rounded text-[10px] font-bold bg-white w-full md:w-auto outline-emerald-500">${[...Array(12).keys()].map(function(n){ return `<option value="${n+1}x">${n+1}x</option>`; }).join('')}</select></div><div class="flex flex-col md:flex-row gap-2 w-full"><input class="t-p-val border-2 p-2 rounded-lg text-xs font-bold w-full md:w-48 text-emerald-600 outline-emerald-500" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${s.toLocaleString('pt-BR',{minimumFractionDigits:2})}"><div class="flex w-full gap-2 md:flex-1"><input class="t-p-obs border-2 p-2 rounded-lg text-xs font-bold flex-1 uppercase outline-emerald-500" placeholder="OBS/DATA"><button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-red-500 font-black px-3 py-1 bg-red-100 md:bg-transparent rounded-lg">✕</button></div></div>`; d.appendChild(r); }
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

function renderTarefas() { const tb=getEl('tabelaTarefas'); if(!tb) return; const f=val('filtro-tarefa-status'); let lst=(f==='TODAS')?tarefas:tarefas.filter(function(x){return x.status===f;}); tb.innerHTML=lst.map(function(x){ return `<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>${esc(x.data)}</td><td class="font-black text-xs uppercase">${esc(x.descricao)}</td><td class="text-[10px] uppercase">${esc(x.tipo)}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${esc(x.status)}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(function(y){return y.uid!=${x.uid};}); salvarColecao('tarefas', tarefas);}" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>`; }).join(''); }
function cycleTarefaStatus(u){ const x = tarefas.find(function(y){ return y.uid == u; }); const s = ["Não Iniciado","Em Andamento","Feito"]; x.status = s[(s.indexOf(x.status)+1)%s.length]; salvarColecao('tarefas', tarefas); renderTarefas(); }

function verDetalhesTarefa(uid){ 
    const t = tarefas.find(function(x){ return x.uid == uid; }); if(!t) return; 
    getEl('modal-detalhes').style.display='flex'; const c = getEl('detalhe-corpo'); 
    if(!t.detalhes){ c.innerHTML = `<div class="font-black uppercase">${esc(t.descricao)}</div>`; return; } 
    const d=t.detalhes; let eC=`${d.end||''}${d.num?', '+d.num:''}${d.torre?' - '+d.torre:''}${d.bairro?' - '+d.bairro:''}${d.cidade?' - '+d.cidade:''}`; 
    let h=`<div class="grid grid-cols-2 gap-2">${l_i("CLIENTE", d.cliente)}${l_i("PREVISÃO", d.previsao||"NÃO INFORMADA")}${l_i("CPF", d.cpf)}${l_i("CONTATO 1", d.contato)}${l_i("CONTATO 2", d.contato2||"-")}${l_i("CEP", d.cep)}${l_i("ENDEREÇO", eC)}</div><div class="mt-4 font-black text-xs uppercase border-b text-blue-600">Móveis:</div>`; 
    safeArr(d.produtos).forEach(function(p){ h+=`<div class="text-xs font-bold border-b py-1 flex justify-between items-center"><span>${esc(p.n)} <span class="text-slate-400 line-through text-[10px] ml-1">${esc(p.o)}</span> <span class="text-indigo-600 ml-1">${esc(p.d)}</span></span><button onclick="copyText('${esc(p.n)} - De: ${esc(p.o)} Por: ${esc(p.d)}', this)">📋</button></div>`; }); 
    h+=`<div class="mt-4 font-black text-xs uppercase border-b text-emerald-600">Pagamento:</div>`; 
    safeArr(d.pagamentos).forEach(function(p){ h+=`<div class="text-xs font-bold border-b py-1 flex justify-between"><span>${esc(p.t)}: ${esc(p.v)} (${esc(p.o)})</span><button onclick="copyText('${esc(p.t)}: ${esc(p.v)}', this)">📋</button></div>`; }); 
    if(d.obs) h+=`<div class="mt-4 font-black text-xs uppercase border-b text-orange-600">Observações:</div><div class="text-xs font-bold py-2 bg-slate-50 p-2 rounded mt-1">${esc(d.obs)}</div>`; 
    c.innerHTML=h; 
}

function l_i(l, v){ return `<div class="border p-2 rounded text-[10px] font-bold uppercase flex justify-between"><span>${l}: ${esc(v)}</span><button onclick="copyText('${esc(v)}', this)">📋</button></div>`; }

// ---------------------------------------------
// ASSISTÊNCIAS, FORNECEDORES E CATÁLOGO
// ---------------------------------------------
function renderAssistencias() { 
    const tb=getEl('tabelaAssistencias'); if(!tb) return; 
    const b=noAcc(val('busca-assistencia').toLowerCase()), f=val('filtro-assistencia-status')||"TODAS"; 
    let lst = assistencias.filter(function(x) { return (noAcc((x.cliente||"").toLowerCase()).includes(b)||noAcc((x.produto||"").toLowerCase()).includes(b)||noAcc((x.fabrica||"").toLowerCase()).includes(b))&&(f==="TODAS"||(x.status||"Aguardando")===f); }); 
    if(getEl('contador-assistencia')) getEl('contador-assistencia').innerText = lst.length + " ASSISTÊNCIAS"; 
    tb.innerHTML = lst.map(function(x) { 
        let sC="bg-slate-200 text-slate-700"; if(x.status==="Aguardando") sC="bg-red-100 text-red-700"; else if(x.status==="Peça Solicitada") sC="bg-blue-100 text-blue-700"; else if(x.status==="Concluído") sC="bg-green-100 text-green-700"; 
        return `<tr class="border-b transition hover:bg-slate-50"><td class="text-[10px] font-bold text-slate-400">${esc(x.data)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'assistencias')" class="uppercase font-bold cursor-pointer">${esc(x.cliente)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'assistencias')" class="uppercase cursor-pointer">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'assistencias')" class="font-black text-blue-800 uppercase text-[10px] cursor-pointer">${esc(x.fabrica)}</td><td class="text-center"><button onclick="cycleAssisStatus(${x.uid})" class="px-2 py-1.5 rounded text-[9px] font-black w-full transition ${sC}">${esc(x.status)}</button></td><td class="text-center"><button onclick="if(confirm('EXCLUIR ASSISTÊNCIA?')){ assistencias=assistencias.filter(function(y){return y.uid!=${x.uid};}); salvarColecao('assistencias', assistencias); }" class="text-red-500 font-black text-lg">✕</button></td></tr>`; 
    }).join(''); 
}
function cadastrarAssistencia(){ const c=val('as_cliente').toUpperCase().trim(), p=val('as_produto').toUpperCase().trim(), f=val('as_fabrica'); if(c&&p){ assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); salvarColecao('assistencias', assistencias); registrarAcao('🛠️', 'REGISTROU ASSISTÊNCIA', `CLIENTE: ${c}`); getEl('as_cliente').value=""; getEl('as_produto').value=""; } else alert("PREENCHA CLIENTE E PRODUTO!"); }
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
