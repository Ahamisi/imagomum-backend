'use strict';

/**
 * TopicContentItem (CMS spec §3.9) - ordered junction between ContentTopics
 * and their ContentItems.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('topic_content_items', {
      topic_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'content_topics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'content_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Sequence of items within the topic story flow'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('topic_content_items', ['topic_id', 'display_order']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('topic_content_items');
  }
};
