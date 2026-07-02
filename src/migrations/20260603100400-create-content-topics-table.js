'use strict';

/**
 * ContentTopic (CMS spec §3.4) - a Stories-card grouping of ContentItems for a
 * given gestational week.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_topics', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      subtitle: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cover_image_url: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Stories card background'
      },
      gestational_week: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '1-42'
      },
      category: {
        type: Sequelize.ENUM(
          'nutrition', 'baby_dev', 'symptoms', 'antenatal_care',
          'mental_health', 'warning_signs', 'postpartum_prep'
        ),
        allowNull: false
      },
      estimated_read_mins: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex('content_topics', ['gestational_week']);
    await queryInterface.addIndex('content_topics', ['category']);
    await queryInterface.addIndex('content_topics', ['gestational_week', 'priority']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('content_topics');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_topics_category";');
  }
};
