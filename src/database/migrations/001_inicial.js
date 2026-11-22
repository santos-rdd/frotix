export const migracao001 = {
  versao: 1,
  nome: '001_inicial',
  async executar(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        usuario_id TEXT NOT NULL,
        entidade TEXT NOT NULL,
        operacao TEXT NOT NULL,
        dados TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDENTE',
        tentativas INTEGER NOT NULL DEFAULT 0,
        erro TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_usuario ON sync_queue (usuario_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);

      CREATE TABLE IF NOT EXISTS dados_locais (
        id TEXT PRIMARY KEY NOT NULL,
        usuario_id TEXT NOT NULL,
        chave TEXT NOT NULL,
        valor TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_dados_locais_usuario_chave ON dados_locais (usuario_id, chave);
    `);
  },
};
