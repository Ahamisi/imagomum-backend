const { validationResult } = require('express-validator');
const ContentSource = require('../models/ContentSource');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

/** Collapse express-validator errors into the app's ValidationError. */
function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(errors.array().map(e => e.msg).join(', '));
  }
}

const contentSourceController = {
  // POST /api/v1/content-sources  (admin)
  async create(req, res) {
    assertValid(req);
    const {
      name, type, apiEndpoint, apiKeyRef, syncFrequency,
      licenseType, attributionRequired, active
    } = req.body;

    const source = await ContentSource.create({
      name, type, apiEndpoint, apiKeyRef,
      syncFrequency: syncFrequency || 'manual',
      licenseType,
      attributionRequired: attributionRequired !== undefined ? attributionRequired : true,
      active: active !== undefined ? active : true
    });

    res.status(201).json({ status: 'success', data: { source } });
  },

  // GET /api/v1/content-sources  (any CMS staff)
  async list(req, res) {
    const where = {};
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    if (req.query.name) where.name = req.query.name;

    const sources = await ContentSource.findAll({ where, order: [['name', 'ASC']] });
    res.status(200).json({ status: 'success', results: sources.length, data: { sources } });
  },

  // GET /api/v1/content-sources/:id
  async getById(req, res) {
    const source = await ContentSource.findByPk(req.params.id);
    if (!source) throw new NotFoundError('ContentSource not found');
    res.status(200).json({ status: 'success', data: { source } });
  },

  // PATCH /api/v1/content-sources/:id  (admin)
  async update(req, res) {
    assertValid(req);
    const source = await ContentSource.findByPk(req.params.id);
    if (!source) throw new NotFoundError('ContentSource not found');

    const updatable = ['apiEndpoint', 'apiKeyRef', 'syncFrequency', 'licenseType', 'attributionRequired', 'active', 'lastSyncedAt'];
    for (const key of updatable) {
      if (req.body[key] !== undefined) source[key] = req.body[key];
    }
    await source.save();
    res.status(200).json({ status: 'success', data: { source } });
  }
};

module.exports = contentSourceController;
