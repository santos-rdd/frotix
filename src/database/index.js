import { executarMigracoes } from './migrations/index.js';

let instanciaBanco = null;
let promessaInicializacao = null;

const NOME_BANCO = 'frotix.db';

export async function abrirBanco() {
  if (instanciaBanco) {
    return instanciaBanco;
  }

  if (promessaInicializacao) {
    return promessaInicializacao;
  }

  promessaInicializacao = (async () => {
    try {
      const SQLite = await import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync(NOME_BANCO);
      await executarMigracoes(db);
      instanciaBanco = db;
      return db;
    } finally {
      promessaInicializacao = null;
    }
  })();

  return promessaInicializacao;
}

export function obterBanco() {
  return instanciaBanco;
}

export function definirInstanciaBanco(db) {
  instanciaBanco = db;
}

export async function fecharBanco() {
  if (instanciaBanco) {
    if (typeof instanciaBanco.closeAsync === 'function') {
      await instanciaBanco.closeAsync();
    }
    instanciaBanco = null;
  }
}

export * from './repositories/syncQueueRepository.js';
export * from './repositories/dadosLocaisRepository.js';
export * from './repositories/comprovantesRepository.js';
export * from './repositories/transacoesRepository.js';
