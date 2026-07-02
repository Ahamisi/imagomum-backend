const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Ordered junction between WeeklyDelivery and ContentTopic (CMS spec §3.9).
 * Not paranoid: a delivery's topic set is fixed at generation time.
 */
const DeliveryTopic = sequelize.define('DeliveryTopic', {
  deliveryId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    field: 'delivery_id'
  },
  topicId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    field: 'topic_id'
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'display_order',
    comment: 'Presentation order within the weekly delivery package'
  }
}, {
  tableName: 'delivery_topics',
  timestamps: true,
  paranoid: false,
  underscored: true,
  indexes: [
    { fields: ['delivery_id', 'display_order'] }
  ]
});

module.exports = DeliveryTopic;
