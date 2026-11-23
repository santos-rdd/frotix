export async function salvarPosicaoGpsPendente(db, posicao) {
  return db.runAsync(
    `INSERT OR IGNORE INTO posicoes_gps_pendentes (
      id, usuario_id, viagem_id, latitude, longitude, precisao, velocidade,
      registrada_em, criado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      posicao.id,
      String(posicao.usuarioId),
      String(posicao.viagemId),
      posicao.latitude,
      posicao.longitude,
      posicao.precisao,
      posicao.velocidade,
      posicao.registradaEm,
      posicao.criadoEm,
    ]
  );
}

export async function listarViagensComPosicoesGpsPendentes(db, usuarioId) {
  return db.getAllAsync(
    `SELECT DISTINCT viagem_id
     FROM posicoes_gps_pendentes
     WHERE usuario_id = ?
     ORDER BY viagem_id`,
    [String(usuarioId)]
  );
}

export async function listarPosicoesGpsPendentes(db, usuarioId, viagemId, limite = 200) {
  return db.getAllAsync(
    `SELECT id, usuario_id, viagem_id, latitude, longitude, precisao, velocidade, registrada_em
     FROM posicoes_gps_pendentes
     WHERE usuario_id = ? AND viagem_id = ?
     ORDER BY registrada_em ASC
     LIMIT ?`,
    [String(usuarioId), String(viagemId), limite]
  );
}

export async function removerPosicoesGpsPersistidas(db, usuarioId, ids) {
  const idsValidos = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
  if (idsValidos.length === 0) return { changes: 0 };

  const parametros = [String(usuarioId), ...idsValidos];
  const marcadores = idsValidos.map(() => '?').join(', ');
  return db.runAsync(
    `DELETE FROM posicoes_gps_pendentes
     WHERE usuario_id = ? AND id IN (${marcadores})`,
    parametros
  );
}
