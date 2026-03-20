// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyA_fQSZJJcz5Wszw54W5EhMN9D5rNnjoCo",
    authDomain: "mercier-design.firebaseapp.com",
    projectId: "mercier-design",
    storageBucket: "mercier-design.firebasestorage.app",
    messagingSenderId: "1060891658513",
    appId: "1:1060891658513:web:2eefd15227203af39064b0",
    databaseURL: "https://mercier-design-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variáveis de Estado
let pedidos = [], fornecedores = [], estoque = [], catalogo = [], tarefas = [], assistencias = [];
let proximoID = 255, notasMelhoria = "", cestoItensTemporario = [];
let filtrandoNaoEnviados = false, cpfValido = true, idTarefaAberta = null;

// --- SINCRONIZAÇÃO EM TEMPO REAL ---
db.ref('dados').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    pedidos = data.pedidos || [];
    fornecedores = data.fornecedores || [];
    estoque = data.estoque || [];
    catalogo = data.catalogo || [];
    tarefas = data.tarefas || [];
    assistencias = data.assistencias || [];
    proximoID = data.proximoID || 255;
    notasMelhoria = data.notasMelhoria || "";

    const statusDb = document.getElementById('status-db');
    if (statusDb) {
        statusDb.innerText = "SINCRONIZADO";
        statusDb.className = "text-[10px] px-4 py-1.5 rounded-full bg-green-600 font-black text-white uppercase tracking-widest";
    }

    const txtMelhorias = document.getElementById('texto-melhorias');
    if (txtMelhorias) txtMelhorias.value = notasMelhoria;

    atualizarSugestoes();
    atualizarSelectsFornecedores();
    renderAll();
});

function salvarCloud() {
    db.ref('dados').set({ pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria });
}

// --- FUNÇÕES DE RENDERIZAÇÃO (MOSTRAR DADOS) ---
function renderAll() {
    renderPedidos();
    renderTarefas();
    renderFornecedores();
    renderEstoque();
    renderCatalogo();
    renderAssistencias();
}

function renderPedidos() {
    const tbody = document.getElementById('tabelaPedidos');
    if (!tbody) return;
    const busca = document.getElementById('busca').value.toLowerCase();
    
    let lista = pedidos.filter(x => 
        (x.cliente || "").toLowerCase().includes(busca) || 
        (x.produto || "").toLowerCase().includes(busca) || 
        (x.idDoc || "").toLowerCase().includes(busca) ||
        (x.fornecedor || "").toLowerCase().includes(busca)
    );

    if (filtrandoNaoEnviados) lista = lista.filter(x => x.status === "Não enviado");

    document.getElementById('contador').innerText = lista.length + " PEDIDOS";
    
    tbody.innerHTML = lista.map(x => {
        const p = calcP(x.dataPedido, x.prazo);
        let sCls = x.status === "Não enviado" ? "bg-red-600" : (x.status.includes("enviado") ? "bg-blue-600" : "bg-green-700");
        const vLimpo = (x.custo || "0,00").replace("R$ ", "");

        return `<tr class="${p.classe}">
            <td><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td><div class="flex flex-col gap-1 items-center">
                <span class="font-black text-[9px]">${p.dias}D</span>
                <select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela">
                    <option value="15" ${x.prazo=='15'?'selected':''}>15C</option>
                    <option value="20" ${x.prazo=='20'?'selected':''}>20C</option>
                    <option value="30" ${x.prazo=='30'?'selected':''}>30C</option>
                    <option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option>
                    <option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option>
                </select>
            </div></td>
            <td class="text-xs font-bold text-slate-400 font-tabela-fixa">${x.idDoc}</td>
            <td onclick="editField(${x.uid},'cliente')" class="editable-cell uppercase col-cliente font-tabela-fixa">${x.cliente}</td>
            <td class="font-tabela-fixa">${x.dataPedido}</td>
            <td class="text-center font-black font-tabela-fixa text-xs">${x.qtd}</td>
            <td class="uppercase font-tabela-fixa col-movel">${x.produto}</td>
            <td class="font-tabela-fixa col-medida uppercase">${x.medida || '-'}</td>
            <td class="uppercase font-tabela-fixa col-cor uppercase">${x.cor || '-'}</td>
            <td onclick="editField(${x.uid},'custo')" class="editable-cell whitespace-nowrap font-tabela-fixa"><span class="text-[8px] opacity-50">R$</span> ${vLimpo}</td>
            <td class="font-tabela-fixa uppercase text-[10px] text-blue-800 font-black">${x.fornecedor || "-"}</td>
            <td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white font-black">${x.status}</button></td>
            <td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'} font-black">${x.whatsEnviado?'SIM':'NÃO'}</button></td>
            <td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'} font-black">${x.confirmado?'SIM':'NÃO'}</button></td>
            <td><div class="flex gap-1 justify-center">
                <button onclick="copyText('${x.qtd}x ${x.produto} ${x.cor} (${x.idDoc})')">📋</button>
                <button onclick="dupPed(${x.uid})">➕</button>
                <button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button>
                <button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✖</button>
            </div></td></tr>`;
    }).join('');
}

// --- LOGICA DE PEDIDOS (ADD E SALVAR) ---
document.getElementById('btn-add-item').addEventListener('click', () => {
    const p = document.getElementById('m_produto').value.trim().toUpperCase();
    if (!p) return alert("Preencha o produto!");
    cestoItensTemporario.push({
        q: document.getElementById('m_qtd').value || 1,
        p: p,
        m: document.getElementById('m_medida').value || "-",
        c: document.getElementById('m_cor').value.toUpperCase() || "-",
        v: document.getElementById('m_custo').value || "R$ 0,00",
        o: (document.getElementById('m_pendencia').value || "-").toUpperCase()
    });
    document.getElementById('cesto-itens').innerText = "Cesto: " + cestoItensTemporario.length + " itens";
    document.getElementById('m_produto').value = ""; document.getElementById('m_medida').value = "";
    document.getElementById('m_cor').value = ""; document.getElementById('m_custo').value = ""; document.getElementById('m_pendencia').value = "";
});

document.getElementById('btn-finalizar-pedido').addEventListener('click', () => {
    const cli = document.getElementById('m_cliente').value.trim().toUpperCase();
    const forn = document.getElementById('m_fornecedor_select').value;
    if (!cli || cestoItensTemporario.length === 0) return alert("Falta cliente ou itens!");
    const idDoc = "ID#" + proximoID.toString().padStart(4, '0');
    proximoID++;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    cestoItensTemporario.forEach(i => pedidos.unshift({
        uid: Date.now() + Math.random(), idDoc, cliente: cli, dataPedido: dataAtual,
        qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, pendencia: i.o,
        fornecedor: forn, prazo: document.getElementById('m_prazo_select').value,
        status: "Não enviado", whatsEnviado: false, confirmado: false
    }));
    cestoItensTemporario = []; document.getElementById('m_cliente').value = ""; document.getElementById('cesto-itens').innerText = "";
    salvarCloud();
});

// --- EMAIL LOTE ---
document.getElementById('btn-email-lote').addEventListener('click', () => {
    const checks = Array.from(document.querySelectorAll('.ped-check:checked'));
    if (checks.length === 0) return alert("Selecione os pedidos!");
    const uids = checks.map(c => parseFloat(c.value));
    const items = pedidos.filter(p => uids.includes(p.uid));
    const fab = items[0].fornecedor;
    const fObj = fornecedores.find(f => f.nome === fab);
    if (!fObj || !fObj.email) return alert("Fábrica sem e-mail!");
    const h = new Date().getHours();
    const saud = h < 12 ? "Bom dia" : (h < 18 ? "Boa tarde" : "Boa noite");
    let lista = items.map(i => `Qtde: ${i.qtd.toString().padStart(2, '0')} - ${i.produto} ${i.medida} ${i.cor} (${i.idDoc})`).join("\n");
    const corpo = `${saud}!\n\nSegue abaixo o pedido para ${fab}:\n\n${lista}\n\nFico no aguardo do documento de confirmação com a relação dos itens acima para conferência.\n\nAtenciosamente,\nLucas Mercier.`;
    window.open(`mailto:${fObj.email}?subject=Pedido Mercier Design&body=${encodeURIComponent(corpo)}`);
});

// --- TAREFAS ---
function mostrarCamposTarefa(t) {
    const c = document.getElementById('container-campos-tarefa'); c.innerHTML = "";
    if (t === 'TIRAR PEDIDO') {
        c.innerHTML = `<input id="t_nome" placeholder="NOME" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_cpf" placeholder="CPF" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="maskCPF(this)"><input id="t_cep" placeholder="CEP" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="buscarCEP(this)"><input id="t_end" placeholder="RUA" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2"><input id="t_bairro" placeholder="BAIRRO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_num" placeholder="NÚMERO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_torre" placeholder="TORRE/APTO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_contato" placeholder="CONTATO" class="border-2 p-2 rounded-lg text-xs font-bold"><div class="col-span-3 border-t mt-2 pt-2"><div id="list-p-t"></div><button onclick="addPT()" class="text-[9px] font-bold text-blue-600 mt-1 uppercase">+ Add Produto</button><div id="total-p-t-top" class="text-xs font-black mt-1 text-indigo-600 uppercase">Total: R$ 0,00</div></div><div class="col-span-3 border-t mt-2 pt-2"><div id="list-pg-t"></div><button onclick="addPgT()" class="text-[9px] font-bold text-blue-600 mt-1 uppercase">+ Add Pagamento</button></div><textarea id="t_obs" placeholder="OBS..." class="col-span-3 border-2 p-2 rounded text-xs font-bold h-16 mt-1 uppercase"></textarea>`;
        addPT(); addPgT();
    } else if (t === 'SIMPLES') c.innerHTML = `<div class="col-span-3"><input id="t_raw" placeholder="DESCRICAO..." class="border-2 p-3 rounded-xl text-xs font-bold w-full"></div>`;
    else c.innerHTML = `<input id="t_cli" placeholder="CLIENTE..." class="border-2 p-2 rounded text-xs font-bold col-span-3">`;
}

function addPT() { let d = document.getElementById('list-p-t'); let r = document.createElement('div'); r.className = "flex gap-2 items-end mt-1"; r.innerHTML = `<input class="t-prod border-2 p-2 rounded text-xs font-bold flex-1" placeholder="MÓVEL"><input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-24" oninput="maskMoney(this)" placeholder="ORIGINAL"><input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-24" oninput="maskMoney(this)" placeholder="DESC."><button onclick="this.parentElement.remove(); calcTotalT();" class="p-2 text-red-500 font-black">✖</button>`; d.appendChild(r); }
function addPgT() {
    let d = document.getElementById('list-pg-t'); let tV = 0; document.querySelectorAll('.t-v-desc').forEach(i => tV += parseMoney(i.value)); let tP = 0; document.querySelectorAll('.t-p-val').forEach(i => tP += parseMoney(i.value)); let saldo = tV - tP;
    let r = document.createElement('div'); r.className = "bg-slate-50 p-2 rounded border mt-1 flex flex-col gap-1";
    r.innerHTML = `<div class="flex gap-1"><button onclick="setPag(this,'PIX')" class="btn-pag-opt active">PIX</button><button onclick="setPag(this,'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button><button onclick="setPag(this,'DÉBITO')" class="btn-pag-opt">DÉBITO</button><input type="hidden" class="t-p-forma" value="PIX"></div><div class="flex gap-1"><input placeholder="VALOR" class="t-p-val border-2 p-1 rounded text-xs font-bold flex-1" oninput="maskMoney(this)" value="${saldo > 0 ? 'R$ ' + saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}"> <input placeholder="DATA" class="t-p-data border-2 p-1 rounded text-xs font-bold w-32"><button onclick="this.parentElement.parentElement.remove()" class="text-red-500 font-black">✖</button></div>`;
    d.appendChild(r);
}

function cadastrarTarefa() {
    const t = document.getElementById('t_tipo').value;
    if (t === 'TIRAR PEDIDO' && !cpfValido) return alert("CPF INVÁLIDO!");
    let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: t, status: "Não Iniciado" };
    if (t === 'TIRAR PEDIDO') {
        obj.detalhes = { nome: document.getElementById('t_nome').value, cpf: document.getElementById('t_cpf').value, cep: document.getElementById('t_cep').value, end: document.getElementById('t_end').value, bairro: document.getElementById('t_bairro').value, num: document.getElementById('t_num').value, torre: document.getElementById('t_torre').value, contato: document.getElementById('t_contato').value, obs: document.getElementById('t_obs').value, prods: [], pags: [] };
        document.querySelectorAll('#list-p-t > div').forEach(r => { obj.detalhes.prods.push({ n: r.querySelector('.t-prod').value, d: r.querySelector('.t-v-desc').value }); });
        document.querySelectorAll('#list-pg-t > div').forEach(r => { obj.detalhes.pags.push({ f: r.querySelector('.t-p-forma').value, v: r.querySelector('.t-p-val').value, dt: r.querySelector('.t-p-data').value }); });
        obj.descricao = "PEDIDO: " + obj.detalhes.nome;
    } else obj.descricao = t + ": " + (document.getElementById('t_cli')?.value || document.getElementById('t_raw')?.value || "");
    if (!obj.descricao) return; tarefas.unshift(obj); salvarCloud(); mostrarCamposTarefa(t);
}

function verDetalhesTarefa(uid) {
    const t = tarefas.find(x => x.uid == uid); if (!t) return;
    document.getElementById('modal-detalhes').style.display = 'flex';
    const c = document.getElementById('detalhe-corpo');
    if (!t.detalhes) { c.innerHTML = `<div class="bg-slate-50 p-6 rounded flex justify-between items-center uppercase font-black"><span>${t.descricao}</span><i class="cursor-pointer" onclick="copyText('${t.descricao}')">📋</i></div>`; return; }
    let h = `<div class="grid grid-cols-1 gap-2">${f_i('CLIENTE', t.detalhes.nome)} ${f_i('CPF', t.detalhes.cpf)} ${f_i('CEP', t.detalhes.cep)} ${f_i('RUA', t.detalhes.end)} ${f_i('BAIRRO', t.detalhes.bairro)} ${f_i('NÚMERO', t.detalhes.num)} ${f_i('TORRE/APTO', t.detalhes.torre || '-')} ${f_i('CONTATO', t.detalhes.contato)}</div><div class="border-t pt-2">`;
    t.detalhes.prods.forEach(p => h += `<div class="bg-slate-50 p-2 rounded mb-1 flex justify-between uppercase text-xs font-bold"><span>${p.n}</span><span>${p.d} <i class="copy-btn-small" onclick="copyText('${p.n} - ${p.d}')">📋</i></span></div>`);
    h += `</div><div class="border-t pt-2 font-bold uppercase text-xs">${t.detalhes.obs || '-'}</div>`;
    c.innerHTML = h;
}
function f_i(l,v){ return `<div class="bg-slate-50 p-2 rounded border flex justify-between items-center"><div class="flex flex-col"><label class="text-[8px] font-black text-slate-400 uppercase">${l}</label><span class="text-xs font-bold uppercase">${v}</span></div><i class="copy-btn-small" onclick="copyText('${v}')">📋</i></div>`; }

// --- OUTROS RENDERS ---
function renderTarefas() { const tb=document.getElementById('tabelaTarefas'); if(!tb) return; const f=document.getElementById('filtro-tarefa').value; let l=f==='TODAS'?tarefas:tarefas.filter(x=>x.status===f); tb.innerHTML=l.map(x=>`<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer"><td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[9px] opacity-40 uppercase font-black">${x.tipo}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge ${x.status==='Feito'?'bg-green-600':(x.status==='Em Andamento'?'bg-orange-500':'bg-slate-400')} text-white font-black">${x.status}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-500 font-bold px-2">✖</button></td></tr>`).join(''); }
function renderEstoque() { const tb=document.getElementById('tabelaEstoque'); if(!tb) return; tb.innerHTML=estoque.map(x=>`<tr><td class="font-black text-xs p-4 uppercase font-tabela-fixa">${x.produto}</td><td class="p-4 font-tabela-fixa">${x.qtd}</td><td class="p-4 font-tabela-fixa">${x.situacao}</td><td class="p-4 text-center"><button onclick="estoque=estoque.filter(y=>y.uid!=${x.uid});salvarCloud();">✖</button></td></tr>`).join(''); }
function renderCatalogo() { const tb=document.getElementById('tabelaCatalogo'); if(!tb) return; tb.innerHTML=catalogo.map((c,i)=>`<tr><td class="p-4 font-black uppercase text-xs font-tabela-fixa">${c.nome}</td><td class="text-center p-4"><button onclick="catalogo.splice(${i},1);salvarCloud();" class="text-red-500 font-bold">✖</button></td></tr>`).join(''); }
function renderFornecedores() { const tb = document.getElementById('tabelaFornecedores'); if(!tb) return; tb.innerHTML=fornecedores.map((f,i)=>`<tr><td class="p-4 font-black uppercase text-xs font-tabela-fixa">${f.nome}</td><td class="p-4 text-xs lowercase font-tabela-fixa">${f.email}</td><td class="text-center p-4"><button onclick="fornecedores.splice(${i},1);salvarCloud();" class="text-red-500 font-bold">✖</button></td></tr>`).join(''); }
function renderAssistencias() { const tb=document.getElementById('tabelaAssistencias'); if(!tb) return; tb.innerHTML=assistencias.map(a=>`<tr><td>${a.data}</td><td class="font-black uppercase">${a.cliente}</td><td>${a.produto}</td><td><button class="status-badge bg-orange-600 text-white font-black">ABERTA</button></td><td><button onclick="assistencias=assistencias.filter(x=>x.uid!=${a.uid});salvarCloud();">✖</button></td></tr>`).join(''); }

// --- AUXILIARES GERAIS ---
function switchTab(t){ document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleStatus(u){ const x=pedidos.find(y=>y.uid==u); const s=["Não enviado","Pedido enviado ao fornecedor","Pedido chegou na loja"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados=!filtrandoNaoEnviados; document.getElementById('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); renderPedidos(); }
function limparBusca(){ document.getElementById('busca').value=""; renderPedidos(); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(c=>c.checked=v); }
function updPed(u,c,v){ pedidos.find(x=>x.uid==u)[c]=v; salvarCloud(); }
function togPed(u,c){ const x=pedidos.find(y=>y.uid==u); if(x) x[c]=!x[c]; salvarCloud(); }
function editField(u,f){ const x=pedidos.find(y=>y.uid==u); let n=prompt(`Editar:`,x[f]||""); if(n!==null){ if(f==='custo'){ let v=n.replace(/\D/g,""); x[f]=v? "R$ "+(v/100).toFixed(2).replace(".",",").replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1.") : "R$ 0,00"; } else {x[f]=n.toUpperCase();} salvarCloud(); } }
function excluirPedido(u){ if(confirm("Excluir?")){ pedidos=pedidos.filter(x=>x.uid!=u); salvarCloud(); } }
function dupPed(u){ const x=pedidos.find(y=>y.uid==u); const idDoc="ID#"+proximoID.toString().padStart(4,'0'); proximoID++; pedidos.unshift({...x, uid:Date.now(), idDoc}); salvarCloud(); }
function gerarAssistenciaRapida(u){ const x=pedidos.find(y=>y.uid==u); document.getElementById('as_cliente').value=x.cliente; document.getElementById('as_produto').value=`${x.produto} - ${x.cor}`; switchTab('assistencia'); }
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }

function atualizarSelectsFornecedores(){ const h = fornecedores.map(f => `<option value="${f.nome}">${f.nome}</option>`).join(''); document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>"; }
function atualizarSugestoes(){ const n=[...new Set(pedidos.map(p=>p.cliente))].sort(); if(document.getElementById('listaSugestaoClientes')) document.getElementById('listaSugestaoClientes').innerHTML=n.map(x=>`<option value="${x}">`).join(''); }
function cadastrarEstoque() { estoque.unshift({ uid: Date.now(), produto: document.getElementById('e_produto').value.toUpperCase(), qtd: document.getElementById('e_qtd').value, situacao: document.getElementById('e_situacao').value }); salvarCloud(); }
function cadastrarCatalogo() { catalogo.push({ nome: document.getElementById('cat_nome').value.toUpperCase() }); salvarCloud(); }
function cadastrarFornecedor() { fornecedores.push({ nome: document.getElementById('f_nome').value.toUpperCase(), email: document.getElementById('f_email').value.toLowerCase() }); salvarCloud(); }
function cadastrarAssistencia() { assistencias.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), cliente: document.getElementById('as_cliente').value.toUpperCase(), produto: document.getElementById('as_produto').value.toUpperCase(), status: 'ABERTA' }); salvarCloud(); }

// --- PDF E BOILERPLATE ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
