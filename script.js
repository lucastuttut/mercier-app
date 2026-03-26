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

// Inicialização segura
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", notasEstoque="", cestoItensTemporario=[], filtrandoNaoEnviados=false, filtrandoVendidos=false, cpfValido=true;

// Função de Proteção contra XSS (Impede injeção de código malicioso)
const esc = str => (str || "").toString().replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));

// Função para remover acentos durante as pesquisas
const removeAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// MONITOR DE CONEXÃO FÍSICO
const statusEl = document.getElementById('status-db');
db.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) console.log("Conectado ao Firebase!");
    else console.log("Tentando conectar...");
});

// SINCRONIZAÇÃO DE DADOS
db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos = d.pedidos ||[];
    fornecedores = d.fornecedores ||[];
    estoque = d.estoque || [];
    catalogo = d.catalogo ||[];
    tarefas = d.tarefas || [];
    assistencias = d.assistencias ||[];
    proximoID = d.proximoID || 255;
    notasMelhoria = d.notasMelhoria || "";
    notasEstoque = d.notasEstoque || "";

    if(statusEl) {
        statusEl.innerText = "ONLINE";
        statusEl.className = "status-online";
    }

    if(document.getElementById('texto-melhorias')) document.getElementById('texto-melhorias').value = notasMelhoria;
    if(document.getElementById('estoque-notas-gerais')) document.getElementById('estoque-notas-gerais').value = notasEstoque;

    atualizarSelectsFornecedores();
    atualizarSugestoes();
    renderAll();
}, (error) => {
    if(statusEl) { statusEl.innerText = "ERRO DE ACESSO"; statusEl.className = "status-offline"; }
    console.error("ERRO FIREBASE:", error);
});

// --- FUNÇÕES DE BANCO DE DADOS SEGURAS ---
function salvarColecao(colecao, dados) { db.ref('dados/' + colecao).set(dados); }

async function getProximoID() {
    // Usa Transaction para evitar que 2 pessoas salvem o mesmo ID ao mesmo tempo
    const ref = db.ref('dados/proximoID');
    const res = await ref.transaction(curr => (curr || 255) + 1);
    return res.snapshot.val();
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---
function renderAll(){ 
    renderPedidos(); renderTarefas(); renderFornecedores(); 
    renderEstoque(); renderCatalogo(); renderAssistencias(); 
}

// --- EDIÇÃO INLINE ---
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
        const list = listType === 'estoque' ? estoque : pedidos;
        const item = list.find(x => x.uid == uid);
        if (item) {
            if(field === 'qtd') item[field] = parseInt(newValue) || 1;
            else item[field] = newValue;
            salvarColecao(listType, list);
        } else { element.innerText = originalValue; }
    };
    input.onblur = save;
    input.onkeydown = (e) => { if(e.key === 'Enter') save(); if(e.key === 'Escape') { input.onblur = null; element.innerText = originalValue; } };
}

// --- UTILITÁRIOS ---
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const ok = validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }
function copyText(v, el){ if(!v || v==="-") return; navigator.clipboard.writeText(v.toUpperCase()); if(el) { el.style.color="#22c55e"; setTimeout(()=>el.style.color="#94a3b8", 1000); } }
async function buscarCEP(i){ let cep=i.value.replace(/\D/g,""); if(cep.length===8){ document.getElementById('loading-cep').classList.remove('hidden'); try{ let r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); let d=await r.json(); if(!d.erro){ document.getElementById('t_end').value=d.logradouro.toUpperCase(); document.getElementById('t_bairro').value=d.bairro.toUpperCase(); document.getElementById('t_cidade').value=d.localidade.toUpperCase(); document.getElementById('t_num').focus(); } }catch(e){} finally { document.getElementById('loading-cep').classList.add('hidden'); }}}

// --- PEDIDOS ---
function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); if(!tb) return;
    
    const b = removeAcentos(document.getElementById('busca').value.toLowerCase());
    
    let lista = pedidos.filter(x => 
        removeAcentos((x.cliente||"").toLowerCase()).includes(b) ||
        removeAcentos((x.produto||"").toLowerCase()).includes(b) ||
        removeAcentos((x.idDoc||"").toLowerCase()).includes(b) ||
        removeAcentos((x.fornecedor||"").toLowerCase()).includes(b)
    );
    
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
            <td class="text-center flex gap-1 justify-center">
                <button onclick="copyText('${x.qtd}x ${esc(x.produto)} ${esc(x.cor)} (${esc(x.idDoc)})', this)">📋</button>
                <button onclick="dupPed(${x.uid})">➕</button>
                <button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button>
                <button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✕</button>
            </td></tr>`;
    }).join('');
}

function adicionarItemAoCesto() {
    const p = document.getElementById('m_produto').value.trim().toUpperCase();
    if(!p) return alert("INFORME O PRODUTO!");
    cestoItensTemporario.push({ uid: Date.now(), q: document.getElementById('m_qtd').value || 1, p, m: document.getElementById('m_medida').value || "-", c: document.getElementById('m_cor').value.toUpperCase() || "-", v: document.getElementById('m_custo').value || "R$ 0,00" });
    renderCesto(); document.getElementById('m_produto').value = "";
}

function renderCesto() {
    document.getElementById('cesto-itens').innerHTML = cestoItensTemporario.map((item, idx) => `<div class="item-cesto"><span>${item.q}x</span><span>${esc(item.p)}</span><button onclick="cestoItensTemporario.splice(${idx},1); renderCesto();" class="text-red-500 font-bold ml-2">✕</button></div>`).join('');
}

async function cadastrarManual() {
    const cli = document.getElementById('m_cliente').value.trim().toUpperCase(); const forn = document.getElementById('m_fornecedor_select').value;
    if(!cli || cestoItensTemporario.length === 0) return alert("FALTA DADOS!");
    
    const nId = await getProximoID();
    const idDoc = "ID#" + nId.toString().padStart(4, '0');
    
    cestoItensTemporario.forEach(i => { pedidos.unshift({ uid: Date.now()+Math.random(), idDoc, cliente: cli, dataPedido: new Date().toLocaleDateString('pt-BR'), qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, fornecedor: forn, prazo: document.getElementById('m_prazo_select').value, status: "Não enviado", whatsEnviado: false, confirmado: false }); });
    cestoItensTemporario =[]; document.getElementById('m_cliente').value = ""; renderCesto(); 
    salvarColecao('pedidos', pedidos);
}

// --- ESTOQUE ---
function autoSalvarNotasEstoque() { notasEstoque = document.getElementById('estoque-notas-gerais').value; db.ref('dados/notasEstoque').set(notasEstoque); }
function renderEstoque() {
    const tb = document.getElementById('tabelaEstoque'); if(!tb) return;
    
    const b = removeAcentos(document.getElementById('estoque-busca').value.toLowerCase());
    
    const fFab = document.getElementById('estoque-filtro-fabrica').value, fSit = document.getElementById('estoque-filtro-situacao') ? document.getElementById('estoque-filtro-situacao').value : "TODAS";
    let totEst = 0, totVen = 0;
    
    let lista = estoque.filter(x => {
        const prod = removeAcentos((x.produto||"").toLowerCase());
        const fab = removeAcentos((x.fabrica||"").toLowerCase());
        const sit = x.situacao||"ESTOQUE";
        
        if(sit === 'ESTOQUE') totEst += parseInt(x.qtd || 0);
        if(sit === 'VENDIDO') totVen += parseInt(x.qtd || 0);
        
        const matBusca = prod.includes(b) || fab.includes(b);
        const matFab = fFab === "TODAS" || x.fabrica === fFab;
        const matSit = fSit === "TODAS" || sit === fSit;
        
        return matBusca && matFab && matSit && (!filtrandoVendidos || sit === 'VENDIDO');
    });
    
    if(document.getElementById('resumo-estoque-total')) document.getElementById('resumo-estoque-total').innerText = totEst;
    if(document.getElementById('resumo-estoque-vendidos')) document.getElementById('resumo-estoque-vendidos').innerText = totVen;
    
    tb.innerHTML = lista.map(x => `<tr>
        <td class="text-[10px] text-slate-400 font-bold">${esc(x.data) || '-'}</td>
        <td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'estoque')" class="editable-cell uppercase font-bold">${esc(x.produto)}</td>
        <td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'estoque')" class="editable-cell text-blue-600 text-[10px] font-black uppercase">${esc(x.fabrica) || "-"}</td>
        <td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'estoque')" class="editable-cell text-center">${esc(x.qtd)}</td>
        <td>
            <button onclick="cycleEstoqueStatus(${x.uid})" class="px-2 py-1 rounded text-[9px] font-black w-full text-center transition ${x.situacao === 'VENDIDO' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}">${esc(x.situacao)}</button>
        </td>
        <td class="text-center flex gap-1 justify-center">
            ${x.situacao === 'ESTOQUE' ? `<button onclick="darBaixaEstoque(${x.uid})" title="Dar Baixa (Parcial/Total)">📉</button>` : ''}
            <button onclick="if(confirm('EXCLUIR?')){estoque=estoque.filter(y=>y.uid!=${x.uid}); salvarColecao('estoque', estoque);}" class="text-red-500 font-black px-2">✕</button>
        </td>
    </tr>`).join('');
}

function cycleEstoqueStatus(u){ 
    const x = estoque.find(y => y.uid == u); 
    if(x) {
        x.situacao = x.situacao === 'ESTOQUE' ? 'VENDIDO' : 'ESTOQUE';
        salvarColecao('estoque', estoque); 
    }
}

function darBaixaEstoque(u) {
    const it = estoque.find(x => x.uid == u); if (!it) return;
    let qS = prompt(`SAÍDA DE "${it.produto}". QTD?`, "1");
    if (!qS) return; qS = parseInt(qS);
    if (isNaN(qS) || qS <= 0 || qS > it.qtd) return alert("QTD INVÁLIDA!");
    if (qS == it.qtd) { it.situacao = "VENDIDO"; it.data = new Date().toLocaleDateString('pt-BR'); }
    else { it.qtd -= qS; estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: it.produto, fabrica: it.fabrica, qtd: qS, situacao: "VENDIDO" }); }
    salvarColecao('estoque', estoque);
}

function cadastrarEstoque() {
    const p = document.getElementById('e_produto').value.toUpperCase().trim(), f = document.getElementById('e_fabrica_select').value, q = document.getElementById('e_qtd').value, s = document.getElementById('e_situacao').value;
    if (p) { estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: p, fabrica: f, qtd: parseInt(q), situacao: s }); salvarColecao('estoque', estoque); document.getElementById('e_produto').value = ""; }
}
function toggleFiltroVendidos(){ filtrandoVendidos=!filtrandoVendidos; document.getElementById('btnFiltroVendidos').classList.toggle('bg-red-600'); document.getElementById('btnFiltroVendidos').classList.toggle('text-white'); renderEstoque(); }

// --- TAREFAS ---
function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`<input id="t_nome" placeholder="CLIENTE" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2 uppercase"><input id="t_cpf" placeholder="CPF" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="maskCPF(this)"><input id="t_contato" placeholder="CONTATO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_cep" placeholder="CEP" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="buscarCEP(this)"><input id="t_end" placeholder="RUA" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2 uppercase"><input id="t_bairro" placeholder="BAIRRO" class="border-2 p-2 rounded-lg text-xs font-bold uppercase"><input id="t_cidade" placeholder="CIDADE" class="border-2 p-2 rounded-lg text-xs font-bold uppercase"><input id="t_num" placeholder="NÚMERO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_torre" placeholder="TORRE" class="border-2 p-2 rounded-lg text-xs font-bold uppercase"><div class="col-span-4 border-t mt-4 pt-4"><div id="lista-produtos-tarefa"></div><button onclick="addProdutoLinha()" class="text-[10px] font-black text-blue-600 mt-2 uppercase">+ MÓVEL</button><div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-xs mt-1 uppercase italic">Total: R$ 0,00</div></div><div class="col-span-4 border-t mt-4 pt-4"><div id="lista-pagamentos-tarefa"></div><button onclick="addPagamentoLinha()" class="text-[10px] font-black text-emerald-600 mt-2 uppercase">+ PAGAMENTO</button></div><textarea id="t_obs" placeholder="OBS" class="col-span-4 border-2 p-2 rounded-lg text-xs font-bold h-16 uppercase"></textarea>`;
        addProdutoLinha(); addPagamentoLinha();
    } else { c.innerHTML = `<input id="t_raw" placeholder="DESCRICAO..." class="border-2 p-2 rounded-lg text-xs font-bold col-span-4 uppercase">`; }
}
function addProdutoLinha(){ const d = document.getElementById('lista-produtos-tarefa'); const r = document.createElement('div'); r.className = "flex gap-2 mb-1 items-center row-prod bg-slate-50 p-2 rounded border border-dashed"; r.innerHTML = `<input class="t-p-nome border-2 p-2 rounded text-xs font-bold flex-1 uppercase" placeholder="MÓVEL"><input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-32" placeholder="ORIGINAL" oninput="maskMoney(this)"><input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-32 text-indigo-600" placeholder="DESCONTO" oninput="maskMoney(this)"><button onclick="this.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-2">✕</button>`; d.appendChild(r); }
function addPagamentoLinha(){
    const d=document.getElementById('lista-pagamentos-tarefa'); let total=0; document.querySelectorAll('.t-v-desc').forEach(i=>total+=parseMoney(i.value)); let pago=0; document.querySelectorAll('.t-p-val').forEach(i=>pago+=parseMoney(i.value)); let saldo=total-pago; if(saldo<0) saldo=0;
    const r=document.createElement('div'); r.className="flex flex-col bg-slate-50 p-2 rounded border mb-3 row-pag";
    r.innerHTML=`<div class="flex gap-1 mb-2 flex-wrap"><button onclick="setP(this,'PIX')" class="btn-pag-opt active">PIX</button><button onclick="setP(this,'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button><button onclick="setP(this,'DÉBITO')" class="btn-pag-opt">DÉBITO</button><button onclick="setP(this,'CHEQUE')" class="btn-pag-opt">CHEQUE</button><input type="hidden" class="t-p-tipo" value="PIX"><select class="t-p-parc hidden border-2 p-1 rounded text-[10px] font-bold bg-white">${[...Array(12).keys()].map(n => `<option value="${n+1}x">${n+1}x</option>`).join('')}</select></div><div class="flex gap-1"><input class="t-p-val border-2 p-2 rounded-lg text-xs font-bold w-48 text-emerald-600" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${saldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}"><input class="t-p-obs border-2 p-2 rounded-lg text-xs font-bold flex-1 uppercase" placeholder="OBS/DATA"><button onclick="this.parentElement.parentElement.remove()" class="text-red-500 font-black px-2">✕</button></div>`;
    d.appendChild(r);
}
function setP(b,v){ 
    const p = b.parentElement; p.querySelectorAll('button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); p.querySelector('.t-p-tipo').value=v; 
    const s = p.querySelector('.t-p-parc'); if(v === 'CRÉDITO') s.classList.remove('hidden'); else s.classList.add('hidden');
}
function calcTotalTirarPedido(){ let t=0; document.querySelectorAll('.t-v-desc').forEach(i=>t+=parseMoney(i.value)); document.getElementById('total-pedido-tarefa').innerText="Total: R$ "+t.toLocaleString('pt-BR',{minimumFractionDigits:2}); }
function cadastrarTarefa(){
    const t = document.getElementById('t_tipo').value; let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: t, status: "Não Iniciado" };
    if(t === 'TIRAR PEDIDO'){ const cli = document.getElementById('t_nome').value; if(!cli) return alert("FALTA NOME!"); let total=0; document.querySelectorAll('.t-v-desc').forEach(i=>total+=parseMoney(i.value)); obj.descricao = "PEDIDO: " + cli.toUpperCase(); obj.detalhes = { cliente: cli.toUpperCase(), cpf: document.getElementById('t_cpf').value, contato: document.getElementById('t_contato').value, cep: document.getElementById('t_cep').value, end: document.getElementById('t_end').value, bairro: document.getElementById('t_bairro').value, cidade: document.getElementById('t_cidade').value, num: document.getElementById('t_num').value, torre: document.getElementById('t_torre').value, obs: document.getElementById('t_obs').value, totalDesc:"R$ "+total.toLocaleString('pt-BR',{minimumFractionDigits:2}), produtos:[], pagamentos:[] }; document.querySelectorAll('.row-prod').forEach(row => { if(row.querySelector('.t-p-nome').value) obj.detalhes.produtos.push({ n: row.querySelector('.t-p-nome').value.toUpperCase(), o: row.querySelector('.t-v-orig').value, d: row.querySelector('.t-v-desc').value }); }); document.querySelectorAll('.row-pag').forEach(row => { const tipo = row.querySelector('.t-p-tipo').value; const parcelas = (tipo === 'CRÉDITO') ? row.querySelector('.t-p-parc').value : ""; obj.detalhes.pagamentos.push({ t: tipo + (parcelas ? " " + parcelas : ""), v: row.querySelector('.t-p-val').value, o: row.querySelector('.t-p-obs').value.toUpperCase() }); }); }
    else { obj.descricao = (document.getElementById('t_raw')?.value || "").toUpperCase(); }
    if(!obj.descricao) return; tarefas.unshift(obj); salvarColecao('tarefas', tarefas); mostrarCamposTarefa(t); renderTarefas();
}
function renderTarefas() { const tb=document.getElementById('tabelaTarefas'); if(!tb) return; const f=document.getElementById('filtro-tarefa-status').value; let lista=f==='TODAS'?tarefas:tarefas.filter(x=>x.status===f); tb.innerHTML=lista.map(x=>`<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>${esc(x.data)}</td><td class="font-black text-xs uppercase">${esc(x.descricao)}</td><td class="text-[10px] uppercase">${esc(x.tipo)}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${esc(x.status)}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarColecao('tarefas', tarefas);}" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>`).join(''); }
function verDetalhesTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return; document.getElementById('modal-detalhes').style.display='flex'; const c=document.getElementById('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML=`<div class="font-black uppercase">${esc(t.descricao)}</div>`; return; }
    const d = t.detalhes; let h = `<div class="grid grid-cols-2 gap-2">${l_i("CLIENTE", d.cliente)}${l_i("CPF", d.cpf)}${l_i("CELULAR", d.contato)}${l_i("CEP", d.cep)}${l_i("ENDEREÇO", d.end)}</div><div class="mt-4 font-black text-xs uppercase border-b text-blue-600">Móveis:</div>`;
    d.produtos.forEach(p => h += `<div class="text-xs font-bold border-b py-1 flex justify-between"><span>${esc(p.n)} - ${esc(p.d)}</span><button onclick="copyText('${esc(p.n)} - ${esc(p.d)}', this)">📋</button></div>`);
    h += `<div class="mt-4 font-black text-xs uppercase border-b text-emerald-600">Pagamento:</div>`;
    d.pagamentos.forEach(p => h += `<div class="text-xs font-bold border-b py-1 flex justify-between"><span>${esc(p.t)}: ${esc(p.v)} (${esc(p.o)})</span><button onclick="copyText('${esc(p.t)}: ${esc(p.v)}', this)">📋</button></div>`);
    c.innerHTML = h;
}
function l_i(l, v){ return `<div class="border p-2 rounded text-[10px] font-bold uppercase flex justify-between"><span>${l}: ${esc(v)}</span><button onclick="copyText('${esc(v)}', this)">📋</button></div>`; }

// --- OUTRAS ABAS ---
function renderFornecedores() { const tb = document.getElementById('tabelaFornecedores'); if(!tb) return; tb.innerHTML = fornecedores.map((f, i) => `<tr><td class="font-bold uppercase">${esc(f.nome)}</td><td class="lowercase text-blue-600">${esc(f.email)}</td><td class="text-center"><button onclick="fornecedores.splice(${i},1); salvarColecao('fornecedores', fornecedores);" class="text-red-500 font-black">✕</button></td></tr>`).join(''); }
function cadastrarFornecedor(){ const n=document.getElementById('f_nome').value.toUpperCase().trim(), e=document.getElementById('f_email').value.toLowerCase().trim(); if(n&&e){fornecedores.push({nome:n,email:e}); salvarColecao('fornecedores', fornecedores); document.getElementById('f_nome').value=""; document.getElementById('f_email').value="";}}
function renderCatalogo() { const tb=document.getElementById('tabelaCatalogo'); if(!tb) return; tb.innerHTML=catalogo.map((c,i)=>`<tr><td class="uppercase">${esc(c.nome)}</td><td class="text-center"><button onclick="catalogo.splice(${i},1); salvarColecao('catalogo', catalogo);">✕</button></td></tr>`).join(''); }
function cadastrarCatalogo(){ const n=document.getElementById('cat_nome').value.toUpperCase(); if(n){catalogo.push({nome:n}); salvarColecao('catalogo', catalogo); document.getElementById('cat_nome').value="";}}
function renderAssistencias() { const tb=document.getElementById('tabelaAssistencias'); if(!tb) return; tb.innerHTML=assistencias.map(x=>`<tr><td>${esc(x.data)}</td><td class="uppercase font-bold">${esc(x.cliente)}</td><td class="uppercase">${esc(x.produto)}</td><td class="font-black text-blue-800 uppercase">${esc(x.fabrica)}</td><td><button onclick="cycleAssisStatus(${x.uid})" class="status-badge bg-slate-200">${esc(x.status)}</button></td><td><button onclick="assistencias=assistencias.filter(y=>y.uid!=${x.uid}); salvarColecao('assistencias', assistencias);" class="text-red-500 font-black">✕</button></td></tr>`).join(''); }
function cadastrarAssistencia(){ const c=document.getElementById('as_cliente').value.toUpperCase(), p=document.getElementById('as_produto').value.toUpperCase(), f=document.getElementById('as_fabrica').value; if(c&&p){ assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); salvarColecao('assistencias', assistencias); document.getElementById('as_cliente').value=""; document.getElementById('as_produto').value=""; } }

// --- GERAIS ---
function switchTab(t){ window.scrollTo(0,0); document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleStatus(u){ const x=pedidos.find(y=>y.uid==u); const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarColecao('pedidos', pedidos); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarColecao('tarefas', tarefas); }
function cycleAssisStatus(u){ const x=assistencias.find(y=>y.uid==u); const s=["Aguardando","Peça Solicitada","Concluído"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarColecao('assistencias', assistencias); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(c=>c.checked=v); }
function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados=!filtrandoNaoEnviados; document.getElementById('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); document.getElementById('btnFiltroNaoEnviado').classList.toggle('text-white'); renderPedidos(); }
function updPed(u,c,v){ pedidos.find(x=>x.uid==u)[c]=v; salvarColecao('pedidos', pedidos); }
function togPed(u,c){ const x=pedidos.find(y=>y.uid==u); if(x) x[c]=!x[c]; salvarColecao('pedidos', pedidos); }
function excluirPedido(u){ if(confirm("EXCLUIR?")){ pedidos=pedidos.filter(x=>x.uid!=u); salvarColecao('pedidos', pedidos); } }
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }
function atualizarSelectsFornecedores(){ 
    const h = fornecedores.map(f => `<option value="${esc(f.nome)}">${esc(f.nome)}</option>`).join(''); 
    if(document.getElementById('m_fornecedor_select')) document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>"; 
    if(document.getElementById('as_fabrica')) document.getElementById('as_fabrica').innerHTML = h || "<option>...</option>";
    if(document.getElementById('e_fabrica_select')) document.getElementById('e_fabrica_select').innerHTML = h || "<option>...</option>";
    if(document.getElementById('estoque-filtro-fabrica')) document.getElementById('estoque-filtro-fabrica').innerHTML = '<option value="TODAS">TODAS AS FÁBRICAS</option>' + h;
}
function atualizarSugestoes(){ 
    const n=[...new Set(pedidos.map(p=>p.cliente))].sort(); if(document.getElementById('listaSugestaoClientes')) document.getElementById('listaSugestaoClientes').innerHTML=n.map(x=>`<option value="${esc(x)}">`).join(''); 
}
async function dupPed(u){ const x=pedidos.find(y=>y.uid==u); const nId=await getProximoID(); const idDoc="ID#"+nId.toString().padStart(4,'0'); pedidos.unshift({...x, uid:Date.now()+Math.random(), idDoc}); salvarColecao('pedidos', pedidos); }
function gerarAssistenciaRapida(u){ const p=pedidos.find(x=>x.uid==u); if(p){ document.getElementById('as_cliente').value=p.cliente; document.getElementById('as_produto').value=p.produto+" (DEFEITO)"; document.getElementById('as_fabrica').value=p.fornecedor; switchTab('assistencia'); }}
function gerarEmailLote() {
    const checks = document.querySelectorAll('.ped-check:checked'); if (checks.length === 0) return alert("SELECIONE PEDIDOS!");
    const selecionados = Array.from(checks).map(c => pedidos.find(p => p.uid == c.value)).filter(p => p);
    const grupos = {}; selecionados.forEach(p => { if (!grupos[p.fornecedor]) grupos[p.fornecedor] = []; grupos[p.fornecedor].push(p); });
    for (const fab in grupos) {
        const email = (fornecedores.find(f => f.nome === fab) || {}).email || "";
        let corpo = `Olá, segue pedido para fábrica ${fab}:%0D%0A%0D%0A`;
        grupos[fab].forEach((p, idx) => { corpo += `Qtde: ${String(p.qtd).padStart(2, '0')} - ${p.produto}%0D%0A${p.medida !== "-" ? `MEDIDA: ${p.medida}%0D%0A` : ""}COR/TECIDO: ${p.cor}%0D%0AREF: ${p.idDoc}%0D%0A${idx < grupos[fab].length - 1 ? `%0D%0A--------------------------%0D%0A` : ""}`; });
        corpo += `%0D%0AForma de pagamento: 30/60/90.%0D%0A%0D%0AIDs para controle interno, favor desconsiderar.%0D%0A%0D%0AFavor confirmar o recebimento e nos enviar o documento de confirmação dos itens acima para conferência.%0D%0A%0D%0AAtenciosamente,%0D%0ALucas Mercier.`;
        window.open(`mailto:${email}?subject=${encodeURIComponent('PEDIDO - MERCIER DESIGN - '+fab)}&body=${corpo}`);
    }
}

// --- DRAG AND DROP DO BLOCO DE NOTAS ---
const painelSugestoes = document.getElementById('painel-sugestoes');
const dragHandle = document.getElementById('drag-handle');
let isDragging = false, offsetX, offsetY;

dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - painelSugestoes.getBoundingClientRect().left;
    offsetY = e.clientY - painelSugestoes.getBoundingClientRect().top;
    painelSugestoes.style.bottom = 'auto'; // Remove a trava do bottom
    painelSugestoes.style.right = 'auto';  // Remove a trava do right
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    painelSugestoes.style.left = (e.clientX - offsetX) + 'px';
    painelSugestoes.style.top = (e.clientY - offsetY) + 'px';
});

document.addEventListener('mouseup', () => { isDragging = false; });

mostrarCamposTarefa('SIMPLES');
