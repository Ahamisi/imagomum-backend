'use strict';

/**
 * Extend ContentTopic.category with 'exercise' and 'wellness' so the mobile
 * browse tabs map to real backend categories. Additive enum values; idempotent.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_content_topics_category" ADD VALUE IF NOT EXISTS 'exercise';`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_content_topics_category" ADD VALUE IF NOT EXISTS 'wellness';`
    );
  },

  // Postgres has no safe DROP VALUE for enums; nothing to undo.
  async down() {}
};
