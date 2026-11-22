import { migracao001 } from './001_inicial.js';
import { migracao002 } from './002_comprovantes_e_mapeamento.js';
import { migracao003 } from './003_transacoes_locais.js';
import { migracao004 } from './004_vinculo_viagem_transacao.js';
import { migracao005 } from './005_posicoes_pendentes.js';

const listaMigracoes = [
  migracao001,
  migracao002,
  migracao003,
  migracao004,
  migracao005,
];

export async function executarMigracoes(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      versao INTEGER NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      aplicada_em TEXT NOT NULL
    );
  `);

  const aplicadas = await db.getAllAsync('SELECT versao FROM schema_migrations ORDER BY versao ASC');
  const versoesAplicadas = new Set(aplicadas.map((m) => m.versao));

  for (const migracao of listaMigracoes) {
    if (!versoesAplicadas.has(migracao.versao)) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await migracao.executar(txn);
        await txn.runAsync(
          'INSERT INTO schema_migrations (versao, nome, aplicada_em) VALUES (?, ?, ?)',
          [migracao.versao, migracao.nome, new Date().toISOString()]
        );
      });
    }
  }
}
