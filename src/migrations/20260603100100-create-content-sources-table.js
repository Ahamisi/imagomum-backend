'use strict';

/**
 * ContentSource (CMS spec §3.2) - external/manual sources content traces back to.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_sources', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.ENUM('WHO', 'NHS', 'MedlinePlus', 'ACOG', 'FMOH', 'YouTube', 'Original'),
        allowNull: false,
        comment: 'Canonical source name'
      },
      type: {
        type: Sequelize.ENUM('api', 'manual_curation', 'original'),
        allowNull: false,
        comment: 'How content arrives from this source'
      },
      api_endpoint: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Base URL for automated API sources'
      },
      api_key_ref: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Reference to secret manager entry - never stored in plaintext'
      },
      sync_frequency: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'manual'),
        allowNull: false,
        defaultValue: 'manual',
        comment: 'How often to poll for updates'
      },
      last_synced_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp of last successful sync run'
      },
      license_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'e.g. "Open Government Licence v3.0", "CC BY-NC-SA 3.0 IGO"'
      },
      attribution_required: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether attribution must appear in the app UI'
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Soft-disable a source without deleting its content records'
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

    await queryInterface.addIndex('content_sources', ['name']);
    await queryInterface.addIndex('content_sources', ['active']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('content_sources');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_sources_name";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_sources_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_content_sources_sync_frequency";');
  }
};
