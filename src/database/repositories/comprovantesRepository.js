export async function salvarComprovanteLocal(db, dados) {
  const agora = new Date().toISOString();
  const id = dados.id || `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await db.runAsync(
    `INSERT INTO comprovantes_locais (
      id, usuario_id, id_lancamento_local, id_lancamento_remoto,
      nome_arquivo, uri_local, mime_type, tamanho_bytes, caminho_remoto,
      status, tentativas, erro, criado_em, atualizado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      id_lancamento_remoto = excluded.id_lancamento_remoto,
      caminho_remoto = excluded.caminho_remoto,
      status = excluded.status,
      tentativas = excluded.tentativas,
      erro = excluded.erro,
      atualizado_em = excluded.atualizado_em`,
    [
      id,
      String(dados.usuarioId),
      dados.idLancamentoLocal || null,
      dados.idLancamentoRemoto || null,
      dados.nomeArquivo,
      dados.uriLocal,
      dados.mimeType || 'image/jpeg',
      dados.tamanhoBytes || null,
      dados.caminhoRemoto || null,
      dados.status || 'LOCAL',
      dados.tentativas || 0,
      dados.erro || null,
      agora,
      agora,
    ]
  );

  return id;
}

export async function listarComprovantesPorStatus(db, usuarioId, status) {
  return await db.getAllAsync(
    `SELECT * FROM comprovantes_locais WHERE usuario_id = ? AND status = ? ORDER BY criado_em ASC`,
    [String(usuarioId), status]
  );
}

export async function listarComprovantesPorUsuario(db, usuarioId) {
  return await db.getAllAsync(
    `SELECT * FROM comprovantes_locais WHERE usuario_id = ? ORDER BY criado_em DESC`,
    [String(usuarioId)]
  );
}

export async function obterComprovanteLocal(db, id) {
  return await db.getFirstAsync(
    `SELECT * FROM comprovantes_locais WHERE id = ?`,
    [id]
  );
}

export async function listarComprovantesPorLancamentoLocal(db, idLancamentoLocal) {
  return await db.getAllAsync(
    `SELECT * FROM comprovantes_locais WHERE id_lancamento_local = ? ORDER BY criado_em ASC`,
    [String(idLancamentoLocal)]
  );
}

export async function atualizarStatusComprovante(db, id, status, caminhoRemoto = null, erro = null) {
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE comprovantes_locais
     SET status = ?, caminho_remoto = COALESCE(?, caminho_remoto), erro = ?, tentativas = tentativas + 1, atualizado_em = ?
     WHERE id = ?`,
    [status, caminhoRemoto, erro, agora, id]
  );
}

export async function recuperarComprovantesPresos(db, usuarioId = null) {
  const agora = new Date().toISOString();
  let queryComRemoto = `UPDATE comprovantes_locais SET status = 'SINCRONIZADO', atualizado_em = ? WHERE status = 'ENVIANDO' AND caminho_remoto IS NOT NULL`;
  let querySemRemoto = `UPDATE comprovantes_locais SET status = 'AGUARDANDO_ENVIO', atualizado_em = ? WHERE status = 'ENVIANDO' AND caminho_remoto IS NULL`;
  const params = [agora];
  if (usuarioId) {
    queryComRemoto += ` AND usuario_id = ?`;
    querySemRemoto += ` AND usuario_id = ?`;
    params.push(String(usuarioId));
  }
  await db.runAsync(queryComRemoto, params);
  await db.runAsync(querySemRemoto, params);
}

export async function removerComprovanteLocal(db, id) {
  await db.runAsync(`DELETE FROM comprovantes_locais WHERE id = ?`, [id]);
}

export async function salvarMapeamentoId(db, entidade, idLocal, idRemoto) {
  const agora = new Date().toISOString();
  const id = `${entidade}_${idLocal}`;

  await db.runAsync(
    `INSERT INTO id_mappings (id, entidade, id_local, id_remoto, criado_em)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id_local) DO UPDATE SET id_remoto = excluded.id_remoto`,
    [id, entidade, String(idLocal), String(idRemoto), agora]
  );
}

export async function obterIdRemoto(db, entidade, idLocal) {
  const item = await db.getFirstAsync(
    `SELECT id_remoto FROM id_mappings WHERE entidade = ? AND id_local = ?`,
    [entidade, String(idLocal)]
  );
  if (item?.id_remoto) {
    return item.id_remoto;
  }

  if (entidade === 'lancamentos') {
    const alt = await db.getFirstAsync(
      `SELECT id_remoto FROM id_mappings WHERE entidade = 'transacoes' AND id_local = ?`,
      [String(idLocal)]
    );
    return alt?.id_remoto || null;
  }

  if (entidade === 'transacoes') {
    const alt = await db.getFirstAsync(
      `SELECT id_remoto FROM id_mappings WHERE entidade = 'lancamentos' AND id_local = ?`,
      [String(idLocal)]
    );
    return alt?.id_remoto || null;
  }

  return null;
}
