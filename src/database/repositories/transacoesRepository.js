export async function salvarTransacaoLocal(db, dados) {
  const agora = new Date().toISOString();
  const id = dados.id || `local_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const valorNum = Number(dados.valor ?? dados.valorParcela) || 0;
  const qtdParcelas = dados.quantidadeParcelas ? parseInt(dados.quantidadeParcelas, 10) : null;
  const quitacaoNum = dados.valorQuitacaoAntecipada !== undefined && dados.valorQuitacaoAntecipada !== null && dados.valorQuitacaoAntecipada !== ''
    ? Number(dados.valorQuitacaoAntecipada)
    : null;

  await db.runAsync(
    `INSERT INTO transacoes_locais (
      id, usuario_id, tipo, descricao, valor,
      id_categoria, nome_categoria, id_forma_pagamento, nome_forma_pagamento,
      data, estado_ou_status, credor, quantidade_parcelas,
      vencimento_primeira, valor_quitacao_antecipada, cliente_ou_veiculo,
      id_viagem,
      status_sync, id_remoto, erro_sync, criado_em, atualizado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      tipo = excluded.tipo,
      descricao = excluded.descricao,
      valor = excluded.valor,
      id_categoria = excluded.id_categoria,
      nome_categoria = excluded.nome_categoria,
      id_forma_pagamento = excluded.id_forma_pagamento,
      nome_forma_pagamento = excluded.nome_forma_pagamento,
      data = excluded.data,
      estado_ou_status = excluded.estado_ou_status,
      credor = excluded.credor,
      quantidade_parcelas = excluded.quantidade_parcelas,
      vencimento_primeira = excluded.vencimento_primeira,
      valor_quitacao_antecipada = excluded.valor_quitacao_antecipada,
      cliente_ou_veiculo = excluded.cliente_ou_veiculo,
      id_viagem = excluded.id_viagem,
      status_sync = excluded.status_sync,
      id_remoto = excluded.id_remoto,
      erro_sync = excluded.erro_sync,
      atualizado_em = excluded.atualizado_em`,
    [
      id,
      String(dados.usuarioId),
      String(dados.tipo || 'saida').toUpperCase(),
      dados.descricao,
      valorNum,
      dados.idCategoria || null,
      dados.categoria || dados.nomeCategoria || null,
      dados.idFormaPagamento || null,
      dados.formaPagamento || dados.nomeFormaPagamento || null,
      dados.data || agora.split('T')[0],
      dados.estadoOuStatus || null,
      dados.credor || null,
      qtdParcelas,
      dados.vencimentoPrimeira || null,
      quitacaoNum,
      dados.clienteOuVeiculo || null,
      dados.idViagem || dados.id_viagem || null,
      dados.statusSync || 'PENDENTE',
      dados.idRemoto || null,
      dados.erroSync || null,
      dados.criadoEm || agora,
      agora,
    ]
  );

  return id;
}

export async function obterTransacaoLocal(db, id) {
  return await db.getFirstAsync(
    `SELECT * FROM transacoes_locais WHERE id = ?`,
    [id]
  );
}

export async function listarTransacoesPorUsuario(db, usuarioId) {
  return await db.getAllAsync(
    `SELECT * FROM transacoes_locais WHERE usuario_id = ? ORDER BY criado_em DESC`,
    [String(usuarioId)]
  );
}

export async function listarTransacoesPorStatusSync(db, usuarioId, statusSync) {
  return await db.getAllAsync(
    `SELECT * FROM transacoes_locais WHERE usuario_id = ? AND status_sync = ? ORDER BY criado_em ASC`,
    [String(usuarioId), statusSync]
  );
}

export async function atualizarStatusTransacaoLocal(db, id, statusSync, idRemoto = null, erroSync = null) {
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE transacoes_locais
     SET status_sync = ?, id_remoto = COALESCE(?, id_remoto), erro_sync = ?, atualizado_em = ?
     WHERE id = ?`,
    [statusSync, idRemoto, erroSync, agora, id]
  );
}

export async function removerTransacaoLocal(db, id) {
  await db.runAsync(`DELETE FROM transacoes_locais WHERE id = ?`, [id]);
}

export async function contarTransacoesPendentes(db, usuarioId) {
  const resultado = await db.getFirstAsync(
    `SELECT COUNT(*) as total FROM transacoes_locais WHERE usuario_id = ? AND status_sync = 'PENDENTE'`,
    [String(usuarioId)]
  );
  return resultado?.total || 0;
}
