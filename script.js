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

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", cestoItensTemporario=[], cpfValido=true;

db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos=d.pedidos||[]; fornecedores=d.fornecedores||[]; estoque=d.estoque||[]; catalogo=d.catalogo||[]; tarefas=d.tarefas||[]; assistencias=d.assistencias||[]; proximoID=d.proximoID||255; notasMelhoria=d.notasMelhoria||"";
    document.getElementById('status-db').innerText="SINCRONIZADO";
    document.getElementById('status-db').className="status-online";
    document.getElementById('texto-melhorias').value=notasMelhoria;
    renderAll();
    atualizarSelectsFornecedores();
});

function renderAll(){ renderPedidos(); renderTarefas(); renderFornecedores(); renderEstoque(); renderCatalogo(); renderAssistencias(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria}); }

// --- MÁSCARAS E CEP ---
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const ok = validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }

async function buscarCEP(i){
    let cep = i.value.replace(/\D/g,"");
    if(cep.length === 8){
        document.getElementById('loading-cep').classList.remove('hidden');
        try {
            let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            let d = await res.json();
            if(!d.erro){
                document.getElementById('t_end').value = d.logradouro.toUpperCase();
                document.getElementById('t_bairro').value = d.bairro.toUpperCase();
                document.getElementById('t_cidade').value = d.localidade.toUpperCase();
                document.getElementById('t_num').focus();
            }
        } catch(e) { console.error("CEP error"); }
        finally { document.getElementById('loading-cep').classList.add('hidden'); }
    }
}

function copyText(v, el){
    if(!v || v === "-") return;
    navigator.clipboard.writeText(v.toUpperCase());
    if(el) {
        el.classList.add('copy-success');
        setTimeout(() => el.classList.remove('copy-success'), 1000);
    }
}

// --- TAREFAS: TIRAR PEDIDO ---
function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`
            <input id="t_nome" placeholder="NOME DO CLIENTE" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2">
            <input id="t_cpf" placeholder="CPF" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="maskCPF(this)">
            <input id="t_contato" placeholder="CONTATO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_cep" placeholder="CEP" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="buscarCEP(this)">
            <input id="t_end" placeholder="RUA" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2">
            <input id="t_bairro" placeholder="BAIRRO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_cidade" placeholder="CIDADE" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_num" placeholder="NÚMERO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_torre" placeholder="TORRE/APTO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <div class="col-span-4 border-t mt-4 pt-4"><div id="lista-produtos-tarefa"></div><button onclick="addProdutoLinha()" class="text-[10px] font-black text-blue-600 mt-2 uppercase bg-blue-50 px-4 py-2 rounded-lg">+ Novo Móvel</button><div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-sm mt-1 uppercase">Soma dos Descontos: R$ 0,00</div></div>
            <div class="col-span-4 border-t mt-4 pt-4"><div id="lista-pagamentos-tarefa"></div><button onclick="addPagamentoLinha()" class="text-[10px] font-black text-emerald-600 mt-2 uppercase bg-emerald-50 px-4 py-2 rounded-lg">+ Nova Forma Pagto</button></div>
            <textarea id="t_obs" placeholder="OBSERVAÇÕES DO PEDIDO" class="col-span-4 border-2 p-2 rounded-lg text-xs font-bold h-16 uppercase"></textarea>
        `;
        addProdutoLinha(); addPagamentoLinha();
    } else {
        c.innerHTML = `<input id="t_raw" placeholder="DESCREVA A TAREFA..." class="border-2 p-3 rounded-xl text-xs font-bold col-span-4">`;
    }
}

function addProdutoLinha(){
    const d = document.getElementById('lista-produtos-tarefa');
    const r = document.createElement('div');
    r.className = "flex gap-2 mb-2 items-center row-prod bg-slate-50 p-2 rounded-lg border border-dashed";
    r.innerHTML = `<input class="t-p-nome border-2 p-2 rounded-lg text-xs font-bold flex-1" placeholder="QUAL O MÓVEL?"><input class="t-v-orig border-2 p-2 rounded-lg text-xs font-bold w-32" placeholder="PREÇO ORIGINAL" oninput="maskMoney(this)"><input class="t-v-desc border-2 p-2 rounded-lg text-xs font-bold w-32 text-indigo-600" placeholder="PREÇO C/ DESCONTO" oninput="maskMoney(this)"><button onclick="this.parentElement.remove(); calcTotalTirarPedido();" class="text-red-400 font-black px-4 hover:text-red-600">✕</button>`;
    d.appendChild(r);
}

function addPagamentoLinha(){
    const d = document.getElementById('lista-pagamentos-tarefa');
    let total = 0; document.querySelectorAll('.t-v-desc').forEach(i => total += parseMoney(i.value));
    let pago = 0; document.querySelectorAll('.t-p-val').forEach(i => pago += parseMoney(i.value));
    let restante = total - pago; if(restante < 0) restante = 0;
    const r = document.createElement('div');
    r.className = "flex flex-col bg-slate-50 p-3 rounded-xl border mb-3 row-pag";
    r.innerHTML = `<div class="flex gap-2 mb-2"><button onclick="setP(this,'PIX')" class="btn-pag-opt active">PIX</button><button onclick="setP(this,'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button><button onclick="setP(this,'DÉBITO')" class="btn-pag-opt">DÉBITO</button><button onclick="setP(this,'CHEQUE')" class="btn-pag-opt">CHEQUE</button><input type="hidden" class="t-p-tipo" value="PIX"></div><div class="flex gap-2"><input class="t-p-val border-2 p-2 rounded-lg text-xs font-bold w-48 text-emerald-600" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${restante.toLocaleString('pt-BR',{minimumFractionDigits:2})}"><input class="t-p-obs border-2 p-2 rounded-lg text-xs font-bold flex-1" placeholder="DETALHES (DATA / PARCELAS)"><button onclick="this.parentElement.parentElement.remove()" class="text-red-400 font-black px-4">✕</button></div>`;
    d.appendChild(r);
    r.querySelector('.t-p-val').focus();
}

function setP(b, v){ b.parentElement.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active'); b.parentElement.querySelector('.t-p-tipo').value = v; }
function calcTotalTirarPedido(){ let t = 0; document.querySelectorAll('.t-v-desc').forEach(i => t += parseMoney(i.value)); document.getElementById('total-pedido-tarefa').innerText = "Soma dos Descontos: R$ " + t.toLocaleString('pt-BR', {minimumFractionDigits:2}); }

function cadastrarTarefa(){
    const tipo = document.getElementById('t_tipo').value;
    if(tipo === 'TIRAR PEDIDO' && !cpfValido) return alert("⚠️ CPF INVÁLIDO OU INCOMPLETO!");
    let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: tipo, status: "Não Iniciado" };
    if(tipo === 'TIRAR PEDIDO'){
        const cli = document.getElementById('t_nome').value; if(!cli) return alert("⚠️ NOME DO CLIENTE É OBRIGATÓRIO!");
        let total = 0; document.querySelectorAll('.t-v-desc').forEach(i => total += parseMoney(i.value));
        obj.descricao = "VENDA: " + cli.toUpperCase();
        obj.detalhes = { cliente: cli.toUpperCase(), cpf: document.getElementById('t_cpf').value, contato: document.getElementById('t_contato').value, cep: document.getElementById('t_cep').value, end: document.getElementById('t_end').value, bairro: document.getElementById('t_bairro').value, cidade: document.getElementById('t_cidade').value, num: document.getElementById('t_num').value, torre: document.getElementById('t_torre').value, obs: document.getElementById('t_obs').value, total: "R$ " + total.toLocaleString('pt-BR', {minimumFractionDigits:2}), produtos: [], pagamentos: [] };
        document.querySelectorAll('.row-prod').forEach(row => { if(row.querySelector('.t-p-nome').value) obj.detalhes.produtos.push({ nome: row.querySelector('.t-p-nome').value.toUpperCase(), orig: row.querySelector('.t-v-orig').value || 'R$ 0,00', desc: row.querySelector('.t-v-desc').value || 'R$ 0,00' }); });
        document.querySelectorAll('.row-pag').forEach(row => { obj.detalhes.pagamentos.push({ tipo: row.querySelector('.t-p-tipo').value, valor: row.querySelector('.t-p-val').value, obs: row.querySelector('.t-p-obs').value.toUpperCase() }); });
    } else { obj.descricao = (document.getElementById('t_raw')?.value || "").toUpperCase(); }
    if(!obj.descricao) return alert("⚠️ DESCREVA A TAREFA!");
    tarefas.unshift(obj); salvarCloud(); mostrarCamposTarefa(tipo); renderTarefas();
    document.getElementById('tabelaTarefas').scrollIntoView({ behavior: 'smooth' });
}

function verDetalhesTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return;
    document.getElementById('modal-detalhes').style.display='flex';
    const c=document.getElementById('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML=`<div class="bg-slate-50 p-12 rounded-2xl border-2 border-dashed text-slate-300 font-black text-center uppercase">${t.descricao}</div>`; return; }
    const d = t.detalhes;
    let html = `<div class="grid grid-cols-2 gap-3">${l_i("CLIENTE", d.cliente)}${l_i("CPF", d.cpf)}${l_i("CONTATO", d.contato)}${l_i("CEP", d.cep)}${l_i("ENDEREÇO", d.end)}${l_i("Nº/TORRE", (d.num+' '+(d.torre||'')))}${l_i("BAIRRO", d.bairro)}${l_i("CIDADE", d.cidade)}</div><div class="mt-6"><h4 class="text-[11px] font-black border-b-2 pb-2 mb-3 uppercase tracking-tighter">🛒 Móveis Escolhidos</h4>`;
    d.produtos.forEach(p => html += `<div class="flex justify-between bg-slate-50 p-3 rounded-xl mb-2 border text-xs font-bold"><div><div class="uppercase">${p.nome}</div><div class="text-[9px] text-slate-400">ORIGINAL: ${p.orig}</div></div><div class="flex items-center gap-4"><span class="text-indigo-600">${p.desc}</span><span class="copy-btn-small" onclick="copyText('${p.nome} - ${p.desc}', this)">📋</span></div></div>`);
    html += `<div class="text-right font-black text-indigo-600 text-lg mt-2 px-2 uppercase">Total da Venda: ${d.total}</div></div><div class="mt-6"><h4 class="text-[11px] font-black border-b-2 pb-2 mb-3 uppercase tracking-tighter">💳 Formas de Pagamento</h4>`;
    d.pagamentos.forEach(p => html += `<div class="flex justify-between bg-slate-50 p-3 rounded-xl mb-2 border border-l-4 border-l-emerald-500 text-xs font-bold"><div><div class="text-emerald-600">${p.tipo} - ${p.valor}</div><div class="text-[9px] text-slate-400 uppercase">${p.obs || 'Á VISTA'}</div></div><span class="copy-btn-small" onclick="copyText('${p.tipo}: ${p.valor}', this)">📋</span></div>`);
    html += `</div><div class="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold uppercase relative"><div class="text-[9px] text-amber-500 mb-2 font-black tracking-widest">OBSERVAÇÕES</div><p class="leading-relaxed">${d.obs || "NENHUMA OBSERVAÇÃO"}</p><span class="absolute top-4 right-4 copy-btn-small" onclick="copyText('${d.obs}', this)">📋</span></div>`;
    c.innerHTML = html;
}
function l_i(l, v){ return `<div class="bg-white p-3 rounded-xl border flex justify-between items-center group hover:border-indigo-300 transition shadow-sm"><div><div class="text-[8px] text-slate-400 font-black mb-1 uppercase">${l}</div><div class="text-xs font-black uppercase text-slate-700">${v || '-'}</div></div><span class="copy-btn-small opacity-0 group-hover:opacity-100 transition" onclick="copyText('${v}', this)">📋</span></div>`; }

// --- PEDIDOS ---
function adicionarItemAoCesto() {
    const p = document.getElementById('m_produto').value.trim().toUpperCase();
    if(!p) return alert("Preecha o produto!");
    cestoItensTemporario.push({ uid: Date.now(), q: document.getElementById('m_qtd').value || 1, p, m: document.getElementById('m_medida').value || "-", c: document.getElementById('m_cor').value.toUpperCase() || "-", v: document.getElementById('m_custo').value || "R$ 0,00" });
    renderCesto();
    document.getElementById('m_produto').value = ""; document.getElementById('m_medida').value = ""; document.getElementById('m_cor').value = ""; document.getElementById('m_custo').value = "";
}
function renderCesto() { document.getElementById('cesto-itens').innerHTML = cestoItensTemporario.map((item, idx) => `<div class="item-cesto"><span>${item.q}x</span><span>${item.p}</span><button onclick="cestoItensTemporario.splice(${idx},1); renderCesto();" class="text-red-500 hover:rotate-90 transition font-black ml-2">✕</button></div>`).join(''); }
function cadastrarManual() {
    const cli = document.getElementById('m_cliente').value.trim().toUpperCase();
    const forn = document.getElementById('m_fornecedor_select').value;
    if(!cli || cestoItensTemporario.length === 0) return alert("Falta cliente ou itens!");
    const idDoc = "ID#" + proximoID.toString().padStart(4, '0'); proximoID++;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    cestoItensTemporario.forEach(i => { pedidos.unshift({ uid: Math.random() + Date.now(), idDoc, cliente: cli, dataPedido: dataAtual, qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, fornecedor: forn, prazo: document.getElementById('m_prazo_select').value, status: "Não enviado", whatsEnviado: false, confirmado: false }); });
    cestoItensTemporario = []; document.getElementById('m_cliente').value = ""; renderCesto(); salvarCloud();
}
function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); const b=document.getElementById('busca').value.toLowerCase();
    let lista=pedidos.filter(x=>(x.cliente||"").toLowerCase().includes(b)||(x.produto||"").toLowerCase().includes(b)||(x.idDoc||"").toLowerCase().includes(b)||(x.fornecedor||"").toLowerCase().includes(b));
    document.getElementById('contador').innerText=lista.length+" PEDIDOS";
    tb.innerHTML = lista.map(x=>{
        const p=calcP(x.dataPedido, x.prazo); let sCls = x.status==="Não enviado" ? "bg-red-600" : (x.status.includes("loja") ? "bg-green-700" : "bg-blue-600");
        return `<tr class="${p.classe}"><td><input type="checkbox" class="ped-check" value="${x.uid}"></td><td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td><td class="text-[10px] text-slate-400 font-black">${x.idDoc}</td><td class="font-tabela-fixa uppercase">${x.cliente}</td><td class="font-tabela-fixa">${x.dataPedido}</td><td class="text-center font-black">${x.qtd}</td><td class="uppercase font-tabela-fixa">${x.produto}</td><td class="font-tabela-fixa">${x.medida}</td><td class="font-tabela-fixa uppercase">${x.cor}</td><td class="font-tabela-fixa">${x.custo}</td><td class="font-black text-blue-800 uppercase text-[10px]">${x.fornecedor}</td><td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white">${x.status}</button></td><td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td><td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td><td class="text-center flex gap-1 justify-center"><button onclick="copyText('${x.qtd}x ${x.produto} ${x.cor} (${x.idDoc})')">📋</button><button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✕</button></td></tr>`;
    }).join('');
}

// GERAIS
function renderTarefas() {
    const f=document.getElementById('filtro-tarefa-status').value;
    let l = f==="TODAS"?tarefas:tarefas.filter(x=>x.status===f);
    document.getElementById('tabelaTarefas').innerHTML=l.map(x=>`<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-indigo-50 cursor-pointer border-b transition"><td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[10px] font-black text-slate-400">${x.tipo}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${x.status}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>`).join('');
}
function switchTab(t){ document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleStatus(u){ const x=pedidos.find(y=>y.uid==u); const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(c=>c.checked=v); }
function updPed(u,c,v){ pedidos.find(x=>x.uid==u)[c]=v; salvarCloud(); }
function togPed(u,c){ const x=pedidos.find(y=>y.uid==u); if(x) x[c]=!x[c]; salvarCloud(); }
function excluirPedido(u){ if(confirm("Excluir?")){ pedidos=pedidos.filter(x=>x.uid!=u); salvarCloud(); } }
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }

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
