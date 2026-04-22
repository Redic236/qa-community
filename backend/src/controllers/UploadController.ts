import type { Request } from 'express';
import { createUpload } from '../services/UploadService';
import { AppError, UnauthorizedError } from '../utils/errors';
import { asyncHandler } from '../middleware/asyncHandler';

/**
 * POST /api/uploads/image
 *
 * Expects `multipart/form-data` with a single `file` field. Returns
 * `{ id, url }` — frontend composes `![alt](url)` markdown itself.
 */
export const createImage = asyncHandler(async (req: Request, res) => {
  if (!req.userId) throw new UnauthorizedError();
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new AppError(400, 'Please select a file to upload', 'upload.missingFile');
  const result = await createUpload({
    uploaderId: req.userId,
    buffer: file.buffer,
    mimeType: file.mimetype,
  });
  res.status(201).json({ success: true, data: result });
});
