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

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", cestoItensTemporario=[], filtrandoNaoEnviados=false, cpfValido=true;

// --- SINCRONIZAÇÃO ---
db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos=d.pedidos||[]; fornecedores=d.fornecedores||[]; estoque=d.estoque||[]; catalogo=d.catalogo||[]; tarefas=d.tarefas||[]; assistencias=d.assistencias||[]; proximoID=d.proximoID||255; notasMelhoria=d.notasMelhoria||"";
    const statusDb = document.getElementById('status-db');
    if(statusDb){ statusDb.innerText="SINCRONIZADO"; statusDb.className="text-[10px] px-4 py-1.5 rounded-full bg-green-600 font-black text-white uppercase"; }
    document.getElementById('texto-melhorias').value=notasMelhoria;
    atualizarSugestoes(); atualizarSelectsFornecedores(); renderAll();
});

function renderAll(){ renderPedidos(); renderTarefas(); renderFornecedores(); renderEstoque(); renderCatalogo(); renderAssistencias(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria}); }

// --- ÚTEIS ---
function formatGrammar(s){ if(!s) return ""; return s.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase()); }
function copyText(v){ navigator.clipboard.writeText(formatGrammar(v)); alert("Copiado!"); }
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalT(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const l=document.getElementById('label-cpf-status'); const ok = validarCPF(i.value); i.className = ok ? "border-2 p-2 rounded-lg text-xs font-bold input-success" : "border-2 p-2 rounded-lg text-xs font-bold input-error"; if(l) l.innerText = ok ? "OK" : "!"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }
async function buscarCEP(i){ let c=i.value.replace(/\D/g,""); if(c.length===8){ try{let r=await fetch(`https://viacep.com.br/ws/${c}/json/`); let d=await r.json(); if(!d.erro){document.getElementById('t_end').value=d.logradouro.toUpperCase(); document.getElementById('t_bairro').value=d.bairro.toUpperCase();}}catch(e){}} }

// --- PEDIDOS ---
function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); if(!tb) return;
    const b=document.getElementById('busca').value.toLowerCase();
    let l=pedidos.filter(x=>(x.cliente||"").toLowerCase().includes(b)||(x.produto||"").toLowerCase().includes(b)||(x.idDoc||"").toLowerCase().includes(b)||(x.fornecedor||"").toLowerCase().includes(b));
    if(filtrandoNaoEnviados) l=l.filter(x=>x.status==="Não enviado");
    document.getElementById('contador').innerText=l.length+" PEDIDOS";
    tb.innerHTML = l.map(x=>{
        const p=calcP(x.dataPedido, x.prazo); let sCls=x.status==="Não enviado"?"bg-red-600":(x.status.includes("enviado")?"bg-blue-600":"bg-green-700");
        const vLimpo = (x.custo || "R$ 0,00").replace("R$ ", "");
        return `<tr class="${p.classe}"><td><input type="checkbox" class="ped-check" value="${x.uid}"></td><td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td><td class="text-xs font-bold text-slate-400 font-tabela-fixa">${x.idDoc}</td><td onclick="editField(${x.uid},'cliente')" class="editable-cell uppercase col-cliente font-tabela-fixa">${x.cliente}</td><td class="font-tabela-fixa">${x.dataPedido}</td><td class="text-center font-black font-tabela-fixa text-xs">${x.qtd}</td><td class="uppercase font-tabela-fixa col-movel">${x.produto}</td><td class="font-tabela-fixa col-medida uppercase">${x.medida||'-'}</td><td class="uppercase font-tabela-fixa col-cor uppercase font-tabela-fixa">${x.cor||'-'}</td><td onclick="editField(${x.uid},'custo')" class="editable-cell whitespace-nowrap font-tabela-fixa"><span class="text-[8px] opacity-50">R$</span> ${vLimpo}</td><td class="font-tabela-fixa uppercase text-[10px] text-blue-800 font-black">${x.fornecedor || "-"}</td><td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white font-black">${x.status}</button></td><td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'} font-black">${x.whatsEnviado?'SIM':'NÃO'}</button></td><td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'} font-black">${x.confirmado?'SIM':'NÃO'}</button></td><td><div class="flex gap-1 justify-center"><button onclick="copyText('${x.qtd}x ${x.produto} ${x.cor} (${x.idDoc})')">📋</button><button onclick="dupPed(${x.uid})">➕</button><button onclick="gerarAssistenciaRapida(${x.uid})">🛠️</button><button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black">✖</button></div></td></tr>`;
    }).join('');
}

// Botões Pedido
document.getElementById('btn-add-item').onclick = () => {
    const p = document.getElementById('m_produto').value.trim().toUpperCase();
    if(!p) return alert("Preecha o produto!");
    cestoItensTemporario.push({ q: document.getElementById('m_qtd').value || 1, p, m: document.getElementById('m_medida').value || "-", c: document.getElementById('m_cor').value.toUpperCase() || "-", v: document.getElementById('m_custo').value || "R$ 0,00", o: (document.getElementById('m_pendencia').value || "-").toUpperCase() });
    document.getElementById('cesto-itens').innerText = "Cesto: " + cestoItensTemporario.length + " itens";
    document.getElementById('m_produto').value = ""; document.getElementById('m_medida').value = ""; document.getElementById('m_cor').value = ""; document.getElementById('m_custo').value = ""; document.getElementById('m_pendencia').value = "";
};

document.getElementById('btn-finalizar-pedido').onclick = () => {
    const cli = document.getElementById('m_cliente').value.trim().toUpperCase();
    const forn = document.getElementById('m_fornecedor_select').value;
    if(!cli || cestoItensTemporario.length === 0) return alert("Falta cliente ou itens!");
    const idDoc = "ID#" + proximoID.toString().padStart(4, '0'); proximoID++;
    const dataA = new Date().toLocaleDateString('pt-BR');
    cestoItensTemporario.forEach(i => pedidos.unshift({ uid: Date.now() + Math.random(), idDoc, cliente: cli, dataPedido: dataA, qtd: i.q, produto: i.p, medida: i.m, cor: i.c, custo: i.v, pendencia: i.o, fornecedor: forn, prazo: document.getElementById('m_prazo_select').value, status: "Não enviado", whatsEnviado: false, confirmado: false }));
    cestoItensTemporario = []; document.getElementById('m_cliente').value = ""; document.getElementById('cesto-itens').innerText = ""; salvarCloud();
};

document.getElementById('btn-email-lote').onclick = () => {
    const checks = Array.from(document.querySelectorAll('.ped-check:checked'));
    if(checks.length === 0) return alert("Selecione os pedidos!");
    const uids = checks.map(c => parseFloat(c.value));
    const items = pedidos.filter(p => uids.includes(p.uid));
    const fab = items[0].fornecedor;
    const fObj = fornecedores.find(f => f.nome === fab);
    if(!fObj || !fObj.email) return alert("Fábrica sem email!");
    const agora=new Date().getHours();
    const saud = agora < 12 ? "Bom dia" : (agora < 18 ? "Boa tarde" : "Boa noite");
    let list = items.map(i => `Qtde: ${i.qtd.toString().padStart(2,'0')} - ${i.produto} ${i.medida} ${i.cor} (${i.idDoc})`).join("\n");
    const corpo = `${saud}!\n\nSegue abaixo o pedido para ${fab}:\n\n${list}\n\nFico no aguardo do documento de confirmação com a relação dos itens acima para conferência.\n\nAtenciosamente,\nLucas Mercier.`;
    window.open(`mailto:${fObj.email}?subject=Pedido Mercier Design&body=${encodeURIComponent(corpo)}`);
};

// --- TAREFAS ---
function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`<input id="t_nome" placeholder="NOME" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_cpf" placeholder="CPF" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="maskCPF(this)"><input id="t_cep" placeholder="CEP" class="border-2 p-2 rounded-lg text-xs font-bold" oninput="buscarCEP(this)"><input id="t_end" placeholder="RUA" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2"><input id="t_bairro" placeholder="BAIRRO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_num" placeholder="NÚMERO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_torre" placeholder="TORRE/APTO" class="border-2 p-2 rounded-lg text-xs font-bold"><input id="t_contato" placeholder="CONTATO" class="border-2 p-2 rounded-lg text-xs font-bold"><div class="col-span-3 border-t mt-2 pt-2"><div id="list-p-t"></div><button onclick="addPT()" class="text-[9px] font-bold text-blue-600 mt-1 uppercase">+ Add Produto</button><div id="total-p-t-top" class="text-xs font-black mt-1 text-indigo-600 uppercase">Total: R$ 0,00</div></div><div class="col-span-3 border-t mt-2 pt-2"><div id="list-pg-t"></div><button onclick="addPgT()" class="text-[9px] font-bold text-blue-600 mt-1 uppercase">+ Add Pagamento</button></div><textarea id="t_obs" placeholder="OBS..." class="col-span-3 border-2 p-2 rounded text-xs font-bold h-16 mt-1 uppercase"></textarea>`;
        addPT(); addPgT();
    } else { c.innerHTML = `<input id="t_raw" placeholder="DESCRIÇÃO DA TAREFA..." class="border-2 p-3 rounded-xl text-xs font-bold w-full col-span-3">`; }
}
function addPT(){ let d=document.getElementById('list-p-t'); let r=document.createElement('div'); r.className="flex gap-2 items-end mt-1"; r.innerHTML=`<input class="t-prod border-2 p-2 rounded text-xs font-bold flex-1" placeholder="MÓVEL"><input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-24" oninput="maskMoney(this)" placeholder="ORIGINAL"><input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-24" oninput="maskMoney(this)" placeholder="DESC."><button onclick="this.parentElement.remove(); calcTotalT();" class="p-2 text-red-500 font-black">✖</button>`; d.appendChild(r); }
function addPgT(){
    let d=document.getElementById('list-pg-t'); let tV=0; document.querySelectorAll('.t-v-desc').forEach(i=> tV += parseMoney(i.value)); let tP=0; document.querySelectorAll('.t-p-val').forEach(i=> tP += parseMoney(i.value)); let saldo = tV - tP;
    let r=document.createElement('div'); r.className="bg-slate-50 p-2 rounded border mt-1 flex flex-col gap-1";
    r.innerHTML=`<div class="flex gap-1"><button onclick="setPag(this,'PIX')" class="btn-pag-opt active">PIX</button><button onclick="setPag(this,'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button><button onclick="setPag(this,'DÉBITO')" class="btn-pag-opt">DÉBITO</button><input type="hidden" class="t-p-forma" value="PIX"></div><div class="flex gap-1"><input placeholder="VALOR" class="t-p-val border-2 p-1 rounded text-xs font-bold flex-1" oninput="maskMoney(this)" value="${saldo>0?'R$ '+saldo.toLocaleString('pt-BR',{minimumFractionDigits:2}):''}"> <input placeholder="DATA" class="t-p-data border-2 p-1 rounded text-xs font-bold w-32"><button onclick="this.parentElement.parentElement.remove()" class="text-red-500 font-black">✖</button></div>`;
    d.appendChild(r);
}
function setPag(b,v){ b.parentElement.querySelectorAll('button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); b.parentElement.querySelector('input').value=v; }
function calcTotalT(){ let t=0; document.querySelectorAll('.t-v-desc').forEach(i=> t += parseMoney(i.value)); const val = "Total: R$ "+t.toLocaleString('pt-BR',{minimumFractionDigits:2}); if(document.getElementById('total-p-t-top')) document.getElementById('total-p-t-top').innerText=val; if(document.getElementById('total-p-t-bottom')) document.getElementById('total-p-t-bottom').innerText=val; }

document.getElementById('btn-salvar-tarefa').onclick = () => {
    const t=document.getElementById('t_tipo').value; if(t==='TIRAR PEDIDO' && !cpfValido) return alert("CPF INVÁLIDO!");
    let obj={ uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), tipo:t, status:"Não Iniciado" };
    if(t==='TIRAR PEDIDO'){
        obj.detalhes={ nome:document.getElementById('t_nome').value, cpf:document.getElementById('t_cpf').value, cep:document.getElementById('t_cep').value, end:document.getElementById('t_end').value, bairro:document.getElementById('t_bairro').value, num:document.getElementById('t_num').value, torre:document.getElementById('t_torre').value, contato:document.getElementById('t_contato').value, obs:document.getElementById('t_obs').value, prods:[], pags:[] };
        document.querySelectorAll('#list-p-t > div').forEach(r=>{ obj.detalhes.prods.push({n:r.querySelector('.t-prod').value, o:r.querySelector('.t-v-orig').value, d:r.querySelector('.t-v-desc').value}); });
        document.querySelectorAll('#list-pg-t > div').forEach(r=>{ obj.detalhes.pags.push({f:r.querySelector('.t-p-forma').value, v:r.querySelector('.t-p-val').value, dt:r.querySelector('.t-p-data').value}); });
        obj.descricao="PEDIDO: "+obj.detalhes.nome;
    } else obj.descricao=t+": "+(document.getElementById('t_cli')?.value||document.getElementById('t_raw')?.value||"");
    if(!obj.descricao) return; tarefas.unshift(obj); salvarCloud(); mostrarCamposTarefa(t);
};

function verDetalhesTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return;
    document.getElementById('modal-detalhes').style.display='flex';
    const c=document.getElementById('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML=`<div class="bg-slate-50 p-6 rounded flex justify-between uppercase font-black"><span>${t.descricao}</span><i class="cursor-pointer" onclick="copyText('${t.descricao}')">📋</i></div>`; return; }
    let h=`<div class="grid grid-cols-1 gap-2">${f_i('CLIENTE', t.detalhes.nome)} ${f_i('CPF', t.detalhes.cpf)} ${f_i('CEP', t.detalhes.cep)} ${f_i('RUA', t.detalhes.end)} ${f_i('BAIRRO', t.detalhes.bairro)} ${f_i('NÚMERO', t.detalhes.num)} ${f_i('TORRE/APTO', t.detalhes.torre || '-')} ${f_i('CONTATO', t.detalhes.contato)}</div><div class="border-t pt-2">`;
    t.detalhes.prods.forEach(p=>h+=`<div class="bg-slate-50 p-2 rounded mb-1 border flex justify-between uppercase text-xs font-bold"><span>${p.n}</span><span>Orig: ${p.o} / Desc: ${p.d} <i class="copy-btn-small" onclick="copyText('${p.n} - ${p.d}')">📋</i></span></div>`);
    h+=`</div><div class="border-t pt-2 font-bold uppercase text-xs">${t.detalhes.obs || '-'}</div>`;
    c.innerHTML=h;
}
function f_i(l,v){ return `<div class="bg-slate-50 p-2 rounded border flex justify-between items-center"><div class="flex flex-col"><label class="text-[8px] font-black text-slate-400 uppercase">${l}</label><span class="text-xs font-bold uppercase">${v}</span></div><i class="copy-btn-small" onclick="copyText('${v}')">📋</i></div>`; }

// --- GERAL ---
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
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }

function renderEstoque(){ const tb=document.getElementById('tabelaEstoque'); if(!tb) return; tb.innerHTML=estoque.map(x=>`<tr><td>${x.produto}</td><td>${x.qtd}</td><td>${x.situacao}</td><td><button onclick="estoque=estoque.filter(y=>y.uid!=${x.uid});salvarCloud();">✖</button></td></tr>`).join(''); }
function renderCatalogo(){ const tb=document.getElementById('tabelaCatalogo'); if(!tb) return; tb.innerHTML=catalogo.map((c,i)=>`<tr><td>${c.nome}</td><td><button onclick="catalogo.splice(${i},1);salvarCloud();">✖</button></td></tr>`).join(''); }
function renderFornecedores(){ const tb=document.getElementById('tabelaFornecedores'); if(!tb) return; tb.innerHTML=fornecedores.map((f,i)=>`<tr><td>${f.nome}</td><td>${f.email}</td><td><button onclick="fornecedores.splice(${i},1);salvarCloud();">✖</button></td></tr>`).join(''); }
function renderAssistencias(){ const tb=document.getElementById('tabelaAssistencias'); if(!tb) return; tb.innerHTML=assistencias.map(a=>`<tr><td>${a.data}</td><td>${a.cliente}</td><td>${a.status}</td><td><button onclick="assistencias=assistencias.filter(x=>x.uid!=${a.uid});salvarCloud();">✖</button></td></tr>`).join(''); }
function renderTarefas(){ const tb=document.getElementById('tabelaTarefas'); if(!tb) return; const f=document.getElementById('filtro-tarefa').value; let l=f==='TODAS'?tarefas:tarefas.filter(x=>x.status===f); tb.innerHTML=l.map(x=>`<tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer"><td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[9px] font-black opacity-40 uppercase">${x.tipo}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge ${x.status==='Feito'?'bg-green-600':(x.status==='Em Andamento'?'bg-orange-500':'bg-slate-400')} text-white">${x.status}</button></td><td><button onclick="event.stopPropagation(); tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();">✖</button></td></tr>`).join(''); }
function atualizarSelectsFornecedores(){ const h = fornecedores.map(f => `<option value="${f.nome}">${f.nome}</option>`).join(''); document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>"; }
function atualizarSugestoes(){ const n=[...new Set(pedidos.map(p=>p.cliente))].sort(); if(document.getElementById('listaSugestaoClientes')) document.getElementById('listaSugestaoClientes').innerHTML=n.map(x=>`<option value="${x}">`).join(''); }
function gerarAssistenciaRapida(u){ alert("Vá para Assistências!"); }
function gerarFechamentoDiario(){ alert("Relatório diário gerado!"); }

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
