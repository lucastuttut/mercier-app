// =========================================================
// TELA "HOJE" - VERSÃO 3 (cole do início até o FINAL do app.js)
// =========================================================
function etiquetaHoje(txt, cor) {
    return `<span class="${cor} text-[9px] font-black px-2 py-0.5 rounded whitespace-nowrap">${txt}</span>`;
}

function linhaHoje(principal, secundario, direita, acao) {
    const clicavel = acao ? ' linha-clicavel' : '';
    const onclick = acao ? ' onclick="' + acao + '" title="Clique para abrir"' : '';
    return `<div${onclick} class="flex justify-between items-start gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100${clicavel}"><div class="flex flex-col min-w-0"><span class="text-[11px] font-black uppercase text-slate-800">${principal}</span><span class="text-[9px] font-bold uppercase text-slate-500">${secundario}</span></div>${direita || ''}</div>`;
}

// Linha com cliente e produto em destaque
function linhaDestaque(cliente, produto, direita, acao) {
    const clicavel = acao ? ' linha-clicavel' : '';
    const onclick = acao ? ' onclick="' + acao + '" title="Clique para abrir"' : '';
    return `<div${onclick} class="flex justify-between items-center gap-2 bg-orange-50 rounded-lg p-2.5 border border-orange-200${clicavel}"><div class="flex flex-col gap-1 min-w-0"><span class="text-sm font-black uppercase text-slate-900 leading-tight">${cliente}</span><span class="text-[11px] font-black uppercase text-indigo-700 bg-indigo-100 rounded px-2 py-0.5 self-start">${produto}</span></div>${direita || ''}</div>`;
}

function hojeSomaDias(iso, n) {
    const p = String(iso).split('-');
    return dataLocalISO(new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]) + n));
}

function hojeDiasDesde(dataBR) {
    const p = String(dataBR || '').split('/'); if (p.length !== 3) return 0;
    const d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    return Math.max(0, Math.floor((new Date() - d) / 86400000));
}

function hojeBotao(txt, acao, cor) {
    return `<button onclick="event.stopPropagation(); ${acao}" class="${cor || 'bg-slate-800 text-white'} px-2 py-1 rounded text-[9px] font-black uppercase whitespace-nowrap">${txt}</button>`;
}

function hojeDireita() {
    return `<div class="flex flex-col items-end gap-1">${Array.prototype.slice.call(arguments).join('')}</div>`;
}

function hojeCartao(icone, titulo, corBadge, qtd, corpo) {
    return `<div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-2">
        <div class="flex justify-between items-center border-b border-slate-100 pb-2"><h3 class="text-xs font-black uppercase text-slate-700">${icone} ${titulo}</h3><span class="${corBadge} text-[10px] font-black px-2 py-0.5 rounded-full">${qtd}</span></div>
        ${corpo}
    </div>`;
}

// ---------- Ações dos cliques ----------
function hojeIr(aba) { if (getEl('view-' + aba)) switchTab(aba); }

function hojeAbrirPedido(uid) {
    const p = pedidos.find(function(x) { return x.uid == uid; }); if (!p) return;
    hojeIr('pedidos');
    if (filtrandoNaoEnviados) toggleFiltroNaoEnviado();
    mudarVisaoPedidos('ATIVOS');
    if (getEl('busca')) getEl('busca').value = p.cliente || '';
    renderPedidos();
}

function hojeVerNaoEnviados(uid) {
    const p = pedidos.find(function(x) { return x.uid == uid; }); if (!p) return;
    hojeIr('pedidos');
    mudarVisaoPedidos('ATIVOS');
    if (getEl('busca')) getEl('busca').value = p.fornecedor || '';
    if (!filtrandoNaoEnviados) toggleFiltroNaoEnviado(); else renderPedidos();
}

function hojeAgendarEntrega(uid) {
    const p = pedidos.find(function(x) { return x.uid == uid; }); if (!p) return;
    hojeIr('logistica');
    abrirModalNovaEntrega();
    getEl('ent_cliente').value = p.cliente || '';
    buscarDadosInteligentes();
}

function hojeVerNaAgenda(iso) {
    hojeIr('logistica');
    dataSelecionadaLogistica = iso;
    const p = iso.split('-');
    dataAtualCalendario = new Date(parseInt(p[0]), parseInt(p[1]) - 1, 1);
    processarEventosCalendario();
}

function hojeAbrirParcela(venc) {
    const p = String(venc).split('-');
    mesComissao = new Date(parseInt(p[0]), parseInt(p[1]) - 1, 1);
    hojeIr('comissoes');
    renderComissoes();
}

function hojeAbrirAssistencia(uid) {
    const a = assistencias.find(function(x) { return x.uid == uid; });
    hojeIr('assistencias');
    if (a && getEl('busca-assistencia')) getEl('busca-assistencia').value = a.cliente || '';
    renderAssistencias();
}

function hojeEntregue(uid) {
    const e = entregas.find(function(x) { return x.uid == uid; }); if (!e) return;
    e.status = 'Entregue';
    salvarColecao('entregas', entregas);
    registrarAcao('🚚', 'ENTREGA CONCLUÍDA', 'CLIENTE: ' + e.cliente);
    processarEventosCalendario(); renderHoje();
}

function hojeGPS(uid) {
    const e = entregas.find(function(x) { return x.uid == uid; }); if (!e) return;
    abrirGPS(e.endereco);
}

function hojeMoverTarefa(uid, col) { moverTarefaEquipe(uid, col); renderHoje(); }

function hojeLembreteFeito(uid) { toggleConcluidoLembrete(uid); renderHoje(); }

function hojeBackup() {
    db.ref('dados').once('value').then(function(s) {
        const blob = new Blob([JSON.stringify(s.val() || {}, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'backup-mercier-' + hojeLocal() + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        try { localStorage.setItem('mercier_ultimo_backup', hojeLocal()); } catch (e) {}
        renderHoje();
    }).catch(function() { alert('Não foi possível baixar o backup. Verifique a conexão.'); });
}

// Abre a tarefa direto na aba Equipe
function irParaTarefa(uid) {
    const t = tarefasEquipe.find(function(x) { return x.uid == uid; });
    if (!t) return alert("Tarefa não encontrada.");

    if (modoMinhasTarefas && usuarioAtual && t.responsavel !== usuarioAtual) {
        modoMinhasTarefas = false;
        try { localStorage.setItem('mercier_so_minhas', 'false'); } catch (e) {}
        if (getEl('check-minhas-tarefas')) getEl('check-minhas-tarefas').checked = false;
    }
    if (filtrosEquipeAtivos.length > 0 && !filtrosEquipeAtivos.includes(t.responsavel)) {
        filtrosEquipeAtivos = [];
    }
    colsMinimizadas[t.coluna] = false;
    t.minimizada = false;

    renderFiltrosEquipe();
    renderQuadroEquipe();

    const card = getEl('card-' + uid);
    if (!card) return;
    const mainE = card.closest('main');
    if (mainE) switchTab(mainE.id.replace('view-', ''));

    setTimeout(function() {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('ring-4', 'ring-blue-500');
        setTimeout(function() { card.classList.remove('ring-4', 'ring-blue-500'); }, 2500);
    }, 150);
}

// ---------- Tela ----------
function renderHoje() {
    const v = getEl('view-hoje'); if (!v) return;
    const hoje = hojeLocal();
    const amanha = hojeSomaDias(hoje, 1);
    const em7 = hojeSomaDias(hoje, 7);
    const hora = new Date().getHours();
    const saud = hora < 12 ? 'Bom dia' : (hora < 18 ? 'Boa tarde' : 'Boa noite');
    const nome = usuarioAtual ? usuarioAtual.charAt(0) + usuarioAtual.slice(1).toLowerCase() : '';
    const dataExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    const cartoes = [];
    const add = function(icone, titulo, cor, qtd, corpo, info) {
        cartoes.push({ titulo: titulo, qtd: qtd, info: !!info, html: qtd > 0 ? hojeCartao(icone, titulo, cor, qtd, corpo) : '' });
    };

    // Backup
    let ultimoBackup = ''; try { ultimoBackup = localStorage.getItem('mercier_ultimo_backup') || ''; } catch (e) {}
    const diasBackup = ultimoBackup ? Math.round((new Date(hoje + 'T12:00:00') - new Date(ultimoBackup + 'T12:00:00')) / 86400000) : null;
    const alertaBackup = diasBackup === null || diasBackup > 7;
    const msgBackup = diasBackup === null ? 'Nenhum backup baixado neste aparelho ainda.' : 'Último backup: ' + fmtBR(ultimoBackup) + ' (' + diasBackup + ' dia(s) atrás).';
    const blocoBackup = `<div class="${alertaBackup ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-200'} border rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <span class="text-[11px] font-black uppercase ${alertaBackup ? 'text-red-700' : 'text-emerald-700'}">${alertaBackup ? '⚠️ ' : '💾 '}${msgBackup}</span>
        <button onclick="hojeBackup()" class="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase">💾 Baixar backup agora</button></div>`;

    // 1. Entregas de hoje e atrasadas
    const entPend = entregas.filter(function(e) { return e.status !== 'Entregue' && e.dataOrdem && e.dataOrdem <= hoje; })
        .sort(function(a, b) { return a.dataOrdem === b.dataOrdem ? (a.hora || '23:59').localeCompare(b.hora || '23:59') : a.dataOrdem.localeCompare(b.dataOrdem); });
    const htmlEnt = entPend.map(function(e) {
        const atrasada = e.dataOrdem < hoje;
        const et = atrasada ? etiquetaHoje('ATRASADA ' + fmtBR(e.dataOrdem).slice(0, 5), 'bg-red-100 text-red-700') : etiquetaHoje(e.hora ? '🕒 ' + esc(e.hora) : 'SEM HORA', 'bg-emerald-100 text-emerald-700');
        return linhaHoje(esc(e.cliente), '📍 ' + esc(e.endereco), hojeDireita(et, hojeBotao('✅ Entregue', 'hojeEntregue(' + e.uid + ')', 'bg-emerald-600 text-white'), hojeBotao('🗺️ GPS', 'hojeGPS(' + e.uid + ')', 'bg-blue-100 text-blue-700')), "hojeVerNaAgenda('" + e.dataOrdem + "')");
    }).join('');
    add('🚚', 'Entregas de hoje e atrasadas', 'bg-emerald-100 text-emerald-700', entPend.length, htmlEnt);

    // 2. Pedidos prontos na loja sem entrega agendada
    const ativos = pedidos.filter(function(p) { return !p.finalizado && p.status !== 'Entregue/Finalizado'; });
    const naLoja = {};
    ativos.filter(function(p) { return p.status === 'Pedido na loja'; }).forEach(function(p) {
        const chave = noAcc((p.cliente || '').toLowerCase().trim());
        const agendada = entregas.some(function(e) {
            if (e.status === 'Entregue' || !e.cliente) return false;
            const c = noAcc(e.cliente.toLowerCase().trim());
            return c.includes(chave) || chave.includes(c);
        });
        if (agendada || !chave) return;
        if (!naLoja[chave]) naLoja[chave] = { cliente: p.cliente, uid: p.uid, itens: [] };
        naLoja[chave].itens.push(p.produto);
    });
    const listaLoja = Object.keys(naLoja).map(function(k) { return naLoja[k]; });
    const htmlLoja = listaLoja.map(function(g) {
        return linhaHoje(esc(g.cliente), g.itens.length + ' item(ns): ' + esc(g.itens.join(', ')), hojeDireita(hojeBotao('🚚 Agendar', 'hojeAgendarEntrega(' + g.uid + ')', 'bg-emerald-600 text-white')), 'hojeAbrirPedido(' + g.uid + ')');
    }).join('');
    add('🏬', 'Chegou na loja, sem entrega agendada', 'bg-emerald-100 text-emerald-700', listaLoja.length, htmlLoja);

    // 3. Pedidos vencidos ou com prazo curto
    const prazo = ativos.filter(function(p) { return p.dataPedido; }).map(function(p) { return { p: p, dias: calcP(p.dataPedido, p.prazo).dias }; })
        .filter(function(x) { return x.dias <= 5; }).sort(function(a, b) { return a.dias - b.dias; });
    let htmlPrazo = prazo.slice(0, 10).map(function(x) {
        const rot = x.dias < 0 ? 'VENCIDO ' + (-x.dias) + 'D' : (x.dias === 0 ? 'HOJE' : x.dias + 'D');
        const cor = x.dias < 0 ? 'bg-red-100 text-red-700' : (x.dias <= 2 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700');
        return linhaHoje(esc(x.p.cliente) + ' - ' + esc(x.p.produto), esc(x.p.fornecedor) + ' | ' + esc(x.p.status), hojeDireita(etiquetaHoje(rot, cor)), 'hojeAbrirPedido(' + x.p.uid + ')');
    }).join('');
    if (prazo.length > 10) htmlPrazo += `<span class="text-[9px] font-black text-slate-400 text-center">+ ${prazo.length - 10} pedidos na aba Pedidos</span>`;
    add('⏳', 'Pedidos vencidos ou até 5 dias', 'bg-red-100 text-red-700', prazo.length, htmlPrazo);

    // 4. Não enviados: cliente e produto em destaque, agrupados por fábrica
    const porFab = {};
    ativos.filter(function(p) { return p.status === 'Não enviado'; }).forEach(function(p) {
        const f = p.fornecedor || 'SEM FÁBRICA';
        if (!porFab[f]) porFab[f] = { uid: p.uid, nome: f, pedidos: [] };
        porFab[f].pedidos.push(p);
    });
    const listaFab = Object.keys(porFab).map(function(k) { return porFab[k]; });
    const totalNaoEnv = listaFab.reduce(function(s, g) { return s + g.pedidos.length; }, 0);
    const htmlFab = '<div class="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">' + listaFab.map(function(g) {
        const itens = g.pedidos.map(function(p) {
            return linhaDestaque(esc(p.cliente), esc(p.qtd || 1) + 'x ' + esc(p.produto), '', 'hojeAbrirPedido(' + p.uid + ')');
        }).join('');
        return '<div class="flex flex-col gap-1.5"><div class="flex justify-between items-center"><span class="text-[10px] font-black uppercase text-slate-500">🏭 ' + esc(g.nome) + ' (' + g.pedidos.length + ')</span>' +
            hojeBotao('📧 Ver e enviar', 'hojeVerNaoEnviados(' + g.uid + ')', 'bg-orange-500 text-white') + '</div>' + itens + '</div>';
    }).join('') + '</div>';
    add('📧', 'Pedidos não enviados à fábrica', 'bg-orange-100 text-orange-700', totalNaoEnv, htmlFab);

    // 5. Minhas tarefas
    let aviso = '';
    if (!usuarioAtual) {
        aviso = `<div class="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-[11px] font-black uppercase text-blue-700">👤 Selecione quem você é no topo da tela para ver suas tarefas aqui.</div>`;
    } else {
        const pP = { "AGORA": 1, "IMEDIATO": 2, "IMPORTANTE": 3, "REGULAR": 4, "TRANQUILO": 5, "": 6 };
        const rotPrazo = { "AGORA": '🚨 AGORA', "IMEDIATO": '⚡ 1 DIA', "IMPORTANTE": '⚠️ 2 DIAS', "REGULAR": '📅 3 DIAS', "TRANQUILO": '☕ + DIAS' };
        const minhas = tarefasEquipe.filter(function(t) { return t.responsavel === usuarioAtual && t.coluna !== 'DONE'; })
            .sort(function(a, b) { return (pP[a.prazo || ""] || 6) - (pP[b.prazo || ""] || 6); });
        const htmlT = minhas.map(function(t) {
            const bt = t.coluna === 'DOING'
                ? hojeBotao('✅ Concluir', "hojeMoverTarefa(" + t.uid + ",'DONE')", 'bg-emerald-600 text-white')
                : hojeBotao('▶ Iniciar', "hojeMoverTarefa(" + t.uid + ",'DOING')", 'bg-blue-600 text-white');
            return linhaHoje(
                esc(t.descricao),
                t.coluna === 'DOING' ? 'Em andamento' : 'A fazer',
                hojeDireita(rotPrazo[t.prazo] ? etiquetaHoje(rotPrazo[t.prazo], 'bg-slate-200 text-slate-700') : '', bt),
                'irParaTarefa(' + t.uid + ')'
            );
        }).join('');
        add('👤', 'Minhas tarefas', 'bg-blue-100 text-blue-700', minhas.length, htmlT);
    }

    // 6. Lembretes
    const lemb = lembretes.filter(function(l) { return !l.concluido && l.dataOrdem && l.dataOrdem <= hoje; });
    const htmlL = lemb.map(function(l) {
        const atr = l.dataOrdem < hoje;
        return linhaHoje(esc(l.titulo), esc(l.categoria), hojeDireita(etiquetaHoje(atr ? 'ATRASADO' : 'HOJE', atr ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'), hojeBotao('✅ Feito', 'hojeLembreteFeito(' + l.uid + ')', 'bg-emerald-600 text-white')), "hojeVerNaAgenda('" + l.dataOrdem + "')");
    }).join('');
    add('🔔', 'Lembretes de hoje e atrasados', 'bg-amber-100 text-amber-700', lemb.length, htmlL);

    // 7. Parcelas a receber
    const parc = [];
    comissoes.forEach(function(venda) {
        const ps = safeArray(venda.parcelas);
        ps.forEach(function(p, i) { if (!p.pago && p.venc && p.venc <= hoje) parc.push({ v: venda, p: p, i: i, n: ps.length }); });
    });
    parc.sort(function(a, b) { return String(a.p.venc).localeCompare(String(b.p.venc)); });
    const htmlP = parc.slice(0, 8).map(function(x) {
        const atr = x.p.venc < hoje;
        return linhaHoje(esc(x.v.cliente), 'Parcela ' + (x.i + 1) + '/' + x.n + ' | ' + formatMoney(x.p.valor) + ' | comissão ' + formatMoney(comissaoDe(x.p.valor)), hojeDireita(etiquetaHoje(atr ? 'ATRASADA ' + fmtBR(x.p.venc).slice(0, 5) : 'HOJE', atr ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'), hojeBotao('✅ Pago', 'togglePagoParcela(' + x.v.uid + ',' + x.i + ')', 'bg-emerald-600 text-white')), "hojeAbrirParcela('" + x.p.venc + "')");
    }).join('') + (parc.length > 8 ? `<span class="text-[9px] font-black text-slate-400 text-center">+ ${parc.length - 8} na aba Comissões</span>` : '');
    add('💰', 'Parcelas a receber (hoje e atrasadas)', 'bg-emerald-100 text-emerald-700', parc.length, htmlP);

    // 8. Assistências abertas
    const assis = assistencias.filter(function(a) { return (a.status || 'Aguardando') !== 'Concluído'; })
        .map(function(a) { return { a: a, dias: hojeDiasDesde(a.data) }; }).sort(function(x, y) { return y.dias - x.dias; });
    const htmlA = assis.slice(0, 8).map(function(x) {
        return linhaHoje(esc(x.a.cliente) + ' - ' + esc(x.a.produto), esc(x.a.fabrica) + ' | ' + esc(x.a.status || 'Aguardando'), hojeDireita(etiquetaHoje(x.dias + ' DIA(S)', x.dias > 15 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700')), 'hojeAbrirAssistencia(' + x.a.uid + ')');
    }).join('') + (assis.length > 8 ? `<span class="text-[9px] font-black text-slate-400 text-center">+ ${assis.length - 8} na aba Assistências</span>` : '');
    add('🛠️', 'Assistências em aberto', 'bg-orange-100 text-orange-700', assis.length, htmlA);

    // 9. Próximas entregas (informativo)
    const prox = entregas.filter(function(e) { return e.status !== 'Entregue' && e.dataOrdem && e.dataOrdem > hoje && e.dataOrdem <= em7; })
        .sort(function(a, b) { return a.dataOrdem === b.dataOrdem ? (a.hora || '23:59').localeCompare(b.hora || '23:59') : a.dataOrdem.localeCompare(b.dataOrdem); });
    const htmlProx = prox.map(function(e) {
        const rot = e.dataOrdem === amanha ? 'AMANHÃ' : fmtBR(e.dataOrdem).slice(0, 5);
        return linhaHoje(esc(e.cliente), '📍 ' + esc(e.endereco), hojeDireita(etiquetaHoje(rot + (e.hora ? ' ' + esc(e.hora) : ''), 'bg-blue-100 text-blue-700')), "hojeVerNaAgenda('" + e.dataOrdem + "')");
    }).join('');
    add('📆', 'Próximas entregas (7 dias)', 'bg-blue-100 text-blue-700', prox.length, htmlProx, true);

    // Montagem
    const totalPend = cartoes.filter(function(c) { return !c.info; }).reduce(function(s, c) { return s + c.qtd; }, 0);
    const comItens = cartoes.filter(function(c) { return c.qtd > 0; }).map(function(c) { return c.html; }).join('');
    const emDia = cartoes.filter(function(c) { return c.qtd === 0; }).map(function(c) {
        return `<span class="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">✔ ${c.titulo}</span>`;
    }).join('');
    const resumo = totalPend > 0 ? totalPend + ' item(ns) precisam de atenção' : 'Tudo em dia por aqui 🎉';

    v.innerHTML = `
    <div class="flex flex-col gap-4">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-1">
            <div><h2 class="text-xl font-black text-slate-800">${saud}${nome ? ', ' + esc(nome) : ''}!</h2><span class="text-[11px] font-bold uppercase text-slate-400">${dataExtenso}</span></div>
            <span class="text-xs font-black uppercase ${totalPend > 0 ? 'text-orange-600' : 'text-emerald-600'}">${resumo}</span>
        </div>
        ${aviso}
        ${blocoBackup}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${comItens}</div>
        ${emDia ? `<div class="flex flex-col gap-2"><span class="text-[10px] font-black uppercase text-slate-400">Em dia:</span><div class="flex flex-wrap gap-2">${emDia}</div></div>` : ''}
    </div>`;
}

// Atualiza a tela sozinha a cada 5 minutos (se estiver aberta)
if (!window.__hojeTimer) {
    window.__hojeTimer = setInterval(function() {
        const v = getEl('view-hoje');
        if (v && !v.classList.contains('hidden')) renderHoje();
    }, 300000);
}
