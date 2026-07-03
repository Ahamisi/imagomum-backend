'use strict';

/**
 * Adds content_topics.is_library. Library topics power the category "browse"
 * tabs (week-agnostic, real-source-backed) and are excluded from the weekly
 * delivery (which stays week-tailored). Idempotent.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('content_topics');
    if (!table.is_library) {
      await queryInterface.addColumn('content_topics', 'is_library', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      await queryInterface.addIndex('content_topics', ['is_library']);
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('content_topics', 'is_library');
  }
};
