'use strict';

/**
 * content_item_versions (CMS spec §8 Audit and Version Control) - append-only
 * history of every ContentItem.body version, the reviewer who approved each,
 * and the approval timestamp. Required for regulatory compliance.
 *
 * No deleted_at / paranoid: this table is append-only and never soft-deleted.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_item_versions', {
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
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Full snapshot of ContentItem.body at this version'
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      reviewer_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Reviewer who approved this version'
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('content_item_versions', ['content_item_id', 'version']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('content_item_versions');
  }
};
