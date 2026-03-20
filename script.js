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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// VARIÁVEIS
let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", cestoItensTemporario=[], filtrandoNaoEnviados=false, cpfValido=true;

// CARREGAMENTO INICIAL
db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos=d.pedidos||[]; fornecedores=d.fornecedores||[]; estoque=d.estoque||[]; catalogo=d.catalogo||[]; tarefas=d.tarefas||[]; assistencias=d.assistencias||[]; proximoID=d.proximoID||255; notasMelhoria=d.notasMelhoria||"";
    
    document.getElementById('status-db').innerText="ONLINE";
    document.getElementById('status-db').className="status-online";
    document.getElementById('texto-melhorias').value=notasMelhoria;
    
    atualizarSugestoes(); 
    atualizarSelectsFornecedores(); 
    renderAll();
});

function renderAll(){ renderPedidos(); renderTarefas(); renderFornecedores(); renderEstoque(); renderCatalogo(); renderAssistencias(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria}); }

// --- ÚTEIS ---
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; }
function formatGrammar(s){ if(!s) return ""; return s.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase()); }
function copyText(v){ navigator.clipboard.writeText(formatGrammar(v)); alert("Copiado!"); }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const ok = validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }

// --- PEDIDOS ---
function adicionarItemAoCesto() {
    const p = document.getElementById('m_produto').value.trim().toUpperCase();
    if(!p) return alert("Preecha o produto!");
    cestoItensTemporario.push({
        uid: Date.now(),
        q: document.getElementById('m_qtd').value || 1,
        p,
        m: document.getElementById('m_medida').value || "-",
        c: document.getElementById('m_cor').value.toUpperCase() || "-",
        v: document.getElementById('m_custo').value || "R$ 0,00"
    });
    renderCesto();
    document.getElementById('m_produto').value = ""; document.getElementById('m_medida').value = ""; document.getElementById('m_cor').value = ""; document.getElementById('m_custo').value = "";
}

function renderCesto() {
    const div = document.getElementById('cesto-itens');
    div.innerHTML = cestoItensTemporario.map((item, idx) => `
        <div class="item-cesto">
            <span class="font-black text-blue-600">${item.q}x</span>
            <span>${item.p}</span>
            <button onclick="cestoItensTemporario.splice(${idx},1); renderCesto();" class="text-red-500 font-black">✕</button>
        </div>
    `).join('');
}

function cadastrarManual() {
    const cli = document.getElementById('m_cliente').value.trim().toUpperCase();
    const forn = document.getElementById('m_fornecedor_select').value;
    if(!cli || cestoItensTemporario.length === 0) return alert("Falta cliente ou itens no cesto!");
    
    const idDoc = "ID#" + proximoID.toString().padStart(4, '0');
    proximoID++;
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    cestoItensTemporario.forEach(i => {
        pedidos.unshift({
            uid: Math.random() + Date.now(),
            idDoc, cliente: cli, dataPedido: dataAtual,
            qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v,
            fornecedor: forn, prazo: document.getElementById('m_prazo_select').value,
            status: "Não enviado", whatsEnviado: false, confirmado: false
        });
    });
    cestoItensTemporario = []; document.getElementById('m_cliente').value = ""; renderCesto(); salvarCloud();
}

function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos');
    const busca=document.getElementById('busca').value.toLowerCase();
    let lista=pedidos.filter(x=>(x.cliente||"").toLowerCase().includes(busca)||(x.produto||"").toLowerCase().includes(busca)||(x.idDoc||"").toLowerCase().includes(busca)||(x.fornecedor||"").toLowerCase().includes(busca));
    
    if(filtrandoNaoEnviados) lista=lista.filter(x=>x.status==="Não enviado");
    
    document.getElementById('contador').innerText=lista.length+" PEDIDOS";
    tb.innerHTML = lista.map(x=>{
        const p=calcP(x.dataPedido, x.prazo);
        let sCls = x.status==="Não enviado" ? "bg-red-600" : (x.status.includes("loja") ? "bg-green-700" : "bg-blue-600");
        return `
        <tr class="${p.classe}">
            <td><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span>
                <select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela">
                    <option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option>
                    <option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option>
                    <option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option>
                </select></div>
            </td>
            <td class="text-[10px] text-slate-400 font-black">${x.idDoc}</td>
            <td onclick="editField(${x.uid},'cliente')" class="editable-cell uppercase col-cliente font-tabela-fixa">${x.cliente}</td>
            <td class="font-tabela-fixa">${x.dataPedido}</td>
            <td class="text-center font-black">${x.qtd}</td>
            <td class="uppercase col-movel font-tabela-fixa">${x.produto}</td>
            <td class="font-tabela-fixa">${x.medida}</td>
            <td class="font-tabela-fixa uppercase">${x.cor}</td>
            <td onclick="editField(${x.uid},'custo')" class="editable-cell font-tabela-fixa">${x.custo}</td>
            <td class="font-black text-blue-800 uppercase text-[10px]">${x.fornecedor}</td>
            <td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white">${x.status}</button></td>
            <td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td>
            <td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td>
            <td class="text-center">
                <div class="flex gap-2 justify-center">
                    <button onclick="copyText('${x.qtd}x ${x.produto} ${x.cor} ${x.medida} (${x.idDoc})')">📋</button>
                    <button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button>
                    <button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✖</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// --- TAREFAS ---
function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`<input id="t_nome" placeholder="CLIENTE" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_cpf" placeholder="CPF" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="maskCPF(this)"><input id="t_contato" placeholder="CELULAR" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_end" placeholder="ENDEREÇO COMPLETO" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2"><textarea id="t_obs" placeholder="MÓVEIS E VALORES" class="col-span-3 border-2 p-2 rounded text-xs font-bold h-20 uppercase"></textarea>`;
    } else c.innerHTML = `<input id="t_raw" placeholder="DESCREVA A TAREFA..." class="border-2 p-3 rounded-xl text-xs font-bold col-span-3">`;
}
function cadastrarTarefa(){
    const t=document.getElementById('t_tipo').value;
    let obj={ uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), tipo:t, status:"Não Iniciado" };
    if(t==='TIRAR PEDIDO'){
        obj.descricao = "VENDA: " + document.getElementById('t_nome').value.toUpperCase();
        obj.detalhes = { nome: document.getElementById('t_nome').value.toUpperCase(), cpf: document.getElementById('t_cpf').value, contato: document.getElementById('t_contato').value, end: document.getElementById('t_end').value.toUpperCase(), obs: document.getElementById('t_obs').value.toUpperCase() };
    } else obj.descricao = document.getElementById('t_raw').value.toUpperCase();
    if(!obj.descricao) return alert("Preencha algo!");
    tarefas.unshift(obj); salvarCloud(); mostrarCamposTarefa(t);
}
function renderTarefas() {
    const f=document.getElementById('filtro-tarefa-status').value;
    let l = f==="TODAS"?tarefas:tarefas.filter(x=>x.status===f);
    document.getElementById('tabelaTarefas').innerHTML=l.map(x=>`
        <tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer">
            <td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[10px] font-bold">${x.tipo}</td>
            <td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-200">${x.status}</button></td>
            <td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-500 font-black">✖</button></td>
        </tr>`).join('');
}
function verDetalhesTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return;
    document.getElementById('modal-detalhes').style.display='flex';
    const c=document.getElementById('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML=`<div class="bg-slate-50 p-6 rounded uppercase font-black">${t.descricao}</div>`; return; }
    c.innerHTML = `<div class="grid grid-cols-1 gap-2">
        <div class="bg-slate-50 p-3 rounded border text-xs font-black uppercase">CLIENTE: ${t.detalhes.nome} - ${t.detalhes.contato}</div>
        <div class="bg-slate-50 p-3 rounded border text-xs font-black uppercase">CPF: ${t.detalhes.cpf}</div>
        <div class="bg-slate-50 p-3 rounded border text-xs font-black uppercase">ENDEREÇO: ${t.detalhes.end}</div>
        <div class="bg-slate-100 p-4 rounded border text-xs font-bold uppercase whitespace-pre-wrap">${t.detalhes.obs}</div>
    </div>`;
}

// --- EMAILS EM LOTE ---
function gerarEmailLote() {
    const checks = document.querySelectorAll('.ped-check:checked');
    if(checks.length === 0) return alert("Selecione pedidos na tabela!");
    const selecionados = Array.from(checks).map(c => pedidos.find(p => p.uid == c.value));
    const grupos = {};
    selecionados.forEach(p => { if(!grupos[p.fornecedor]) grupos[p.fornecedor] = []; grupos[p.fornecedor].push(p); });
    for(const fab in grupos) {
        const f = fornecedores.find(x => x.nome === fab);
        let corpo = `Olá, segue pedido(s) Mercier Design:\n\n`;
        grupos[fab].forEach(p => corpo += `${p.qtd}x ${p.produto} - COR: ${p.cor} (${p.idDoc})\n`);
        const sub = encodeURIComponent(`PEDIDO MERCIER DESIGN - ${fab}`);
        window.open(`mailto:${f?f.email:''}?subject=${sub}&body=${encodeURIComponent(corpo)}`);
    }
}

// --- SISTEMA GERAL ---
function switchTab(t){ document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleStatus(u){ const x=pedidos.find(y=>y.uid==u); const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleAssisStatus(u){ const x=assistencias.find(y=>y.uid==u); const s=["Aguardando","Peça Solicitada","Concluído"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados=!filtrandoNaoEnviados; document.getElementById('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); document.getElementById('btnFiltroNaoEnviado').classList.toggle('text-white'); renderPedidos(); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(c=>c.checked=v); }
function updPed(u,c,v){ pedidos.find(x=>x.uid==u)[c]=v; salvarCloud(); }
function togPed(u,c){ const x=pedidos.find(y=>y.uid==u); if(x) x[c]=!x[c]; salvarCloud(); }
function editField(u,f){ const x=pedidos.find(y=>y.uid==u); let n=prompt(`Editar ${f}:`,x[f]||""); if(n!==null){ x[f]=n.toUpperCase(); salvarCloud(); } }
function excluirPedido(u){ if(confirm("Excluir item?")){ pedidos=pedidos.filter(x=>x.uid!=u); salvarCloud(); } }
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }

function renderEstoque() { document.getElementById('tabelaEstoque').innerHTML=estoque.map(x=>`<tr><td>${x.produto}</td><td>${x.qtd}</td><td>${x.situacao}</td><td><button onclick="if(confirm('Excluir?')){estoque=estoque.filter(y=>y.uid!=${x.uid});salvarCloud();}">✖</button></td></tr>`).join(''); }
function renderCatalogo() { document.getElementById('tabelaCatalogo').innerHTML=catalogo.map((c,i)=>`<tr><td>${c.nome}</td><td><button onclick="catalogo.splice(${i},1);salvarCloud();" class="text-red-500 font-black">✖</button></td></tr>`).join(''); }
function renderFornecedores() { document.getElementById('tabelaFornecedores').innerHTML=fornecedores.map((f,i)=>`<tr><td>${f.nome}</td><td class="lowercase">${f.email}</td><td><button onclick="fornecedores.splice(${i},1);salvarCloud();" class="text-red-500 font-black">✖</button></td></tr>`).join(''); }
function renderAssistencias() { document.getElementById('tabelaAssistencias').innerHTML=assistencias.map(a=>`<tr><td>${a.data}</td><td class="uppercase font-bold">${a.cliente}</td><td class="uppercase">${a.produto}</td><td class="font-black text-blue-700 uppercase">${a.fabrica}</td><td><button onclick="cycleAssisStatus(${a.uid})" class="status-badge bg-slate-200">${a.status}</button></td><td><button onclick="if(confirm('Excluir?')){assistencias=assistencias.filter(x=>x.uid!=${a.uid});salvarCloud();}" class="text-red-500 font-black">✖</button></td></tr>`).join(''); }

function cadastrarAssistencia(){ const c=document.getElementById('as_cliente').value.toUpperCase(), p=document.getElementById('as_produto').value.toUpperCase(), f=document.getElementById('as_fabrica').value; if(c&&p){ assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); salvarCloud(); document.getElementById('as_cliente').value=""; document.getElementById('as_produto').value=""; } }
function cadastrarFornecedor(){ const n=document.getElementById('f_nome').value.toUpperCase(), e=document.getElementById('f_email').value.toLowerCase(); if(n&&e){fornecedores.push({nome:n,email:e}); salvarCloud(); document.getElementById('f_nome').value=""; document.getElementById('f_email').value="";}}
function cadastrarEstoque(){ const p=document.getElementById('e_produto').value.toUpperCase(), q=document.getElementById('e_qtd').value, s=document.getElementById('e_situacao').value; if(p){estoque.push({uid:Date.now(),produto:p,qtd:q,situacao:s}); salvarCloud();}}
function cadastrarCatalogo(){ const n=document.getElementById('cat_nome').value.toUpperCase(); if(n){catalogo.push({nome:n}); salvarCloud(); document.getElementById('cat_nome').value="";}}

function atualizarSelectsFornecedores(){ const h = fornecedores.map(f => `<option value="${f.nome}">${f.nome}</option>`).join(''); document.getElementById('m_fornecedor_select').innerHTML = h || "<option>Cadastre Fábricas</option>"; document.getElementById('as_fabrica').innerHTML = h || "<option>...</option>";}
function atualizarSugestoes(){ const n=[...new Set(pedidos.map(p=>p.cliente))].sort(); document.getElementById('listaSugestaoClientes').innerHTML=n.map(x=>`<option value="${x}">`).join(''); const p=[...new Set(catalogo.map(c=>c.nome))].sort(); document.getElementById('listaSugestaoProdutos').innerHTML=p.map(x=>`<option value="${x}">`).join('');}
function gerarAssistenciaRapida(u){ const p=pedidos.find(x=>x.uid==u); if(p){ document.getElementById('as_cliente').value=p.cliente; document.getElementById('as_produto').value=p.produto+" (DEFEITO)"; document.getElementById('as_fabrica').value=p.fornecedor; switchTab('assistencia'); alert("Dados preenchidos na aba Assistência!"); } }

mostrarCamposTarefa('SIMPLES');
