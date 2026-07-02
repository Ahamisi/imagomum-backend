const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContentTopic = sequelize.define('ContentTopic', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { notEmpty: true }
  },
  subtitle: {
    type: DataTypes.STRING(300),
    allowNull: true
  },
  coverImageUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'cover_image_url',
    comment: 'Stories card background'
  },
  gestationalWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'gestational_week',
    validate: { min: 1, max: 42 }
  },
  category: {
    type: DataTypes.ENUM(
      'nutrition', 'baby_dev', 'symptoms', 'antenatal_care',
      'mental_health', 'warning_signs', 'postpartum_prep'
    ),
    allowNull: false
  },
  estimatedReadMins: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'estimated_read_mins'
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'content_topics',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['gestational_week'] },
    { fields: ['category'] },
    { fields: ['gestational_week', 'priority'] }
  ]
});

module.exports = ContentTopic;
