export const migracao004 = {
  versao: 4,
  nome: '004_vinculo_viagem_transacao',
  async executar(db) {
    const colunas = await db.getAllAsync('PRAGMA table_info(transacoes_locais)');
    if (!colunas.some((coluna) => coluna.name === 'id_viagem')) {
      await db.execAsync('ALTER TABLE transacoes_locais ADD COLUMN id_viagem TEXT;');
    }
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transacoes_viagem ON transacoes_locais (id_viagem);');
  },
};
