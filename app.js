// =========================================================
// FUNÇÃO DE GERAR EMAIL/WHATSAPP EM LOTE
// =========================================================
function gerarEmailLote() {
    // 1. Pega todas as caixinhas que estão marcadas na tabela
    const checks = document.querySelectorAll('.ped-check:checked');
    if (checks.length === 0) {
        return alert("Nenhum pedido selecionado! Marque as caixinhas na primeira coluna da tabela.");
    }

    // 2. Filtra os pedidos correspondentes
    const uids = Array.from(checks).map(c => c.value);
    const selecionados = pedidos.filter(p => uids.includes(String(p.uid)));

    // 3. Monta o texto bonitinho
    let texto = "Olá! Seguem os dados dos novos pedidos para fabricação:\n\n";
    
    selecionados.forEach(p => {
        texto += `----------------------------------------\n`;
        texto += `ID: ${p.idDoc}\n`;
        texto += `Cliente: ${p.cliente}\n`;
        texto += `Produto: ${p.qtd}x ${p.produto}\n`;
        texto += `Medida: ${p.medida}\n`;
        texto += `Cor/Tecido: ${p.cor}\n`;
        texto += `Fábrica: ${p.fornecedor}\n`;
        texto += `----------------------------------------\n\n`;
    });

    // 4. Copia para a área de transferência (Ctrl+C automático)
    navigator.clipboard.writeText(texto).then(() => {
        // 5. Pergunta se já quer atualizar o status no sistema
        if (confirm("✅ Dados copiados com sucesso!\nAgora é só 'Colar' (Ctrl+V) no e-mail ou WhatsApp da fábrica.\n\nDeseja alterar o status de todos os pedidos selecionados para 'Pedido enviado'?")) {
            
            selecionados.forEach(p => {
                if(p.status === "Não enviado") {
                    p.status = "Pedido enviado";
                }
            });
            
            salvarColecao('pedidos', pedidos);
            registrarAcao('📧', 'ENVIOU LOTE', `Marcou ${selecionados.length} pedidos como enviados.`);
            
            // Desmarca o botão "Marcar Todos" se estiver marcado
            const checkTodos = document.querySelector('input[onclick="marcarTodos(this.checked)"]');
            if(checkTodos) checkTodos.checked = false;
            
            renderPedidos();
        }
    }).catch(err => {
        alert("Não foi possível copiar o texto automaticamente. Seu navegador pode ter bloqueado.");
        console.error(err);
    });
}
