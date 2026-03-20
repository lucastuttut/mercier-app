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

let pedidos=[], fornecedores=[], estoque=[], catalogo=[], tarefas=[], assistencias=[], proximoID=255, notasMelhoria="", cpfValido=true;

// SINCRONIZAÇÃO
db.ref('dados').on('value', (s) => {
    const d = s.val() || {};
    pedidos=d.pedidos||[]; fornecedores=d.fornecedores||[]; estoque=d.estoque||[]; catalogo=d.catalogo||[]; tarefas=d.tarefas||[]; assistencias=d.assistencias||[]; proximoID=d.proximoID||255; notasMelhoria=d.notasMelhoria||"";
    document.getElementById('status-db').innerText="ONLINE";
    document.getElementById('status-db').className="status-online";
    document.getElementById('texto-melhorias').value=notasMelhoria;
    renderAll();
});

function renderAll(){ renderPedidos(); renderTarefas(); renderFornecedores(); renderEstoque(); renderCatalogo(); renderAssistencias(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria}); }

// --- MÁSCARAS E CEP ---
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function copyText(v){ navigator.clipboard.writeText(v.toUpperCase()); alert("Copiado: " + v.toUpperCase()); }
function maskCPF(i){ let v=i.value.replace(/\D/g,""); if(v.length>11)v=v.slice(0,11); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d)/,"$1.$2"); v=v.replace(/(\d{3})(\d{1,2})$/,"$1-$2"); i.value=v; if(v.length===14) verifCPF(i); }
function verifCPF(i){ const ok = validarCPF(i.value); i.style.borderColor = ok ? "#22c55e" : "#ef4444"; cpfValido=ok; }
function validarCPF(c){ c=c.replace(/[^\d]+/g,''); if(c.length!==11||!!c.match(/(\d)\1{10}/))return false; let a=0; for(let i=0;i<9;i++)a+=parseInt(c.charAt(i))*(10-i); let r=11-(a%11); if(r===10||r===11)r=0; if(r!==parseInt(c.charAt(9)))return false; a=0; for(let i=0;i<10;i++)a+=parseInt(c.charAt(i))*(11-i); r=11-(a%11); return (r>=10?0:r)===parseInt(c.charAt(10)); }

async function buscarCEP(i){
    let cep = i.value.replace(/\D/g,"");
    if(cep.length === 8){
        try {
            let res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            let d = await res.json();
            if(!d.erro){
                document.getElementById('t_end').value = d.logradouro.toUpperCase();
                document.getElementById('t_bairro').value = d.bairro.toUpperCase();
                document.getElementById('t_cidade').value = d.localidade.toUpperCase();
                document.getElementById('t_num').focus();
            }
        } catch(e) { console.error("CEP Offline"); }
    }
}

// --- TAREFAS: TIRAR PEDIDO ---
function mostrarCamposTarefa(t){
    const c=document.getElementById('container-campos-tarefa'); c.innerHTML="";
    if(t==='TIRAR PEDIDO'){
        c.innerHTML=`
            <input id="t_nome" placeholder="NOME DO CLIENTE" class="border-2 p-3 rounded-lg text-xs font-bold col-span-2 outline-indigo-500">
            <input id="t_cpf" placeholder="CPF" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500" oninput="maskCPF(this)">
            <input id="t_contato" placeholder="CONTATO" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500">
            <input id="t_cep" placeholder="CEP" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500" oninput="buscarCEP(this)">
            <input id="t_end" placeholder="RUA" class="border-2 p-3 rounded-lg text-xs font-bold col-span-2 outline-indigo-500">
            <input id="t_bairro" placeholder="BAIRRO" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500">
            <input id="t_cidade" placeholder="CIDADE" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500">
            <input id="t_num" placeholder="NÚMERO" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500">
            <input id="t_torre" placeholder="TORRE/APTO" class="border-2 p-3 rounded-lg text-xs font-bold outline-indigo-500">
            <div class="col-span-4 border-t mt-4 pt-4">
                <div class="flex justify-between items-center mb-4"><h4 class="text-xs font-black uppercase">🛒 Móveis do Pedido</h4></div>
                <div id="lista-produtos-tarefa"></div>
                <button onclick="addProdutoLinha()" class="text-[10px] font-black text-blue-600 uppercase mt-2 bg-blue-50 px-4 py-2 rounded-lg">+ Novo Móvel</button>
                <div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-lg mt-2 uppercase">Total: R$ 0,00</div>
            </div>
            <div class="col-span-4 border-t mt-4 pt-4">
                <div class="flex justify-between items-center mb-4"><h4 class="text-xs font-black uppercase">💳 Pagamento</h4></div>
                <div id="lista-pagamentos-tarefa"></div>
                <button onclick="addPagamentoLinha()" class="text-[10px] font-black text-emerald-600 uppercase mt-2 bg-emerald-50 px-4 py-2 rounded-lg">+ Nova Forma de Pagto</button>
            </div>
            <textarea id="t_obs" placeholder="OBSERVAÇÕES DO PEDIDO" class="col-span-4 border-2 p-3 rounded-xl text-xs font-bold h-24 uppercase outline-indigo-500"></textarea>
        `;
        addProdutoLinha(); addPagamentoLinha();
    } else {
        c.innerHTML = `<input id="t_raw" placeholder="DESCREVA A TAREFA..." class="border-2 p-4 rounded-xl text-xs font-bold col-span-4 outline-indigo-500">`;
    }
}

function addProdutoLinha(){
    const div = document.getElementById('lista-produtos-tarefa');
    const row = document.createElement('div');
    row.className = "flex gap-2 mb-2 items-center row-prod bg-white p-2 rounded-lg border";
    row.innerHTML = `
        <input class="t-p-nome border-0 p-2 text-xs font-bold flex-1" placeholder="NOME DO MÓVEL (EX: SOFÁ)">
        <input class="t-v-orig border-2 border-slate-100 p-2 rounded-lg text-xs font-bold w-32" placeholder="ORIGINAL" oninput="maskMoney(this)">
        <input class="t-v-desc border-2 border-slate-100 p-2 rounded-lg text-xs font-bold w-32 text-indigo-600" placeholder="DESCONTO" oninput="maskMoney(this)">
        <button onclick="this.parentElement.remove(); calcTotalTirarPedido();" class="text-red-400 font-black px-4 hover:text-red-600">✕</button>
    `;
    div.appendChild(row);
}

function addPagamentoLinha(){
    const div = document.getElementById('lista-pagamentos-tarefa');
    let total = 0; document.querySelectorAll('.t-v-desc').forEach(i => total += parseMoney(i.value));
    let pago = 0; document.querySelectorAll('.t-p-val').forEach(i => pago += parseMoney(i.value));
    let restante = total - pago; if(restante < 0) restante = 0;

    const row = document.createElement('div');
    row.className = "flex flex-col bg-slate-50 p-4 rounded-xl border mb-3 row-pag";
    row.innerHTML = `
        <div class="flex gap-2 mb-3">
            <button onclick="selecionarPagt(this, 'PIX')" class="btn-pag-opt active">PIX</button>
            <button onclick="selecionarPagt(this, 'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button>
            <button onclick="selecionarPagt(this, 'DÉBITO')" class="btn-pag-opt">DÉBITO</button>
            <button onclick="selecionarPagt(this, 'CHEQUE')" class="btn-pag-opt">CHEQUE</button>
            <input type="hidden" class="t-p-tipo" value="PIX">
        </div>
        <div class="flex gap-2">
            <input class="t-p-val border-2 border-slate-200 p-2 rounded-lg text-xs font-bold w-48 text-emerald-600" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${restante.toLocaleString('pt-BR', {minimumFractionDigits:2})}">
            <input class="t-p-obs border-2 border-slate-200 p-2 rounded-lg text-xs font-bold flex-1" placeholder="DATA / DETALHES DO PAGTO">
            <button onclick="this.parentElement.parentElement.remove()" class="text-red-400 font-black px-4">✕</button>
        </div>
    `;
    div.appendChild(row);
}

function selecionarPagt(btn, tipo){
    const container = btn.parentElement;
    container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    container.querySelector('.t-p-tipo').value = tipo;
}

function calcTotalTirarPedido(){
    let total = 0;
    document.querySelectorAll('.t-v-desc').forEach(i => total += parseMoney(i.value));
    document.getElementById('total-pedido-tarefa').innerText = "Total: R$ " + total.toLocaleString('pt-BR', {minimumFractionDigits:2});
}

function cadastrarTarefa(){
    const tipo = document.getElementById('t_tipo').value;
    if(tipo === 'TIRAR PEDIDO' && !cpfValido) return alert("⚠️ CPF INVÁLIDO!");

    let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: tipo, status: "Não Iniciado" };

    if(tipo === 'TIRAR PEDIDO'){
        const cliente = document.getElementById('t_nome').value;
        if(!cliente) return alert("⚠️ NOME DO CLIENTE É OBRIGATÓRIO!");
        
        let total = 0; document.querySelectorAll('.t-v-desc').forEach(i => total += parseMoney(i.value));
        
        obj.descricao = "PEDIDO: " + cliente.toUpperCase();
        obj.detalhes = {
            cliente: cliente.toUpperCase(),
            cpf: document.getElementById('t_cpf').value,
            contato: document.getElementById('t_contato').value,
            cep: document.getElementById('t_cep').value,
            end: document.getElementById('t_end').value,
            bairro: document.getElementById('t_bairro').value,
            cidade: document.getElementById('t_cidade').value,
            num: document.getElementById('t_num').value,
            torre: document.getElementById('t_torre').value,
            obs: document.getElementById('t_obs').value,
            total: "R$ " + total.toLocaleString('pt-BR', {minimumFractionDigits:2}),
            produtos: [],
            pagamentos: []
        };

        document.querySelectorAll('.row-prod').forEach(row => {
            const nome = row.querySelector('.t-p-nome').value;
            if(nome) obj.detalhes.produtos.push({
                nome: nome.toUpperCase(),
                orig: row.querySelector('.t-v-orig').value || 'R$ 0,00',
                desc: row.querySelector('.t-v-desc').value || 'R$ 0,00'
            });
        });

        document.querySelectorAll('.row-pag').forEach(row => {
            obj.detalhes.pagamentos.push({
                tipo: row.querySelector('.t-p-tipo').value,
                valor: row.querySelector('.t-p-val').value,
                obs: row.querySelector('.t-p-obs').value.toUpperCase()
            });
        });
    } else {
        obj.descricao = document.getElementById('t_raw').value.toUpperCase();
    }

    if(!obj.descricao) return alert("⚠️ DESCREVA A TAREFA!");
    
    tarefas.unshift(obj);
    salvarCloud();
    mostrarCamposTarefa(tipo);
    renderTarefas(); // Força a atualização imediata da tabela
    
    // Rola a tela até a lista para o usuário ver o item novo
    document.getElementById('lista-tarefas-ancora').scrollIntoView({ behavior: 'smooth' });
}

function renderTarefas() {
    const f=document.getElementById('filtro-tarefa-status').value;
    let l = f==="TODAS"?tarefas:tarefas.filter(x=>x.status===f);
    document.getElementById('tarefa-count').innerText = l.length + " ITENS";
    document.getElementById('tabelaTarefas').innerHTML=l.map(x=>`
        <tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-indigo-50 cursor-pointer transition-all border-b">
            <td class="text-slate-400 font-bold">${x.data}</td>
            <td class="font-black text-xs uppercase">${x.descricao}</td>
            <td class="text-[10px] font-black text-slate-400">${x.tipo}</td>
            <td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-100">${x.status}</button></td>
            <td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir Tarefa?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-400 hover:text-red-600 font-black">✕</button></td>
        </tr>`).join('');
}

function verDetalhesTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return;
    const modal = document.getElementById('modal-detalhes');
    modal.classList.remove('hidden');
    const c=document.getElementById('detalhe-corpo');
    
    if(!t.detalhes){
        c.innerHTML=`<div class="bg-white p-12 rounded-2xl text-center uppercase font-black border-2 border-dashed text-slate-300">${t.descricao}</div>`;
        return;
    }

    const d = t.detalhes;
    c.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${linhaInfo("CLIENTE", d.cliente)}
            ${linhaInfo("CPF", d.cpf)}
            ${linhaInfo("CONTATO", d.contato)}
            ${linhaInfo("CEP", d.cep)}
            ${linhaInfo("ENDEREÇO", d.end)}
            ${linhaInfo("Nº / TORRE", (d.num + ' ' + (d.torre||'')))}
            ${linhaInfo("BAIRRO", d.bairro)}
            ${linhaInfo("CIDADE", d.cidade)}
        </div>
        <div class="mt-8">
            <h4 class="text-[11px] font-black border-b-2 border-slate-200 pb-2 mb-4 uppercase tracking-tighter">Móveis e Valores</h4>
            ${d.produtos.map(p => `
                <div class="flex justify-between items-center bg-white p-3 rounded-xl mb-2 border shadow-sm">
                    <div class="flex flex-col">
                        <span class="text-xs font-black uppercase">${p.nome}</span>
                        <span class="text-[9px] text-slate-400">VALOR ORIGINAL: ${p.orig}</span>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-xs font-black text-indigo-600">${p.desc}</span>
                        <span class="copy-icon" onclick="copyText('${p.nome} - VALOR: ${p.desc}')">📋</span>
                    </div>
                </div>
            `).join('')}
            <div class="text-right font-black text-indigo-600 text-lg mt-4 px-2">TOTAL: ${d.total}</div>
        </div>
        <div class="mt-8">
            <h4 class="text-[11px] font-black border-b-2 border-slate-200 pb-2 mb-4 uppercase tracking-tighter">Formas de Pagamento</h4>
            ${d.pagamentos.map(p => `
                <div class="flex justify-between items-center bg-white p-3 rounded-xl mb-2 border shadow-sm border-l-4 border-l-emerald-500">
                    <div class="flex flex-col">
                        <span class="text-xs font-black text-emerald-600 uppercase">${p.tipo} - ${p.valor}</span>
                        <span class="text-[9px] text-slate-400">${p.obs || 'PAGAMENTO À VISTA'}</span>
                    </div>
                    <span class="copy-icon" onclick="copyText('${p.tipo}: ${p.valor} (${p.obs})')">📋</span>
                </div>
            `).join('')}
        </div>
        <div class="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold uppercase relative">
            <div class="text-[9px] text-amber-500 mb-2 font-black">OBSERVAÇÕES DO PEDIDO</div>
            <p class="leading-relaxed">${d.obs || "NENHUMA OBSERVAÇÃO ADICIONAL"}</p>
            <button class="absolute top-4 right-4 copy-icon" onclick="copyText('${d.obs}')">📋</button>
        </div>
    `;
}

function linhaInfo(label, valor){
    return `
        <div class="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center hover:border-indigo-300 transition-all">
            <div>
                <div class="text-[8px] text-slate-400 font-black mb-1 uppercase">${label}</div>
                <div class="text-xs font-black uppercase text-slate-700">${valor || '-'}</div>
            </div>
            <button class="copy-icon" onclick="copyText('${valor}')">📋</button>
        </div>
    `;
}

// GERAIS
function switchTab(t){ document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.classList.toggle('hidden'); }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }

// RENDER OUTRAS ABAS
function renderPedidos() { document.getElementById('tabelaPedidos').innerHTML=pedidos.map(x=>`<tr><td><input type="checkbox"></td><td>30D</td><td class="text-xs text-slate-400">${x.idDoc}</td><td class="font-bold">${x.cliente}</td><td>${x.dataPedido}</td><td>${x.qtd}</td><td>${x.produto}</td><td>${x.medida}</td><td>${x.cor}</td><td>${x.custo}</td><td>${x.fornecedor}</td><td>${x.status}</td><td>SIM</td><td>SIM</td><td>...</td></tr>`).join(''); }
function renderEstoque() { document.getElementById('tabelaEstoque').innerHTML=estoque.map(x=>`<tr><td>${x.produto}</td><td>${x.qtd}</td><td>${x.situacao}</td><td>✖</td></tr>`).join(''); }
function renderCatalogo() { document.getElementById('tabelaCatalogo').innerHTML=catalogo.map(x=>`<tr><td>${x.nome}</td><td>✖</td></tr>`).join(''); }
function renderFornecedores() { document.getElementById('tabelaFornecedores').innerHTML=fornecedores.map(x=>`<tr><td>${x.nome}</td><td>${x.email}</td><td>✖</td></tr>`).join(''); }
function renderAssistencias() { document.getElementById('tabelaAssistencias').innerHTML=assistencias.map(x=>`<tr><td>${x.data}</td><td>${x.cliente}</td><td>${x.produto}</td><td>${x.fabrica}</td><td>${x.status}</td><td>✖</td></tr>`).join(''); }
function cadastrarAssistencia(){ alert("Funcionalidade básica mantida"); }

mostrarCamposTarefa('SIMPLES');
