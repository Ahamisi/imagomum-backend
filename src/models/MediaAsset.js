const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MediaAsset = sequelize.define('MediaAsset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  contentItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'content_item_id'
  },
  type: {
    type: DataTypes.ENUM('image', 'video_embed', 'video_file', 'infographic'),
    allowNull: false
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'CDN URL for hosted assets; embed URL for video_embed type'
  },
  thumbnailUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'thumbnail_url'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Video or audio duration in seconds'
  },
  youtubeVideoId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'youtube_video_id',
    comment: 'YouTube video ID only - embed/thumbnail URLs constructed at render time'
  },
  videoChannel: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'video_channel'
  },
  licenseType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'license_type'
  },
  altText: {
    type: DataTypes.STRING(300),
    allowNull: true,
    field: 'alt_text'
  },
  captionAvailable: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'caption_available'
  }
}, {
  tableName: 'media_assets',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['content_item_id'] },
    { fields: ['type'] }
  ]
});

/**
 * Build the renderable YouTube embed + thumbnail URLs from the stored videoId
 * (CMS spec §5.4). Returns null when this asset is not a YouTube embed.
 */
MediaAsset.prototype.getYoutubeUrls = function () {
  if (!this.youtubeVideoId) return null;
  return {
    embedUrl: `https://www.youtube.com/embed/${this.youtubeVideoId}?rel=0&modestbranding=1`,
    thumbnailUrl: `https://img.youtube.com/vi/${this.youtubeVideoId}/hqdefault.jpg`
  };
};

module.exports = MediaAsset;
