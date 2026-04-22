import type { QueryInterface } from 'sequelize';

/**
 * FULLTEXT search index for question list keyword queries.
 *
 * - MySQL-only (SQLite tests don't run migrations; they sync from models and
 *   use LIKE in the service-layer fallback).
 * - WITH PARSER ngram because Chinese/Japanese/Korean text has no whitespace;
 *   default parser would only index English word boundaries.
 * - Default `ngram_token_size` is 2, so single-char queries won't match.
 *   Queries shorter than that fall back to LIKE.
 *
 * Existing rows are indexed automatically by MySQL when the index is added.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE questions ADD FULLTEXT INDEX questions_ft_idx (title, content) WITH PARSER ngram'
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'ALTER TABLE questions DROP INDEX questions_ft_idx'
  );
}
