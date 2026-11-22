let instanciaFileSystem = null;

export function definirFileSystem(instancia) {
  instanciaFileSystem = instancia;
}

async function obterFileSystem() {
  if (instanciaFileSystem) return instanciaFileSystem;
  try {
    const mod = await import('expo-file-system/legacy');
    return mod.default || mod;
  } catch {
    return null;
  }
}

const DIRETORIO_PADRAO = 'frotix_comprovantes/';

export async function garantirDiretorioComprovantes() {
  const fs = await obterFileSystem();
  if (!fs) return DIRETORIO_PADRAO;
  const dir = `${fs.documentDirectory}frotix_comprovantes/`;
  const info = await fs.getInfoAsync(dir);
  if (!info.exists) {
    await fs.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function preservarArquivoComprovante(uriOrigem, nomeOriginal = null) {
  if (!uriOrigem) {
    throw new Error('URI do arquivo não informada.');
  }

  const dir = await garantirDiretorioComprovantes();

  const nomeBase = nomeOriginal || uriOrigem.split('/').pop() || 'comprovante.jpg';
  const matchExtensao = /\.(\w+)$/.exec(nomeBase);
  const extensao = matchExtensao ? matchExtensao[1].toLowerCase() : 'jpg';

  const tipos = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    pdf: 'application/pdf',
  };
  const mimeType = tipos[extensao] || 'image/jpeg';

  const nomeArquivo = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extensao}`;
  const uriDestino = `${dir}${nomeArquivo}`;

  const fs = await obterFileSystem();
  if (fs?.copyAsync) {
    await fs.copyAsync({
      from: uriOrigem,
      to: uriDestino,
    });
  }

  const infoFinal = fs?.getInfoAsync ? await fs.getInfoAsync(uriDestino) : {};

  return {
    uriLocal: uriDestino,
    nomeArquivo,
    mimeType,
    tamanhoBytes: infoFinal.size || null,
  };
}

export async function removerArquivoComprovante(uriLocal) {
  if (!uriLocal) return;
  try {
    const fs = await obterFileSystem();
    if (!fs?.getInfoAsync) return;
    const info = await fs.getInfoAsync(uriLocal);
    if (info.exists && fs.deleteAsync) {
      await fs.deleteAsync(uriLocal, { idempotent: true });
    }
  } catch {}
}
