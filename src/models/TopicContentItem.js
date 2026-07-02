const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Ordered junction between ContentTopic and ContentItem (CMS spec §3.9).
 * Not paranoid: links are hard-deleted when an item is removed from a topic.
 */
const TopicContentItem = sequelize.define('TopicContentItem', {
  topicId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    field: 'topic_id'
  },
  contentItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    field: 'content_item_id'
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'display_order',
    comment: 'Sequence of items within the topic story flow'
  }
}, {
  tableName: 'topic_content_items',
  timestamps: true,
  paranoid: false,
  underscored: true,
  indexes: [
    { fields: ['topic_id', 'display_order'] }
  ]
});

module.exports = TopicContentItem;
