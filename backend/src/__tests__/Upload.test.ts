import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import request from 'supertest';

// Point uploads at a disposable tmp dir BEFORE importing the app — the
// UploadService resolves UPLOAD_DIR once at module load.
const TMP_UPLOADS = path.join(os.tmpdir(), `qa-uploads-test-${process.pid}`);
process.env.UPLOAD_DIR = TMP_UPLOADS;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('../app') as typeof import('../app');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sequelize, User, Upload } = require('../models') as typeof import('../models');

// A 1x1 transparent PNG — small but valid enough for the tests.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
  await fs.rm(TMP_UPLOADS, { recursive: true, force: true });
});

beforeEach(async () => {
  await Upload.destroy({ where: {}, truncate: true });
  await User.destroy({ where: {}, truncate: true });
});

async function registerUser(
  username: string
): Promise<{ token: string; id: number }> {
  const res = await request(app).post('/api/auth/register').send({
    username,
    email: `${username}@test.com`,
    password: 'secret123',
  });
  expect(res.status).toBe(201);
  return { token: res.body.data.token, id: res.body.data.user.id };
}

describe('POST /api/uploads/image', () => {
  test('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .attach('file', TINY_PNG, { filename: 'x.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  test('returns 400 when file field is missing', async () => {
    const alice = await registerUser('alice');
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(400);
  });

  test('rejects non-image MIME types', async () => {
    const alice = await registerUser('alice');
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('file', Buffer.from('hello world'), {
        filename: 'x.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(415);
  });

  test('rejects oversized files at multer layer', async () => {
    const alice = await registerUser('alice');
    // 6 MB > 5 MB cap; multer rejects at write time (no memory growth beyond
    // the streamed chunk boundary).
    const oversized = Buffer.alloc(6 * 1024 * 1024, 0xff);
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
  });

  test('creates an Upload row and writes the file on success', async () => {
    const alice = await registerUser('alice');
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('file', TINY_PNG, { filename: 'pic.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const { id, url } = res.body.data;
    expect(typeof id).toBe('number');
    expect(url).toMatch(/^\/uploads\/[\w-]+\.png$/);

    const row = await Upload.findByPk(id);
    expect(row).not.toBeNull();
    expect(row!.uploaderId).toBe(alice.id);
    expect(row!.mimeType).toBe('image/png');
    expect(row!.sizeBytes).toBe(TINY_PNG.length);

    const diskPath = path.join(TMP_UPLOADS, path.basename(url));
    const stat = await fs.stat(diskPath);
    expect(stat.size).toBe(TINY_PNG.length);
  });

  test('UUID filenames avoid collisions across uploads', async () => {
    const alice = await registerUser('alice');
    const a = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('file', TINY_PNG, { filename: 'pic.png', contentType: 'image/png' });
    const b = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('file', TINY_PNG, { filename: 'pic.png', contentType: 'image/png' });
    expect(a.body.data.url).not.toBe(b.body.data.url);
  });
});
