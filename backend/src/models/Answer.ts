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
import type { Question } from './Question';

export class Answer extends Model<
  InferAttributes<Answer>,
  InferCreationAttributes<Answer>
> {
  declare id: CreationOptional<number>;
  declare content: string;
  declare questionId: ForeignKey<Question['id']>;
  declare authorId: ForeignKey<User['id']>;
  declare votes: CreationOptional<number>;
  declare isAccepted: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export const initAnswerModel = (sequelize: Sequelize): void => {
  Answer.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      content: { type: DataTypes.TEXT, allowNull: false },
      questionId: { type: DataTypes.INTEGER, allowNull: false },
      authorId: { type: DataTypes.INTEGER, allowNull: false },
      votes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isAccepted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
    },
    {
      sequelize,
      tableName: 'answers',
      modelName: 'Answer',
      underscored: true,
      indexes: [
        { fields: ['question_id'] },
        { fields: ['author_id'] },
      ],
    }
  );
};
