/**
 * Central wiring of Sequelize associations across the Imago Mum data model.
 *
 * Each model file calls sequelize.define() on require; this module is required
 * once at startup (after all models load) to declare the relationships between
 * them. Keeping associations in one place avoids circular-require problems
 * between model files and gives a single map of how the CMS entities relate.
 *
 * Returns the keyed model registry for convenient destructured imports.
 */
const User = require('./User');
const ContentSource = require('./ContentSource');
const ContentItem = require('./ContentItem');
const MedicalReview = require('./MedicalReview');
const ContentTopic = require('./ContentTopic');
const MediaAsset = require('./MediaAsset');
const PersonalizationRule = require('./PersonalizationRule');
const WeeklyDelivery = require('./WeeklyDelivery');
const TopicContentItem = require('./TopicContentItem');
const DeliveryTopic = require('./DeliveryTopic');
const ContentItemVersion = require('./ContentItemVersion');
const SourceDocument = require('./SourceDocument');
const DocumentChunk = require('./DocumentChunk');

let initialised = false;

function initAssociations() {
  if (initialised) {
    return getModels();
  }

  // ContentSource 1---* ContentItem
  ContentSource.hasMany(ContentItem, { foreignKey: 'sourceId', as: 'contentItems' });
  ContentItem.belongsTo(ContentSource, { foreignKey: 'sourceId', as: 'source' });

  // ContentItem 1---* MediaAsset
  ContentItem.hasMany(MediaAsset, { foreignKey: 'contentItemId', as: 'mediaAssets' });
  MediaAsset.belongsTo(ContentItem, { foreignKey: 'contentItemId', as: 'contentItem' });

  // ContentItem 1---* MedicalReview (full review history).
  // ContentItem.reviewId also points at the *latest* review; that side has no
  // DB-level FK (circular ref) so it is a plain belongsTo for query convenience.
  ContentItem.hasMany(MedicalReview, { foreignKey: 'contentItemId', as: 'reviews' });
  MedicalReview.belongsTo(ContentItem, { foreignKey: 'contentItemId', as: 'contentItem' });
  ContentItem.belongsTo(MedicalReview, { foreignKey: 'reviewId', as: 'review', constraints: false });

  // ContentItem 1---* ContentItemVersion (append-only audit trail)
  ContentItem.hasMany(ContentItemVersion, { foreignKey: 'contentItemId', as: 'versions' });
  ContentItemVersion.belongsTo(ContentItem, { foreignKey: 'contentItemId', as: 'contentItem' });

  // ContentTopic *---* ContentItem, ordered via TopicContentItem
  ContentTopic.belongsToMany(ContentItem, {
    through: TopicContentItem,
    foreignKey: 'topicId',
    otherKey: 'contentItemId',
    as: 'contentItems'
  });
  ContentItem.belongsToMany(ContentTopic, {
    through: TopicContentItem,
    foreignKey: 'contentItemId',
    otherKey: 'topicId',
    as: 'topics'
  });

  // PersonalizationRule *---1 ContentTopic
  ContentTopic.hasMany(PersonalizationRule, { foreignKey: 'contentTopicId', as: 'rules' });
  PersonalizationRule.belongsTo(ContentTopic, { foreignKey: 'contentTopicId', as: 'topic' });

  // User 1---* WeeklyDelivery
  User.hasMany(WeeklyDelivery, { foreignKey: 'userId', as: 'deliveries' });
  WeeklyDelivery.belongsTo(User, { foreignKey: 'userId', as: 'user' });

  // RAG knowledge base: ContentSource 1---* SourceDocument 1---* DocumentChunk
  ContentSource.hasMany(SourceDocument, { foreignKey: 'sourceId', as: 'documents' });
  SourceDocument.belongsTo(ContentSource, { foreignKey: 'sourceId', as: 'source' });
  SourceDocument.hasMany(DocumentChunk, { foreignKey: 'documentId', as: 'chunks' });
  DocumentChunk.belongsTo(SourceDocument, { foreignKey: 'documentId', as: 'document' });

  // WeeklyDelivery *---* ContentTopic, ordered via DeliveryTopic
  WeeklyDelivery.belongsToMany(ContentTopic, {
    through: DeliveryTopic,
    foreignKey: 'deliveryId',
    otherKey: 'topicId',
    as: 'topics'
  });
  ContentTopic.belongsToMany(WeeklyDelivery, {
    through: DeliveryTopic,
    foreignKey: 'topicId',
    otherKey: 'deliveryId',
    as: 'deliveries'
  });

  initialised = true;
  return getModels();
}

function getModels() {
  return {
    User,
    ContentSource,
    ContentItem,
    MedicalReview,
    ContentTopic,
    MediaAsset,
    PersonalizationRule,
    WeeklyDelivery,
    TopicContentItem,
    DeliveryTopic,
    ContentItemVersion,
    SourceDocument,
    DocumentChunk
  };
}

module.exports = { initAssociations, getModels };
