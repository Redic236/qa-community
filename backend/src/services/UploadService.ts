import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Upload } from '../models';
import { AppError } from '../utils/errors';
import {
  UPLOAD_ALLOWED_MIME,
  UPLOAD_MAX_BYTES,
  UPLOAD_URL_PREFIX,
  type UploadMime,
} from '../utils/constants';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');

const MIME_TO_EXT: Record<UploadMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function isAllowedMime(mime: string): mime is UploadMime {
  return (UPLOAD_ALLOWED_MIME as readonly string[]).includes(mime);
}

/**
 * Validates, persists to disk, and records the ownership row.
 *
 * Returns the public URL the client should embed in markdown. Filename is
 * UUID-based — any client-supplied name is discarded (path-traversal defence
 * + avoids collisions without coordinating across users).
 */
export async function createUpload(input: {
  uploaderId: number;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ id: number; url: string }> {
  if (!isAllowedMime(input.mimeType)) {
    throw new AppError(415, 'Only png / jpg / gif / webp supported', 'upload.badType');
  }
  if (input.buffer.length > UPLOAD_MAX_BYTES) {
    throw new AppError(413, 'File too large (5MB max)', 'upload.tooLarge');
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const ext = MIME_TO_EXT[input.mimeType];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const absPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(absPath, input.buffer);

  const url = `${UPLOAD_URL_PREFIX}/${filename}`;
  const row = await Upload.create({
    uploaderId: input.uploaderId,
    filename,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    url,
  });

  return { id: row.id, url };
}

export function getUploadDir(): string {
  return UPLOAD_DIR;
}
