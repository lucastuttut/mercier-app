// --- LÓGICA DE ESTOQUE ATUALIZADA ---
function renderEstoque() {
    const tb = document.getElementById('tabelaEstoque'); if(!tb) return;
    
    // Captura valores dos filtros
    const busca = document.getElementById('estoque-busca').value.toLowerCase();
    const filtroFabrica = document.getElementById('estoque-filtro-fabrica').value;
    const filtroSituacao = document.getElementById('estoque-filtro-situacao').value;

    let lista = estoque.filter(x => {
        const matchesBusca = (x.produto || "").toLowerCase().includes(busca);
        const matchesFabrica = filtroFabrica === "TODAS" || x.fabrica === filtroFabrica;
        const matchesSituacao = filtroSituacao === "TODAS" || x.situacao === filtroSituacao;
        return matchesBusca && matchesFabrica && matchesSituacao;
    });

    tb.innerHTML = lista.map(x => `
        <tr>
            <td class="uppercase font-bold">${x.produto}</td>
            <td class="text-blue-600 text-[10px] font-black uppercase">${x.fabrica || "-"}</td>
            <td>${x.qtd}</td>
            <td>
                <span class="px-2 py-1 rounded text-[9px] font-black ${x.situacao === 'ESTOQUE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${x.situacao}
                </span>
            </td>
            <td class="text-center">
                <button onclick="if(confirm('EXCLUIR?')){estoque=estoque.filter(y=>y.uid!=${x.uid}); salvarCloud();}" class="text-red-500 font-black hover:scale-125 transition">✕</button>
            </td>
        </tr>`).join('');
}

function cadastrarEstoque() {
    const p = document.getElementById('e_produto').value.toUpperCase().trim();
    const f = document.getElementById('e_fabrica_select').value;
    const q = document.getElementById('e_qtd').value;
    const s = document.getElementById('e_situacao').value;

    if (p) {
        estoque.push({
            uid: Date.now(),
            produto: p,
            fabrica: f,
            qtd: q,
            situacao: s
        });
        salvarCloud();
        document.getElementById('e_produto').value = "";
    } else {
        alert("INFORME O NOME DO PRODUTO!");
    }
}

// Atualize a função de Selects para incluir o novo filtro do estoque
function atualizarSelectsFornecedores() {
    const h = fornecedores.map(f => `<option value="${f.nome}">${f.nome}</option>`).join('');
    
    // Select de Cadastro de Pedido
    if(document.getElementById('m_fornecedor_select')) document.getElementById('m_fornecedor_select').innerHTML = h || "<option>...</option>";
    
    // Select de Cadastro de Assistência
    if(document.getElementById('as_fabrica')) document.getElementById('as_fabrica').innerHTML = h || "<option>...</option>";
    
    // Select de Cadastro de Estoque
    if(document.getElementById('e_fabrica_select')) document.getElementById('e_fabrica_select').innerHTML = h || "<option>...</option>";

    // Select de Filtro (Funil) do Estoque
    if(document.getElementById('estoque-filtro-fabrica')) {
        document.getElementById('estoque-filtro-fabrica').innerHTML = '<option value="TODAS">FÁBRICAS: TODAS</option>' + h;
    }
}
