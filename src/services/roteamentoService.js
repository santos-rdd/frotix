














const KNOWN_COORDS = {
  'campinas - sp': [-22.9056, -47.0608],
  'campinas': [-22.9056, -47.0608],
  'rio de janeiro - rj': [-22.9068, -43.1729],
  'rio de janeiro': [-22.9068, -43.1729],
  'sao paulo - sp': [-23.5505, -46.6333],
  'sao paulo': [-23.5505, -46.6333],
  'são paulo - sp': [-23.5505, -46.6333],
  'são paulo': [-23.5505, -46.6333],
  'belo horizonte - mg': [-19.9167, -43.9345],
  'belo horizonte': [-19.9167, -43.9345],
  'curitiba - pr': [-25.4284, -49.2731],
  'curitiba': [-25.4284, -49.2731],
  'santos - sp': [-23.9608, -46.3333],
  'santos': [-23.9608, -46.3333],
  'porto alegre - rs': [-30.0346, -51.2177],
  'porto alegre': [-30.0346, -51.2177],
  'brasilia - df': [-15.7975, -47.8919],
  'brasilia': [-15.7975, -47.8919],
  'brasília - df': [-15.7975, -47.8919],
  'brasília': [-15.7975, -47.8919],
  'salvador - ba': [-12.9777, -38.5016],
  'salvador': [-12.9777, -38.5016],
  'fortaleza - ce': [-3.7172, -38.5433],
  'fortaleza': [-3.7172, -38.5433],
  'recife - pe': [-8.0476, -34.8770],
  'recife': [-8.0476, -34.8770],
  'goiania - go': [-16.6869, -49.2648],
  'goiânia - go': [-16.6869, -49.2648],
  'goiania': [-16.6869, -49.2648],
  'goiânia': [-16.6869, -49.2648],
  'ribeirao preto - sp': [-21.1776, -47.8101],
  'ribeirão preto - sp': [-21.1776, -47.8101],
  'ribeirao preto': [-21.1776, -47.8101],
  'ribeirão preto': [-21.1776, -47.8101],
  'sorocaba - sp': [-23.5015, -47.4587],
  'sorocaba': [-23.5015, -47.4587],
  'florianopolis - sc': [-27.5954, -48.5480],
  'florianópolis - sc': [-27.5954, -48.5480],
  'florianopolis': [-27.5954, -48.5480],
  'florianópolis': [-27.5954, -48.5480],
  'joinville - sc': [-26.3045, -48.8487],
  'joinville': [-26.3045, -48.8487],
  'londrina - pr': [-23.3045, -51.1696],
  'londrina': [-23.3045, -51.1696],
  'maringa - pr': [-23.4210, -51.9331],
  'maringá - pr': [-23.4210, -51.9331],
  'uberlandia - mg': [-18.9186, -48.2772],
  'uberlândia - mg': [-18.9186, -48.2772],
  'juiz de fora - mg': [-21.7642, -43.3496],
  'vitoria - es': [-20.3155, -40.3128],
  'vitória - es': [-20.3155, -40.3128],
  'cuiaba - mt': [-15.6014, -56.0979],
  'cuiabá - mt': [-15.6014, -56.0979],
  'campo grande - ms': [-20.4697, -54.6201],
  'manaus - am': [-3.1190, -60.0217],
  'belem - pa': [-1.4558, -48.5039],
  'belém - pa': [-1.4558, -48.5039],
  'sao luis - ma': [-2.5387, -44.2825],
  'são luís - ma': [-2.5387, -44.2825],
  'natal - rn': [-5.7945, -35.2110],
  'joao pessoa - pb': [-7.1195, -34.8450],
  'joão pessoa - pb': [-7.1195, -34.8450],
  'maceio - al': [-9.6658, -35.7353],
  'maceió - al': [-9.6658, -35.7353],
  'aracaju - se': [-10.9472, -37.0731],
  'teresina - pi': [-5.0892, -42.8016],
};

const ATRIBUICAO = 'Dados cartográficos © OpenStreetMap contributors | Roteamento por OSRM';
const AVISO_GERAL = 'Estimativa rodoviária geral para automóveis/veículos leves; não considera restrições específicas para veículos pesados, pontes ou bloqueios temporários.';

const cacheCoordenadas = new Map();
const cacheRotas = new Map();

const pendentesGeocoding = new Map();
const pendentesRotas = new Map();

let ultimaRequisicaoNominatim = 0;
const INTERVALO_MIN_NOMINATIM_MS = 1000;

function normalizarTexto(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}




async function aguardarTaxaNominatim() {
  const agora = Date.now();
  const diferenca = agora - ultimaRequisicaoNominatim;
  if (diferenca < INTERVALO_MIN_NOMINATIM_MS) {
    const espera = INTERVALO_MIN_NOMINATIM_MS - diferenca;
    await new Promise((resolve) => setTimeout(resolve, espera));
  }
  ultimaRequisicaoNominatim = Date.now();
}

export async function obterCoordenadas(localizacao) {
  const norm = normalizarTexto(localizacao);
  if (!norm) return null;

  if (KNOWN_COORDS[norm]) return KNOWN_COORDS[norm];
  for (const [chave, coords] of Object.entries(KNOWN_COORDS)) {
    if (norm === chave || norm.startsWith(`${chave} `) || norm.includes(` - ${chave}`)) {
      return coords;
    }
  }

  if (cacheCoordenadas.has(norm)) {
    return cacheCoordenadas.get(norm);
  }

  if (pendentesGeocoding.has(norm)) {
    return pendentesGeocoding.get(norm);
  }

  const promessa = (async () => {
    try {
      await aguardarTaxaNominatim();

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = setTimeout(() => controller?.abort(), 5000);

      const termoBusca = encodeURIComponent(`${localizacao.trim()}, Brasil`);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${termoBusca}&limit=1`;

      const res = await fetch(url, {
        signal: controller?.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FrotixApp/1.0',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        cacheCoordenadas.set(norm, coords);
        return coords;
      }
      return null;
    } catch {
      return null;
    } finally {
      pendentesGeocoding.delete(norm);
    }
  })();

  pendentesGeocoding.set(norm, promessa);
  return promessa;
}




async function calcularRotaOsrm(coordsOrigem, coordsDestino) {
  const chave = `${coordsOrigem[0]},${coordsOrigem[1]};${coordsDestino[0]},${coordsDestino[1]}`;

  if (cacheRotas.has(chave)) {
    return cacheRotas.get(chave);
  }

  if (pendentesRotas.has(chave)) {
    return pendentesRotas.get(chave);
  }

  const promessa = (async () => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = setTimeout(() => controller?.abort(), 6000);

      const url = `https://router.project-osrm.org/route/v1/driving/${coordsOrigem[1]},${coordsOrigem[0]};${coordsDestino[1]},${coordsDestino[0]}?overview=false`;

      const res = await fetch(url, {
        signal: controller?.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const data = await res.json();

      if (data && data.routes && data.routes.length > 0 && typeof data.routes[0].distance === 'number') {
        const metros = data.routes[0].distance;
        const kmExato = metros / 1000;
        const km = kmExato >= 10 ? Math.round(kmExato) : Math.round(kmExato * 10) / 10;
        const info = { distanciaMetros: metros, distanciaKm: km };
        cacheRotas.set(chave, info);
        return info;
      }
      return null;
    } catch {
      return null;
    } finally {
      pendentesRotas.delete(chave);
    }
  })();

  pendentesRotas.set(chave, promessa);
  return promessa;
}
















export async function calcularDistanciaRodoviaria(origem, destino) {
  const normOrigem = normalizarTexto(origem);
  const normDestino = normalizarTexto(destino);

  if (!normOrigem || !normDestino) {
    return {
      sucesso: false,
      distanciaKm: null,
      erro: 'Informe a origem e o destino para calcular a distância.',
      provedor: 'OSRM / OpenStreetMap',
      atribuicao: ATRIBUICAO,
      avisoGeral: AVISO_GERAL,
    };
  }

  if (normOrigem === normDestino) {
    return {
      sucesso: false,
      distanciaKm: null,
      erro: 'A origem e o destino precisam ser diferentes.',
      provedor: 'OSRM / OpenStreetMap',
      atribuicao: ATRIBUICAO,
      avisoGeral: AVISO_GERAL,
    };
  }

  const chaveTexto = `${normOrigem}|${normDestino}`;
  if (cacheRotas.has(chaveTexto)) {
    const info = cacheRotas.get(chaveTexto);
    return {
      sucesso: true,
      distanciaKm: info.distanciaKm,
      distanciaMetros: info.distanciaMetros,
      provedor: 'OSRM / OpenStreetMap',
      atribuicao: ATRIBUICAO,
      avisoGeral: AVISO_GERAL,
    };
  }

  const [coordsOrigem, coordsDestino] = await Promise.all([
    obterCoordenadas(origem),
    obterCoordenadas(destino),
  ]);

  if (!coordsOrigem) {
    return {
      sucesso: false,
      distanciaKm: null,
      erro: `Não foi possível localizar as coordenadas da origem "${origem}". Você pode informar a distância manualmente.`,
      provedor: 'OSRM / OpenStreetMap',
      atribuicao: ATRIBUICAO,
      avisoGeral: AVISO_GERAL,
    };
  }

  if (!coordsDestino) {
    return {
      sucesso: false,
      distanciaKm: null,
      erro: `Não foi possível localizar as coordenadas do destino "${destino}". Você pode informar a distância manualmente.`,
      provedor: 'OSRM / OpenStreetMap',
      atribuicao: ATRIBUICAO,
      avisoGeral: AVISO_GERAL,
    };
  }

  const resultadoRota = await calcularRotaOsrm(coordsOrigem, coordsDestino);

  if (!resultadoRota) {
    return {
      sucesso: false,
      distanciaKm: null,
      erro: 'Não foi possível traçar a rota rodoviária entre os pontos. Você pode informar a distância manualmente.',
      provedor: 'OSRM / OpenStreetMap',
      atribuicao: ATRIBUICAO,
      avisoGeral: AVISO_GERAL,
    };
  }

  cacheRotas.set(chaveTexto, resultadoRota);

  return {
    sucesso: true,
    distanciaKm: resultadoRota.distanciaKm,
    distanciaMetros: resultadoRota.distanciaMetros,
    provedor: 'OSRM / OpenStreetMap',
    atribuicao: ATRIBUICAO,
    avisoGeral: AVISO_GERAL,
  };
}

export function limparCacheRoteamento() {
  cacheCoordenadas.clear();
  cacheRotas.clear();
}
