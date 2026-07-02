const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WeeklyDelivery = sequelize.define('WeeklyDelivery', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  gestationalWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'gestational_week',
    validate: { min: 1, max: 42 }
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'scheduled_at'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at'
  },
  personalizationSnapshot: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'personalization_snapshot',
    comment: 'Immutable copy of UserProfile fields used at delivery time (audit trail)'
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'delivered', 'opened', 'completed'),
    allowNull: false,
    defaultValue: 'scheduled'
  },
  engagementScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    field: 'engagement_score',
    validate: { min: 0, max: 1 }
  }
}, {
  tableName: 'weekly_deliveries',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['user_id'] },
    { unique: true, fields: ['user_id', 'gestational_week'] },
    { fields: ['status'] },
    { fields: ['scheduled_at'] }
  ]
});

module.exports = WeeklyDelivery;
