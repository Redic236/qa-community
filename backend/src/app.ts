import express from 'express';
import cors from 'cors';
import { sequelize } from './models';
import { env } from './config/env';
import { redis } from './config/redis';
import apiRouter from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { initI18n, i18next, i18nextMiddleware } from './i18n';
import { NotificationStream, type PubSubAdapter } from './services/NotificationStream';

export const app = express();

// Detect language from Accept-Language and expose req.t() before any handler
// can throw. Resources are bundled at import time so init is synchronous.
initI18n();
app.use(cors({ exposedHeaders: ['Content-Language'] }));
app.use(i18nextMiddleware.handle(i18next));
app.use(express.json());

// Wire SSE pub/sub. With Redis available, every replica publishes notifications
// onto a shared channel; each replica's subscriber fans out to its own local
// SSE clients. Without Redis, we stay single-instance and fanout in-process.
if (redis) {
  // ioredis requires a SECOND connection for subscribe mode — once a connection
  // enters SUBSCRIBE it can't issue normal commands.
  const publisher = redis;
  const subscriber = publisher.duplicate();
  subscriber.on('error', (err) => {
    console.warn('[redis-sub] connection error:', err.message);
  });
  const adapter: PubSubAdapter = {
    publish: (channel, message) => publisher.publish(channel, message).then(() => undefined),
    subscribe: (channel, handler) =>
      subscriber.subscribe(channel).then(() => {
        subscriber.on('message', (ch, msg) => {
          if (ch === channel) handler(msg);
        });
      }),
  };
  NotificationStream.initPubSub(adapter);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  try {
    await sequelize.authenticate();
    // Schema management:
    //   - test: SQLite in-memory; create schema via sync() so E2E or a detached
    //     test server starts with empty but valid tables. Jest uses its own
    //     beforeAll sync({force:true}) so it doesn't depend on this branch.
    //   - dev/prod: migrations via `npm run db:migrate`. Warn loudly if tables
    //     haven't been created yet rather than silently booting a broken server.
    if (env.NODE_ENV === 'test') {
      await sequelize.sync({ force: true });
    } else {
      const [existing] = await sequelize.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users' LIMIT 1"
      );
      if (!Array.isArray(existing) || existing.length === 0) {
        console.warn(
          '[qa-community] users table not found — run `npm run db:migrate` before using the API.'
        );
      }
    }
    app.listen(env.PORT, () => {
      console.log(`[qa-community] listening on :${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  void bootstrap();
}
