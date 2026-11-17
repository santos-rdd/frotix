import { Router } from 'express';
import multer from 'multer';
import financialController from '../controllers/financialController.js';

const router = Router();

const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    ALLOWED_RECEIPT_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error('INVALID_FILE_TYPE'))
});

const receiptUpload = (req, res, next) => {
  upload.single('comprovante')(req, res, (err) => {
    if (!err) return next();
    const mensagem =
      err.code === 'LIMIT_FILE_SIZE' ? 'O comprovante deve ter no máximo 5 MB.'
      : err.message === 'INVALID_FILE_TYPE' ? 'Envie o comprovante em JPG, PNG, WEBP ou PDF.'
      : 'Não foi possível ler o arquivo enviado.';
    return res.status(400).json({ sucesso: false, mensagem });
  });
};

router.post('/transactions', receiptUpload, financialController.createTransaction);
router.get('/transactions', financialController.listTransactions);
router.patch('/transactions/:id/pay', financialController.payTransaction);

router.post('/financings', financialController.createFinancing);
router.get('/financings/:id', financialController.getFinancing);

router.get('/projection', financialController.getCashProjection);

export default router;