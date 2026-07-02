'use strict';

/**
 * WeeklyDelivery (CMS spec §3.6) - one record per user per gestational week,
 * fetched by the mobile app and rendered as the Stories experience.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weekly_deliveries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      gestational_week: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '1-42'
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the delivery is due to be sent'
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Actual send time; null until the scheduler fires'
      },
      personalization_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Immutable copy of UserProfile fields used at delivery time (audit trail)'
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'delivered', 'opened', 'completed'),
        allowNull: false,
        defaultValue: 'scheduled',
        comment: 'Engagement state of this delivery'
      },
      engagement_score: {
        type: Sequelize.FLOAT,
        allowNull: true,
        comment: 'Proportion of topics opened and completed by the user (0-1)'
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
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    await queryInterface.addIndex('weekly_deliveries', ['user_id']);
    await queryInterface.addIndex('weekly_deliveries', ['user_id', 'gestational_week'], { unique: true });
    await queryInterface.addIndex('weekly_deliveries', ['status']);
    await queryInterface.addIndex('weekly_deliveries', ['scheduled_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('weekly_deliveries');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_weekly_deliveries_status";');
  }
};
