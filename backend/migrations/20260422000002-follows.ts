import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('follows', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    follower_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    target_type: {
      type: DataTypes.ENUM('user', 'question'),
      allowNull: false,
    },
    target_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  // Prevent duplicates (idempotent follow) + accelerate the hot lookups:
  //   - "does user X follow target T?" (covered by unique)
  //   - "who follows question Q?" (target_type + target_id)
  await queryInterface.addConstraint('follows', {
    fields: ['follower_id', 'target_type', 'target_id'],
    type: 'unique',
    name: 'follows_follower_target_uk',
  });
  await queryInterface.addIndex('follows', ['target_type', 'target_id'], {
    name: 'follows_target_idx',
  });

  // Extend notifications ENUM with the two follow-driven event types. MySQL
  // requires a column rewrite; SQLite treats ENUM as TEXT so it's a no-op
  // (but sequelize.sync in tests picks up the new model list anyway).
  await queryInterface.changeColumn('notifications', 'type', {
    type: DataTypes.ENUM(
      'question_answered',
      'answer_accepted',
      'question_liked',
      'answer_liked',
      'content_removed',
      'followed_question_answered',
      'followed_user_posted'
    ),
    allowNull: false,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.changeColumn('notifications', 'type', {
    type: DataTypes.ENUM(
      'question_answered',
      'answer_accepted',
      'question_liked',
      'answer_liked',
      'content_removed'
    ),
    allowNull: false,
  });
  await queryInterface.removeIndex('follows', 'follows_target_idx');
  await queryInterface.removeConstraint('follows', 'follows_follower_target_uk');
  await queryInterface.dropTable('follows');
}
