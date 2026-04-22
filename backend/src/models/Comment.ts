import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
  type ForeignKey,
  type Sequelize,
} from 'sequelize';
import type { User } from './User';
import { VOTE_TARGET_TYPE, type VoteTargetType } from './Vote';

export class Comment extends Model<
  InferAttributes<Comment>,
  InferCreationAttributes<Comment>
> {
  declare id: CreationOptional<number>;
  declare content: string;
  declare targetType: VoteTargetType;
  declare targetId: number;
  declare authorId: ForeignKey<User['id']>;
  /** Nullable self-ref. Depth capped at 2 (root → direct reply) in the service. */
  declare parentId: CreationOptional<number | null>;
  declare createdAt: CreationOptional<Date>;
}

export const initCommentModel = (sequelize: Sequelize): void => {
  Comment.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      content: { type: DataTypes.STRING(500), allowNull: false },
      targetType: {
        type: DataTypes.ENUM(VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER),
        allowNull: false,
      },
      targetId: { type: DataTypes.INTEGER, allowNull: false },
      authorId: { type: DataTypes.INTEGER, allowNull: false },
      parentId: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'comments',
      modelName: 'Comment',
      underscored: true,
      updatedAt: false,
      indexes: [
        {
          fields: ['target_type', 'target_id', 'created_at'],
          name: 'comments_target_created_idx',
        },
        { fields: ['author_id'], name: 'comments_author_idx' },
        { fields: ['parent_id'], name: 'comments_parent_idx' },
      ],
    }
  );
};
