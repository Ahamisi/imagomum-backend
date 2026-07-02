'use strict';

/**
 * PersonalizationRule (CMS spec §3.7) - evaluated in ascending priority order
 * against each UserProfile by the weekly scheduler.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('personalization_rules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Human-readable rule name, e.g. "GDM Nutrition Boost Wk 24"'
      },
      trigger_type: {
        type: Sequelize.ENUM('gestational_week', 'risk_flag', 'location', 'parity', 'age_group', 'language'),
        allowNull: false,
        comment: 'Which profile dimension this rule operates on'
      },
      trigger_value: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Value to match, e.g. "gestational_diabetes", "yo", "primigravida"'
      },
      content_topic_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'content_topics', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      action: {
        type: Sequelize.ENUM('include', 'exclude', 'boost_priority'),
        allowNull: false,
        comment: 'What the rule does to the matched topic in the delivery'
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Evaluation order - lower value evaluated first when rules conflict'
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Soft-toggle rules without deleting them'
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

    await queryInterface.addIndex('personalization_rules', ['active', 'priority']);
    await queryInterface.addIndex('personalization_rules', ['trigger_type', 'trigger_value']);
    await queryInterface.addIndex('personalization_rules', ['content_topic_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('personalization_rules');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_personalization_rules_trigger_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_personalization_rules_action";');
  }
};
