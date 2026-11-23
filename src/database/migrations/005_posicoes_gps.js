export const migracao005 = {
  versao: 5,
  nome: '005_posicoes_gps',
  async executar(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS posicoes_gps_pendentes (
        id TEXT PRIMARY KEY NOT NULL,
        usuario_id TEXT NOT NULL,
        viagem_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        precisao REAL,
        velocidade REAL,
        registrada_em TEXT NOT NULL,
        criado_em TEXT NOT NULL,
        UNIQUE (usuario_id, viagem_id, registrada_em)
      );
      CREATE INDEX IF NOT EXISTS idx_posicoes_gps_usuario_viagem_data
        ON posicoes_gps_pendentes (usuario_id, viagem_id, registrada_em);
    `);
  },
};
