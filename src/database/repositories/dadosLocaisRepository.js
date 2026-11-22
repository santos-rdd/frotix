export async function salvarDadoLocal(db, usuarioId, chave, valor) {
  const agora = new Date().toISOString();
  const id = `${usuarioId}_${chave}`;
  const valorStr = typeof valor === 'string' ? valor : JSON.stringify(valor);

  await db.runAsync(
    `INSERT INTO dados_locais (id, usuario_id, chave, valor, atualizado_em)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em`,
    [id, String(usuarioId), chave, valorStr, agora]
  );
}

export async function obterDadoLocal(db, usuarioId, chave) {
  const linha = await db.getFirstAsync(
    `SELECT valor, atualizado_em FROM dados_locais WHERE usuario_id = ? AND chave = ?`,
    [String(usuarioId), chave]
  );

  if (!linha) return null;

  try {
    return JSON.parse(linha.valor);
  } catch {
    return linha.valor;
  }
}

export async function removerDadoLocal(db, usuarioId, chave) {
  await db.runAsync(
    `DELETE FROM dados_locais WHERE usuario_id = ? AND chave = ?`,
    [String(usuarioId), chave]
  );
}

export async function limparDadosLocaisUsuario(db, usuarioId) {
  await db.runAsync(
    `DELETE FROM dados_locais WHERE usuario_id = ?`,
    [String(usuarioId)]
  );
}
