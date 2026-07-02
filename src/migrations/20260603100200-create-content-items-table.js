'use strict';

/**
 * ContentItem (CMS spec §3.3) - a single localised, reviewable unit of content.
 *
 * review_id intentionally has NO database-level FK constraint: ContentItem and
 * MedicalReview reference each other circularly. The medical_reviews table owns
 * the enforced FK (content_item_id -> content_items); the Sequelize association
 * layer wires ContentItem.reviewId -> MedicalReview for query convenience.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_items', {
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
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Markdown'
      },
      content_type: {
        type: Sequelize.ENUM(
          'tip', 'nutrition', 'baby_dev', 'warning_sign', 'scan_info',
          'mental_health', 'antenatal_prep', 'exercise'
        ),
        allowNull: false
      },
      gestational_week_min: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '1-42'
      },
      gestational_week_max: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '1-42'
      },
      trimester: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '1|2|3'
      },
      source_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'content_sources', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      source_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      localized_for_nigeria: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      cultural_context: {
        type: Sequelize.ENUM('universal', 'nigerian', 'west_african'),
        allowNull: false,
        defaultValue: 'universal'
      },
      tags: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('draft', 'under_review', 'approved', 'published', 'archived'),
        allowNull: false,
        defaultValue: 'draft'
      },
      review_id: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Latest MedicalReview (no DB FK - circular ref, see medical_reviews)'
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

    await queryInterface.addIndex('content_items', ['status']);
    await queryInterface.addIndex('content_items', ['content_type']);
    await queryInterface.addIndex('content_items', ['gestational_week_min', 'gestational_week_max']);
    await queryInterface.addIndex('content_items', ['source_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('content_items');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_items_content_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_items_cultural_context";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_items_status";');
  }
};
