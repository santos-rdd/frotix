export const migracao003 = {
  versao: 3,
  nome: '003_transacoes_locais',
  async executar(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transacoes_locais (
        id TEXT PRIMARY KEY NOT NULL,
        usuario_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        id_categoria TEXT,
        nome_categoria TEXT,
        id_forma_pagamento TEXT,
        nome_forma_pagamento TEXT,
        data TEXT NOT NULL,
        estado_ou_status TEXT,
        credor TEXT,
        quantidade_parcelas INTEGER,
        vencimento_primeira TEXT,
        valor_quitacao_antecipada REAL,
        cliente_ou_veiculo TEXT,
        status_sync TEXT NOT NULL DEFAULT 'PENDENTE',
        id_remoto TEXT,
        erro_sync TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_transacoes_usuario ON transacoes_locais (usuario_id);
      CREATE INDEX IF NOT EXISTS idx_transacoes_status_sync ON transacoes_locais (status_sync);
    `);
  },
};
