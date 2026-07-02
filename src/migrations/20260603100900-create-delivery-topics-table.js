'use strict';

/**
 * DeliveryTopic (CMS spec §3.9) - ordered junction between WeeklyDeliveries
 * and their ContentTopics.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_topics', {
      delivery_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'weekly_deliveries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      topic_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'content_topics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Presentation order within the weekly delivery package'
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

    await queryInterface.addIndex('delivery_topics', ['delivery_id', 'display_order']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('delivery_topics');
  }
};
