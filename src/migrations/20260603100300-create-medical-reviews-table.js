'use strict';

/**
 * MedicalReview (CMS spec §3.8) - the approval gate. No ContentItem reaches
 * published without a linked MedicalReview.status = approved.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('medical_reviews', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      content_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'content_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      reviewer_id: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: "Reviewer's internal ID or professional email address"
      },
      reviewer_credentials: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'e.g. "FWACOG, Consultant OB/GYN, Lagos University Teaching Hospital"'
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'needs_revision', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reviewer comments and specific change requests'
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Increments each time content is revised and re-submitted'
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

    await queryInterface.addIndex('medical_reviews', ['content_item_id']);
    await queryInterface.addIndex('medical_reviews', ['status']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('medical_reviews');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_medical_reviews_status";');
  }
};
