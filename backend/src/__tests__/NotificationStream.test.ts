import { NotificationStream, type PubSubAdapter } from '../services/NotificationStream';
import type { Notification } from '../models';

// Minimal stand-in for the SSE Response just so subscribe/fanout works in tests.
function makeFakeRes() {
  const writes: string[] = [];
  return {
    writes,
    res: {
      status: () => undefined,
      set: () => undefined,
      flushHeaders: () => undefined,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
      end: () => undefined,
    } as unknown as import('express').Response,
  };
}

function fakeNotification(extra: Record<string, unknown> = {}): Notification {
  // The real Sequelize instance has more, but `publish` only calls toJSON().
  return {
    toJSON: () => ({ id: 1, type: 'question_liked', ...extra }),
  } as unknown as Notification;
}

describe('NotificationStream — single-instance fallback', () => {
  beforeEach(() => NotificationStream.resetPubSub());

  test('publish without an adapter fans out locally', () => {
    const { res, writes } = makeFakeRes();
    const off = NotificationStream.subscribe(42, res);

    NotificationStream.publish(42, fakeNotification({ id: 99 }));

    const events = writes.filter((w) => w.startsWith('event: notification'));
    expect(events.length).toBe(1);
    const data = writes.find((w) => w.startsWith('data: ') && w.includes('"id":99'));
    expect(data).toBeTruthy();

    off();
    expect(NotificationStream.subscriberCount(42)).toBe(0);
  });

  test('publish to a user with no subscribers is a no-op', () => {
    expect(() => NotificationStream.publish(404, fakeNotification())).not.toThrow();
  });
});

describe('NotificationStream — pub/sub adapter wired', () => {
  beforeEach(() => NotificationStream.resetPubSub());

  test('publish goes through the adapter, not direct local fanout', async () => {
    const published: { channel: string; message: string }[] = [];
    let savedHandler: ((msg: string) => void) | null = null;

    const adapter: PubSubAdapter = {
      publish: (channel, message) => {
        published.push({ channel, message });
      },
      subscribe: (_channel, handler) => {
        savedHandler = handler;
      },
    };
    NotificationStream.initPubSub(adapter);
    await NotificationStream.waitForPubSubReady();

    const { res, writes } = makeFakeRes();
    NotificationStream.subscribe(7, res);

    NotificationStream.publish(7, fakeNotification({ id: 555 }));

    // Adapter received the publish.
    expect(published.length).toBe(1);
    expect(published[0].channel).toBe('qa:notifications');
    expect(JSON.parse(published[0].message)).toEqual({
      userId: 7,
      notification: { id: 555, type: 'question_liked' },
    });

    // Crucially: local fanout did NOT happen yet — that's the subscriber's job.
    expect(writes.filter((w) => w.startsWith('event: notification')).length).toBe(0);

    // Now simulate Redis delivering the message back to this instance.
    expect(savedHandler).not.toBeNull();
    savedHandler!(published[0].message);

    expect(writes.filter((w) => w.startsWith('event: notification')).length).toBe(1);
  });

  test('messages from peer instances reach local subscribers', async () => {
    let savedHandler: ((msg: string) => void) | null = null;
    const adapter: PubSubAdapter = {
      publish: () => undefined,
      subscribe: (_c, h) => {
        savedHandler = h;
      },
    };
    NotificationStream.initPubSub(adapter);
    await NotificationStream.waitForPubSubReady();

    const { res, writes } = makeFakeRes();
    NotificationStream.subscribe(123, res);

    // Pretend another replica published this — only the channel handler runs.
    savedHandler!(JSON.stringify({ userId: 123, notification: { id: 9001 } }));

    const data = writes.find((w) => w.includes('"id":9001'));
    expect(data).toBeTruthy();
  });

  test('rejected publish promise does NOT fall back to local fanout', async () => {
    // Intentional behavior: when the pub/sub adapter is wired and publish
    // rejects, we log and move on — we do NOT also deliver locally, because
    // a "publish failed" response from Redis frequently means the message
    // was delivered but the ACK was lost, so a local fallback would produce
    // a duplicate event for every connected subscriber on this instance.
    const adapter: PubSubAdapter = {
      publish: () => Promise.reject(new Error('redis is down')),
      subscribe: () => undefined,
    };
    NotificationStream.initPubSub(adapter);
    await NotificationStream.waitForPubSubReady();

    const { res, writes } = makeFakeRes();
    NotificationStream.subscribe(8, res);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    NotificationStream.publish(8, fakeNotification({ id: 1234 }));
    await Promise.resolve();
    await Promise.resolve();

    // No local fanout → no event written for that id.
    expect(writes.find((w) => w.includes('"id":1234'))).toBeFalsy();
    // But we DID log the failure.
    expect(warn).toHaveBeenCalledWith(
      '[NotificationStream] publish failed:',
      'redis is down'
    );
    warn.mockRestore();
  });
});
