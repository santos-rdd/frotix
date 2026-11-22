// Fila local das posições de GPS do motorista (tabela posicoes_pendentes).

/** Guarda uma leitura. INSERT OR IGNORE: a mesma leitura (viagem + horário) não entra duas vezes. */
export async function salvarPosicaoPendente(db, usuarioId, idViagem, p) {
  await db.runAsync(
    `INSERT OR IGNORE INTO posicoes_pendentes
       (usuario_id, id_viagem, latitude, longitude, precisao, velocidade, registrada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [String(usuarioId), String(idViagem), p.latitude, p.longitude, p.precisao ?? null, p.velocidade ?? null, p.registradaEm]
  );
}

/** As mais antigas primeiro, no máximo `limite` (o backend aceita até 200 por envio). */
export async function listarPosicoesPendentes(db, usuarioId, idViagem, limite = 200) {
  return db.getAllAsync(
    `SELECT * FROM posicoes_pendentes
     WHERE usuario_id = ? AND id_viagem = ?
     ORDER BY registrada_em ASC
     LIMIT ?`,
    [String(usuarioId), String(idViagem), limite]
  );
}

export async function removerPosicoesPendentes(db, ids) {
  if (!ids?.length) return;
  const marcadores = ids.map(() => '?').join(', ');
  await db.runAsync(`DELETE FROM posicoes_pendentes WHERE id IN (${marcadores})`, ids);
}

/** Descarta leituras velhas demais para ainda importarem no mapa (ex.: viagem já concluída). */
export async function descartarPosicoesAntigas(db, usuarioId, antesDeIso) {
  await db.runAsync(
    `DELETE FROM posicoes_pendentes WHERE usuario_id = ? AND registrada_em < ?`,
    [String(usuarioId), antesDeIso]
  );
}

/** Limita a fila para não crescer sem fim num celular que fica dias offline. */
export async function limitarPosicoesPendentes(db, usuarioId, idViagem, maximo = 2000) {
  await db.runAsync(
    `DELETE FROM posicoes_pendentes
     WHERE usuario_id = ? AND id_viagem = ? AND id NOT IN (
       SELECT id FROM posicoes_pendentes
       WHERE usuario_id = ? AND id_viagem = ?
       ORDER BY registrada_em DESC
       LIMIT ?
     )`,
    [String(usuarioId), String(idViagem), String(usuarioId), String(idViagem), maximo]
  );
}
