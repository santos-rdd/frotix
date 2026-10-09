import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import financialController from '../controllers/financialController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Tipo de arquivo não permitido. Envie uma imagem JPG, PNG ou WEBP.'));
  },
});

const router = Router();

router.post('/transactions', upload.single('proof'), financialController.createTransaction);
router.post('/financings', financialController.createFinancing);
router.get('/summary', financialController.getSummary);

export default router;