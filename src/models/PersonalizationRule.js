const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PersonalizationRule = sequelize.define('PersonalizationRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Human-readable rule name, e.g. "GDM Nutrition Boost Wk 24"'
  },
  triggerType: {
    type: DataTypes.ENUM('gestational_week', 'risk_flag', 'location', 'parity', 'age_group', 'language'),
    allowNull: false,
    field: 'trigger_type'
  },
  triggerValue: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'trigger_value'
  },
  contentTopicId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'content_topic_id'
  },
  action: {
    type: DataTypes.ENUM('include', 'exclude', 'boost_priority'),
    allowNull: false
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Lower value evaluated first when rules conflict'
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'personalization_rules',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['active', 'priority'] },
    { fields: ['trigger_type', 'trigger_value'] },
    { fields: ['content_topic_id'] }
  ]
});

module.exports = PersonalizationRule;
