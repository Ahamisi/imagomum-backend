'use strict';

/**
 * MediaAsset (CMS spec §3.5) - image/video/infographic attached to a ContentItem.
 * For YouTube, only youtube_video_id is stored; embed/thumbnail URLs are built
 * at render time.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('media_assets', {
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
      type: {
        type: Sequelize.ENUM('image', 'video_embed', 'video_file', 'infographic'),
        allowNull: false,
        comment: 'Asset type drives which component the app uses'
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'CDN URL for hosted assets; embed URL for video_embed type'
      },
      thumbnail_url: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Video or audio duration in seconds'
      },
      youtube_video_id: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'YouTube video ID only - embed and thumbnail URLs constructed at render time'
      },
      video_channel: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Channel name for attribution: e.g. "NHS England", "WHO Official"'
      },
      license_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      alt_text: {
        type: Sequelize.STRING(300),
        allowNull: true,
        comment: 'Accessibility description for image and infographic types'
      },
      caption_available: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True if subtitles exist - important for Yoruba/Hausa/Igbo videos'
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

    await queryInterface.addIndex('media_assets', ['content_item_id']);
    await queryInterface.addIndex('media_assets', ['type']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('media_assets');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_media_assets_type";');
  }
};
