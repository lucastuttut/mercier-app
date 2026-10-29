// ==========================================
// SALVAMENTO POR ITEM (substitui o salvarColecao antigo)
// ==========================================
const COLECOES = {
    pedidos: 'desc', estoque: 'desc', tarefas: 'desc', assistencias: 'desc', historico: 'desc',
    fornecedores: 'asc', catalogo: 'asc', tarefasEquipe: 'asc', entregas: 'asc', lembretes: 'asc'
};
let dadosCarregados = false;
let estadoServidor = {};
let ultimoUid = 0;

function gerarUid() { ultimoUid = Math.max(Date.now(), ultimoUid + 1); return ultimoUid; }

// O Firebase não aceita . # $ [ ] / dentro de chaves
function chaveDe(uid) { return String(uid).replace(/[.#$|$$$$|\/]/g, '_'); }

function mapaJson(lista) {
    const m = {};
    lista.forEach(function(i) { m[chaveDe(i.uid)] = JSON.stringify(i); });
    return m;
}

function lerColecao(col, bruto) {
    if (!bruto) return [];
    const eraLista = Array.isArray(bruto);
    const lista = (eraLista ? bruto : Object.values(bruto)).filter(function(i) { return i && typeof i === 'object'; });
    lista.forEach(function(i) { if (i.uid == null) i.uid = gerarUid(); });
    if (!eraLista) {
        const desc = COLECOES[col] === 'desc';
        lista.sort(function(a, b) { return desc ? b.uid - a.uid : a.uid - b.uid; });
    }
    return lista;
}

function salvarColecao(col, lista) {
    if (!dadosCarregados) return; // nunca grava antes de carregar os dados
    const antes = estadoServidor[col] || {};
    const depois = {};
    const mudancas = {};

    lista.forEach(function(item) {
        if (!item || typeof item !== 'object') return;
        if (item.uid == null) item.uid = gerarUid();
        const chave = chaveDe(item.uid);
        const json = JSON.stringify(item);
        depois[chave] = json;
        if (antes[chave] !== json) mudancas[chave] = JSON.parse(json);
    });

    Object.keys(antes).forEach(function(chave) {
        if (!(chave in depois)) mudancas[chave] = null; // item removido
    });

    estadoServidor[col] = depois;
    if (Object.keys(mudancas).length === 0) return;
    db.ref('dados/' + col).update(mudancas);
}

function migrarColecao(col, lista) {
    const obj = {};
    lista.forEach(function(i) { obj[chaveDe(i.uid)] = JSON.parse(JSON.stringify(i)); });
    return db.ref('dados/' + col).set(obj);
}

function baixarBackup(dados) {
    try {
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'backup-mercier-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.error('Backup falhou:', e); }
}
