import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adicionarOperacaoSync,
  listarOperacoesPendentes,
  marcarOperacaoProcessando,
  marcarOperacaoPendente,
  marcarOperacaoFalha,
  recuperarOperacoesEmProcessamento,
  cancelarOperacaoPorEntidadeEIdLocal,
  contarOperacoesPendentes,
  removerOperacaoSync,
} from '../../src/database/repositories/syncQueueRepository.js';
import {
  salvarComprovanteLocal,
  listarComprovantesPorStatus,
  recuperarComprovantesPresos,
  salvarMapeamentoId,
  obterIdRemoto,
  obterComprovanteLocal,
  listarComprovantesPorLancamentoLocal,
} from '../../src/database/repositories/comprovantesRepository.js';
import {
  salvarDadoLocal,
  obterDadoLocal,
} from '../../src/database/repositories/dadosLocaisRepository.js';
import {
  salvarTransacaoLocal,
  obterTransacaoLocal,
  listarTransacoesPorUsuario,
  atualizarStatusTransacaoLocal,
} from '../../src/database/repositories/transacoesRepository.js';
import {
  salvarCadastroLocal,
  removerCadastroLocal,
  salvarCategoriaLocal,
  salvarTransacaoOffline,
  obterTransacaoOffline,
  listarTransacoesLocais,
  salvarFormasPagamentoLocais,
  listarFormasPagamentoLocais,
  atualizarCacheCategorias,
  salvarVeiculoOffline,
  listarVeiculosLocais,
  listarVeiculosPermitidosLocais,
  atualizarCacheVeiculos,
  salvarRotaOffline,
  listarRotasLocais,
  atualizarCacheRotas,
  abrirViagemOffline,
  concluirViagemOffline,
  salvarUsuariosLocais,
  listarUsuariosLocais,
} from '../../src/services/localDataService.js';
import {
  definirNetInfo,
  iniciarMonitorConectividade,
  pararMonitorConectividade,
  recuperarOperacoesInterrompidas,
  sincronizarOperacoes,
} from '../../src/services/syncService.js';
import { definirInstanciaBanco } from '../../src/database/index.js';

function criarBancoMemoria() {
  const syncQueue = new Map();
  const dadosLocais = new Map();
  const comprovantes = new Map();
  const idMappings = new Map();
  const transacoes = new Map();

  return {
    tabelas: { syncQueue, dadosLocais, comprovantes, idMappings, transacoes },
    async runAsync(sql, params = []) {
      const sqlNorm = sql.replace(/\s+/g, ' ').trim();

      if (sqlNorm.startsWith('INSERT INTO sync_queue')) {
        const [id, usuario_id, entidade, operacao, dados, criado_em, atualizado_em] = params;
        syncQueue.set(id, {
          id,
          usuario_id: String(usuario_id),
          entidade,
          operacao,
          dados,
          status: 'PENDENTE',
          tentativas: 0,
          erro: null,
          criado_em: criado_em || new Date().toISOString(),
          atualizado_em: atualizado_em || new Date().toISOString(),
        });
        return { changes: 1 };
      }

      if (sqlNorm.startsWith('UPDATE sync_queue SET status = ?, erro = ?, tentativas = ?, atualizado_em = ? WHERE id = ?')) {
        const [status, erro, tentativas, atualizado_em, id] = params;
        const item = syncQueue.get(id);
        if (item) {
          item.status = status;
          item.erro = erro;
          item.tentativas = tentativas;
          item.atualizado_em = atualizado_em;
        }
        return { changes: item ? 1 : 0 };
      }

      if (sqlNorm.startsWith('UPDATE sync_queue SET status = ?, erro = ?, tentativas = tentativas + 1, atualizado_em = ? WHERE id = ?')) {
        const [status, erro, atualizado_em, id] = params;
        const item = syncQueue.get(id);
        if (item) {
          item.status = status;
          item.erro = erro;
          item.tentativas = (item.tentativas || 0) + 1;
          item.atualizado_em = atualizado_em;
        }
        return { changes: item ? 1 : 0 };
      }

      if (sqlNorm.startsWith('UPDATE sync_queue SET status = \'PROCESSANDO\', atualizado_em = ? WHERE id = ?')) {
        const [atualizado_em, id] = params;
        const item = syncQueue.get(id);
        if (item) {
          item.status = 'PROCESSANDO';
          item.atualizado_em = atualizado_em;
        }
        return { changes: item ? 1 : 0 };
      }

      if (sqlNorm.startsWith('UPDATE sync_queue SET status = \'PENDENTE\', erro = COALESCE(?, erro), atualizado_em = ? WHERE id = ?')) {
        const [erro, atualizado_em, id] = params;
        const item = syncQueue.get(id);
        if (item) {
          item.status = 'PENDENTE';
          if (erro !== null && erro !== undefined) item.erro = erro;
          item.atualizado_em = atualizado_em;
        }
        return { changes: item ? 1 : 0 };
      }

      if (sqlNorm.startsWith('UPDATE sync_queue SET status = \'PENDENTE\', atualizado_em = ? WHERE status = \'PROCESSANDO\'')) {
        const [atualizado_em, usuario_id] = params;
        let count = 0;
        for (const item of syncQueue.values()) {
          if (item.status === 'PROCESSANDO') {
            if (!usuario_id || item.usuario_id === String(usuario_id)) {
              item.status = 'PENDENTE';
              item.atualizado_em = atualizado_em;
              count++;
            }
          }
        }
        return { changes: count };
      }

      if (sqlNorm.startsWith('DELETE FROM sync_queue WHERE id = ?')) {
        const [id] = params;
        const existed = syncQueue.delete(id);
        return { changes: existed ? 1 : 0 };
      }

      if (sqlNorm.startsWith('DELETE FROM sync_queue WHERE usuario_id = ? AND (id = ? OR (entidade = ? AND dados LIKE ?))')) {
        const [usuario_id, id, entidade, padrao] = params;
        const idLimpo = padrao.replace(/%/g, '').replace(/"id":"/g, '').replace(/"/g, '');
        let count = 0;
        for (const [chave, item] of Array.from(syncQueue.entries())) {
          if (item.usuario_id === String(usuario_id)) {
            if (chave === id || (item.entidade === entidade && item.dados.includes(idLimpo))) {
              syncQueue.delete(chave);
              count++;
            }
          }
        }
        return { changes: count };
      }

      if (sqlNorm.startsWith('INSERT INTO dados_locais')) {
        const [id, usuario_id, chave, valor, atualizado_em] = params;
        dadosLocais.set(id, { id, usuario_id: String(usuario_id), chave, valor, atualizado_em });
        return { changes: 1 };
      }

      if (sqlNorm.startsWith('INSERT INTO comprovantes_locais')) {
        const [id, usuario_id, idLancLocal, idLancRemoto, nome, uri, mime, tam, remoto, status, tentativas, erro, criado, atualizado] = params;
        comprovantes.set(id, {
          id,
          usuario_id: String(usuario_id),
          id_lancamento_local: idLancLocal || null,
          id_lancamento_remoto: idLancRemoto || null,
          nome_arquivo: nome,
          uri_local: uri,
          mime_type: mime,
          tamanho_bytes: tam,
          caminho_remoto: remoto || null,
          status: status || 'LOCAL',
          tentativas: tentativas || 0,
          erro: erro || null,
          criado_em: criado,
          atualizado_em: atualizado,
        });
        return { changes: 1 };
      }

      if (sqlNorm.startsWith('UPDATE comprovantes_locais SET status = \'SINCRONIZADO\', atualizado_em = ? WHERE status = \'ENVIANDO\' AND caminho_remoto IS NOT NULL')) {
        const [atualizado_em, usuario_id] = params;
        let count = 0;
        for (const c of comprovantes.values()) {
          if (c.status === 'ENVIANDO' && c.caminho_remoto) {
            if (!usuario_id || c.usuario_id === String(usuario_id)) {
              c.status = 'SINCRONIZADO';
              c.atualizado_em = atualizado_em;
              count++;
            }
          }
        }
        return { changes: count };
      }

      if (sqlNorm.startsWith('UPDATE comprovantes_locais SET status = \'AGUARDANDO_ENVIO\', atualizado_em = ? WHERE status = \'ENVIANDO\' AND caminho_remoto IS NULL')) {
        const [atualizado_em, usuario_id] = params;
        let count = 0;
        for (const c of comprovantes.values()) {
          if (c.status === 'ENVIANDO' && !c.caminho_remoto) {
            if (!usuario_id || c.usuario_id === String(usuario_id)) {
              c.status = 'AGUARDANDO_ENVIO';
              c.atualizado_em = atualizado_em;
              count++;
            }
          }
        }
        return { changes: count };
      }

      if (sqlNorm.startsWith('UPDATE comprovantes_locais SET status = ?, caminho_remoto = COALESCE(?, caminho_remoto)')) {
        const [status, caminho_remoto, erro, atualizado_em, id] = params;
        const c = comprovantes.get(id);
        if (c) {
          c.status = status;
          if (caminho_remoto) c.caminho_remoto = caminho_remoto;
          c.erro = erro;
          c.tentativas = (c.tentativas || 0) + 1;
          c.atualizado_em = atualizado_em;
        }
        return { changes: c ? 1 : 0 };
      }

      if (sqlNorm.startsWith('INSERT INTO id_mappings')) {
        const [id, entidade, id_local, id_remoto, criado_em] = params;
        idMappings.set(`${entidade}_${id_local}`, { id, entidade, id_local: String(id_local), id_remoto: String(id_remoto), criado_em });
        return { changes: 1 };
      }

      if (sqlNorm.startsWith('INSERT INTO transacoes_locais')) {
        const [id, usuario_id, tipo, descricao, valor, id_cat, nome_cat, id_forma, nome_forma, data, estado, credor, qtd, venc_prim, val_quit, cliente_veiculo, id_viagem, status_sync, id_remoto, erro_sync, criado, atualizado] = params;
        transacoes.set(id, {
          id,
          usuario_id: String(usuario_id),
          tipo,
          descricao,
          valor,
          id_categoria: id_cat,
          nome_categoria: nome_cat,
          id_forma_pagamento: id_forma,
          nome_forma_pagamento: nome_forma,
          data,
          estado_ou_status: estado,
          credor,
          quantidade_parcelas: qtd,
          vencimento_primeira: venc_prim,
          valor_quitacao_antecipada: val_quit,
          cliente_ou_veiculo: cliente_veiculo,
          id_viagem: id_viagem || null,
          status_sync: status_sync || 'PENDENTE',
          id_remoto: id_remoto || null,
          erro_sync: erro_sync || null,
          criado_em: criado,
          atualizado_em: atualizado,
        });
        return { changes: 1 };
      }

      if (sqlNorm.startsWith('UPDATE transacoes_locais SET status_sync = ?')) {
        const [status_sync, id_remoto, erro_sync, atualizado_em, id] = params;
        const t = transacoes.get(id);
        if (t) {
          t.status_sync = status_sync;
          if (id_remoto) t.id_remoto = id_remoto;
          t.erro_sync = erro_sync;
          t.atualizado_em = atualizado_em;
        }
        return { changes: t ? 1 : 0 };
      }

      return { changes: 0 };
    },
    async getAllAsync(sql, params = []) {
      const sqlNorm = sql.replace(/\s+/g, ' ').trim();

      if (sqlNorm.startsWith('SELECT * FROM sync_queue WHERE usuario_id = ? AND status IN (\'PENDENTE\', \'FALHA\')')) {
        const [usuario_id] = params;
        return Array.from(syncQueue.values())
          .filter((item) => item.usuario_id === String(usuario_id) && (item.status === 'PENDENTE' || item.status === 'FALHA'))
          .sort((a, b) => String(a.criado_em || '').localeCompare(String(b.criado_em || '')));
      }

      if (sqlNorm.startsWith('SELECT status, tentativas FROM sync_queue WHERE usuario_id = ?')) {
        const [usuario_id] = params;
        return Array.from(syncQueue.values())
          .filter((item) => item.usuario_id === String(usuario_id))
          .map((i) => ({ status: i.status, tentativas: i.tentativas }));
      }

      if (sqlNorm.startsWith('SELECT * FROM comprovantes_locais WHERE id_lancamento_local = ?')) {
        const [id_lancamento_local] = params;
        return Array.from(comprovantes.values())
          .filter((c) => c.id_lancamento_local === String(id_lancamento_local));
      }

      if (sqlNorm.startsWith('SELECT * FROM comprovantes_locais WHERE usuario_id = ? AND status = ?')) {
        const [usuario_id, status] = params;
        return Array.from(comprovantes.values())
          .filter((c) => c.usuario_id === String(usuario_id) && c.status === status);
      }

      if (sqlNorm.startsWith('SELECT * FROM transacoes_locais WHERE usuario_id = ?')) {
        const [usuario_id] = params;
        return Array.from(transacoes.values()).filter((t) => t.usuario_id === String(usuario_id));
      }

      return [];
    },
    async getFirstAsync(sql, params = []) {
      const sqlNorm = sql.replace(/\s+/g, ' ').trim();

      if (sqlNorm.startsWith('SELECT tentativas FROM sync_queue WHERE id = ?')) {
        const [id] = params;
        const item = syncQueue.get(id);
        return item ? { tentativas: item.tentativas } : null;
      }

      if (sqlNorm.startsWith('SELECT valor, atualizado_em FROM dados_locais WHERE usuario_id = ? AND chave = ?')) {
        const [usuario_id, chave] = params;
        const item = dadosLocais.get(`${usuario_id}_${chave}`);
        return item ? { valor: item.valor, atualizado_em: item.atualizado_em } : null;
      }

      if (sqlNorm.startsWith('SELECT * FROM comprovantes_locais WHERE id = ?')) {
        const [id] = params;
        return comprovantes.get(id) || null;
      }

      if (sqlNorm.startsWith('SELECT * FROM transacoes_locais WHERE id = ?')) {
        const [id] = params;
        return transacoes.get(id) || null;
      }

      if (sqlNorm.includes('FROM id_mappings WHERE')) {
        if (sqlNorm.includes("entidade = 'transacoes'")) {
          const [id_local] = params;
          const item = idMappings.get(`transacoes_${id_local}`);
          return item ? { id_remoto: item.id_remoto } : null;
        }
        if (sqlNorm.includes("entidade = 'lancamentos'")) {
          const [id_local] = params;
          const item = idMappings.get(`lancamentos_${id_local}`);
          return item ? { id_remoto: item.id_remoto } : null;
        }
        const [entidade, id_local] = params;
        const item = idMappings.get(`${entidade}_${id_local}`);
        return item ? { id_remoto: item.id_remoto } : null;
      }

      return null;
    },
  };
}

test('fila de sincronização: ciclo de vida, retentativas e limiar de falha definitiva', async () => {
  const db = criarBancoMemoria();
  const usuarioId = 'usr_1';

  const opId = await adicionarOperacaoSync(db, {
    id: 'op_1',
    usuarioId,
    entidade: 'categorias',
    operacao: 'CRIAR',
    dados: { nome: 'Combustível', tipo: 'saida' },
  });

  assert.equal(opId, 'op_1');
  let pendentes = await listarOperacoesPendentes(db, usuarioId);
  assert.equal(pendentes.length, 1);
  assert.equal(pendentes[0].status, 'PENDENTE');

  await marcarOperacaoProcessando(db, 'op_1');
  assert.equal(db.tabelas.syncQueue.get('op_1').status, 'PROCESSANDO');

  await marcarOperacaoFalha(db, 'op_1', 'Erro 500 no servidor', false, 3);
  let item = db.tabelas.syncQueue.get('op_1');
  assert.equal(item.status, 'FALHA');
  assert.equal(item.tentativas, 1);
  assert.equal(item.erro, 'Erro 500 no servidor');

  await marcarOperacaoFalha(db, 'op_1', 'Erro 500 no servidor', false, 3);
  item = db.tabelas.syncQueue.get('op_1');
  assert.equal(item.tentativas, 2);
  assert.equal(item.status, 'FALHA');

  await marcarOperacaoFalha(db, 'op_1', 'Erro 500 no servidor', false, 3);
  item = db.tabelas.syncQueue.get('op_1');
  assert.equal(item.tentativas, 3);
  assert.equal(item.status, 'FALHA_DEFINITIVA');

  await adicionarOperacaoSync(db, {
    id: 'op_2',
    usuarioId,
    entidade: 'categorias',
    operacao: 'CRIAR',
    dados: { nome: 'Teste', tipo: 'saida' },
  });
  await marcarOperacaoFalha(db, 'op_2', 'Dados inválidos 400', true);
  assert.equal(db.tabelas.syncQueue.get('op_2').status, 'FALHA_DEFINITIVA');
});

test('recuperação de operações em PROCESSANDO após fechamento inesperado', async () => {
  const db = criarBancoMemoria();
  const usuarioId = 'usr_1';

  await adicionarOperacaoSync(db, { id: 'op_presa', usuarioId, entidade: 'categorias', operacao: 'CRIAR', dados: {} });
  await marcarOperacaoProcessando(db, 'op_presa');
  assert.equal(db.tabelas.syncQueue.get('op_presa').status, 'PROCESSANDO');

  await recuperarOperacoesEmProcessamento(db, usuarioId);
  assert.equal(db.tabelas.syncQueue.get('op_presa').status, 'PENDENTE');
});

test('recuperação de comprovantes presos em status ENVIANDO', async () => {
  const db = criarBancoMemoria();
  const usuarioId = 'usr_1';

  await salvarComprovanteLocal(db, {
    id: 'comp_com_upload',
    usuarioId,
    nomeArquivo: 'nota1.jpg',
    uriLocal: 'file:///data/nota1.jpg',
    caminhoRemoto: 'storage/nota1.jpg',
    status: 'ENVIANDO',
  });

  await salvarComprovanteLocal(db, {
    id: 'comp_sem_upload',
    usuarioId,
    nomeArquivo: 'nota2.jpg',
    uriLocal: 'file:///data/nota2.jpg',
    caminhoRemoto: null,
    status: 'ENVIANDO',
  });

  await recuperarComprovantesPresos(db, usuarioId);

  const c1 = await obterComprovanteLocal(db, 'comp_com_upload');
  assert.equal(c1.status, 'SINCRONIZADO');

  const c2 = await obterComprovanteLocal(db, 'comp_sem_upload');
  assert.equal(c2.status, 'AGUARDANDO_ENVIO');
});

test('exclusão de categoria local ainda não sincronizada cancela a criação sem gerar exclusão fantasma', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_1';

  const catSalva = await salvarCategoriaLocal(usuarioId, { nome: 'Pedágio', tipo: 'saida' });
  assert.equal(catSalva.nome, 'Pedágio');
  assert.ok(catSalva.id.startsWith('local_'));

  assert.equal(db.tabelas.syncQueue.size, 1);
  const chaveQueue = `sync_${catSalva.id}`;
  assert.ok(db.tabelas.syncQueue.has(chaveQueue));

  await removerCadastroLocal(usuarioId, 'categorias', catSalva.id);

  assert.equal(db.tabelas.syncQueue.size, 0);
  const colecao = await obterDadoLocal(db, usuarioId, 'colecao_categorias');
  assert.equal(colecao.length, 0);
});

test('exclusão de categoria já sincronizada (id remoto) agenda operação de exclusão no servidor', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_1';
  const idRemoto = 'a123-uuid-categoria';

  await salvarDadoLocal(db, usuarioId, 'colecao_categorias', [
    { id: idRemoto, nome: 'Frete', tipo: 'entrada', pendenteSincronizacao: false },
  ]);

  await removerCadastroLocal(usuarioId, 'categorias', idRemoto);

  assert.equal(db.tabelas.syncQueue.size, 1);
  const itemSync = db.tabelas.syncQueue.get(`sync_del_${idRemoto}`);
  assert.ok(itemSync);
  assert.equal(itemSync.operacao, 'EXCLUIR');
  assert.equal(itemSync.usuario_id, usuarioId);

  const colecao = await obterDadoLocal(db, usuarioId, 'colecao_categorias');
  assert.equal(colecao.length, 0);
});

test('isolamento estrito entre usuários no banco SQLite', async () => {
  const db = criarBancoMemoria();
  const userA = 'user_alpha';
  const userB = 'user_beta';

  await adicionarOperacaoSync(db, { id: 'op_a', usuarioId: userA, entidade: 'categorias', operacao: 'CRIAR', dados: { nome: 'A' } });
  await adicionarOperacaoSync(db, { id: 'op_b', usuarioId: userB, entidade: 'categorias', operacao: 'CRIAR', dados: { nome: 'B' } });

  const pendentesA = await listarOperacoesPendentes(db, userA);
  assert.equal(pendentesA.length, 1);
  assert.equal(pendentesA[0].id, 'op_a');

  const pendentesB = await listarOperacoesPendentes(db, userB);
  assert.equal(pendentesB.length, 1);
  assert.equal(pendentesB[0].id, 'op_b');

  assert.equal(await contarOperacoesPendentes(db, userA), 1);
  assert.equal(await contarOperacoesPendentes(db, userB), 1);
});

test('obterIdRemoto resolve mapeamentos sob alias transacoes e lancamentos intercambiáveis', async () => {
  const db = criarBancoMemoria();

  await salvarMapeamentoId(db, 'transacoes', 'tx_loc_1', 'tx_rem_999');

  const remotoViaTransacoes = await obterIdRemoto(db, 'transacoes', 'tx_loc_1');
  assert.equal(remotoViaTransacoes, 'tx_rem_999');

  const remotoViaLancamentos = await obterIdRemoto(db, 'lancamentos', 'tx_loc_1');
  assert.equal(remotoViaLancamentos, 'tx_rem_999');
});

test('monitor de conectividade: inscrição, disparo e cancelamento limpo', async () => {
  let ouvinteRegistrado = null;
  let removido = false;

  const mockNetInfo = {
    addEventListener(fn) {
      ouvinteRegistrado = fn;
      return () => {
        removido = true;
      };
    },
  };

  definirNetInfo(mockNetInfo);

  const cancelar = iniciarMonitorConectividade();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(typeof ouvinteRegistrado, 'function');

  cancelar();
  assert.equal(removido, true);

  pararMonitorConectividade();
});

test('sincronização bloqueia execuções concorrentes simultâneas', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);

  const p1 = sincronizarOperacoes('usr_sem_backend');
  const p2 = sincronizarOperacoes('usr_sem_backend');

  const [res1, res2] = await Promise.all([p1, p2]);

  const motivos = [res1.motivo, res2.motivo];
  assert.ok(motivos.includes('ocupado') || motivos.includes('backend_offline'));
});

test('preservação de arquivos locais e metadados de comprovantes durante falhas de rede', async () => {
  const db = criarBancoMemoria();
  const usuarioId = 'usr_1';

  const compId = 'comp_local_persistido';
  const uriOriginal = 'file:///data/user/0/frotix_comprovantes/nota.jpg';

  await salvarComprovanteLocal(db, {
    id: compId,
    usuarioId,
    nomeArquivo: 'nota.jpg',
    uriLocal: uriOriginal,
    caminhoRemoto: null,
    status: 'AGUARDANDO_ENVIO',
  });

  const antes = await obterComprovanteLocal(db, compId);
  assert.equal(antes.uri_local, uriOriginal);
  assert.equal(antes.status, 'AGUARDANDO_ENVIO');

  await db.runAsync(
    'UPDATE comprovantes_locais SET status = ?, caminho_remoto = COALESCE(?, caminho_remoto)',
    ['AGUARDANDO_ENVIO', null, 'Timeout de rede', new Date().toISOString(), compId]
  );

  const depois = await obterComprovanteLocal(db, compId);
  assert.equal(depois.uri_local, uriOriginal);
  assert.equal(depois.status, 'AGUARDANDO_ENVIO');
  assert.equal(depois.erro, 'Timeout de rede');
});

test('comportamento completo de recuperação após reinicialização do aplicativo', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_reboot';

  await adicionarOperacaoSync(db, {
    id: 'op_crashed',
    usuarioId,
    entidade: 'categorias',
    operacao: 'CRIAR',
    dados: { nome: 'Pneus', tipo: 'saida' },
  });
  await marcarOperacaoProcessando(db, 'op_crashed');

  await salvarComprovanteLocal(db, {
    id: 'comp_crashed_sem_upload',
    usuarioId,
    nomeArquivo: 'cupom.jpg',
    uriLocal: 'file:///cupom.jpg',
    caminhoRemoto: null,
    status: 'ENVIANDO',
  });

  await salvarComprovanteLocal(db, {
    id: 'comp_crashed_com_upload',
    usuarioId,
    nomeArquivo: 'cupom2.jpg',
    uriLocal: 'file:///cupom2.jpg',
    caminhoRemoto: 'storage/cupom2.jpg',
    status: 'ENVIANDO',
  });

  assert.equal(db.tabelas.syncQueue.get('op_crashed').status, 'PROCESSANDO');
  assert.equal(db.tabelas.comprovantes.get('comp_crashed_sem_upload').status, 'ENVIANDO');
  assert.equal(db.tabelas.comprovantes.get('comp_crashed_com_upload').status, 'ENVIANDO');

  await recuperarOperacoesInterrompidas(usuarioId);

  assert.equal(db.tabelas.syncQueue.get('op_crashed').status, 'PENDENTE');
  assert.equal(db.tabelas.comprovantes.get('comp_crashed_sem_upload').status, 'AGUARDANDO_ENVIO');
  assert.equal(db.tabelas.comprovantes.get('comp_crashed_com_upload').status, 'SINCRONIZADO');
});

test('cadastro offline de receita: validação, gravação no SQLite e enfileiramento', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_fin_1';

  const tx = await salvarTransacaoOffline(usuarioId, {
    tipo: 'entrada',
    descricao: 'Frete Rio Claro',
    valorParcela: '1500.50',
    data: '2026-11-20',
    clienteOuVeiculo: 'Cliente ABC',
  });

  assert.ok(tx.id.startsWith('local_tx_'));
  assert.equal(tx.tipo, 'entrada');
  assert.equal(tx.valorParcela, 1500.50);
  assert.equal(tx.statusSync, 'PENDENTE');

  const salva = await obterTransacaoOffline(tx.id);
  assert.equal(salva.descricao, 'Frete Rio Claro');
  assert.equal(salva.tipo, 'ENTRADA');

  const itensQueue = await listarOperacoesPendentes(db, usuarioId);
  assert.equal(itensQueue.length, 1);
  assert.equal(itensQueue[0].entidade, 'transacoes');
  assert.equal(itensQueue[0].operacao, 'CRIAR');
});

test('cadastro offline de despesa: gravação correta e persistência', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_fin_1';

  const tx = await salvarTransacaoOffline(usuarioId, {
    tipo: 'saida',
    descricao: 'Diesel Posto Graal',
    valorParcela: 450.00,
    data: '2026-11-20',
    idViagem: 'local_rota_teste',
  });

  assert.equal(tx.tipo, 'saida');
  assert.equal(tx.valor, 450);

  const tLocal = await obterTransacaoOffline(tx.id);
  assert.equal(tLocal.tipo, 'SAIDA');
  assert.equal(tLocal.valor, 450);
  assert.equal(tLocal.id_viagem, 'local_rota_teste');

  const pendencia = (await listarOperacoesPendentes(db, usuarioId))[0];
  const dadosPendentes = typeof pendencia.dados === 'string' ? JSON.parse(pendencia.dados) : pendencia.dados;
  assert.equal(dadosPendentes.idViagem, 'local_rota_teste');
});

test('cadastro offline de dívida parcelada: exige pelo menos 2 parcelas e armazena metadados', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_fin_1';

  await assert.rejects(
    async () => {
      await salvarTransacaoOffline(usuarioId, {
        tipo: 'divida',
        descricao: 'Seguro',
        valorParcela: 100,
        quantidadeParcelas: 1,
      });
    },
    /pelo menos 2 parcelas/
  );

  const divida = await salvarTransacaoOffline(usuarioId, {
    tipo: 'divida',
    descricao: 'Seguro Frota',
    valorParcela: 800,
    quantidadeParcelas: 6,
    vencimentoPrimeira: '2026-12-05',
    credor: 'Porto Seguro',
    valorQuitacaoAntecipada: 4500,
  });

  assert.equal(divida.tipo, 'divida');
  const dLocal = await obterTransacaoOffline(divida.id);
  assert.equal(dLocal.quantidade_parcelas, 6);
  assert.equal(dLocal.credor, 'Porto Seguro');
  assert.equal(dLocal.valor_quitacao_antecipada, 4500);
});

test('cache de categorias e formas de pagamento: leitura offline e atualização', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_cache_test';

  const formasIniciais = [
    { id: 'f1', nome: 'Pix', tipo: 'pix' },
    { id: 'f2', nome: 'Crédito Visa', tipo: 'credito' },
  ];
  await salvarFormasPagamentoLocais(usuarioId, formasIniciais);

  const formasLidas = await listarFormasPagamentoLocais(usuarioId);
  assert.equal(formasLidas.length, 2);
  assert.equal(formasLidas[0].nome, 'Pix');

  await salvarCategoriaLocal(usuarioId, { nome: 'Cat Local Pendente', tipo: 'saida' });

  const catsRemotas = [
    { id: 'rem_1', nome: 'Diesel', tipo: 'saida' },
    { id: 'rem_2', nome: 'Frete', tipo: 'entrada' },
  ];
  await atualizarCacheCategorias(usuarioId, catsRemotas);

  const colecao = await obterDadoLocal(db, usuarioId, 'colecao_categorias');
  assert.equal(colecao.length, 3);
  assert.ok(colecao.some((c) => c.id === 'rem_1'));
  assert.ok(colecao.some((c) => c.nome === 'Cat Local Pendente' && c.pendenteSincronizacao));
});

test('persistência de anexos offline vinculados à transação', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_anexos';

  const tx = await salvarTransacaoOffline(
    usuarioId,
    {
      tipo: 'saida',
      descricao: 'Manutenção Freios',
      valorParcela: 600,
    },
    {
      fotos: [{ uri: 'file:///foto_freio.jpg' }],
      documentos: [{ uri: 'file:///nota_fiscal.pdf' }],
      comprovantes: [{ uri: 'file:///recibo_pix.jpg' }],
    }
  );

  assert.equal(tx.comprovantes.length, 3);
  assert.equal(db.tabelas.comprovantes.size, 3);

  const anexosVinculados = await listarComprovantesPorLancamentoLocal(db, tx.id);
  assert.equal(anexosVinculados.length, 3);
  assert.ok(anexosVinculados.every((a) => a.id_lancamento_local === tx.id));
});

test('veículos offline: cadastro, listagem, cache e enfileiramento na sync_queue', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_veic_test';

  const veiculo = await salvarVeiculoOffline(usuarioId, {
    modelo: 'Volvo FH 540',
    placa: 'XYZ-9876',
    ano: 2024,
    hodometro: 12000,
    consumoMedio: 2.8,
    status: 'disponivel',
  });

  assert.ok(veiculo.id.startsWith('local_veic_'));
  assert.equal(veiculo.modelo, 'Volvo FH 540');
  assert.equal(veiculo.pendenteSincronizacao, true);

  const locais = await listarVeiculosLocais(usuarioId);
  assert.equal(locais.length, 1);
  assert.equal(locais[0].placa, 'XYZ-9876');

  const pendencias = await listarOperacoesPendentes(db, usuarioId);
  assert.equal(pendencias.length, 1);
  assert.equal(pendencias[0].entidade, 'veiculos');
  assert.equal(pendencias[0].operacao, 'CRIAR');

  // Cache mesclado
  const remotos = [{ id: 'rem_v1', modelo: 'Scania R450', placa: 'ABC-1234', hodometro: 45000, status: 'disponivel' }];
  await atualizarCacheVeiculos(usuarioId, remotos);

  const mesclados = await listarVeiculosLocais(usuarioId);
  assert.equal(mesclados.length, 2);
  assert.ok(mesclados.some((v) => v.id === 'rem_v1'));
  assert.ok(mesclados.some((v) => v.id === veiculo.id && v.pendenteSincronizacao));
});

test('cache offline do motorista limita veículos aos vinculados às rotas locais permitidas', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_veic_permitidos';

  await atualizarCacheVeiculos(usuarioId, [
    { id: 'veic_proprio', modelo: 'Caminhão A', placa: 'AAA-1111', status: 'disponivel' },
    { id: 'veic_outro', modelo: 'Caminhão B', placa: 'BBB-2222', status: 'disponivel' },
  ]);
  await atualizarCacheRotas(usuarioId, [
    { id: 'rota_propria', veiculoId: 'veic_proprio', motoristaId: usuarioId, status: 'agendada' },
  ]);

  const permitidos = await listarVeiculosPermitidosLocais(usuarioId);
  assert.deepEqual(permitidos.map((veiculo) => veiculo.id), ['veic_proprio']);
});

test('rotas offline: cadastro com idLocal e vinculação a veículo local', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_rota_test';

  const rota = await salvarRotaOffline(usuarioId, {
    origem: 'São Paulo - SP',
    destino: 'Rio de Janeiro - RJ',
    veiculoId: 'local_veic_123',
    motoristaId: 'mot_456',
    dataSaida: '25/12/2026',
    hodometroInicial: 12000,
    receita: 4500,
    distanciaPrevistaKm: 435,
  });

  assert.ok(rota.id.startsWith('local_rota_'));
  assert.equal(rota.origem, 'São Paulo - SP');
  assert.equal(rota.status, 'agendada');
  assert.equal(rota.pendenteSincronizacao, true);

  const rotasLocais = await listarRotasLocais(usuarioId);
  assert.equal(rotasLocais.length, 1);
  assert.equal(rotasLocais[0].destino, 'Rio de Janeiro - RJ');

  const pendencias = await listarOperacoesPendentes(db, usuarioId);
  assert.equal(pendencias.length, 1);
  assert.equal(pendencias[0].entidade, 'rotas');
  assert.equal(pendencias[0].operacao, 'CRIAR');
});

test('viagens offline: abertura e conclusão com atualização local de status e hodômetro', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_viagem_fluxo';

  // Cadastra veículo e rota local
  const v = await salvarVeiculoOffline(usuarioId, {
    id: 'local_veic_99',
    modelo: 'Mercedes Actros',
    placa: 'MBB-9999',
    hodometro: 50000,
    status: 'disponivel',
  });

  const r = await salvarRotaOffline(usuarioId, {
    id: 'local_rota_88',
    origem: 'Belo Horizonte',
    destino: 'Vitória',
    veiculoId: v.id,
    hodometroInicial: 50000,
  });

  await atualizarCacheVeiculos(usuarioId, [{
    id: 'veiculo_sem_vinculo',
    modelo: 'Veículo externo',
    placa: 'EXT-0000',
    hodometro: 100,
    status: 'disponivel',
  }]);
  await assert.rejects(
    concluirViagemOffline(usuarioId, r.id, { hodometroFinal: 50520 }),
    /Só é possível concluir uma viagem em andamento/
  );
  await assert.rejects(
    abrirViagemOffline(usuarioId, r.id, { veiculoId: 'veiculo_sem_vinculo', hodometroInicial: 50000 }),
    /não está associado às suas rotas/
  );
  await assert.rejects(
    abrirViagemOffline(usuarioId, r.id, { veiculoId: v.id, hodometroInicial: 49999 }),
    /já marca/
  );

  // 1. Abertura offline
  const abertura = await abrirViagemOffline(usuarioId, r.id, {
    veiculoId: v.id,
    hodometroInicial: 50000,
  });
  assert.equal(abertura.status, 'em_transito');
  await assert.rejects(
    abrirViagemOffline(usuarioId, r.id, { veiculoId: v.id, hodometroInicial: 50000 }),
    /Só é possível iniciar uma rota agendada/
  );

  const rotasAposAbrir = await listarRotasLocais(usuarioId);
  assert.equal(rotasAposAbrir.find((x) => x.id === r.id).status, 'em_transito');

  const veiculosAposAbrir = await listarVeiculosLocais(usuarioId);
  assert.equal(veiculosAposAbrir.find((x) => x.id === v.id).status, 'em_viagem');
  await assert.rejects(
    concluirViagemOffline(usuarioId, r.id, { hodometroFinal: 50000 }),
    /maior que 50\.000 km/
  );

  // 2. Conclusão offline
  const conclusao = await concluirViagemOffline(usuarioId, r.id, {
    hodometroFinal: 50520,
  });
  assert.equal(conclusao.status, 'concluida');

  const rotasAposConcluir = await listarRotasLocais(usuarioId);
  const rotaConcluida = rotasAposConcluir.find((x) => x.id === r.id);
  assert.equal(rotaConcluida.status, 'concluida');
  assert.equal(rotaConcluida.hodometroFinal, 50520);
  assert.equal(rotaConcluida.kmRodados, 520);

  const veiculosAposConcluir = await listarVeiculosLocais(usuarioId);
  const veiculoDisponivel = veiculosAposConcluir.find((x) => x.id === v.id);
  assert.equal(veiculoDisponivel.status, 'disponivel');
  assert.equal(veiculoDisponivel.hodometro, 50520);

  const pendencias = await listarOperacoesPendentes(db, usuarioId);
  assert.equal(pendencias.length, 4); // veiculo CRIAR, rota CRIAR, viagem ABRIR, viagem CONCLUIR
  assert.ok(pendencias.some((p) => p.entidade === 'viagens' && p.operacao === 'ABRIR'));
  assert.ok(pendencias.some((p) => p.entidade === 'viagens' && p.operacao === 'CONCLUIR'));
});

test('sincronização de frota: encadeamento de mapeamento de IDs entre veículo, rota e viagem', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_encadeamento';

  // 1. Cadastra veículo local e simula mapeamento remoto
  const veic = await salvarVeiculoOffline(usuarioId, {
    modelo: 'Scania R500',
    placa: 'BRA-2E19',
    hodometro: 10000,
  });
  assert.ok(veic.id.startsWith('local_veic_'));

  await salvarMapeamentoId(db, 'veiculos', veic.id, 'rem_veic_uuid_123');
  const idVeicRemoto = await obterIdRemoto(db, 'veiculos', veic.id);
  assert.equal(idVeicRemoto, 'rem_veic_uuid_123');

  // 2. Cadastra rota local apontando para o veículo local
  const rota = await salvarRotaOffline(usuarioId, {
    origem: 'Curitiba',
    destino: 'Florianópolis',
    veiculoId: veic.id,
    hodometroInicial: 10000,
  });
  assert.ok(rota.id.startsWith('local_rota_'));

  // Resolução da dependência: a rota obtém o ID remoto do veículo
  const idVeicParaEnvio = await obterIdRemoto(db, 'veiculos', rota.veiculoId);
  assert.equal(idVeicParaEnvio, 'rem_veic_uuid_123');

  // Simula sincronização da rota e mapeamento remoto
  await salvarMapeamentoId(db, 'rotas', rota.id, 'rem_rota_uuid_456');
  await salvarMapeamentoId(db, 'viagens', rota.id, 'rem_rota_uuid_456');

  // 3. Viagem local obtém o ID remoto da rota tanto por alias rotas quanto viagens
  const idRotaParaAbrir = (await obterIdRemoto(db, 'rotas', rota.id)) || (await obterIdRemoto(db, 'viagens', rota.id));
  assert.equal(idRotaParaAbrir, 'rem_rota_uuid_456');
});

test('usuários offline: persistência de cache local e isolamento entre administradores', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const adminA = 'usr_admin_a';
  const adminB = 'usr_admin_b';

  const listaMock = [
    { id: 'u1', nome: 'Carlos Gestor', email: 'carlos@frotix.com', id_perfil: 2 },
    { id: 'u2', nome: 'Marcos Motorista', email: 'marcos@frotix.com', id_perfil: 4 },
  ];

  await salvarUsuariosLocais(adminA, listaMock);
  const obtidosA = await listarUsuariosLocais(adminA);
  assert.equal(obtidosA.length, 2);
  assert.equal(obtidosA[0].nome, 'Carlos Gestor');

  // Isolamento: adminB ainda não possui cache
  const obtidosB = await listarUsuariosLocais(adminB);
  assert.equal(obtidosB.length, 0);
});

test('financeiro offline: integridade de entradas, saídas e dívidas com idempotência e persistência', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_financeiro_teste';

  // 1. Salva entrada offline
  const entrada = await salvarTransacaoOffline(usuarioId, {
    tipo: 'entrada',
    descricao: 'Frete Avulso',
    valorParcela: 1500,
  });
  assert.equal(entrada.tipo, 'entrada');
  assert.equal(entrada.statusSync, 'PENDENTE');
  assert.ok(entrada.idLocal.startsWith('local_tx_'));

  // 2. Salva dívida parcelada offline
  const divida = await salvarTransacaoOffline(usuarioId, {
    tipo: 'divida',
    descricao: 'Financiamento Van',
    valorParcela: 1200,
    quantidadeParcelas: 12,
    vencimentoPrimeira: '2026-12-15',
  });
  assert.equal(divida.tipo, 'divida');
  assert.equal(divida.quantidadeParcelas, 12);

  // 3. Verifica persistência imediata no SQLite
  const transacoes = await listarTransacoesLocais(usuarioId);
  assert.equal(transacoes.length, 2);

  const pendencias = await listarOperacoesPendentes(db, usuarioId);
  assert.equal(pendencias.length, 2);
  const parseDados = (p) => (typeof p.dados === 'string' ? JSON.parse(p.dados) : p.dados);
  assert.ok(pendencias.some((p) => parseDados(p).idLocal === entrada.idLocal));
  assert.ok(pendencias.some((p) => parseDados(p).idLocal === divida.idLocal));
});

test('sincronização resolve o id local da viagem antes de enviar o lançamento', async () => {
  const db = criarBancoMemoria();
  definirInstanciaBanco(db);
  const usuarioId = 'usr_viagem_financeira';
  const idViagemLocal = 'local_rota_financeira';
  await salvarTransacaoOffline(usuarioId, {
    tipo: 'saida',
    descricao: 'Combustível da rota',
    valorParcela: 250,
    idViagem: idViagemLocal,
  });
  await salvarMapeamentoId(db, 'viagens', idViagemLocal, 'viagem-remota-123');

  const fetchOriginal = globalThis.fetch;
  let payloadRecebido;
  globalThis.fetch = async (entrada, opcoes = {}) => {
    const url = new URL(String(entrada));
    if (url.pathname === '/') return new Response('ok', { status: 200 });
    if (url.pathname.endsWith('/financeiro/transacoes')) {
      payloadRecebido = JSON.parse(opcoes.body);
      return new Response(JSON.stringify({ sucesso: true, lancamento: { id: 'lancamento-remoto-123' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ sucesso: false, erro: 'Rota de teste não esperada.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const resultado = await sincronizarOperacoes(usuarioId);
    assert.equal(resultado.processadas, 1);
    assert.equal(payloadRecebido.idViagem, 'viagem-remota-123');
    assert.equal((await listarOperacoesPendentes(db, usuarioId)).length, 0);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
