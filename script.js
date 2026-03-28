// CONFIGURAÇÃO FIREBASE - v106.0
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

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], tarefasEquipe=[], proximoID=255, notasMelhoria="", notasEstoque="", cestoItensTemporario=[], filtrandoNaoEnviados=false, filtrandoVendidos=false, cpfValido=true;

let deepLinkVerificado = false;

// --- SISTEMA DE LOGIN DISCRETO ---
let usuarioAtual = "";
try { usuarioAtual = localStorage.getItem('mercier_user') || ""; } catch(e) {}

window.onload = () => {
    const selectEl = document.getElementById('user-select');
    if(selectEl && usuarioAtual) selectEl.value = usuarioAtual;
    renderFiltrosEquipe();
};

function setUsuario(nome) {
    usuarioAtual = nome;
    if(nome) { try { localStorage.setItem('mercier_user', nome); } catch(e) {} } 
    else { try { localStorage.removeItem('mercier_user'); } catch(e) {} }
}

const esc = str => (str || "").toString().replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));
const removeAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const safeArray = (data) => Array.isArray(data) ? data : Object.values(data || {});

const statusEl = document.getElementById('status-db');
db.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) console.log("Conectado!");
    else console.log("Tentando...");
});

// SINCRONIZAÇÃO DE DADOS
db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    
    pedidos = safeArray(d.pedidos);
    fornecedores = safeArray(d.fornecedores);
    estoque = safeArray(d.estoque);
    catalogo = safeArray(d.catalogo);
    tarefas = safeArray(d.tarefas);
    assistencias = safeArray(d.assistencias);
    tarefasEquipe = safeArray(d.tarefasEquipe);
    
    proximoID = d.proximoID || 255;
    notasMelhoria = d.notasMelhoria || "";
    notasEstoque = d.notasEstoque || "";

    if(statusEl) { statusEl.innerText = "ONLINE"; statusEl.className = "status-online"; }
    if(document.getElementById('texto-melhorias')) document.getElementById('texto-melhorias').value = notasMelhoria;
    if(document.getElementById('estoque-notas-gerais')) document.getElementById('estoque-notas-gerais').value = notasEstoque;

    atualizarSelectsFornecedores();
    atualizarSugestoes();
    renderAll();
    
    if(!deepLinkVerificado && tarefasEquipe.length > 0) {
        const urlParams = new URLSearchParams(window.location.search);
        const tarefaId = urlParams.get('tarefa');
        
        if(tarefaId) {
            switchTab('equipe');
            setTimeout(() => {
                const card = document.getElementById(`card-${tarefaId}`);
                if(card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const bgOriginal = card.style.backgroundColor;
                    card.style.backgroundColor = '#bbf7d0'; 
                    card.style.transition = 'background-color 2s';
                    setTimeout(() => { card.style.backgroundColor = bgOriginal; }, 2000);
                }
            }, 600); 
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        deepLinkVerificado = true;
    }

}, (error) => {
    if(statusEl) { statusEl.innerText = "ERRO DE ACESSO"; statusEl.className = "status-offline"; }
});

function salvarColecao(colecao, dados) { db.ref('dados/' + colecao).set(dados); }

async function getProximoID() {
    const ref = db.ref('dados/proximoID');
    const res = await ref.transaction(curr => (curr || 255) + 1);
    return res.snapshot.val();
}

function renderAll(){ 
    renderPedidos(); renderTarefas(); renderFornecedores(); 
    renderEstoque(); renderCatalogo(); renderAssistencias(); renderQuadroEquipe();
}

function activeInlineEdit(element, uid, field, listType) {
    const originalValue = element.innerText;
    const input = document.createElement('input');
    input.value = (originalValue === "-" ? "" : originalValue);
    input.className = "w-full p-1 text-xs font-bold border-2 border-blue-500 rounded bg-white text-black outline-none uppercase";
    if(field === 'custo') input.oninput = () => { let v = input.value.replace(/\D/g,""); v = (v/100).toFixed(2).replace(".",","); v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); input.value = "R$ " + v; };
    element.innerHTML = ''; element.appendChild(input); input.focus();
    
    const save = () => {
        let newValue = input.value.toUpperCase().trim();
        if (newValue === "") newValue = "-";
        let list = pedidos;
        if(listType === 'estoque') list = estoque;
        else if(listType === 'assistencias') list = assistencias;
        const item = list.find(x => x.uid == uid);
        if (item) {
            if(field === 'qtd') item[field] = parseInt(newValue) || 1;
            else item[field] = newValue;
            salvarColecao(listType, list);
        } else { element.innerText = originalValue; }
    };
    input.onblur = save; input.onkeydown = (e) => { if(e.key === 'Enter') save(); if(e.key === 'Escape') { input.onblur = null; element.innerText = originalValue; } };
}

function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const ok = validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }
function copyText(v, el){ if(!v || v==="-") return; navigator.clipboard.writeText(v.toUpperCase()); if(el) { el.style.color="#22c55e"; setTimeout(()=>el.style.color="#94a3b8", 1000); } }
async function buscarCEP(i){ let cep=i.value.replace(/\D/g,""); if(cep.length===8){ document.getElementById('loading-cep').classList.remove('hidden'); try{ let r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); let d=await r.json(); if(!d.erro){ document.getElementById('t_end').value=d.logradouro.toUpperCase(); document.getElementById('t_bairro').value=d.bairro.toUpperCase(); document.getElementById('t_cidade').value=d.localidade.toUpperCase(); document.getElementById('t_num').focus(); } }catch(e){} finally { document.getElementById('loading-cep').classList.add('hidden'); }}}

function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); if(!tb) return;
    const b = removeAcentos(document.getElementById('busca').value.toLowerCase());
    let lista = pedidos.filter(x => removeAcentos((x.cliente||"").toLowerCase()).includes(b) || removeAcentos((x.produto||"").toLowerCase()).includes(b) || removeAcentos((x.idDoc||"").toLowerCase()).includes(b) || removeAcentos((x.fornecedor||"").toLowerCase()).includes(b));
    if(filtrandoNaoEnviados) lista=lista.filter(x=>x.status==="Não enviado");
    document.getElementById('contador').innerText=lista.length+" PEDIDOS";
    tb.innerHTML = lista.map(x=>{
        const p=calcP(x.dataPedido, x.prazo); let sCls = x.status==="Não enviado" ? "bg-red-600" : (x.status.includes("loja") ? "bg-green-700" : "bg-blue-600");
        return `<tr class="${p.classe}">
            <td><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td>
            <td class="text-[10px] text-slate-400 font-black">${esc(x.idDoc)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'pedidos')" class="editable-cell uppercase">${esc(x.cliente)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'dataPedido', 'pedidos')" class="editable-cell text-[10px]">${esc(x.dataPedido)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'pedidos')" class="editable-cell text-center font-black">${esc(x.qtd)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'pedidos')" class="editable-cell uppercase">${esc(x.produto)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'medida', 'pedidos')" class="editable-cell uppercase">${esc(x.medida)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cor', 'pedidos')" class="editable-cell uppercase">${esc(x.cor)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'custo', 'pedidos')" class="editable-cell">${esc(x.custo)}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'fornecedor', 'pedidos')" class="editable-cell font-black text-blue-800 uppercase text-[10px]">${esc(x.fornecedor)}</td>
            <td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white">${esc(x.status)}</button></td>
            <td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td>
            <td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td>
            <td class="text-center flex gap-1 justify-center"><button onclick="copyText('${x.qtd}x ${esc(x.produto)} ${esc(x.cor)} (${esc(x.idDoc)})', this)">📋</button><button onclick="dupPed(${x.uid})">➕</button><button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button><button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✕</button></td>
        </tr>`;
    }).join('');
}
function adicionarItemAoCesto() { const p = document.getElementById('m_produto').value.trim().toUpperCase(); if(!p) return alert("INFORME PRODUTO!"); cestoItensTemporario.push({ uid: Date.now(), q: document.getElementById('m_qtd').value || 1, p, m: document.getElementById('m_medida').value || "-", c: document.getElementById('m_cor').value.toUpperCase() || "-", v: document.getElementById('m_custo').value || "R$ 0,00" }); renderCesto(); document.getElementById('m_produto').value = ""; }
function renderCesto() { document.getElementById('cesto-itens').innerHTML = cestoItensTemporario.map((item, idx) => `<div class="item-cesto"><span>${item.q}x</span><span>${esc(item.p)}</span><button onclick="cestoItensTemporario.splice(${idx},1); renderCesto();" class="text-red-500 font-bold ml-2">✕</button></div>`).join(''); }
async function cadastrarManual() { const cli = document.getElementById('m_cliente').value.trim().toUpperCase(); const forn = document.getElementById('m_fornecedor_select').value; if(!cli || cestoItensTemporario.length === 0) return alert("FALTA DADOS!"); const nId = await getProximoID(); const idDoc = "ID#" + nId.toString().padStart(4, '0'); cestoItensTemporario.forEach(i => { pedidos.unshift({ uid: Date.now()+Math.random(), idDoc, cliente: cli, dataPedido: new Date().toLocaleDateString('pt-BR'), qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, fornecedor: forn, prazo: document.getElementById('m_prazo_select').value, status: "Não enviado", whatsEnviado: false, confirmado: false }); }); cestoItensTemporario =[]; document.getElementById('m_cliente').value = ""; renderCesto(); salvarColecao('pedidos', pedidos); }

function autoSalvarNotasEstoque() { notasEstoque = document.getElementById('estoque-notas-gerais').value; db.ref('dados/notasEstoque').set(notasEstoque); }
function renderEstoque() {
    const tb = document.getElementById('tabelaEstoque'); if(!tb) return;
    const b = removeAcentos(document.getElementById('estoque-busca').value.toLowerCase());
    const fFab = document.getElementById('estoque-filtro-fabrica').value, fSit = document.getElementById('estoque-filtro-situacao') ? document.getElementById('estoque-filtro-situacao').value : "TODAS";
    let totEst = 0, totVen = 0;
    let lista = estoque.filter(x => {
        const prod = removeAcentos((x.produto||"").toLowerCase()), fab = removeAcentos((x.fabrica||"").toLowerCase()), sit = x.situacao||"ESTOQUE";
        if(sit === 'ESTOQUE') totEst += parseInt(x.qtd || 0);
        if(sit === 'VENDIDO') totVen += parseInt(x.qtd || 0);
        return (prod.includes(b) || fab.includes(b)) && (fFab === "TODAS" || x.fabrica === fFab) && (fSit === "TODAS" || sit === fSit) && (!filtrandoVendidos || sit === 'VENDIDO');
    });
    if(document.getElementById('resumo-estoque-total')) document.getElementById('resumo-estoque-total').innerText = totEst;
    if(document.getElementById('resumo-estoque-vendidos')) document.getElementById('resumo-estoque-vendidos').innerText = totVen;
    tb.innerHTML = lista.map(x => `<tr><td class="text-[10px] text-slate-400 font-bold">${esc(x.data) || '-'}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'estoque')" class="editable-cell uppercase font-bold">${esc(x.produto)}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'estoque')" class="editable-cell text-blue-600 text-[10px] font-black uppercase">${esc(x.fabrica) || "-"}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'estoque')" class="editable-cell text-center">${esc(x.qtd)}</td><td><button onclick="cycleEstoqueStatus(${x.uid})" class="px-2 py-1 rounded text-[9px] font-black w-full text-center transition ${x.situacao === 'VENDIDO' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}">${esc(x.situacao)}</button></td><td class="text-center flex gap-1 justify-center">${x.situacao === 'ESTOQUE' ? `<button onclick="darBaixaEstoque(${x.uid})" title="Dar Baixa">📉</button>` : ''}<button onclick="if(confirm('EXCLUIR?')){estoque=estoque.filter(y=>y.uid!=${x.uid}); salvarColecao('estoque', estoque);}" class="text-red-500 font-black px-2">✕</button></td></tr>`).join('');
}
function cycleEstoqueStatus(u){ const x = estoque.find(y => y.uid == u); if(x) { x.situacao = x.situacao === 'ESTOQUE' ? 'VENDIDO' : 'ESTOQUE'; salvarColecao('estoque', estoque); } }
function darBaixaEstoque(u) { const it = estoque.find(x => x.uid == u); if (!it) return; let qS = prompt(`SAÍDA DE "${it.produto}". QTD?`, "1"); if (!qS) return; qS = parseInt(qS); if (isNaN(qS) || qS <= 0 || qS > it.qtd) return alert("QTD INVÁLIDA!"); if (qS == it.qtd) { it.situacao = "VENDIDO"; it.data = new Date().toLocaleDateString('pt-BR'); } else { it.qtd -= qS; estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: it.produto, fabrica: it.fabrica, qtd: qS, situacao: "VENDIDO" }); } salvarColecao('estoque', estoque); }
function cadastrarEstoque() { const p = document.getElementById('e_produto').value.toUpperCase().trim(), f = document.getElementById('e_fabrica_select').value, q = document.getElementById('e_qtd').value, s = document.getElementById('e_situacao').value; if (p) { estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: p, fabrica: f, qtd: parseInt(q), situacao: s }); salvarColecao('estoque', estoque); document.getElementById('e_produto').value = ""; } }
function toggleFiltroVendidos(){ filtrandoVendidos=!filtrandoVendidos; document.getElementById('btnFiltroVendidos').classList.toggle('bg-red-600'); document.getElementById('btnFiltroVendidos').classList.toggle('text-white'); renderEstoque(); }

function renderAssistencias() { 
    const tb = document.getElementById('tabelaAssistencias'); 
    if(!tb) return;
    const b = removeAcentos((document.getElementById('busca-assistencia')?.value || "").toLowerCase());
    const fStatus = document.getElementById('filtro-assistencia-status')?.value || "TODAS";
    let lista = assistencias.filter(x => {
        const cliente = removeAcentos((x.cliente || "").toLowerCase());
        const produto = removeAcentos((x.produto || "").toLowerCase());
        const fabrica = removeAcentos((x.fabrica || "").toLowerCase());
        const status = x.status || "Aguardando";
        return (cliente.includes(b) || produto.includes(b) || fabrica.includes(b)) && (fStatus === "TODAS" || status === fStatus);
    });
    const cnt = document.getElementById('contador-assistencia');
    if(cnt) cnt.innerText = lista.length + " ASSISTÊNCIAS";

    tb.innerHTML = lista.map(x => {
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
            <td class="text-center flex gap-1 justify-center"><button onclick="if(confirm('EXCLUIR ASSISTÊNCIA?')){assistencias=assistencias.filter(y=>y.uid!=${x.uid}); salvarColecao('assistencias', assistencias);}" class="text-red-500 font-black px-2 hover:text-red-700 text-lg">✕</button></td>
        </tr>`;
    }).join(''); 
}
function cadastrarAssistencia(){ 
    const c=document.getElementById('as_cliente').value.toUpperCase().trim(), p=document.getElementById('as_produto').value.toUpperCase().trim(), f=document.getElementById('as_fabrica').value; 
    if(c&&p){ 
        assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); 
        salvarColecao('assistencias', assistencias); document.getElementById('as_cliente').value=""; document.getElementById('as_produto').value=""; 
    } else { alert("PREENCHA O CLIENTE E O PRODUTO/DEFEITO!"); }
}

// --- ABA EQUIPE KANBAN ---
const coresEquipe = {
    "LUCAS": "bg-emerald-100 text-emerald-700 border-emerald-400",
    "GUILHERME": "bg-blue-100 text-blue-700 border-blue-400",
    "CAROL": "bg-orange-100 text-orange-700 border-orange-400",
    "ISABELLA": "bg-amber-100 text-amber-700 border-amber-400",
    "ANGÉLICA": "bg-purple-100 text-purple-700 border-purple-400"
};

// NOVO: Lógica de Colunas Minimizáveis
let colsMinimizadas = { "TODO": false, "DOING": false, "DONE": false };

function toggleColunaKanban(coluna) {
    colsMinimizadas[coluna] = !colsMinimizadas[coluna];
    renderQuadroEquipe();
}

// NOVO: Notificação de Grupo com Link Direto (NOVA e CONCLUÍDA)
function notificarNoGrupo(tarefa, tipoAcao) {
    const quem = usuarioAtual || "A equipe";
    const baseUrl = window.location.href.split('?')[0];
    const linkAcesso = `${baseUrl}?tarefa=${tarefa.uid}`;
    let msg = "";

    if (tipoAcao === 'NOVA') {
        const prazoTxt = tarefa.prazo ? tarefa.prazo.split('-').reverse().join('/') : 'Sem prazo definido';
        msg = `📢 *NOVA TAREFA*\n\nDesignada para: *${tarefa.responsavel}*\nCriada por: ${quem}\n\n📌 *${tarefa.descricao}*\n🗓️ Prazo: ${prazoTxt}\n\n🔗 *Acessar tarefa no sistema:*\n${linkAcesso}`;
    } else if (tipoAcao === 'CONCLUIDA') {
        msg = `✅ *TAREFA CONCLUÍDA*\n\nFinalizada por: *${quem}*\n\n📌 *${tarefa.descricao}*\n👤 Resp. Original: ${tarefa.responsavel}\n\n🔗 *Ver histórico no sistema:*\n${linkAcesso}`;
    }

    const urlGrupo = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if(confirm(`Deseja enviar e
