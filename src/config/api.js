







const RENDER_URL = 'https://frotix.onrender.com';

export const API_URL = ((typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_API_URL) || RENDER_URL).replace(/\/+$/, '');
console.log('[Config] API_URL configurada:', API_URL);
