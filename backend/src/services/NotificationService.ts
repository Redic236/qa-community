import { Op, type WhereOptions } from 'sequelize';
import { Notification } from '../models';
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from '../utils/constants';
import { NotificationStream } from './NotificationStream';

export interface NotifyInput {
  userId: number;
  type: NotificationType;
  payload: Record<string, unknown>;
}

export interface ListInput {
  userId: number;
  unreadOnly?: boolean;
  page: number;
  limit: number;
}

export interface ListResult {
  rows: Notification[];
  total: number;
  unread: number;
}

/**
 * Best-effort fire-and-(awaited)-forget notification creation. Callers should
 * invoke this AFTER their main transaction commits so a failure here doesn't
 * roll back the actual user-facing action.
 */
export class NotificationService {
  static async notify(input: NotifyInput): Promise<Notification | null> {
    try {
      const created = await Notification.create({
        userId: input.userId,
        type: input.type,
        payload: input.payload,
      });
      // Best-effort live push to any open SSE streams for this recipient. Done
      // outside the create-promise rejection path so a broken stream can't fail
      // the original write.
      NotificationStream.publish(input.userId, created);
      return created;
    } catch (err) {
      console.warn('[notify] failed:', (err as Error).message);
      return null;
    }
  }

  /** Emit only if recipient is not the actor (no self-notification noise). */
  static async notifyExceptSelf(
    recipientId: number,
    actorId: number,
    type: NotificationType,
    payload: Record<string, unknown>
  ): Promise<Notification | null> {
    if (recipientId === actorId) return null;
    return this.notify({ userId: recipientId, type, payload });
  }

  static async list(input: ListInput): Promise<ListResult> {
    const where: WhereOptions = { userId: input.userId };
    if (input.unreadOnly) where.read = false;

    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: input.limit,
      offset: (input.page - 1) * input.limit,
    });
    const unread = await Notification.count({
      where: { userId: input.userId, read: false },
    });
    return { rows, total: count, unread };
  }

  static async unreadCount(userId: number): Promise<number> {
    return Notification.count({ where: { userId, read: false } });
  }

  static async markRead(userId: number, ids: number[] | 'all'): Promise<number> {
    const where: WhereOptions = { userId, read: false };
    if (ids !== 'all') {
      if (ids.length === 0) return 0;
      where.id = { [Op.in]: ids };
    }
    const [affected] = await Notification.update({ read: true }, { where });
    return affected;
  }
}

export const NOTIF = NOTIFICATION_TYPES;
