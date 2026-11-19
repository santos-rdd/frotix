import crypto from 'crypto';
import multer from 'multer';
import supabase from '../database/db.js';
import { PERFIS } from '../middleware/auth.js';

// Erro I1: a rota POST /comprovantes/upload que o app chamava não existia.
// Os arquivos vão para o Storage do Supabase, no bucket privado "comprovantes".

export const BUCKET = 'comprovantes';
const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const TIPOS_ACEITOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

export const receberArquivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Boolean(TIPOS_ACEITOS[file.mimetype])),
}).single('comprovante');

let bucketConferido = false;
async function garantirBucket() {
  if (bucketConferido) return;
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: TAMANHO_MAXIMO,
      allowedMimeTypes: Object.keys(TIPOS_ACEITOS),
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketConferido = true;
}

/**
 * POST /comprovantes/upload  (multipart, campo "comprovante")
 * Campo opcional "idLancamento": liga o arquivo a um lançamento já existente.
 * Devolve { caminho }: guarde esse caminho no lançamento (comprovante_url).
 */
export async function enviarComprovante(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Envie uma imagem (JPG, PNG, WEBP, HEIC) ou PDF de até 10 MB no campo "comprovante".',
      });
    }

    await garantirBucket();

    const extensao = TIPOS_ACEITOS[req.file.mimetype];
    const caminho = `${req.usuario.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extensao}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;

    const idLancamento = req.body?.idLancamento;
    if (idLancamento) {
      let consulta = supabase.from('lancamentos_financeiros').update({ comprovante_url: caminho }).eq('id', idLancamento);
      // Quem não é Admin/Financeiro só anexa nos próprios lançamentos.
      if (![PERFIS.ADMIN, PERFIS.FINANCEIRO].includes(req.usuario.perfil)) consulta = consulta.eq('id_usuario', req.usuario.id);
      const { error: eL } = await consulta;
      if (eL) throw eL;
    }

    return res.status(201).json({ sucesso: true, caminho });
  } catch (e) {
    console.error('Erro ao enviar comprovante:', e);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao salvar o comprovante.' });
  }
}

/** GET /comprovantes/link?caminho=...  → link temporário (10 min) para abrir o arquivo. */
export async function linkComprovante(req, res) {
  try {
    const caminho = String(req.query.caminho || '');
    if (!caminho || caminho.includes('..')) return res.status(400).json({ sucesso: false, erro: 'Caminho inválido.' });
    const dono = caminho.split('/')[0];
    if (dono !== req.usuario.id && ![PERFIS.ADMIN, PERFIS.FINANCEIRO, PERFIS.GESTOR].includes(req.usuario.perfil)) {
      return res.status(403).json({ sucesso: false, erro: 'Seu perfil não tem acesso a este comprovante.' });
    }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 600);
    if (error) throw error;
    return res.json({ sucesso: true, url: data.signedUrl });
  } catch (e) {
    console.error('Erro ao gerar link do comprovante:', e);
    return res.status(500).json({ sucesso: false, erro: 'Erro interno ao abrir o comprovante.' });
  }
}
