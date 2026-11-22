// Posições de GPS lidas no celular do motorista que ainda não chegaram ao servidor.
// Ficam aqui enquanto o celular está sem internet e são apagadas assim que o envio dá certo.
export const migracao005 = {
  versao: 5,
  nome: '005_posicoes_pendentes',
  async executar(db) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS posicoes_pendentes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id TEXT NOT NULL,
        id_viagem TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        precisao REAL,
        velocidade REAL,
        registrada_em TEXT NOT NULL,
        UNIQUE (id_viagem, registrada_em)
      );
      CREATE INDEX IF NOT EXISTS idx_posicoes_pendentes_viagem ON posicoes_pendentes (usuario_id, id_viagem, registrada_em);
    `);
  },
};
