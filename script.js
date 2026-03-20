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

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", cestoItensTemporario=[], filtrandoNaoEnviados=false, cpfValido=true;

db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos=d.pedidos||[]; fornecedores=d.fornecedores||[]; estoque=d.estoque||[]; catalogo=d.catalogo||[]; tarefas=d.tarefas||[]; assistencias=d.assistencias||[]; proximoID=d.proximoID||255; notasMelhoria=d.notasMelhoria||"";
    document.getElementById('status-db').innerText="ONLINE";
    document.getElementById('status-db').className="status-online";
    document.getElementById('texto-melhorias').value=notasMelhoria;
    renderAll();
    atualizarSelectsFornecedores();
});

function renderAll(){ renderPedidos(); renderTarefas(); renderFornecedores(); renderEstoque(); renderCatalogo(); renderAssistencias(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria}); }

// --- MÁSCARAS ---
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function copyText(v){ navigator.clipboard.writeText(v.toUpperCase()); alert("COPIADO!"); }

// --- PEDIDOS ---
function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); 
    const b=document.getElementById('busca').value.toLowerCase();
    let lista=pedidos.filter(x=>(x.cliente||"").toLowerCase().includes(b)||(x.produto||"").toLowerCase().includes(b)||(x.idDoc||"").toLowerCase().includes(b)||(x.fornecedor||"").toLowerCase().includes(b));
    if(filtrandoNaoEnviados) lista=lista.filter(x=>x.status==="Não enviado");
    
    document.getElementById('contador').innerText=lista.length+" PEDIDOS";
    tb.innerHTML = lista.map(x=>{
        const p=calcP(x.dataPedido, x.prazo); 
        let sCls = x.status==="Não enviado" ? "bg-red-600" : (x.status.includes("loja") ? "bg-green-700" : "bg-blue-600");
        return `<tr class="${p.classe}">
            <td><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td>
            <td class="text-[10px] text-slate-400 font-black">${x.idDoc}</td>
            <td onclick="editField(${x.uid},'cliente')" class="editable-cell uppercase">${x.cliente}</td>
            <td onclick="editField(${x.uid},'dataPedido')" class="editable-cell">${x.dataPedido}</td>
            <td onclick="editField(${x.uid},'qtd')" class="editable-cell text-center font-black">${x.qtd}</td>
            <td onclick="editField(${x.uid},'produto')" class="editable-cell uppercase">${x.produto}</td>
            <td onclick="editField(${x.uid},'medida')" class="editable-cell uppercase">${x.medida}</td>
            <td onclick="editField(${x.uid},'cor')" class="editable-cell uppercase">${x.cor}</td>
            <td onclick="editField(${x.uid},'custo')" class="editable-cell">${x.custo}</td>
            <td onclick="editField(${x.uid},'fornecedor')" class="editable-cell font-black text-blue-800 uppercase text-[10px]">${x.fornecedor}</td>
            <td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white">${x.status}</button></td>
            <td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td>
            <td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td>
            <td class="text-center flex gap-1 justify-center">
                <button onclick="copyText('${x.qtd}x ${x.produto} ${x.cor} (${x.idDoc})')">📋</button>
                <button onclick="dupPed(${x.uid})">➕</button>
                <button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button>
                <button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✕</button>
            </td></tr>`;
    }).join('');
}

function editField(u, f) {
    const x = pedidos.find(y => y.uid == u);
    let n = prompt(`EDITAR ${f.toUpperCase()}:`, x[f] || "");
    if (n !== null) {
        if (f === 'custo') {
            let v = n.replace(/\D/g, "");
            x[f] = v ? "R$ " + (v / 100).toFixed(2).replace(".", ",").replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.") : "R$ 0,00";
        } else if (f === 'qtd') {
            x[f] = parseInt(n) || 1;
        } else {
            x[f] = n.toUpperCase();
        }
        salvarCloud();
    }
}

function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados=!filtrandoNaoEnviados; document.getElementById('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); document.getElementById('btnFiltroNaoEnviado').classList.toggle('text-white'); renderPedidos(); }

function gerarEmailLote() {
    const checks = document.querySelectorAll('.ped-check:checked');
    if(checks.length === 0) return alert("SELECIONE PEDIDOS!");
    const selecionados = Array.from(checks).map(c => pedidos.find(p => p.uid == c.value));
    const grupos = {};
    selecionados.forEach(p => { if(!grupos[p.fornecedor]) grupos[p.fornecedor] = []; grupos[p.fornecedor].push(p); });
    for(const fab in grupos) {
        const f = fornecedores.find(x => x.nome === fab);
        let corpo = `Olá, segue pedido(s):\n\n`;
        grupos[fab].forEach(p => corpo += `${p.qtd}x ${p.produto} - COR: ${p.cor} (${p.idDoc})\n`);
        window.open(`mailto:${f?f.email:''}?subject=${encodeURIComponent('PEDIDO MERCIER DESIGN - '+fab)}&body=${encodeURIComponent(corpo)}`);
    }
}

function dupPed(u){ const x=pedidos.find(y=>y.uid==u); const idDoc="ID#"+proximoID.toString().padStart(4,'0'); proximoID++; pedidos.unshift({...x, uid:Date.now()+Math.random(), idDoc}); salvarCloud(); }
function gerarAssistenciaRapida(u){ const p=pedidos.find(x=>x.uid==u); if(p){ document.getElementById('as_cliente').value=p.cliente; document.getElementById('as_produto').value=p.produto+" (DEFEITO)"; document.getElementById('as_fabrica').value=p.fornecedor; switchTab('assistencia'); }}

// --- TAREFAS E GERAIS ---
function switchTab(t){ document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleStatus(u){ const x=pedidos.find(y=>y.uid==u); const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(c=>c.checked=v); }
function updPed(u,c,v){ pedidos.find(x=>x.uid==u)[c]=v; salvarCloud(); }
function togPed(u,c){ const x=pedidos.find(y=>y.uid==u); if(x) x[c]=!x[c]; salvarCloud(); }
function excluirPedido(u){ if(confirm("EXCLUIR?")){ pedidos=pedidos.filter(x=>x.uid!=u); salvarCloud(); } }
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }

function renderTarefas() { const f=document.getElementById('filtro-tarefa-status').value; let l = f==="TODAS"?tarefas:tarefas.filter(x=>x.status===f); document.getElementById('tabelaTarefas').innerHTML=l.map(x=>`<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[10px] font-black text-slate-400">${x.tipo}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${x.status}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('EXCLUIR?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-400 font-black">✕</button></td></tr>`).join(''); }
function renderEstoque() { document.getElementById('tabelaEstoque').innerHTML=estoque.map(x=>`<tr><td>${x.produto}</td><td>${x.qtd}</td><td>${x.situacao}</td><td>✖</td></tr>`).join(''); }
function renderCatalogo() { document.getElementById('tabelaCatalogo').innerHTML=catalogo.map(x=>`<tr><td>${x.nome}</td><td>✖</td></tr>`).join(''); }
function renderFornecedores() { document.getElementById('tabelaFornecedores').innerHTML=fornecedores.map(x=>`<tr><td>${x.nome}</td><td class="lowercase">${x.email}</td><td>✖</td></tr>`).join(''); }
function renderAssistencias() { document.getElementById('tabelaAssistencias').innerHTML=assistencias.map(x=>`<tr><td>${x.data}</td><td class="uppercase">${x.cliente}</td><td>${x.produto}</td><td>${x.fabrica}</td><td>${x.status}</td><td>✖</td></tr>`).join(''); }

function cadastrarFornecedor(){ const n=document.getElementById('f_nome').value.toUpperCase(), e=document.getElementById('f_email').value.toLowerCase(); if(n&&e){fornecedores.push({nome:n,email:e}); salvarCloud(); document.getElementById('f_nome').value=""; document.getElementById('f_email').value="";}}
function cadastrarEstoque(){ const p=document.getElementById('e_produto').value.toUpperCase(), q=document.getElementById('e_qtd').value, s=document.getElementById('e_situacao').value; if(p){estoque.push({uid:Date.now(),produto:p,qtd:q,situacao:s}); salvarCloud();}}
function cadastrarCatalogo(){ const n=document.getElementById('cat_nome').value.toUpperCase(); if(n){catalogo.push({nome:n}); salvarCloud(); document.getElementById('cat_nome').value="";}}
function cadastrarAssistencia(){ const c=document.getElementById('as_cliente').value.toUpperCase(), p=document.getElementById('as_produto').value.toUpperCase(), f=document.getElementById('as_fabrica').value; if(c&&p){ assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); salvarCloud(); }}
function atualizarSelectsFornecedores(){ const h = fornecedores.map(f => `<option value="${f.nome}">${f.nome}</option>`).join(''); if(document.getElementById('m_fornecedor_select')) document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>"; if(document.getElementById('as_fabrica')) document.getElementById('as_fabrica').innerHTML = h || "<option>...</option>";}

mostrarCamposTarefa('SIMPLES');
