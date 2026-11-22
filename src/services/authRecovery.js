import { API_URL } from '../config/api.js';

async function postJson(path, body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Tente novamente quando estiver online.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.mensagem || 'Não foi possível concluir a solicitação.');
  }
  return data;
}

export function solicitarRecuperacaoSenha(email) {
  return postJson('/auth/password/recovery', { email });
}

export function concluirRecuperacaoSenha({ token_hash, access_token, refresh_token, password }) {
  return postJson('/auth/password/recovery/complete', {
    token_hash,
    access_token,
    refresh_token,
    password,
  });
}
