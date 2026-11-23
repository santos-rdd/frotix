import { API_URL } from '../config/api.js';
import {
  abrirBanco,
  listarOperacoesPendentes,
  marcarOperacaoProcessando,
  marcarOperacaoPendente,
  marcarOperacaoFalha,
  recuperarOperacoesEmProcessamento,
  recuperarComprovantesPresos,
  removerOperacaoSync,
  salvarMapeamentoId,
  obterIdRemoto,
  obterComprovanteLocal,
  atualizarStatusComprovante,
  atualizarStatusTransacaoLocal,
  obterDadoLocal,
  salvarDadoLocal,
} from '../database/index.js';
import {
  criarCategoria,
  listarCategorias,
  removerCategoria,
  enviarComprovante,
  registrarTransacao,
  cadastrarVeiculo,
  listarVeiculos,
  cadastrarRota,
  abrirViagem,
  concluirViagem,
} from './frotix.js';
import { obterUsuarioLogado } from './api.js';
import {
  sincronizarPosicoesGpsDaViagem,
  sincronizarPosicoesGpsPendentes,
} from './rastreamentoGpsService.js';

let sincronizacaoEmAndamento = false;
let instanciaNetInfo = null;
let monitorSubscricao = null;
let monitorTimer = null;

export function definirNetInfo(instancia) {
  instanciaNetInfo = instancia;
}

async function carregarNetInfo() {
  if (instanciaNetInfo) return instanciaNetInfo;
  try {
    const mod = await import('@react-native-community/netinfo');
    return mod.default || mod;
  } catch {
    return null;
  }
}

export async function verificarDisponibilidadeBackend() {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3000);
    const resposta = await fetch(`${API_URL}/`, {
      method: 'GET',
      signal: controller?.signal,
    });
    clearTimeout(timeoutId);
    return resposta.ok;
  } catch {
    return false;
  }
}

export async function recuperarOperacoesInterrompidas(usuarioId = null) {
  try {
    const db = await abrirBanco();
    await recuperarOperacoesEmProcessamento(db, usuarioId);
    await recuperarComprovantesPresos(db, usuarioId);
  } catch {}
}

export async function sincronizarOperacoes(usuarioId) {
  if (!usuarioId) {
    return { sucesso: false, motivo: 'usuario_invalido' };
  }

  if (sincronizacaoEmAndamento) {
    return { sucesso: false, motivo: 'ocupado' };
  }

  sincronizacaoEmAndamento = true;

  try {
    const online = await verificarDisponibilidadeBackend();
    if (!online) {
      const gps = await sincronizarPosicoesGpsPendentes(usuarioId);
      return {
        sucesso: false,
        motivo: 'backend_offline',
        posicoesGps: gps.processadas || 0,
      };
    }

    const db = await abrirBanco();
    const pendencias = await listarOperacoesPendentes(db, usuarioId);

    if (pendencias.length === 0) {
      const gps = await sincronizarPosicoesGpsPendentes(usuarioId);
      return { sucesso: gps.sucesso, processadas: 0, posicoesGps: gps.processadas || 0 };
    }

    let processadas = 0;

    for (const item of pendencias) {
      let dados;
      try {
        dados = typeof item.dados === 'string' ? JSON.parse(item.dados) : item.dados;
      } catch {
        dados = item.dados;
      }

      await marcarOperacaoProcessando(db, item.id);

      try {
        if (item.entidade === 'categorias') {
          if (item.operacao === 'CRIAR') {
            let categoriaRemota = null;
            try {
              categoriaRemota = await criarCategoria(dados.nome, dados.tipo);
            } catch (erroEnvio) {
              const msg = erroEnvio?.message || '';
              if (/já existe/i.test(msg)) {
                const categoriasServidor = await listarCategorias();
                categoriaRemota = (categoriasServidor || []).find(
                  (c) => c.tipo === dados.tipo && c.nome.trim().toLowerCase() === dados.nome.trim().toLowerCase()
                );
              } else {
                throw erroEnvio;
              }
            }

            if (categoriaRemota && categoriaRemota.id) {
              await salvarMapeamentoId(db, 'categorias', dados.id, categoriaRemota.id);

              const chaveColecao = 'colecao_categorias';
              const colecao = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
              const colecaoAtualizada = colecao.map((c) => {
                if (c.id === dados.id) {
                  return {
                    ...c,
                    id: categoriaRemota.id,
                    pendenteSincronizacao: false,
                  };
                }
                return c;
              });
              await salvarDadoLocal(db, usuarioId, chaveColecao, colecaoAtualizada);

              await removerOperacaoSync(db, item.id);
              processadas++;
            }
          } else if (item.operacao === 'EXCLUIR') {
            let idRemoto = dados.id;
            if (String(idRemoto).startsWith('local_')) {
              idRemoto = await obterIdRemoto(db, 'categorias', idRemoto);
            }
            if (idRemoto) {
              try {
                await removerCategoria(idRemoto);
              } catch (erroExcluir) {
                const msg = erroExcluir?.message || '';
                if (!/não encontrada|404/i.test(msg)) {
                  throw erroExcluir;
                }
              }
            }

            const chaveColecao = 'colecao_categorias';
            const colecao = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
            const colecaoAtualizada = colecao.filter((c) => c.id !== dados.id && c.id !== idRemoto);
            await salvarDadoLocal(db, usuarioId, chaveColecao, colecaoAtualizada);

            await removerOperacaoSync(db, item.id);
            processadas++;
          }
        } else if (item.entidade === 'comprovantes') {
          const idComp = dados.id || dados.idComprovante;
          const compLocal = await obterComprovanteLocal(db, idComp);

          if (!compLocal) {
            await removerOperacaoSync(db, item.id);
            continue;
          }

          if (compLocal.caminho_remoto) {
            await atualizarStatusComprovante(db, idComp, 'SINCRONIZADO', compLocal.caminho_remoto);
            await removerOperacaoSync(db, item.id);
            processadas++;
            continue;
          }

          if (compLocal.uri_local) {
            await atualizarStatusComprovante(db, idComp, 'ENVIANDO');

            let idLancamentoFinal = compLocal.id_lancamento_remoto;
            if (!idLancamentoFinal && compLocal.id_lancamento_local) {
              idLancamentoFinal = await obterIdRemoto(db, 'transacoes', compLocal.id_lancamento_local);
            }

            const caminhoRemoto = await enviarComprovante(
              {
                uri: compLocal.uri_local,
                name: compLocal.nome_arquivo,
                mimeType: compLocal.mime_type,
              },
              idLancamentoFinal
            );

            await atualizarStatusComprovante(db, idComp, 'SINCRONIZADO', caminhoRemoto);
            await removerOperacaoSync(db, item.id);
            processadas++;
          }
        } else if (item.entidade === 'transacoes') {
          const idLocal = dados.idLocal || dados.id;

          let idCatFinal = dados.idCategoria;
          if (idCatFinal && String(idCatFinal).startsWith('local_')) {
            const mapeado = await obterIdRemoto(db, 'categorias', idCatFinal);
            if (mapeado) idCatFinal = mapeado;
          }

          let idFormaFinal = dados.idFormaPagamento;
          if (idFormaFinal && String(idFormaFinal).startsWith('local_')) {
            const mapeado = await obterIdRemoto(db, 'formas_pagamento', idFormaFinal);
            if (mapeado) idFormaFinal = mapeado;
          }

          let idViagemFinal = dados.idViagem || dados.id_viagem || null;
          if (idViagemFinal && String(idViagemFinal).startsWith('local_')) {
            idViagemFinal = (await obterIdRemoto(db, 'viagens', idViagemFinal))
              || (await obterIdRemoto(db, 'rotas', idViagemFinal));
            if (!idViagemFinal) {
              throw new Error('A viagem vinculada ainda aguarda sincronização.');
            }
          }

          const anexosMontados = { fotos: [], documentos: [], comprovantes: [] };
          const anexosLocais = dados.anexosLocais || [];

          for (const anexoItem of anexosLocais) {
            const idComp = anexoItem.id || anexoItem.idComprovante;
            const compLocal = await obterComprovanteLocal(db, idComp);

            let caminhoRemoto = compLocal?.caminho_remoto;
            if (!caminhoRemoto && compLocal?.uri_local) {
              await atualizarStatusComprovante(db, idComp, 'ENVIANDO');
              caminhoRemoto = await enviarComprovante({
                uri: compLocal.uri_local,
                name: compLocal.nome_arquivo,
                mimeType: compLocal.mime_type,
              });
              await atualizarStatusComprovante(db, idComp, 'SINCRONIZADO', caminhoRemoto);
            }

            if (caminhoRemoto) {
              const tipoDestino = anexoItem.tipoAnexo === 'fotos' ? 'fotos'
                : anexoItem.tipoAnexo === 'documentos' ? 'documentos'
                : 'comprovantes';
              anexosMontados[tipoDestino].push(caminhoRemoto);
            }
          }

          const payloadEnvio = {
            idLocal,
            tipo: dados.tipo,
            descricao: dados.descricao,
            valorParcela: dados.valorParcela || dados.valor,
            valor: dados.valor || dados.valorParcela,
            idCategoria: idCatFinal,
            idFormaPagamento: idFormaFinal,
            idViagem: idViagemFinal,
            data: dados.data,
            estadoOuStatus: dados.estadoOuStatus,
            credor: dados.credor,
            quantidadeParcelas: dados.quantidadeParcelas,
            vencimentoPrimeira: dados.vencimentoPrimeira,
            valorQuitacaoAntecipada: dados.valorQuitacaoAntecipada,
            clienteOuVeiculo: dados.clienteOuVeiculo,
            anexos: anexosMontados,
          };

          const resposta = await registrarTransacao(payloadEnvio);
          const idRemoto = resposta?.financiamentoId || resposta?.lancamento?.id || idLocal;

          await salvarMapeamentoId(db, 'transacoes', idLocal, idRemoto);
          await salvarMapeamentoId(db, 'lancamentos', idLocal, idRemoto);

          await atualizarStatusTransacaoLocal(db, idLocal, 'SINCRONIZADO', idRemoto);

          const chaveColecao = 'colecao_transacoes';
          const colecao = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
          const colecaoAtualizada = colecao.map((t) => {
            if (t.id === idLocal || t.idLocal === idLocal) {
              return { ...t, idRemoto, statusSync: 'SINCRONIZADO', pendenteSincronizacao: false };
            }
            return t;
          });
          await salvarDadoLocal(db, usuarioId, chaveColecao, colecaoAtualizada);

          await removerOperacaoSync(db, item.id);
          processadas++;
        } else if (item.entidade === 'veiculos') {
          if (item.operacao === 'CRIAR') {
            let veiculoRemoto = null;
            try {
              veiculoRemoto = await cadastrarVeiculo({
                modelo: dados.modelo,
                placa: dados.placa,
                ano: dados.ano,
                hodometro: dados.hodometro,
                consumoMedio: dados.consumoMedio,
                status: dados.status,
              });
            } catch (erroEnvio) {
              const msg = erroEnvio?.message || '';
              if (/já existe|placa/i.test(msg)) {
                const lista = await listarVeiculos();
                veiculoRemoto = (lista || []).find(
                  (v) => String(v.placa).replace(/[^A-Z0-9]/gi, '').toLowerCase() === String(dados.placa).replace(/[^A-Z0-9]/gi, '').toLowerCase()
                );
              } else {
                throw erroEnvio;
              }
            }

            if (veiculoRemoto && veiculoRemoto.id) {
              await salvarMapeamentoId(db, 'veiculos', dados.id, veiculoRemoto.id);

              const chaveColecao = 'colecao_veiculos';
              const colecao = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
              const colecaoAtualizada = colecao.map((v) => {
                if (v.id === dados.id || v.idLocal === dados.id) {
                  return { ...v, id: veiculoRemoto.id, pendenteSincronizacao: false };
                }
                return v;
              });
              await salvarDadoLocal(db, usuarioId, chaveColecao, colecaoAtualizada);

              await removerOperacaoSync(db, item.id);
              processadas++;
            }
          }
        } else if (item.entidade === 'rotas') {
          if (item.operacao === 'CRIAR') {
            let idVeiculoFinal = dados.veiculoId;
            if (idVeiculoFinal && String(idVeiculoFinal).startsWith('local_')) {
              const mapeado = await obterIdRemoto(db, 'veiculos', idVeiculoFinal);
              if (mapeado) {
                idVeiculoFinal = mapeado;
              } else {

                throw new Error('Veículo vinculado ainda pendente de sincronização remota.');
              }
            }

            const rotaRemota = await cadastrarRota({
              origem: dados.origem,
              destino: dados.destino,
              veiculoId: idVeiculoFinal,
              motoristaId: dados.motoristaId,
              dataSaida: dados.dataSaida || dados.dataInicial,
              hodometroInicial: dados.hodometroInicial,
              receita: dados.receita,
              distanciaPrevistaKm: dados.distanciaPrevistaKm,
            });

            if (rotaRemota && rotaRemota.id) {
              await salvarMapeamentoId(db, 'rotas', dados.id, rotaRemota.id);
              await salvarMapeamentoId(db, 'viagens', dados.id, rotaRemota.id);

              const chaveColecao = 'colecao_rotas';
              const colecao = (await obterDadoLocal(db, usuarioId, chaveColecao)) || [];
              const colecaoAtualizada = colecao.map((r) => {
                if (r.id === dados.id || r.idLocal === dados.id) {
                  return { ...r, id: rotaRemota.id, pendenteSincronizacao: false };
                }
                return r;
              });
              await salvarDadoLocal(db, usuarioId, chaveColecao, colecaoAtualizada);

              await removerOperacaoSync(db, item.id);
              processadas++;
            }
          }
        } else if (item.entidade === 'viagens') {
          if (item.operacao === 'ABRIR') {
            let idRotaFinal = dados.rotaId;
            if (String(idRotaFinal).startsWith('local_')) {
              idRotaFinal = (await obterIdRemoto(db, 'rotas', idRotaFinal)) || (await obterIdRemoto(db, 'viagens', idRotaFinal));
              if (!idRotaFinal) {
                throw new Error('Rota vinculada ainda pendente de sincronização remota.');
              }
            }

            let idVeiculoFinal = dados.veiculoId;
            if (idVeiculoFinal && String(idVeiculoFinal).startsWith('local_')) {
              idVeiculoFinal = await obterIdRemoto(db, 'veiculos', idVeiculoFinal);
            }

            await abrirViagem(idRotaFinal, {
              veiculoId: idVeiculoFinal || undefined,
              hodometroInicial: dados.hodometroInicial,
            });

            await removerOperacaoSync(db, item.id);
            processadas++;
          } else if (item.operacao === 'CONCLUIR') {
            const gps = await sincronizarPosicoesGpsDaViagem(usuarioId, dados.rotaId);
            if (!gps.sucesso && gps.pendentes > 0) {
              await marcarOperacaoPendente(db, item.id, gps.erro || 'Posições GPS aguardam sincronização.');
              return { sucesso: false, processadas, posicoesGps: gps.processadas || 0 };
            }

            let idRotaFinal = dados.rotaId;
            if (String(idRotaFinal).startsWith('local_')) {
              idRotaFinal = (await obterIdRemoto(db, 'rotas', idRotaFinal)) || (await obterIdRemoto(db, 'viagens', idRotaFinal));
              if (!idRotaFinal) {
                throw new Error('Rota vinculada ainda pendente de sincronização remota.');
              }
            }

            await concluirViagem(idRotaFinal, dados.hodometroFinal);

            await removerOperacaoSync(db, item.id);
            processadas++;
          }
        }
      } catch (erroOperacao) {
        const mensagemErro = erroOperacao?.message || 'Falha de sincronização';
        const ehErroRede = /conexão|internet|network|timeout|failed|econnrefused/i.test(mensagemErro);

        if (ehErroRede) {
          await marcarOperacaoPendente(db, item.id, mensagemErro);
          if (item.entidade === 'comprovantes') {
            const idComp = dados?.id || dados?.idComprovante;
            if (idComp) {
              await atualizarStatusComprovante(db, idComp, 'AGUARDANDO_ENVIO', null, mensagemErro);
            }
          }
          break;
        } else {
          const ehDefinitivo = /inválid|obrigatór|não permitid|400|403|422/i.test(mensagemErro);
          await marcarOperacaoFalha(db, item.id, mensagemErro, ehDefinitivo);
          if (item.entidade === 'comprovantes') {
            const idComp = dados?.id || dados?.idComprovante;
            if (idComp) {
              await atualizarStatusComprovante(db, idComp, 'ERRO', null, mensagemErro);
            }
          }
        }
      }
    }

    const gps = await sincronizarPosicoesGpsPendentes(usuarioId);
    return {
      sucesso: gps.sucesso,
      processadas,
      posicoesGps: gps.processadas || 0,
    };
  } finally {
    sincronizacaoEmAndamento = false;
  }
}

export function iniciarMonitorConectividade(onSyncConcluido) {
  pararMonitorConectividade();

  let ativo = true;

  (async () => {
    const NetInfo = await carregarNetInfo();
    if (!NetInfo || !ativo) return;

    monitorSubscricao = NetInfo.addEventListener((estado) => {
      if (!ativo) return;

      const conectado = Boolean(estado?.isConnected && estado?.isInternetReachable !== false);

      if (conectado) {
        if (monitorTimer) clearTimeout(monitorTimer);
        monitorTimer = setTimeout(async () => {
          try {
            const usuario = await obterUsuarioLogado();
            const idUsuario = usuario?.id || usuario?.sub;
            if (!idUsuario) return;

            const online = await verificarDisponibilidadeBackend();
            if (!online) {
              await sincronizarPosicoesGpsPendentes(idUsuario);
              return;
            }

            await recuperarOperacoesInterrompidas(idUsuario);
            const resultado = await sincronizarOperacoes(idUsuario);

            if (resultado?.processadas > 0 && typeof onSyncConcluido === 'function') {
              onSyncConcluido(resultado);
            }
          } catch {}
        }, 1500);
      }
    });
  })();

  return () => {
    ativo = false;
    pararMonitorConectividade();
  };
}

export function pararMonitorConectividade() {
  if (monitorTimer) {
    clearTimeout(monitorTimer);
    monitorTimer = null;
  }
  if (monitorSubscricao) {
    if (typeof monitorSubscricao === 'function') {
      monitorSubscricao();
    } else if (typeof monitorSubscricao.remove === 'function') {
      monitorSubscricao.remove();
    }
    monitorSubscricao = null;
  }
}
