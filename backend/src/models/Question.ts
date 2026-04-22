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

export class Question extends Model<
  InferAttributes<Question>,
  InferCreationAttributes<Question>
> {
  declare id: CreationOptional<number>;
  declare title: string;
  declare content: string;
  declare tags: CreationOptional<string[]>;
  declare authorId: ForeignKey<User['id']>;
  declare views: CreationOptional<number>;
  declare answersCount: CreationOptional<number>;
  declare votes: CreationOptional<number>;
  declare isSolved: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export const initQuestionModel = (sequelize: Sequelize): void => {
  Question.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(200), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      tags: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
      authorId: { type: DataTypes.INTEGER, allowNull: false },
      views: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      answersCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      votes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isSolved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'questions',
      modelName: 'Question',
      underscored: true,
      indexes: [
        { fields: ['author_id'] },
        { fields: ['created_at'] },
        { fields: ['votes'] },
        { fields: ['is_solved'] },
      ],
    }
  );
};
