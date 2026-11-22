export async function adicionarOperacaoSync(db, { id, usuarioId, entidade, operacao, dados }) {
  const agora = new Date().toISOString();
  const idOperacao = id || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const dadosStr = typeof dados === 'string' ? dados : JSON.stringify(dados);

  await db.runAsync(
    `INSERT INTO sync_queue (id, usuario_id, entidade, operacao, dados, status, tentativas, erro, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, 'PENDENTE', 0, NULL, ?, ?)`,
    [idOperacao, String(usuarioId), entidade, operacao, dadosStr, agora, agora]
  );

  return idOperacao;
}

export async function listarOperacoesPendentes(db, usuarioId, maxTentativas = 5) {
  const agora = Date.now();
  const itens = await db.getAllAsync(
    `SELECT * FROM sync_queue WHERE usuario_id = ? AND status IN ('PENDENTE', 'FALHA') ORDER BY criado_em ASC`,
    [String(usuarioId)]
  );

  return itens.filter((item) => {
    if (item.status === 'PENDENTE') {
      return true;
    }
    if (item.status === 'FALHA') {
      if (item.tentativas >= maxTentativas) {
        return false;
      }
      const intervalos = [0, 5000, 15000, 30000, 60000];
      const esperaMs = intervalos[Math.min(item.tentativas, intervalos.length - 1)];
      const atualizadoEmMs = new Date(item.atualizado_em).getTime();
      return (agora - atualizadoEmMs) >= esperaMs;
    }
    return false;
  });
}

export async function marcarOperacaoProcessando(db, id) {
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'PROCESSANDO', atualizado_em = ? WHERE id = ?`,
    [agora, id]
  );
}

export async function marcarOperacaoPendente(db, id, erro = null) {
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'PENDENTE', erro = COALESCE(?, erro), atualizado_em = ? WHERE id = ?`,
    [erro ? String(erro) : null, agora, id]
  );
}

export async function marcarOperacaoFalha(db, id, erro, ehDefinitivo = false, maxTentativas = 5) {
  const agora = new Date().toISOString();
  const item = await db.getFirstAsync(`SELECT tentativas FROM sync_queue WHERE id = ?`, [id]);
  const tentativasAtual = (item?.tentativas || 0) + 1;
  const status = (ehDefinitivo || tentativasAtual >= maxTentativas) ? 'FALHA_DEFINITIVA' : 'FALHA';

  await db.runAsync(
    `UPDATE sync_queue SET status = ?, erro = ?, tentativas = ?, atualizado_em = ? WHERE id = ?`,
    [status, erro ? String(erro) : null, tentativasAtual, agora, id]
  );
}

export async function recuperarOperacoesEmProcessamento(db, usuarioId = null) {
  const agora = new Date().toISOString();
  let query = `UPDATE sync_queue SET status = 'PENDENTE', atualizado_em = ? WHERE status = 'PROCESSANDO'`;
  const params = [agora];
  if (usuarioId) {
    query += ` AND usuario_id = ?`;
    params.push(String(usuarioId));
  }
  await db.runAsync(query, params);
}

export async function cancelarOperacaoPorEntidadeEIdLocal(db, usuarioId, entidade, idLocal) {
  const syncId = `sync_${idLocal}`;
  const padraoDados = `%"id":"${idLocal}"%`;
  await db.runAsync(
    `DELETE FROM sync_queue WHERE usuario_id = ? AND (id = ? OR (entidade = ? AND dados LIKE ?))`,
    [String(usuarioId), syncId, entidade, padraoDados]
  );
}

export async function atualizarStatusOperacao(db, id, status, erro = null) {
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE sync_queue
     SET status = ?, erro = ?, tentativas = tentativas + 1, atualizado_em = ?
     WHERE id = ?`,
    [status, erro ? String(erro) : null, agora, id]
  );
}

export async function removerOperacaoSync(db, id) {
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function contarOperacoesPendentes(db, usuarioId, maxTentativas = 5) {
  const itens = await db.getAllAsync(
    `SELECT status, tentativas FROM sync_queue WHERE usuario_id = ?`,
    [String(usuarioId)]
  );

  return itens.filter((i) => {
    if (i.status === 'PENDENTE' || i.status === 'PROCESSANDO') return true;
    if (i.status === 'FALHA' && i.tentativas < maxTentativas) return true;
    return false;
  }).length;
}
