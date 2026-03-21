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

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", notasEstoque="", cestoItensTemporario=[], filtrandoNaoEnviados=false, filtrandoVendidos=false, cpfValido=true;

// --- SINCRONIZAÇÃO ---
db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos=d.pedidos||[]; fornecedores=d.fornecedores||[]; estoque=d.estoque||[]; catalogo=d.catalogo||[]; tarefas=d.tarefas||[]; assistencias=d.assistencias||[]; proximoID=d.proximoID||255; notasMelhoria=d.notasMelhoria||""; notasEstoque=d.notasEstoque||"";
    const statusEl = document.getElementById('status-db');
    if(statusEl) { statusEl.innerText="ONLINE"; statusEl.className="status-online"; }
    if(document.getElementById('texto-melhorias')) document.getElementById('texto-melhorias').value=notasMelhoria;
    if(document.getElementById('estoque-notas-gerais')) document.getElementById('estoque-notas-gerais').value=notasEstoque;
    atualizarSelectsFornecedores(); atualizarSugestoes(); renderAll();
});

function renderAll(){ renderPedidos(); renderTarefas(); renderFornecedores(); renderEstoque(); renderCatalogo(); renderAssistencias(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria, notasEstoque}); }

// --- MODAL ---
function fecharModal() { document.getElementById('modal-detalhes').style.display='none'; }

// --- EDICAO INLINE ---
function activeInlineEdit(element, uid, field, listType) {
    const originalValue = element.innerText;
    const input = document.createElement('input');
    input.value = (originalValue === "-" ? "" : originalValue);
    input.className = "w-full p-2 text-xs font-bold border-2 border-blue-500 rounded-xl bg-white shadow-lg outline-none uppercase";
    if(field === 'custo') input.oninput = () => { let v = input.value.replace(/\D/g,""); v = (v/100).toFixed(2).replace(".",","); v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); input.value = "R$ " + v; };
    element.innerHTML = ''; element.appendChild(input); input.focus();
    const save = () => {
        let newValue = input.value.toUpperCase().trim();
        if (newValue === "") newValue = "-";
        const list = listType === 'estoque' ? estoque : pedidos;
        const item = list.find(x => x.uid == uid);
        if (item) { item[field] = (field === 'qtd') ? (parseInt(newValue) || 1) : newValue; salvarCloud(); } 
        else { element.innerText = originalValue; }
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
function copyText(v, el){ if(!v || v==="-") return; navigator.clipboard.writeText(v.toUpperCase()); if(el) { const old = el.innerText; el.innerText="OK!"; setTimeout(()=>el.innerText=old, 1000); } }
async function buscarCEP(i){ let cep=i.value.replace(/\D/g,""); if(cep.length===8){ document.getElementById('loading-cep').classList.remove('hidden'); try{ let r=await fetch(`https://viacep.com.br/ws/${cep}/json/`); let d=await r.json(); if(!d.erro){ document.getElementById('t_end').value=d.logradouro.toUpperCase(); document.getElementById('t_bairro').value=d.bairro.toUpperCase(); document.getElementById('t_cidade').value=d.localidade.toUpperCase(); document.getElementById('t_num').focus(); } }catch(e){} finally { document.getElementById('loading-cep').classList.add('hidden'); }}}

// --- PEDIDOS ---
function renderPedidos() {
    const tb=document.getElementById('tabelaPedidos'); if(!tb) return;
    const b=document.getElementById('busca').value.toLowerCase();
    let lista=pedidos.filter(x=>(x.cliente||"").toLowerCase().includes(b)||(x.produto||"").toLowerCase().includes(b)||(x.idDoc||"").toLowerCase().includes(b)||(x.fornecedor||"").toLowerCase().includes(b));
    if(filtrandoNaoEnviados) lista=lista.filter(x=>x.status==="Não enviado");
    document.getElementById('contador').innerText=lista.length+" PEDIDOS";
    tb.innerHTML = lista.map(x=>{
        const p=calcP(x.dataPedido, x.prazo); let sCls = x.status==="Não enviado" ? "bg-red-600" : (x.status.includes("loja") ? "bg-green-700" : "bg-blue-600");
        return `<tr class="${p.classe}">
            <td class="pl-6"><input type="checkbox" class="ped-check" value="${x.uid}"></td>
            <td><div class="flex flex-col gap-1 items-center"><span class="font-black text-[9px]">${p.dias}D</span><select onchange="updPed(${x.uid},'prazo',this.value)" class="select-prazo-tabela"><option value="15" ${x.prazo=='15'?'selected':''}>15C</option><option value="20" ${x.prazo=='20'?'selected':''}>20C</option><option value="30" ${x.prazo=='30'?'selected':''}>30C</option><option value="30-util" ${x.prazo=='30-util'?'selected':''}>30U</option><option value="40-util" ${x.prazo=='40-util'?'selected':''}>40U</option></select></div></td>
            <td class="text-[10px] text-slate-400 font-black">${x.idDoc}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cliente', 'pedidos')" class="editable-cell uppercase">${x.cliente}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'dataPedido', 'pedidos')" class="editable-cell text-[10px]">${x.dataPedido}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'pedidos')" class="editable-cell text-center font-black">${x.qtd}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'pedidos')" class="editable-cell uppercase">${x.produto}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'medida', 'pedidos')" class="editable-cell uppercase">${x.medida}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'cor', 'pedidos')" class="editable-cell uppercase">${x.cor}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'custo', 'pedidos')" class="editable-cell font-bold text-blue-600">${x.custo}</td>
            <td onclick="activeInlineEdit(this, ${x.uid}, 'fornecedor', 'pedidos')" class="editable-cell font-black text-blue-800 uppercase text-[10px]">${x.fornecedor}</td>
            <td><button onclick="cycleStatus(${x.uid})" class="status-badge ${sCls} text-white font-black">${x.status}</button></td>
            <td><button onclick="togPed(${x.uid},'whatsEnviado')" class="status-badge ${x.whatsEnviado?'btn-sim':'btn-nao'}">${x.whatsEnviado?'SIM':'NÃO'}</button></td>
            <td><button onclick="togPed(${x.uid},'confirmado')" class="status-badge ${x.confirmado?'btn-sim':'btn-nao'}">${x.confirmado?'SIM':'NÃO'}</button></td>
            <td class="text-center flex gap-2 justify-center py-4 pr-6">
                <button onclick="verResumoCompleto(${x.uid})" title="Ver Resumo" class="hover:scale-125 transition">📄</button>
                <button onclick="dupPed(${x.uid})" title="Duplicar" class="hover:scale-125 transition">➕</button>
                <button onclick="gerarAssistenciaRapida(${x.uid})" title="Assistência" class="hover:scale-125 transition">🛠️</button>
                <button onclick="excluirPedido(${x.uid})" class="text-red-500 font-black hover:scale-125 transition">✕</button>
            </td></tr>`;
    }).join('');
}

function verResumoCompleto(uid) {
    const p = pedidos.find(x => x.uid == uid);
    if(!p) return;
    document.getElementById('modal-detalhes').style.display='flex';
    document.getElementById('modal-ref-id').innerText = `Referência: ${p.idDoc} | Data: ${p.dataPedido}`;
    const corpo = document.getElementById('detalhe-corpo');
    
    // Calcula prazo final
    const prazoInfo = calcP(p.dataPedido, p.prazo);

    corpo.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
                <span class="modal-section-title">Dados do Cliente</span>
                <div class="info-card"><div class="flex flex-col"><label>Cliente</label><span>${p.cliente}</span></div><button class="copy-btn-modal" onclick="copyText('${p.cliente}', this)">COPIAR</button></div>
                <div class="info-card"><div class="flex flex-col"><label>Fábrica Fornecedora</label><span>${p.fornecedor}</span></div><button class="copy-btn-modal" onclick="copyText('${p.fornecedor}', this)">COPIAR</button></div>
            </div>
            <div class="space-y-4">
                <span class="modal-section-title">Logística e Prazos</span>
                <div class="info-card"><div class="flex flex-col"><label>Status Atual</label><span>${p.status}</span></div></div>
                <div class="info-card"><div class="flex flex-col"><label>Prazo Restante</label><span>${prazoInfo.dias} Dias</span></div></div>
            </div>
        </div>
        
        <div class="mt-8">
            <span class="modal-section-title">Detalhes do Móvel</span>
            <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative group">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="flex flex-col"><label class="label-mini text-blue-400">Produto</label><span class="font-black text-blue-900">${p.produto}</span></div>
                    <div class="flex flex-col"><label class="label-mini text-blue-400">Qtd</label><span class="font-black text-blue-900">${p.qtd} UN</span></div>
                    <div class="flex flex-col"><label class="label-mini text-blue-400">Medida</label><span class="font-black text-blue-900">${p.medida}</span></div>
                    <div class="flex flex-col"><label class="label-mini text-blue-400">Cor/Tecido</label><span class="font-black text-blue-900">${p.cor}</span></div>
                </div>
                <button class="absolute top-4 right-4 copy-btn-modal opacity-0 group-hover:opacity-100 transition-all" onclick="copyText('${p.qtd}x ${p.produto} - ${p.cor} - ${p.medida}', this)">COPIAR TUDO</button>
            </div>
        </div>

        <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
             <div class="bg-slate-900 text-white p-4 rounded-2xl flex flex-col items-center">
                <label class="text-blue-400 text-[8px] font-black uppercase mb-1">Custo Total</label>
                <span class="text-lg font-black">${p.custo}</span>
             </div>
             <div class="bg-emerald-600 text-white p-4 rounded-2xl flex flex-col items-center">
                <label class="text-emerald-200 text-[8px] font-black uppercase mb-1">Confirmação</label>
                <span class="text-sm font-black">${p.confirmado ? 'CONFIRMADO' : 'PENDENTE'}</span>
             </div>
             <div class="bg-indigo-600 text-white p-4 rounded-2xl flex flex-col items-center">
                <label class="text-indigo-200 text-[8px] font-black uppercase mb-1">WhatsApp</label>
                <span class="text-sm font-black">${p.whatsEnviado ? 'ENVIADO' : 'NÃO ENVIADO'}</span>
             </div>
        </div>
    `;
}

// --- TAREFAS ---
function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`<input id="t_nome" placeholder="NOME DO CLIENTE" class="input-modern col-span-2"><input id="t_cpf" placeholder="CPF" class="input-modern" oninput="maskCPF(this)"><input id="t_contato" placeholder="CONTATO" class="input-modern"><input id="t_cep" placeholder="CEP" class="input-modern" oninput="buscarCEP(this)"><input id="t_end" placeholder="RUA" class="input-modern col-span-2"><input id="t_bairro" placeholder="BAIRRO" class="input-modern"><input id="t_cidade" placeholder="CIDADE" class="input-modern"><input id="t_num" placeholder="NÚMERO" class="input-modern"><input id="t_torre" placeholder="TORRE / APTO" class="input-modern"><div class="col-span-4 border-t mt-4 pt-4"><div id="lista-produtos-tarefa"></div><button onclick="addProdutoLinha()" class="text-xs font-black text-blue-600 uppercase mt-2 hover:underline">+ Adicionar Móvel</button><div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-lg mt-2 uppercase italic">Total: R$ 0,00</div></div><div class="col-span-4 border-t mt-4 pt-4"><div id="lista-pagamentos-tarefa"></div><button onclick="addPagamentoLinha()" class="text-xs font-black text-emerald-600 uppercase mt-2 hover:underline">+ Adicionar Pagamento</button></div><textarea id="t_obs" placeholder="OBSERVAÇÕES DO CONTRATO" class="col-span-4 input-modern !h-24 uppercase"></textarea>`;
        addProdutoLinha(); addPagamentoLinha();
    } else { c.innerHTML = `<input id="t_raw" placeholder="DESCREVA A TAREFA AQUI..." class="input-modern col-span-4 text-lg">`; }
}
function addProdutoLinha(){ const d = document.getElementById('lista-produtos-tarefa'); const r = document.createElement('div'); r.className = "flex gap-4 mb-3 items-center row-prod bg-slate-50 p-4 rounded-2xl border border-dashed"; r.innerHTML = `<input class="t-p-nome input-modern flex-1" placeholder="MÓVEL"><input class="t-v-orig input-modern w-40" placeholder="VALOR ORIGINAL" oninput="maskMoney(this)"><input class="t-v-desc input-modern w-40 text-indigo-600" placeholder="VALOR FINAL" oninput="maskMoney(this)"><button onclick="this.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black text-xl px-2">✕</button>`; d.appendChild(r); }
function addPagamentoLinha(){
    const d=document.getElementById('lista-pagamentos-tarefa'); let total=0; document.querySelectorAll('.t-v-desc').forEach(i=>total+=parseMoney(i.value)); let pago=0; document.querySelectorAll('.t-p-val').forEach(i=>pago+=parseMoney(i.value)); let saldo=total-pago; if(saldo<0) saldo=0;
    const r=document.createElement('div'); r.className="flex flex-col bg-slate-50 p-4 rounded-2xl border mb-4 row-pag shadow-inner";
    r.innerHTML=`<div class="flex gap-2 mb-3 flex-wrap"><button onclick="setP(this,'PIX')" class="btn-pag-opt active">PIX</button><button onclick="setP(this,'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button><button onclick="setP(this,'DÉBITO')" class="btn-pag-opt">DÉBITO</button><button onclick="setP(this,'CHEQUE')" class="btn-pag-opt">CHEQUE</button><input type="hidden" class="t-p-tipo" value="PIX"><select class="t-p-parc hidden input-modern !w-24 !p-1">${[...Array(12).keys()].map(n => `<option value="${n+1}x">${n+1}x</option>`).join('')}</select></div><div class="flex gap-4"><input class="t-p-val input-modern w-48 text-emerald-600" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${saldo.toLocaleString('pt-BR',{minimumFractionDigits:2})}"><input class="t-p-obs input-modern flex-1" placeholder="OBS / DATA"><button onclick="this.parentElement.parentElement.remove()" class="text-red-500 font-black text-xl px-2">✕</button></div>`;
    d.appendChild(r);
}
function setP(b,v){ const p = b.parentElement; p.querySelectorAll('button').forEach(x=>x.classList.remove('active')); b.classList.add('active'); p.querySelector('.t-p-tipo').value=v; const s = p.querySelector('.t-p-parc'); if(v === 'CRÉDITO') s.classList.remove('hidden'); else s.classList.add('hidden'); }
function calcTotalTirarPedido(){ let t=0; document.querySelectorAll('.t-v-desc').forEach(i=>t+=parseMoney(i.value)); document.getElementById('total-pedido-tarefa').innerText="Total Final: R$ "+t.toLocaleString('pt-BR',{minimumFractionDigits:2}); }

function cadastrarTarefa(){
    const t = document.getElementById('t_tipo').value; let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: t, status: "Não Iniciado" };
    if(t === 'TIRAR PEDIDO'){ const cli = document.getElementById('t_nome').value; if(!cli) return alert("NOME OBRIGATÓRIO!"); let total=0; document.querySelectorAll('.t-v-desc').forEach(i=>total+=parseMoney(i.value)); obj.descricao = "VENDA: " + cli.toUpperCase(); obj.detalhes = { cliente: cli.toUpperCase(), cpf: document.getElementById('t_cpf').value, contato: document.getElementById('t_contato').value, cep: document.getElementById('t_cep').value, end: document.getElementById('t_end').value, bairro: document.getElementById('t_bairro').value, cidade: document.getElementById('t_cidade').value, num: document.getElementById('t_num').value, torre: document.getElementById('t_torre').value, obs: document.getElementById('t_obs').value, totalDesc:"R$ "+total.toLocaleString('pt-BR',{minimumFractionDigits:2}), produtos: [], pagamentos: [] }; document.querySelectorAll('.row-prod').forEach(row => { if(row.querySelector('.t-p-nome').value) obj.detalhes.produtos.push({ n: row.querySelector('.t-p-nome').value.toUpperCase(), o: row.querySelector('.t-v-orig').value, d: row.querySelector('.t-v-desc').value }); }); document.querySelectorAll('.row-pag').forEach(row => { const tipo = row.querySelector('.t-p-tipo').value; const parcelas = (tipo === 'CRÉDITO') ? row.querySelector('.t-p-parc').value : ""; obj.detalhes.pagamentos.push({ t: tipo + (parcelas ? " " + parcelas : ""), v: row.querySelector('.t-p-val').value, o: row.querySelector('.t-p-obs').value.toUpperCase() }); }); }
    else { obj.descricao = (document.getElementById('t_raw')?.value || "").toUpperCase(); }
    if(!obj.descricao) return; tarefas.unshift(obj); salvarCloud(); mostrarCamposTarefa(t); renderTarefas();
}

function renderTarefas() { const tb=document.getElementById('tabelaTarefas'); if(!tb) return; const f=document.getElementById('filtro-tarefa-status').value; let lista=f==='TODAS'?tarefas:tarefas.filter(x=>x.status===f); tb.innerHTML=lista.map(x=>`<tr onclick="verVisualizacaoTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer border-b transition"><td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[10px] uppercase font-bold text-slate-400">${x.tipo}</td><td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${x.status}</button></td><td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-400 hover:text-red-600 font-black text-lg">✕</button></td></tr>`).join(''); }

function verVisualizacaoTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return; document.getElementById('modal-detalhes').style.display='flex'; document.getElementById('modal-ref-id').innerText = `DATA: ${t.data} | CATEGORIA: ${t.tipo}`; const c=document.getElementById('detalhe-corpo');
    if(!t.detalhes){ c.innerHTML=`<div class="font-black text-center py-10 uppercase text-slate-400 border-2 border-dashed rounded-3xl">${t.descricao}</div>`; return; }
    const d = t.detalhes;
    let h = `<div class="grid grid-cols-2 gap-4">${l_i("CLIENTE", d.cliente)}${l_i("CPF", d.cpf)}${l_i("CONTATO", d.contato)}${l_i("ENDEREÇO", d.end)}</div><div class="mt-6"><h4 class="modal-section-title">Móveis Vendidos</h4>`;
    d.produtos.forEach(p => h += `<div class="info-card mb-2"><span>${p.n}</span><div class="flex items-center gap-4"><span class="text-indigo-600">${p.d}</span><button class="copy-btn-modal" onclick="copyText('${p.n} - ${p.d}', this)">COPIAR</button></div></div>`);
    h += `<div class="text-right font-black text-indigo-700 text-lg mt-2 px-2 uppercase">Venda Total: ${d.totalDesc}</div><div class="mt-6"><h4 class="modal-section-title">Plano de Pagamento</h4>`;
    d.pagamentos.forEach(p => h += `<div class="info-card mb-2 border-l-4 border-l-emerald-500"><span>${p.t} - ${p.v}</span><span class="text-[10px] text-slate-400">${p.o}</span><button class="copy-btn-modal" onclick="copyText('${p.t}: ${p.v}', this)">COPIAR</button></div>`);
    h += `</div><div class="mt-6 p-6 bg-slate-900 text-white rounded-3xl text-xs font-bold relative uppercase"><label class="text-blue-400 text-[8px] mb-2 block">Observações do Contrato</label><p class="leading-relaxed opacity-90">${d.obs || "NENHUMA OBSERVAÇÃO"}</p><button class="absolute top-4 right-4 copy-btn-modal !bg-white/10 !text-white" onclick="copyText('${d.obs}', this)">COPIAR</button></div>`;
    c.innerHTML = h;
}
function l_i(l, v){ return `<div class="info-card group"><div class="flex flex-col"><label>${l}</label><span>${v || '-'}</span></div><button class="copy-btn-modal opacity-0 group-hover:opacity-100 transition-all" onclick="copyText('${v}', this)">COPIAR</button></div>`; }

// --- OUTRAS ABAS ---
function renderEstoque() {
    const tb = document.getElementById('tabelaEstoque'); if(!tb) return;
    const b = document.getElementById('estoque-busca').value.toLowerCase();
    const fFab = document.getElementById('estoque-filtro-fabrica').value, fSit = document.getElementById('estoque-filtro-situacao').value;
    let totEst = 0, totVen = 0;
    let lista = estoque.filter(x => {
        const prod = (x.produto||"").toLowerCase(), fab = (x.fabrica||"").toLowerCase(), sit = x.situacao||"ESTOQUE";
        if(sit === 'ESTOQUE') totEst += parseInt(x.qtd || 0); if(sit === 'VENDIDO') totVen += parseInt(x.qtd || 0);
        const matBusca = prod.includes(b) || fab.includes(b), matFab = fFab === "TODAS" || x.fabrica === fFab, matSit = fSit === "TODAS" || sit === fSit;
        return matBusca && matFab && matSit && (!filtrandoVendidos || sit === 'VENDIDO');
    });
    document.getElementById('resumo-estoque-total').innerText = totEst;
    document.getElementById('resumo-estoque-vendidos').innerText = totVen;
    tb.innerHTML = lista.map(x => `<tr><td class="text-[10px] text-slate-400 font-bold">${x.data || '-'}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'produto', 'estoque')" class="editable-cell font-bold uppercase">${x.produto}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'fabrica', 'estoque')" class="editable-cell text-blue-600 text-[10px] font-black uppercase">${x.fabrica || "-"}</td><td onclick="activeInlineEdit(this, ${x.uid}, 'qtd', 'estoque')" class="editable-cell text-center">${x.qtd}</td><td><span class="px-2 py-1 rounded text-[9px] font-black ${x.situacao === 'VENDIDO' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${x.situacao}</span></td><td class="text-center flex gap-3 justify-center">${x.situacao === 'ESTOQUE' ? `<button onclick="darBaixaEstoque(${x.uid})" class="hover:scale-125 transition">📉</button>` : ''}<button onclick="if(confirm('EXCLUIR?')){estoque=estoque.filter(y=>y.uid!=${x.uid}); salvarCloud();}" class="text-red-400 hover:text-red-600 font-black">✕</button></td></tr>`).join('');
}
function darBaixaEstoque(u) { const it = estoque.find(x => x.uid == u); if (!it) return; let qS = prompt(`SAÍDA DE "${it.produto}". QUANTAS UNIDADES?`, "1"); if (!qS) return; qS = parseInt(qS); if (isNaN(qS) || qS <= 0 || qS > it.qtd) return alert("QTD INVÁLIDA!"); if (qS == it.qtd) { it.situacao = "VENDIDO"; it.data = new Date().toLocaleDateString('pt-BR'); } else { it.qtd -= qS; estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: it.produto, fabrica: it.fabrica, qtd: qS, situacao: "VENDIDO" }); } salvarCloud(); }
function cadastrarEstoque() { const p = document.getElementById('e_produto').value.toUpperCase().trim(), f = document.getElementById('e_fabrica_select').value, q = document.getElementById('e_qtd').value, s = document.getElementById('e_situacao').value; if (p) { estoque.unshift({ uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), produto: p, fabrica: f, qtd: parseInt(q), situacao: s }); salvarCloud(); document.getElementById('e_produto').value = ""; } }
function toggleFiltroVendidos(){ filtrandoVendidos=!filtrandoVendidos; document.getElementById('btnFiltroVendidos').classList.toggle('bg-red-600'); document.getElementById('btnFiltroVendidos').classList.toggle('text-white'); renderEstoque(); }
function autoSalvarNotasEstoque() { notasEstoque = document.getElementById('estoque-notas-gerais').value; salvarCloud(); }

function renderFornecedores() { const tb = document.getElementById('tabelaFornecedores'); if(!tb) return; tb.innerHTML = fornecedores.map((f, i) => `<tr><td class="font-bold uppercase">${f.nome}</td><td class="lowercase text-blue-600 font-medium">${f.email}</td><td class="text-center"><button onclick="fornecedores.splice(${i},1); salvarCloud();" class="text-red-400 hover:text-red-600 font-black text-xl">✕</button></td></tr>`).join(''); }
function cadastrarFornecedor(){ const n=document.getElementById('f_nome').value.toUpperCase().trim(), e=document.getElementById('f_email').value.toLowerCase().trim(); if(n&&e){fornecedores.push({nome:n,email:e}); salvarCloud(); document.getElementById('f_nome').value=""; document.getElementById('f_email').value="";}}
function renderCatalogo() { const tb=document.getElementById('tabelaCatalogo'); if(!tb) return; tb.innerHTML=catalogo.map((c,i)=>`<tr><td class="uppercase font-bold">${c.nome}</td><td class="text-center"><button onclick="catalogo.splice(${i},1); salvarCloud();" class="text-red-400 hover:text-red-600 font-black text-xl">✕</button></td></tr>`).join(''); }
function cadastrarCatalogo(){ const n=document.getElementById('cat_nome').value.toUpperCase(); if(n){catalogo.push({nome:n}); salvarCloud(); document.getElementById('cat_nome').value="";}}
function renderAssistencias() { const tb=document.getElementById('tabelaAssistencias'); if(!tb) return; tb.innerHTML=assistencias.map(x=>`<tr><td>${x.data}</td><td class="uppercase font-bold">${x.cliente}</td><td class="uppercase text-slate-500 font-medium">${x.produto}</td><td class="font-black text-orange-600 uppercase text-[10px]">${x.fabrica}</td><td><button onclick="cycleAssisStatus(${x.uid})" class="status-badge bg-slate-100">${x.status}</button></td><td><button onclick="assistencias=assistencias.filter(y=>y.uid!=${x.uid}); salvarCloud();" class="text-red-400 font-black text-xl">✕</button></td></tr>`).join(''); }
function cadastrarAssistencia(){ const c=document.getElementById('as_cliente').value.toUpperCase(), p=document.getElementById('as_produto').value.toUpperCase(), f=document.getElementById('as_fabrica').value; if(c&&p){ assistencias.unshift({uid:Date.now(), data:new Date().toLocaleDateString('pt-BR'), cliente:c, produto:p, fabrica:f, status:"Aguardando"}); salvarCloud(); document.getElementById('as_cliente').value=""; document.getElementById('as_produto').value=""; } }

// --- GERAIS ---
function switchTab(t){ window.scrollTo(0,0); document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleStatus(u){ const x=pedidos.find(y=>y.uid==u); const s=["Não enviado","Pedido enviado","Aguardando fábrica","Pedido na loja"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function cycleAssisStatus(u){ const x=assistencias.find(y=>y.uid==u); const s=["Aguardando","Peça Solicitada","Concluído"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }
function marcarTodos(v){ document.querySelectorAll('.ped-check').forEach(c=>c.checked=v); }
function toggleFiltroNaoEnviado(){ filtrandoNaoEnviados=!filtrandoNaoEnviados; document.getElementById('btnFiltroNaoEnviado').classList.toggle('bg-red-600'); document.getElementById('btnFiltroNaoEnviado').classList.toggle('text-white'); renderPedidos(); }
function updPed(u,c,v){ pedidos.find(x=>x.uid==u)[c]=v; salvarCloud(); }
function togPed(u,c){ const x=pedidos.find(y=>y.uid==u); if(x) x[c]=!x[c]; salvarCloud(); }
function excluirPedido(u){ if(confirm("EXCLUIR?")){ pedidos=pedidos.filter(x=>x.uid!=u); salvarCloud(); } }
function calcP(d, pr){ if(!d)return{dias:0,classe:""}; try { const pA=d.split("/"); const dt=new Date(pA[2], pA[1]-1, pA[0]); let dF=new Date(dt); if(pr.includes("util")){ let c=0; while(c<parseInt(pr)){dF.setDate(dF.getDate()+1); if(dF.getDay()!==0&&dF.getDay()!==6)c++;} } else {dF.setDate(dF.getDate()+parseInt(pr||30));} const df=Math.ceil((dF-new Date())/86400000); let c=df<0?"prazo-vencido":(df<=5?"prazo-urgente":(df<=10?"prazo-alerta":(df<=20?"prazo-atencao":""))); return {dias:df,classe:c}; } catch(e){return {dias:0,classe:""}} }
function atualizarSelectsFornecedores(){ 
    const h = fornecedores.map(f => `<option value="${f.nome}">${f.nome}</option>`).join(''); 
    if(document.getElementById('m_fornecedor_select')) document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>"; 
    if(document.getElementById('as_fabrica')) document.getElementById('as_fabrica').innerHTML = h || "<option>...</option>";
    if(document.getElementById('e_fabrica_select')) document.getElementById('e_fabrica_select').innerHTML = h || "<option>...</option>";
    if(document.getElementById('estoque-filtro-fabrica')) document.getElementById('estoque-filtro-fabrica').innerHTML = '<option value="TODAS">TODAS AS FÁBRICAS</option>' + h;
}
function atualizarSugestoes(){ 
    const n=[...new Set(pedidos.map(p=>p.cliente))].sort(); if(document.getElementById('listaSugestaoClientes')) document.getElementById('listaSugestaoClientes').innerHTML=n.map(x=>`<option value="${x}">`).join(''); 
}
function dupPed(u){ const x=pedidos.find(y=>y.uid==u); const idDoc="ID#"+proximoID.toString().padStart(4,'0'); proximoID++; pedidos.unshift({...x, uid:Date.now()+Math.random(), idDoc}); salvarCloud(); }
function gerarAssistenciaRapida(u){ const p=pedidos.find(x=>x.uid==u); if(p){ document.getElementById('as_cliente').value=p.cliente; document.getElementById('as_produto').value=p.produto+" (DEFEITO)"; document.getElementById('as_fabrica').value=p.fornecedor; switchTab('assistencia'); }}

function gerarEmailLote() {
    const checks = document.querySelectorAll('.ped-check:checked'); if (checks.length === 0) return alert("SELECIONE PEDIDOS!");
    const selecionados = Array.from(checks).map(c => pedidos.find(p => p.uid == c.value)).filter(p => p);
    const grupos = {}; selecionados.forEach(p => { if (!grupos[p.fornecedor]) grupos[p.fornecedor] = []; grupos[p.fornecedor].push(p); });
    for (const fab in grupos) {
        const fornecedorData = fornecedores.find(f => f.nome === fab);
        const email = fornecedorData ? fornecedorData.email : "";
        let corpo = `Olá, segue pedido para fábrica ${fab}:%0D%0A%0D%0A`;
        grupos[fab].forEach((p, idx) => {
            const qtdFormatada = String(p.qtd).padStart(2, '0');
            corpo += `Qtde: ${qtdFormatada} - ${p.produto}%0D%0A${p.medida && p.medida !== "-" ? `MEDIDA: ${p.medida}%0D%0A` : ""}COR/TECIDO: ${p.cor}%0D%0AREF: ${p.idDoc}%0D%0A${idx < grupos[fab].length - 1 ? `%0D%0A--------------------------%0D%0A` : ""}`;
        });
        corpo += `%0D%0AForma de pagamento: 30/60/90.%0D%0A%0D%0AIDs para controle interno, favor desconsiderar.%0D%0A%0D%0AFavor confirmar o recebimento e nos enviar o documento de confirmação dos itens acima para conferência.%0D%0A%0D%0AAtenciosamente,%0D%0ALucas Mercier.`;
        window.open(`mailto:${email}?subject=${encodeURIComponent('PEDIDO - MERCIER DESIGN - '+fab)}&body=${corpo}`);
    }
}
mostrarCamposTarefa('SIMPLES');
