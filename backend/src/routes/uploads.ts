import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import * as UploadController from '../controllers/UploadController';
import { requireAuth } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';
import { AppError } from '../utils/errors';
import { UPLOAD_MAX_BYTES } from '../utils/constants';

// Memory storage → validate + rename + write in service layer. Keeps the
// disk layout a service concern (swap for S3 later without touching routes).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
});

/**
 * Multer surfaces LIMIT_FILE_SIZE etc. as raw errors. Wrap the middleware so
 * these get funneled through our AppError → i18n pipeline instead of a 500.
 */
function uploadSingle(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(413, 'File too large', 'upload.tooLarge'));
        }
        return next(new AppError(400, err.message, 'upload.badRequest'));
      }
      return next(err);
    });
  };
}

const router = Router();

router.post('/image', requireAuth, writeLimiter, uploadSingle('file'), UploadController.createImage);

export default router;
