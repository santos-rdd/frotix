export const migracao002 = {
  versao: 2,
  nome: '002_comprovantes_e_mapeamento',
  async executar(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS id_mappings (
        id TEXT PRIMARY KEY NOT NULL,
        entidade TEXT NOT NULL,
        id_local TEXT NOT NULL UNIQUE,
        id_remoto TEXT NOT NULL,
        criado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_id_mappings_local ON id_mappings (entidade, id_local);

      CREATE TABLE IF NOT EXISTS comprovantes_locais (
        id TEXT PRIMARY KEY NOT NULL,
        usuario_id TEXT NOT NULL,
        id_lancamento_local TEXT,
        id_lancamento_remoto TEXT,
        nome_arquivo TEXT NOT NULL,
        uri_local TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        tamanho_bytes INTEGER,
        caminho_remoto TEXT,
        status TEXT NOT NULL DEFAULT 'LOCAL',
        tentativas INTEGER NOT NULL DEFAULT 0,
        erro TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comprovantes_usuario ON comprovantes_locais (usuario_id);
      CREATE INDEX IF NOT EXISTS idx_comprovantes_status ON comprovantes_locais (status);
    `);
  },
};
