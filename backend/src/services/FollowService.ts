import { Op } from 'sequelize';
import { Follow, Question, User } from '../models';
import { FOLLOW_TARGET_TYPE, type FollowTargetType } from '../models/Follow';
import { BadRequestError, NotFoundError } from '../utils/errors';

export interface ToggleFollowInput {
  followerId: number;
  targetType: FollowTargetType;
  targetId: number;
}

export interface ToggleFollowResult {
  following: boolean;
}

async function targetExists(targetType: FollowTargetType, targetId: number): Promise<boolean> {
  if (targetType === FOLLOW_TARGET_TYPE.USER) {
    return (await User.count({ where: { id: targetId } })) > 0;
  }
  return (await Question.count({ where: { id: targetId } })) > 0;
}

export class FollowService {
  static async toggle(input: ToggleFollowInput): Promise<ToggleFollowResult> {
    if (
      input.targetType === FOLLOW_TARGET_TYPE.USER &&
      input.targetId === input.followerId
    ) {
      throw new BadRequestError('Cannot follow yourself', 'cannotFollowSelf');
    }

    if (!(await targetExists(input.targetType, input.targetId))) {
      throw new NotFoundError(`${input.targetType} not found`, 'targetNotFound', {
        targetType: input.targetType,
      });
    }

    // Race-safe toggle: two concurrent follow clicks (double tap, two tabs)
    // used to race between findOne + create, with one winning and the other
    // hitting the unique-constraint and bubbling as 500. findOrCreate is
    // atomic against the uk → the loser cleanly resolves as "already
    // followed" and unwinds.
    const [, created] = await Follow.findOrCreate({
      where: {
        followerId: input.followerId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
      defaults: {
        followerId: input.followerId,
        targetType: input.targetType,
        targetId: input.targetId,
      },
    });
    if (!created) {
      // Already followed → this click was an unfollow.
      await Follow.destroy({
        where: {
          followerId: input.followerId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      });
      return { following: false };
    }
    return { following: true };
  }

  /** Return the ids of targets of a specific type that this user follows. */
  static async followedTargetIds(
    followerId: number,
    targetType: FollowTargetType
  ): Promise<number[]> {
    const rows = await Follow.findAll({
      where: { followerId, targetType },
      attributes: ['targetId'],
    });
    return rows.map((r) => r.targetId);
  }

  /** Reverse lookup: who follows this target? Used for notification fan-out. */
  static async followerIdsOf(
    targetType: FollowTargetType,
    targetId: number
  ): Promise<number[]> {
    const rows = await Follow.findAll({
      where: { targetType, targetId },
      attributes: ['followerId'],
    });
    return rows.map((r) => r.followerId);
  }

  /**
   * For a logged-in viewer, decorate a set of (targetType, targetId) pairs with
   * `following: boolean`. Single query keyed on `followerId + targetType` with
   * IN targetIds — cheap even for large pages.
   */
  static async whichAreFollowed(
    followerId: number,
    targetType: FollowTargetType,
    targetIds: number[]
  ): Promise<Set<number>> {
    if (targetIds.length === 0) return new Set();
    const rows = await Follow.findAll({
      where: {
        followerId,
        targetType,
        targetId: { [Op.in]: targetIds },
      },
      attributes: ['targetId'],
    });
    return new Set(rows.map((r) => r.targetId));
  }
}
