import { DataTypes, type QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('users', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(100), allowNull: false },
    avatar: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await queryInterface.createTable('questions', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    tags: { type: DataTypes.JSON, allowNull: false },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    views: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    answers_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    votes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_solved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('questions', ['author_id']);
  await queryInterface.addIndex('questions', ['created_at']);
  await queryInterface.addIndex('questions', ['votes']);
  await queryInterface.addIndex('questions', ['is_solved']);

  await queryInterface.createTable('answers', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'questions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    votes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_accepted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('answers', ['question_id']);
  await queryInterface.addIndex('answers', ['author_id']);

  await queryInterface.createTable('votes', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    target_type: {
      type: DataTypes.ENUM('question', 'answer'),
      allowNull: false,
    },
    target_id: { type: DataTypes.INTEGER, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('votes', {
    fields: ['user_id', 'target_type', 'target_id'],
    unique: true,
    name: 'votes_user_target_unique',
  });
  await queryInterface.addIndex('votes', ['target_type', 'target_id']);

  await queryInterface.createTable('point_records', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    type: {
      type: DataTypes.ENUM('ask', 'answer', 'accept', 'like_question', 'like_answer'),
      allowNull: false,
    },
    points: { type: DataTypes.INTEGER, allowNull: false },
    related_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
  await queryInterface.addIndex('point_records', ['user_id']);
  await queryInterface.addIndex('point_records', ['type']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('point_records');
  await queryInterface.dropTable('votes');
  await queryInterface.dropTable('answers');
  await queryInterface.dropTable('questions');
  await queryInterface.dropTable('users');
}
