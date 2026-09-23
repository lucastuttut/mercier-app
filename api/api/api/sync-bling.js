// api/sync-bling.js
// Função serverless da Vercel — roda no servidor, nunca no navegador do cliente.

import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";

// Mesma configuração já usada no app.js (pode ficar exposta, pois quem protege
// os dados são as REGRAS do Realtime Database, não esse objeto).
const firebaseConfig = {
  apiKey: "AIzaSyA_fQSZJJcz5Wszw54W5EhMN9D5rNnjoCo",
  authDomain: "mercier-design.firebaseapp.com",
  projectId: "mercier-design",
  storageBucket: "mercier-design.firebasestorage.app",
  messagingSenderId: "1060891658513",
  appId: "1:1060891658513:web:2eefd15227203af39064b0",
  databaseURL: "https://mercier-design-default-rtdb.firebaseio.com/"
};

const firebaseApp = initializeApp(firebaseConfig, "sync-bling-app");
const db = getDatabase(firebaseApp);

// Essas variáveis SÓ existem no servidor da Vercel (Settings > Environment Variables)
const BLING_CLIENT_ID = process.env.BLING_CLIENT_ID;
const BLING_CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;

async function buscarVendasNoBling() {
  // Aqui entra a chamada real à API do Bling (autenticação OAuth2 + endpoint de pedidos de venda).
  // Retorna algo como: [{ id: "123", cliente: "...", itens: [{ id: "456", produto: "...", qtd: 2 }] }]
  throw new Error("Integração com Bling ainda não configurada.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  try {
    const vendas = await buscarVendasNoBling();

    // Carrega os pedidos atuais do Firebase
    const snap = await get(ref(db, "dados/pedidos"));
    const pedidosAtuais = snap.exists() ? Object.values(snap.val()) : [];

    // Monta um Set com os itens já importados, para evitar duplicidade
    const jaImportados = new Set(
      pedidosAtuais
        .filter((p) => p.origemBling)
        .map((p) => `${p.blingPedidoId}-${p.blingItemId}`)
    );

    const novosPedidos = [];

    vendas.forEach((venda) => {
      venda.itens.forEach((item) => {
        const chave = `${venda.id}-${item.id}`;
        if (jaImportados.has(chave)) return; // já existe, não duplica

        novosPedidos.push({
          uid: Date.now() + Math.random(),
          idDoc: null, // pode gerar depois seguindo a lógica do getProximoID
          cliente: (venda.cliente || "").toUpperCase(),
          dataPedido: new Date().toLocaleDateString("pt-BR"),
          qtd: item.qtd || 1,
          produto: (item.produto || "").toUpperCase(),
          medida: "-",
          cor: "-",
          custo: "R$ 0,00",
          fornecedor: "",
          prazo: "30",
          status: "Não enviado",
          whatsEnviado: false,
          confirmado: false,
          finalizado: false,
          origemBling: true,
          blingPedidoId: venda.id,
          blingItemId: item.id
        });
      });
    });

    if (novosPedidos.length > 0) {
      const listaAtualizada = [...novosPedidos, ...pedidosAtuais];
      await set(ref(db, "dados/pedidos"), listaAtualizada);
    }

    return res.status(200).json({
      importados: novosPedidos.length,
      mensagem: `${novosPedidos.length} novo(s) pedido(s) importado(s) do Bling.`
    });
  } catch (erro) {
    console.error("Erro na sincronização com Bling:", erro);
    return res.status(500).json({ erro: "Falha ao sincronizar com o Bling." });
  }
}
