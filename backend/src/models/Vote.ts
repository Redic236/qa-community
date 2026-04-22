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

export const VOTE_TARGET_TYPE = {
  QUESTION: 'question',
  ANSWER: 'answer',
} as const;

export type VoteTargetType = (typeof VOTE_TARGET_TYPE)[keyof typeof VOTE_TARGET_TYPE];

export class Vote extends Model<
  InferAttributes<Vote>,
  InferCreationAttributes<Vote>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User['id']>;
  declare targetType: VoteTargetType;
  declare targetId: number;
  declare createdAt: CreationOptional<Date>;
}

export const initVoteModel = (sequelize: Sequelize): void => {
  Vote.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      targetType: {
        type: DataTypes.ENUM(VOTE_TARGET_TYPE.QUESTION, VOTE_TARGET_TYPE.ANSWER),
        allowNull: false,
      },
      targetId: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'votes',
      modelName: 'Vote',
      underscored: true,
      updatedAt: false,
      indexes: [
        { unique: true, fields: ['user_id', 'target_type', 'target_id'] },
        { fields: ['target_type', 'target_id'] },
      ],
    }
  );
};
