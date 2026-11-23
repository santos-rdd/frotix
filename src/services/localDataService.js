import {
  abrirBanco,
  adicionarOperacaoSync,
  listarOperacoesPendentes,
  contarOperacoesPendentes,
  cancelarOperacaoPorEntidadeEIdLocal,
  salvarDadoLocal,
  obterDadoLocal,
  salvarComprovanteLocal,
  listarComprovantesPorUsuario,
  salvarTransacaoLocal,
  listarTransacoesPorUsuario,
  obterTransacaoLocal,
} from '../database/index.js';
import { preservarArquivoComprovante } from './comprovanteStorageService.js';

export async function salvarCadastroLocal(usuarioId, entidade, operacao, dados) {
  if (!usuarioId) {
    throw new Error('Identificação do usuário necessária para salvar registro local.');
  }
  if (!entidade || !operacao || !dados) {
    throw new Error('Parâmetros inválidos para cadastro local.');
  }

  const db = await abrirBanco();
  const idLocal = dados.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const registro = {
    ...dados,
    id: idLocal,
    criadoEm: new Date().toISOString(),
    pendenteSincronizacao: true,
  };

  const chaveColecao = `colecao_${entidade}`;
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
  const novaColecao = [...colecaoAtual.filter((item) => item.id !== idLocal), registro];

  await salvarDadoLocal(db, usuarioId, chaveColecao, novaColecao);

  await adicionarOperacaoSync(db, {
    id: `sync_${idLocal}`,
    usuarioId,
    entidade,
    operacao,
    dados: registro,
  });

  return registro;
}

export async function listarCadastrosLocais(usuarioId, entidade) {
  if (!usuarioId || !entidade) {
    return [];
  }

  const db = await abrirBanco();
  const chaveColecao = `colecao_${entidade}`;
  const colecao = await obterDadoLocal(db, usuarioId, chaveColecao);
  return Array.isArray(colecao) ? colecao : [];
}

export async function removerCadastroLocal(usuarioId, entidade, id) {
  if (!usuarioId || !entidade || !id) {
    return;
  }

  const db = await abrirBanco();
  const chaveColecao = `colecao_${entidade}`;
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
  const itemAlvo = colecaoAtual.find((item) => item.id === id);
  const novaColecao = colecaoAtual.filter((item) => item.id !== id);

  await salvarDadoLocal(db, usuarioId, chaveColecao, novaColecao);

  const ehLocal = String(id).startsWith('local_') || Boolean(itemAlvo?.pendenteSincronizacao);

  if (ehLocal) {
    await cancelarOperacaoPorEntidadeEIdLocal(db, usuarioId, entidade, id);
  } else {
    await adicionarOperacaoSync(db, {
      id: `sync_del_${id}`,
      usuarioId,
      entidade,
      operacao: 'EXCLUIR',
      dados: { id },
    });
  }
}

export async function obterPendenciasUsuario(usuarioId) {
  if (!usuarioId) {
    return [];
  }

  const db = await abrirBanco();
  return await listarOperacoesPendentes(db, usuarioId);
}

export async function contarPendenciasUsuario(usuarioId) {
  if (!usuarioId) {
    return 0;
  }

  const db = await abrirBanco();
  return await contarOperacoesPendentes(db, usuarioId);
}

export async function salvarCategoriaLocal(usuarioId, { nome, tipo }) {
  const nomeLimpo = String(nome || '').trim();
  const tipoLimpo = String(tipo || '').toLowerCase();

  if (!nomeLimpo) {
    throw new Error('Informe o nome da categoria.');
  }
  if (!['entrada', 'saida'].includes(tipoLimpo)) {
    throw new Error('Tipo de categoria inválido.');
  }

  return await salvarCadastroLocal(usuarioId, 'categorias', 'CRIAR', {
    nome: nomeLimpo,
    tipo: tipoLimpo,
  });
}

export async function listarCategoriasLocais(usuarioId) {
  return await listarCadastrosLocais(usuarioId, 'categorias');
}

export async function atualizarCacheCategorias(usuarioId, categoriasRemotas) {
  if (!usuarioId || !Array.isArray(categoriasRemotas)) return;
  const db = await abrirBanco();
  const chave = 'colecao_categorias';
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chave)) || [];
  const pendentes = colecaoAtual.filter((c) => c.pendenteSincronizacao || String(c.id).startsWith('local_'));
  const mapa = new Map();
  for (const r of categoriasRemotas) {
    mapa.set(r.id, { ...r, pendenteSincronizacao: false });
  }
  for (const p of pendentes) {
    mapa.set(p.id, p);
  }
  await salvarDadoLocal(db, usuarioId, chave, Array.from(mapa.values()));
}

export async function salvarFormasPagamentoLocais(usuarioId, formas) {
  if (!usuarioId || !Array.isArray(formas)) return;
  const db = await abrirBanco();
  await salvarDadoLocal(db, usuarioId, 'colecao_formas_pagamento', formas);
}

export async function listarFormasPagamentoLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  const formas = await obterDadoLocal(db, usuarioId, 'colecao_formas_pagamento');
  return Array.isArray(formas) ? formas : [];
}

export async function salvarComprovanteOffline(usuarioId, uriOrigem, idLancamentoLocal = null) {
  if (!usuarioId || !uriOrigem) {
    throw new Error('Dados insuficientes para armazenar comprovante.');
  }

  const db = await abrirBanco();
  const arquivoPersistido = await preservarArquivoComprovante(uriOrigem);

  const idComprovante = await salvarComprovanteLocal(db, {
    usuarioId,
    idLancamentoLocal,
    nomeArquivo: arquivoPersistido.nomeArquivo,
    uriLocal: arquivoPersistido.uriLocal,
    mimeType: arquivoPersistido.mimeType,
    tamanhoBytes: arquivoPersistido.tamanhoBytes,
    status: 'AGUARDANDO_ENVIO',
  });

  await adicionarOperacaoSync(db, {
    id: `sync_${idComprovante}`,
    usuarioId,
    entidade: 'comprovantes',
    operacao: 'ENVIAR',
    dados: {
      id: idComprovante,
      idComprovante,
      nomeArquivo: arquivoPersistido.nomeArquivo,
      uriLocal: arquivoPersistido.uriLocal,
    },
  });

  return {
    id: idComprovante,
    uri: arquivoPersistido.uriLocal,
    nome: arquivoPersistido.nomeArquivo,
    status: 'AGUARDANDO_ENVIO',
  };
}

export async function listarComprovantesLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  return await listarComprovantesPorUsuario(db, usuarioId);
}

export async function salvarTransacaoOffline(usuarioId, dados, anexosEntrada = {}) {
  if (!usuarioId) {
    throw new Error('Identificação do usuário necessária para salvar transação local.');
  }

  const tipo = String(dados.tipo || dados.actionType || 'saida').toLowerCase();
  const descricao = String(dados.descricao || '').trim();
  const valor = parseFloat(String(dados.valorParcela || dados.valor || '0').replace(',', '.'));

  if (!descricao) {
    throw new Error('Informe a descrição.');
  }
  if (!(valor > 0)) {
    throw new Error('Informe um valor maior que zero.');
  }
  if (tipo === 'divida') {
    const qtd = parseInt(dados.quantidadeParcelas, 10);
    if (!(qtd >= 2)) {
      throw new Error('Uma dívida precisa ter pelo menos 2 parcelas.');
    }
  }

  const db = await abrirBanco();
  const idLocal = dados.id || dados.idLocal || `local_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const listaProcessar = [];
  if (Array.isArray(anexosEntrada)) {
    for (const a of anexosEntrada) {
      if (a?.uri) listaProcessar.push({ tipoAnexo: 'comprovantes', anexo: a });
    }
  } else if (anexosEntrada && typeof anexosEntrada === 'object') {
    for (const [tipoAnexo, itens] of Object.entries(anexosEntrada)) {
      if (Array.isArray(itens)) {
        for (const a of itens) {
          if (a?.uri) listaProcessar.push({ tipoAnexo, anexo: a });
        }
      }
    }
  }

  const comprovantesSalvos = [];
  for (const item of listaProcessar) {
    const arquivoPersistido = await preservarArquivoComprovante(item.anexo.uri);
    const idComp = await salvarComprovanteLocal(db, {
      usuarioId,
      idLancamentoLocal: idLocal,
      nomeArquivo: arquivoPersistido.nomeArquivo,
      uriLocal: arquivoPersistido.uriLocal,
      mimeType: arquivoPersistido.mimeType,
      tamanhoBytes: arquivoPersistido.tamanhoBytes,
      status: 'AGUARDANDO_ENVIO',
    });

    comprovantesSalvos.push({
      id: idComp,
      tipoAnexo: item.tipoAnexo,
      uri: arquivoPersistido.uriLocal,
      nome: arquivoPersistido.nomeArquivo,
      mimeType: arquivoPersistido.mimeType,
    });
  }

  const transacaoParaSalvar = {
    ...dados,
    id: idLocal,
    idLocal,
    usuarioId,
    tipo,
    descricao,
    valorParcela: valor,
    valor,
    statusSync: 'PENDENTE',
    anexosLocais: comprovantesSalvos,
  };

  await salvarTransacaoLocal(db, transacaoParaSalvar);

  const chaveColecao = 'colecao_transacoes';
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
  const novaColecao = [
    ...colecaoAtual.filter((t) => t.id !== idLocal),
    { ...transacaoParaSalvar, criadoEm: new Date().toISOString(), pendenteSincronizacao: true },
  ];
  await salvarDadoLocal(db, usuarioId, chaveColecao, novaColecao);

  await adicionarOperacaoSync(db, {
    id: `sync_${idLocal}`,
    usuarioId,
    entidade: 'transacoes',
    operacao: 'CRIAR',
    dados: transacaoParaSalvar,
  });

  return {
    id: idLocal,
    idLocal,
    ...transacaoParaSalvar,
    comprovantes: comprovantesSalvos,
  };
}

export async function listarTransacoesLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  return await listarTransacoesPorUsuario(db, usuarioId);
}

export async function obterTransacaoOffline(id) {
  if (!id) return null;
  const db = await abrirBanco();
  return await obterTransacaoLocal(db, id);
}





export async function salvarVeiculoOffline(usuarioId, dados) {
  if (!usuarioId) throw new Error('Identificação do usuário necessária para salvar veículo local.');
  if (!dados?.modelo?.trim()) throw new Error('Informe o modelo do veículo.');
  if (!dados?.placa) throw new Error('Informe a placa do veículo.');

  const db = await abrirBanco();
  const idLocal = dados.id || dados.idLocal || `local_veic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const registro = {
    ...dados,
    id: idLocal,
    idLocal,
    status: dados.status || 'disponivel',
    pendenteSincronizacao: true,
    criadoEm: new Date().toISOString(),
  };

  const chaveColecao = 'colecao_veiculos';
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
  const novaColecao = [...colecaoAtual.filter((v) => v.id !== idLocal), registro];
  await salvarDadoLocal(db, usuarioId, chaveColecao, novaColecao);

  await adicionarOperacaoSync(db, {
    id: `sync_${idLocal}`,
    usuarioId,
    entidade: 'veiculos',
    operacao: 'CRIAR',
    dados: registro,
  });

  return registro;
}

export async function listarVeiculosLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  const veiculos = await obterDadoLocal(db, usuarioId, 'colecao_veiculos');
  return Array.isArray(veiculos) ? veiculos : [];
}

export async function listarVeiculosPermitidosLocais(usuarioId) {
  if (!usuarioId) return [];

  const [veiculos, rotas] = await Promise.all([
    listarVeiculosLocais(usuarioId),
    listarRotasLocais(usuarioId),
  ]);
  const idsVeiculos = new Set(
    veiculos.flatMap((veiculo) => [veiculo.id, veiculo.idLocal]).filter(Boolean)
  );
  const idsPermitidos = new Set(
    rotas.map((rota) => rota.veiculoId).filter((id) => id && idsVeiculos.has(id))
  );

  return veiculos.filter(
    (veiculo) => idsPermitidos.has(veiculo.id) || idsPermitidos.has(veiculo.idLocal)
  );
}

export async function atualizarCacheVeiculos(usuarioId, veiculosRemotos) {
  if (!usuarioId || !Array.isArray(veiculosRemotos)) return;
  const db = await abrirBanco();
  const chave = 'colecao_veiculos';
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chave)) || [];
  const pendentes = colecaoAtual.filter((v) => v.pendenteSincronizacao || String(v.id).startsWith('local_'));
  const mapa = new Map();
  for (const r of veiculosRemotos) {
    mapa.set(r.id, { ...r, pendenteSincronizacao: false });
  }
  for (const p of pendentes) {
    mapa.set(p.id, p);
  }
  await salvarDadoLocal(db, usuarioId, chave, Array.from(mapa.values()));
}





export async function salvarRotaOffline(usuarioId, dados) {
  if (!usuarioId) throw new Error('Identificação do usuário necessária para salvar rota local.');
  if (!dados?.origem?.trim()) throw new Error('Informe a cidade de origem.');
  if (!dados?.destino?.trim()) throw new Error('Informe a cidade de destino.');

  const db = await abrirBanco();
  const idLocal = dados.id || dados.idLocal || `local_rota_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const registro = {
    ...dados,
    id: idLocal,
    idLocal,
    status: dados.status || 'agendada',
    pendenteSincronizacao: true,
    criadoEm: new Date().toISOString(),
  };

  const chaveColecao = 'colecao_rotas';
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
  const novaColecao = [...colecaoAtual.filter((r) => r.id !== idLocal), registro];
  await salvarDadoLocal(db, usuarioId, chaveColecao, novaColecao);

  await adicionarOperacaoSync(db, {
    id: `sync_${idLocal}`,
    usuarioId,
    entidade: 'rotas',
    operacao: 'CRIAR',
    dados: registro,
  });

  return registro;
}

export async function listarRotasLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  const rotas = await obterDadoLocal(db, usuarioId, 'colecao_rotas');
  return Array.isArray(rotas) ? rotas : [];
}

export async function atualizarCacheRotas(usuarioId, rotasRemotas) {
  if (!usuarioId || !Array.isArray(rotasRemotas)) return;
  const db = await abrirBanco();
  const chave = 'colecao_rotas';
  const colecaoAtual = (await obterDadoLocal(db, usuarioId, chave)) || [];
  const pendentes = colecaoAtual.filter((r) => r.pendenteSincronizacao || String(r.id).startsWith('local_'));
  const mapa = new Map();
  for (const r of rotasRemotas) {
    mapa.set(r.id, { ...r, pendenteSincronizacao: false });
  }
  for (const p of pendentes) {
    mapa.set(p.id, p);
  }
  await salvarDadoLocal(db, usuarioId, chave, Array.from(mapa.values()));
}





export async function abrirViagemOffline(usuarioId, rotaId, { veiculoId, hodometroInicial } = {}) {
  if (!usuarioId || !rotaId) throw new Error('Parâmetros insuficientes para abrir viagem localmente.');

  const db = await abrirBanco();
  const chaveRotas = 'colecao_rotas';
  const rotas = (await obterDadoLocal(db, usuarioId, chaveRotas)) || [];
  const rota = rotas.find((item) => item.id === rotaId || item.idLocal === rotaId);
  if (!rota) throw new Error('Rota não encontrada no dispositivo.');
  if (rota.status !== 'agendada') throw new Error('Só é possível iniciar uma rota agendada.');

  const idVeiculoFinal = veiculoId || rota.veiculoId;
  if (!idVeiculoFinal) throw new Error('Selecione o veículo.');
  const veiculos = (await obterDadoLocal(db, usuarioId, 'colecao_veiculos')) || [];
  const veiculo = veiculos.find(
    (item) => item.id === idVeiculoFinal || item.idLocal === idVeiculoFinal
  );
  if (!veiculo) throw new Error('Veículo não encontrado no dispositivo.');
  const associadoAsRotasPermitidas = rotas.some((item) => {
    const idAssociado = item.veiculoId;
    const veiculoAssociado = veiculos.find(
      (candidato) => candidato.id === idAssociado || candidato.idLocal === idAssociado
    );
    return idAssociado === idVeiculoFinal
      || veiculoAssociado?.id === veiculo.id
      || (veiculo.idLocal && veiculoAssociado?.idLocal === veiculo.idLocal);
  });
  if (!associadoAsRotasPermitidas) {
    throw new Error('Este veículo não está associado às suas rotas disponíveis.');
  }
  if (rota.veiculoId && String(rota.veiculoId) !== String(idVeiculoFinal)) {
    throw new Error('Esta rota está associada a outro veículo.');
  }
  if (veiculo.status !== 'disponivel') throw new Error('O veículo não está disponível.');

  const kmInicial = Number(hodometroInicial);
  if (!Number.isFinite(kmInicial) || kmInicial < 0) {
    throw new Error('Informe um hodômetro inicial válido.');
  }
  if (kmInicial < Number(veiculo.hodometro)) {
    throw new Error(`O veículo já marca ${Number(veiculo.hodometro).toLocaleString('pt-BR')} km.`);
  }

  const rotaAtualizada = rotas.map((r) => {
    if (r.id === rota.id) {
      return {
        ...r,
        status: 'em_transito',
        veiculoId: idVeiculoFinal,
        hodometroInicial: kmInicial,
        pendenteSincronizacao: true,
      };
    }
    return r;
  });
  await salvarDadoLocal(db, usuarioId, chaveRotas, rotaAtualizada);

  const veiculosAtualizados = veiculos.map((item) => (
    item.id === veiculo.id
      ? { ...item, status: 'em_viagem' }
      : item
  ));
  await salvarDadoLocal(db, usuarioId, 'colecao_veiculos', veiculosAtualizados);

  const idSync = `sync_abrir_${rota.id}_${Date.now()}`;
  await adicionarOperacaoSync(db, {
    id: idSync,
    usuarioId,
    entidade: 'viagens',
    operacao: 'ABRIR',
    dados: { rotaId: rota.id, veiculoId: idVeiculoFinal, hodometroInicial: kmInicial },
  });

  return { rotaId: rota.id, status: 'em_transito' };
}

export async function concluirViagemOffline(usuarioId, rotaId, { hodometroFinal } = {}) {
  if (!usuarioId || !rotaId) throw new Error('Parâmetros insuficientes para concluir viagem localmente.');

  const db = await abrirBanco();
  const chaveRotas = 'colecao_rotas';
  const rotas = (await obterDadoLocal(db, usuarioId, chaveRotas)) || [];
  const rota = rotas.find((item) => item.id === rotaId || item.idLocal === rotaId);
  if (!rota) throw new Error('Rota não encontrada no dispositivo.');
  if (rota.status !== 'em_transito') {
    throw new Error('Só é possível concluir uma viagem em andamento.');
  }

  const kmInicial = Number(rota.hodometroInicial);
  const kmFinal = Number(hodometroFinal);
  if (!Number.isFinite(kmInicial) || kmInicial < 0 || !Number.isFinite(kmFinal) || kmFinal <= kmInicial) {
    throw new Error(`Informe um hodômetro final maior que ${kmInicial.toLocaleString('pt-BR')} km.`);
  }

  const rotaAtualizada = rotas.map((r) => {
    if (r.id === rota.id) {
      return {
        ...r,
        status: 'concluida',
        hodometroFinal: kmFinal,
        kmRodados: kmFinal - kmInicial,
        pendenteSincronizacao: true,
      };
    }
    return r;
  });
  await salvarDadoLocal(db, usuarioId, chaveRotas, rotaAtualizada);

  const veiculos = (await obterDadoLocal(db, usuarioId, 'colecao_veiculos')) || [];
  const veiculosAtualizados = veiculos.map((item) => (
    item.id === rota.veiculoId || item.idLocal === rota.veiculoId
      ? { ...item, status: 'disponivel', hodometro: kmFinal }
      : item
  ));
  await salvarDadoLocal(db, usuarioId, 'colecao_veiculos', veiculosAtualizados);

  const idSync = `sync_concluir_${rota.id}_${Date.now()}`;
  await adicionarOperacaoSync(db, {
    id: idSync,
    usuarioId,
    entidade: 'viagens',
    operacao: 'CONCLUIR',
    dados: { rotaId: rota.id, hodometroFinal: kmFinal },
  });

  return { rotaId: rota.id, status: 'concluida' };
}





export async function listarViagensLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  const rotas = await obterDadoLocal(db, usuarioId, 'colecao_rotas');
  return Array.isArray(rotas) ? rotas : [];
}





export async function salvarUsuariosLocais(usuarioId, usuarios) {
  if (!usuarioId || !Array.isArray(usuarios)) return;
  const db = await abrirBanco();
  await salvarDadoLocal(db, usuarioId, 'colecao_usuarios', usuarios);
}

export async function listarUsuariosLocais(usuarioId) {
  if (!usuarioId) return [];
  const db = await abrirBanco();
  const usuarios = await obterDadoLocal(db, usuarioId, 'colecao_usuarios');
  return Array.isArray(usuarios) ? usuarios : [];
}
