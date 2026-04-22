import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('comments', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    content: { type: DataTypes.STRING(500), allowNull: false },
    target_type: {
      type: DataTypes.ENUM('question', 'answer'),
      allowNull: false,
    },
    target_id: { type: DataTypes.INTEGER, allowNull: false },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('comments', ['target_type', 'target_id', 'created_at'], {
    name: 'comments_target_created_idx',
  });
  await queryInterface.addIndex('comments', ['author_id'], { name: 'comments_author_idx' });

  await queryInterface.createTable('notifications', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM(
        'question_answered',
        'answer_accepted',
        'question_liked',
        'answer_liked',
        'content_removed'
      ),
      allowNull: false,
    },
    payload: { type: DataTypes.JSON, allowNull: false },
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('notifications', ['user_id', 'read', 'created_at'], {
    name: 'notifications_user_read_created_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('notifications');
  await queryInterface.dropTable('comments');
}
