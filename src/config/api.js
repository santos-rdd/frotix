// Endereço do backend (erro I8: a main tinha "http://localhost:3000" fixo, que não
// funciona no emulador nem no celular).
//
// Por padrão o app usa o backend do Render. Para testar com o backend rodando na sua
// máquina, crie um .env na raiz com:
//   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000   (emulador Android)
// e reinicie o Metro. Esse .env não vai para o GitHub, então ninguém precisa trocar
// este arquivo antes de fazer commit.
const RENDER_URL = 'https://frotix.onrender.com';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || RENDER_URL).replace(/\/+$/, '');
