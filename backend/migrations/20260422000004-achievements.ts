import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // user_achievements — append-only ledger. Achievement definitions live in
  // code, not the DB; we only track "which user unlocked which code, when".
  await queryInterface.createTable('user_achievements', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    // Stored as VARCHAR (not ENUM) so adding new achievements in code doesn't
    // require a schema migration — the code list is the source of truth.
    achievement_code: { type: DataTypes.STRING(50), allowNull: false },
    unlocked_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await queryInterface.addConstraint('user_achievements', {
    fields: ['user_id', 'achievement_code'],
    type: 'unique',
    name: 'user_achievements_user_code_uk',
  });
  await queryInterface.addIndex('user_achievements', ['user_id'], {
    name: 'user_achievements_user_idx',
  });

  // Extend notifications ENUM with the unlock event.
  await queryInterface.changeColumn('notifications', 'type', {
    type: DataTypes.ENUM(
      'question_answered',
      'answer_accepted',
      'question_liked',
      'answer_liked',
      'content_removed',
      'followed_question_answered',
      'followed_user_posted',
      'achievement_unlocked'
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
      'content_removed',
      'followed_question_answered',
      'followed_user_posted'
    ),
    allowNull: false,
  });
  await queryInterface.removeIndex('user_achievements', 'user_achievements_user_idx');
  await queryInterface.removeConstraint('user_achievements', 'user_achievements_user_code_uk');
  await queryInterface.dropTable('user_achievements');
}
