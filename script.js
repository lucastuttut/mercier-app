// CONFIGURAÇÃO FIREBASE (Mantenha sua configuração aqui)
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
});

function renderAll(){ renderPedidos(); renderTarefas(); }
function salvarCloud(){ db.ref('dados').set({pedidos, fornecedores, estoque, catalogo, tarefas, assistencias, proximoID, notasMelhoria}); }

// --- MÁSCARAS E ÚTEIS ---
function maskMoney(i){ let v=i.value.replace(/\D/g,""); v=(v/100).toFixed(2).replace(".",","); v=v.replace(/(\d)(?=(\d{3})+(?!\d))/g,"$1."); i.value="R$ "+v; if(i.classList.contains('t-v-desc')) calcTotalTirarPedido(); }
function parseMoney(v){ return parseFloat((v||"").replace("R$ ","").replace(/\./g,"").replace(",",".")) || 0; }
function copyText(v){ navigator.clipboard.writeText(v.toUpperCase()); alert("Copiado!"); }
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
            }
        } catch(e) { console.error("Erro CEP"); }
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
            <input id="t_end" placeholder="ENDEREÇO (RUA)" class="border-2 p-2 rounded-lg text-xs font-bold col-span-2">
            <input id="t_bairro" placeholder="BAIRRO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_cidade" placeholder="CIDADE" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_num" placeholder="NÚMERO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <input id="t_torre" placeholder="TORRE/APTO" class="border-2 p-2 rounded-lg text-xs font-bold">
            <div class="col-span-4 border-t mt-2 pt-2"><h4 class="text-[10px] font-black mb-2 uppercase">Produtos</h4><div id="lista-produtos-tarefa"></div>
                <button onclick="addProdutoLinha()" class="text-[9px] font-black text-blue-600 uppercase mt-2">+ Adicionar Móvel</button>
                <div id="total-pedido-tarefa" class="text-right text-indigo-600 font-black text-sm mt-2 uppercase">Total: R$ 0,00</div>
            </div>
            <div class="col-span-4 border-t mt-2 pt-2"><h4 class="text-[10px] font-black mb-2 uppercase">Pagamento</h4><div id="lista-pagamentos-tarefa"></div>
                <button onclick="addPagamentoLinha()" class="text-[9px] font-black text-blue-600 uppercase mt-2">+ Adicionar Forma de Pagto</button>
            </div>
            <textarea id="t_obs" placeholder="OBSERVAÇÕES ADICIONAIS" class="col-span-4 border-2 p-2 rounded text-xs font-bold h-16 uppercase"></textarea>
        `;
        addProdutoLinha(); addPagamentoLinha();
    } else {
        c.innerHTML = `<input id="t_raw" placeholder="DESCREVA A TAREFA..." class="border-2 p-3 rounded-xl text-xs font-bold col-span-4">`;
    }
}

function addProdutoLinha(){
    const div = document.getElementById('lista-produtos-tarefa');
    const row = document.createElement('div');
    row.className = "flex gap-2 mb-2 items-center row-prod";
    row.innerHTML = `
        <input class="t-p-nome border-2 p-2 rounded text-xs font-bold flex-1" placeholder="NOME DO MÓVEL">
        <input class="t-v-orig border-2 p-2 rounded text-xs font-bold w-32" placeholder="VALOR ORIGINAL" oninput="maskMoney(this)">
        <input class="t-v-desc border-2 p-2 rounded text-xs font-bold w-32" placeholder="VALOR FINAL" oninput="maskMoney(this)">
        <button onclick="this.parentElement.remove(); calcTotalTirarPedido();" class="text-red-500 font-black px-2">✕</button>
    `;
    div.appendChild(row);
}

function addPagamentoLinha(){
    const div = document.getElementById('lista-pagamentos-tarefa');
    // Calcular restante
    let total = 0; document.querySelectorAll('.t-v-desc').forEach(i => total += parseMoney(i.value));
    let pago = 0; document.querySelectorAll('.t-p-val').forEach(i => pago += parseMoney(i.value));
    let restante = total - pago; if(restante < 0) restante = 0;

    const row = document.createElement('div');
    row.className = "flex flex-col bg-slate-50 p-3 rounded-lg border mb-2 row-pag";
    row.innerHTML = `
        <div class="flex gap-2 mb-2">
            <button onclick="selecionarPagt(this, 'PIX')" class="btn-pag-opt active">PIX</button>
            <button onclick="selecionarPagt(this, 'CRÉDITO')" class="btn-pag-opt">CRÉDITO</button>
            <button onclick="selecionarPagt(this, 'DÉBITO')" class="btn-pag-opt">DÉBITO</button>
            <button onclick="selecionarPagt(this, 'CHEQUE')" class="btn-pag-opt">CHEQUE</button>
            <input type="hidden" class="t-p-tipo" value="PIX">
        </div>
        <div class="flex gap-2">
            <input class="t-p-val border-2 p-2 rounded text-xs font-bold flex-1" placeholder="VALOR" oninput="maskMoney(this)" value="R$ ${restante.toLocaleString('pt-BR', {minimumFractionDigits:2})}">
            <input class="t-p-obs border-2 p-2 rounded text-xs font-bold flex-1" placeholder="DATA / OBS">
            <button onclick="this.parentElement.parentElement.remove()" class="text-red-500 font-black px-2">✕</button>
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
    if(tipo === 'TIRAR PEDIDO' && !cpfValido) return alert("CPF INVÁLIDO!");

    let obj = { uid: Date.now(), data: new Date().toLocaleDateString('pt-BR'), tipo: tipo, status: "Não Iniciado" };

    if(tipo === 'TIRAR PEDIDO'){
        const cliente = document.getElementById('t_nome').value;
        if(!cliente) return alert("Nome do cliente obrigatório!");
        
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
            obj.detalhes.produtos.push({
                nome: row.querySelector('.t-p-nome').value.toUpperCase(),
                orig: row.querySelector('.t-v-orig').value,
                desc: row.querySelector('.t-v-desc').value
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

    if(!obj.descricao) return alert("Preencha os dados!");
    tarefas.unshift(obj);
    salvarCloud();
    mostrarCamposTarefa(tipo);
}

function renderTarefas() {
    const f=document.getElementById('filtro-tarefa-status').value;
    let l = f==="TODAS"?tarefas:tarefas.filter(x=>x.status===f);
    document.getElementById('tabelaTarefas').innerHTML=l.map(x=>`
        <tr onclick="verDetalhesTarefa(${x.uid})" class="hover:bg-slate-50 cursor-pointer">
            <td>${x.data}</td><td class="font-black text-xs uppercase">${x.descricao}</td><td class="text-[10px] font-bold">${x.tipo}</td>
            <td><button onclick="event.stopPropagation(); cycleTarefaStatus(${x.uid})" class="status-badge bg-slate-200">${x.status}</button></td>
            <td class="text-center"><button onclick="event.stopPropagation(); if(confirm('Excluir?')){tarefas=tarefas.filter(y=>y.uid!=${x.uid});salvarCloud();}" class="text-red-500 font-black">✕</button></td>
        </tr>`).join('');
}

function verDetalhesTarefa(uid){
    const t=tarefas.find(x=>x.uid==uid); if(!t) return;
    document.getElementById('modal-detalhes').style.display='flex';
    const c=document.getElementById('detalhe-corpo');
    
    if(!t.detalhes){
        c.innerHTML=`<div class="bg-white p-6 rounded-xl shadow-inner uppercase font-black text-center border-2 border-dashed">${t.descricao}</div>`;
        return;
    }

    const d = t.detalhes;
    let html = `
        <div class="grid grid-cols-2 gap-4 mb-6">
            ${linhaInfo("CLIENTE", d.cliente)}
            ${linhaInfo("CPF", d.cpf)}
            ${linhaInfo("CONTATO", d.contato)}
            ${linhaInfo("CEP", d.cep)}
            ${linhaInfo("ENDEREÇO", d.end)}
            ${linhaInfo("Nº", d.num)}
            ${linhaInfo("BAIRRO", d.bairro)}
            ${linhaInfo("CIDADE", d.cidade)}
            ${linhaInfo("TORRE/APTO", d.torre || '-')}
        </div>
        <div class="mb-6"><h4 class="text-[10px] font-black border-b pb-1 mb-2">PRODUTOS</h4>
            ${d.produtos.map(p => `
                <div class="flex justify-between bg-white p-2 rounded mb-1 border shadow-sm text-xs font-bold">
                    <span>${p.nome}</span>
                    <span class="text-slate-400 italic">De: ${p.orig} Por: <span class="text-indigo-600">${p.desc}</span></span>
                    <span class="copy-icon" onclick="copyText('${p.nome} - ${p.desc}')">📋</span>
                </div>
            `).join('')}
            <div class="text-right font-black text-indigo-600 mt-2">TOTAL PEDIDO: ${d.total}</div>
        </div>
        <div class="mb-6"><h4 class="text-[10px] font-black border-b pb-1 mb-2">PAGAMENTO</h4>
            ${d.pagamentos.map(p => `
                <div class="flex justify-between bg-white p-2 rounded mb-1 border shadow-sm text-xs font-bold">
                    <span>${p.tipo} - <span class="text-emerald-600">${p.valor}</span></span>
                    <span class="text-slate-400">${p.obs}</span>
                    <span class="copy-icon" onclick="copyText('${p.tipo} - ${p.valor}')">📋</span>
                </div>
            `).join('')}
        </div>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-xs font-bold uppercase">
            <div class="text-[9px] text-amber-500 mb-1">OBSERVAÇÕES</div>
            ${d.obs || "NENHUMA OBSERVAÇÃO REGISTRADA"}
            <div class="mt-2 text-right"><span class="copy-icon" onclick="copyText('${d.obs}')">📋</span></div>
        </div>
    `;
    c.innerHTML = html;
}

function linhaInfo(label, valor){
    return `
        <div class="bg-white p-3 rounded-lg border shadow-sm flex justify-between items-center">
            <div>
                <div class="text-[9px] text-slate-400 font-black">${label}</div>
                <div class="text-xs font-bold uppercase">${valor || '-'}</div>
            </div>
            <span class="copy-icon" onclick="copyText('${valor}')">📋</span>
        </div>
    `;
}

// Funções de apoio
function switchTab(t){ document.querySelectorAll('main').forEach(x=>x.classList.add('hidden')); document.getElementById('view-'+t).classList.remove('hidden'); document.querySelectorAll('nav button').forEach(x=>x.classList.remove('tab-active')); document.getElementById('tab-'+t).classList.add('tab-active'); }
function cycleTarefaStatus(u){ const x=tarefas.find(y=>y.uid==u); const s=["Não Iniciado","Em Andamento","Feito"]; x.status=s[(s.indexOf(x.status)+1)%s.length]; salvarCloud(); }
function togglePainelSugestoes(){ const p=document.getElementById('painel-sugestoes'); p.style.display=p.style.display==='flex'?'none':'flex'; }
function autoSalvarNotas(){ notasMelhoria=document.getElementById('texto-melhorias').value; db.ref('dados/notasMelhoria').set(notasMelhoria); }

mostrarCamposTarefa('SIMPLES');
