import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podeAcessarTela } from '../src/navigation/permissions.js';

test('motorista acessa telas operacionais e seu próprio perfil', () => {
  for (const tela of [
    'HomePage',
    'Viagens',
    'Veiculos',
    'Rotas',
    'DetalhesRota',
    'userProfile',
    'TransactionForm',
    'Extrato',
    'Dividas',
    'DetalheDivida',
  ]) {
    assert.equal(podeAcessarTela(4, tela), true, tela);
  }
});

test('motorista não acessa telas administrativas ou financeiras globais', () => {
  for (const tela of [
    'GestorHome',
    'CadastroVeiculo',
    'CadastroRota',
    'Manutencao',
    'Relatorios',
    'Categorias',
    'uploadProof',
    'Categorias',
    'RegisterUser',
    'ManageUser',
    'UserDetail',
  ]) {
    assert.equal(podeAcessarTela('4', tela), false, tela);
  }
});

test('a regra específica do motorista não restringe os demais perfis', () => {
  for (const perfil of [1, 2, 3]) {
    assert.equal(podeAcessarTela(perfil, 'CadastroVeiculo'), true);
    assert.equal(podeAcessarTela(perfil, 'Relatorios'), true);
    assert.equal(podeAcessarTela(perfil, 'ManageUser'), true);
  }
});
