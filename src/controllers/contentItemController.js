const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const ContentItem = require('../models/ContentItem');
const ContentSource = require('../models/ContentSource');
const MediaAsset = require('../models/MediaAsset');
const MedicalReview = require('../models/MedicalReview');
const ContentItemVersion = require('../models/ContentItemVersion');
const cmsWorkflow = require('../services/cmsWorkflowService');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(e => e.msg).join(', '));
  }
}

/** Standard association set returned when fetching a single item. */
const itemIncludes = [
  { model: ContentSource, as: 'source' },
  { model: MediaAsset, as: 'mediaAssets' },
  { model: MedicalReview, as: 'review' }
];

async function findItemOr404(id, options = {}) {
  const item = await ContentItem.findByPk(id, options);
  if (!item) throw new NotFoundError('ContentItem not found');
  return item;
}

const contentItemController = {
  // POST /api/v1/content-items  (editor) - always enters as draft (spec §6 Stage 1)
  async create(req, res) {
    assertValid(req);
    const b = req.body;
    const item = await ContentItem.create({
      title: b.title,
      body: b.body,
      contentType: b.contentType,
      gestationalWeekMin: b.gestationalWeekMin,
      gestationalWeekMax: b.gestationalWeekMax,
      trimester: b.trimester,
      sourceId: b.sourceId,
      sourceUrl: b.sourceUrl,
      localizedForNigeria: b.localizedForNigeria || false,
      culturalContext: b.culturalContext || 'universal',
      tags: b.tags,
      status: 'draft'
    });
    res.status(201).json({ status: 'success', data: { item } });
  },

  // GET /api/v1/content-items  (any CMS staff) - Content Library View filters (spec §9)
  async list(req, res) {
    const where = {};
    const { status, contentType, gestationalWeek, sourceId, localizedForNigeria, culturalContext, search } = req.query;

    if (status) where.status = status;
    if (contentType) where.contentType = contentType;
    if (sourceId) where.sourceId = sourceId;
    if (culturalContext) where.culturalContext = culturalContext;
    if (localizedForNigeria !== undefined) where.localizedForNigeria = localizedForNigeria === 'true';
    if (gestationalWeek !== undefined) {
      const wk = parseInt(gestationalWeek, 10);
      where.gestationalWeekMin = { [Op.lte]: wk };
      where.gestationalWeekMax = { [Op.gte]: wk };
    }
    if (search) where.title = { [Op.iLike]: `%${search}%` };

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);

    const { rows, count } = await ContentItem.findAndCountAll({
      where,
      include: [{ model: MedicalReview, as: 'review', attributes: ['id', 'status', 'version'] }],
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true
    });

    res.status(200).json({
      status: 'success',
      results: rows.length,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
      data: { items: rows }
    });
  },

  // GET /api/v1/content-items/:id
  async getById(req, res) {
    const item = await findItemOr404(req.params.id, { include: itemIncludes });
    res.status(200).json({ status: 'success', data: { item } });
  },

  // GET /api/v1/content-items/:id/versions  - append-only audit trail (spec §8)
  async getVersions(req, res) {
    await findItemOr404(req.params.id);
    const versions = await ContentItemVersion.findAll({
      where: { contentItemId: req.params.id },
      order: [['version', 'DESC']]
    });
    res.status(200).json({ status: 'success', results: versions.length, data: { versions } });
  },

  // PATCH /api/v1/content-items/:id  (editor) - localise/edit; only while draft.
  // Editing an approved/published item's body must go through reviseBody (re-review).
  async update(req, res) {
    assertValid(req);
    const item = await findItemOr404(req.params.id);

    if (item.status !== 'draft') {
      throw new ConflictError(
        `Item is "${item.status}" and cannot be edited directly. ` +
        'Use POST /:id/revise to change the body of an approved/published item.'
      );
    }

    const updatable = [
      'title', 'body', 'contentType', 'gestationalWeekMin', 'gestationalWeekMax',
      'trimester', 'sourceId', 'sourceUrl', 'localizedForNigeria', 'culturalContext', 'tags'
    ];
    for (const key of updatable) {
      if (req.body[key] !== undefined) item[key] = req.body[key];
    }
    await item.save();
    res.status(200).json({ status: 'success', data: { item } });
  },

  // POST /api/v1/content-items/:id/media  (editor) - attach a MediaAsset
  async addMedia(req, res) {
    assertValid(req);
    const item = await findItemOr404(req.params.id);
    const b = req.body;
    const asset = await MediaAsset.create({
      contentItemId: item.id,
      type: b.type,
      url: b.url,
      thumbnailUrl: b.thumbnailUrl,
      duration: b.duration,
      youtubeVideoId: b.youtubeVideoId,
      videoChannel: b.videoChannel,
      licenseType: b.licenseType,
      altText: b.altText,
      captionAvailable: b.captionAvailable || false
    });
    res.status(201).json({ status: 'success', data: { asset } });
  },

  // ---- Workflow transitions (delegate to the enforced service) ----

  // POST /api/v1/content-items/:id/submit-for-review  (editor)
  async submitForReview(req, res) {
    assertValid(req);
    const result = await cmsWorkflow.submitForReview(
      req.params.id,
      { reviewerId: req.body.reviewerId, reviewerCredentials: req.body.reviewerCredentials },
      req.cmsUser
    );
    res.status(200).json({ status: 'success', data: result });
  },

  // POST /api/v1/content-items/:id/approve  (reviewer)
  async approve(req, res) {
    const result = await cmsWorkflow.approve(req.params.id, req.cmsUser);
    res.status(200).json({ status: 'success', data: result });
  },

  // POST /api/v1/content-items/:id/request-revision  (reviewer)
  async requestRevision(req, res) {
    assertValid(req);
    const result = await cmsWorkflow.requestRevision(req.params.id, req.body.notes, req.cmsUser);
    res.status(200).json({ status: 'success', data: result });
  },

  // POST /api/v1/content-items/:id/publish  (publisher)
  async publish(req, res) {
    const result = await cmsWorkflow.publish(req.params.id, req.cmsUser);
    res.status(200).json({ status: 'success', data: result });
  },

  // POST /api/v1/content-items/:id/revise  (editor) - edit body of approved/published -> re-review
  async revise(req, res) {
    assertValid(req);
    const result = await cmsWorkflow.reviseBody(req.params.id, req.body.body, req.cmsUser);
    res.status(200).json({ status: 'success', data: result });
  },

  // POST /api/v1/content-items/:id/archive  (publisher/admin)
  async archive(req, res) {
    const result = await cmsWorkflow.archive(req.params.id, req.cmsUser);
    res.status(200).json({ status: 'success', data: result });
  }
};

module.exports = contentItemController;
