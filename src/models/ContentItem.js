const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContentItem = sequelize.define('ContentItem', {
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
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Markdown'
  },
  contentType: {
    type: DataTypes.ENUM(
      'tip', 'nutrition', 'baby_dev', 'warning_sign', 'scan_info',
      'mental_health', 'antenatal_prep', 'exercise'
    ),
    allowNull: false,
    field: 'content_type'
  },
  gestationalWeekMin: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'gestational_week_min',
    validate: { min: 1, max: 42 }
  },
  gestationalWeekMax: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'gestational_week_max',
    validate: { min: 1, max: 42 }
  },
  trimester: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: { min: 1, max: 3 }
  },
  sourceId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'source_id'
  },
  sourceUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'source_url'
  },
  localizedForNigeria: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'localized_for_nigeria'
  },
  culturalContext: {
    type: DataTypes.ENUM('universal', 'nigerian', 'west_african'),
    allowNull: false,
    defaultValue: 'universal',
    field: 'cultural_context'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('draft', 'under_review', 'approved', 'published', 'archived'),
    allowNull: false,
    defaultValue: 'draft'
  },
  reviewId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'review_id',
    comment: 'Latest MedicalReview (no DB FK - circular ref)'
  }
}, {
  tableName: 'content_items',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['content_type'] },
    { fields: ['gestational_week_min', 'gestational_week_max'] },
    { fields: ['source_id'] }
  ]
});

/**
 * A ContentItem is only deliverable when it is published AND its linked
 * MedicalReview is approved (CMS spec §6 Stage 4 / §8). Callers must include
 * the `review` association for this to be meaningful.
 */
ContentItem.prototype.isDeliverable = function () {
  return this.status === 'published'
    && this.review
    && this.review.status === 'approved';
};

module.exports = ContentItem;
