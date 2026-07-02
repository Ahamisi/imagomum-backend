const { sequelize } = require('../config/database');
const ContentItem = require('../models/ContentItem');
const MedicalReview = require('../models/MedicalReview');
const ContentItemVersion = require('../models/ContentItemVersion');
const User = require('../models/User');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Encapsulates the ContentItem editorial lifecycle and medical-review workflow
 * (CMS spec §6 Content Pipeline, §8 Medical Review Workflow).
 *
 * The state machine over ContentItem.status:
 *
 *   draft ──submitForReview──▶ under_review ──approve──▶ approved ──publish──▶ published
 *     ▲                            │                        │                      │
 *     └────requestRevision─────────┘                        │                      │
 *     └──────────────── edit body (revise) ◀────────────────┴──────────────────────┘
 *
 * Hard invariant (enforced here, not just in the UI): a ContentItem can only
 * become `published` when its linked MedicalReview.status = 'approved'.
 */

/** Load an item or throw 404. */
async function loadItem(itemId, options = {}) {
  const item = await ContentItem.findByPk(itemId, options);
  if (!item) throw new NotFoundError('ContentItem not found');
  return item;
}

/**
 * Editor submits a draft (or a revision-requested item) for medical review.
 * Creates a pending MedicalReview on first submit; on re-submit after a revision
 * request, reuses the review record and increments its version (CMS spec §8).
 *
 * @param {string} itemId
 * @param {{ reviewerId: string, reviewerCredentials?: string }} assignment
 * @param {object} actor - the editing user (req.cmsUser)
 */
async function submitForReview(itemId, assignment, actor) {
  return sequelize.transaction(async (t) => {
    const item = await loadItem(itemId, { transaction: t });

    if (!['draft'].includes(item.status)) {
      throw new ConflictError(`Cannot submit for review from status "${item.status}"; item must be draft`);
    }
    if (!assignment || !assignment.reviewerId) {
      throw new ValidationError('reviewerId is required to assign a medical reviewer');
    }

    // Resolve the reviewer and their credentials (required, non-null on the record).
    const reviewer = await User.findByPk(assignment.reviewerId, { transaction: t });
    if (!reviewer || reviewer.cmsRole !== 'reviewer') {
      throw new ValidationError('reviewerId must reference a user with cms_role = reviewer');
    }
    const credentials = assignment.reviewerCredentials || reviewer.cmsCredentials;
    if (!credentials) {
      throw new ValidationError('reviewerCredentials missing: set the reviewer\'s cms_credentials or pass reviewerCredentials');
    }

    // Reuse an existing review (re-submit after revision) or create a new one.
    let review = item.reviewId
      ? await MedicalReview.findByPk(item.reviewId, { transaction: t })
      : null;

    if (review && review.status === 'needs_revision') {
      review.version += 1;
      review.status = 'pending';
      review.reviewerId = assignment.reviewerId;
      review.reviewerCredentials = credentials;
      review.notes = null;
      review.approvedAt = null;
      await review.save({ transaction: t });
    } else {
      review = await MedicalReview.create({
        contentItemId: item.id,
        reviewerId: assignment.reviewerId,
        reviewerCredentials: credentials,
        status: 'pending',
        version: 1
      }, { transaction: t });
    }

    item.status = 'under_review';
    item.reviewId = review.id;
    await item.save({ transaction: t });

    logger.info('CMS: content submitted for review', {
      itemId: item.id, reviewId: review.id, version: review.version, by: actor?.id
    });
    return { item, review };
  });
}

/**
 * Assigned reviewer approves the pending review. Writes an append-only
 * content_item_versions audit row capturing the exact body, reviewer, and
 * approval timestamp (CMS spec §8), and moves the item to `approved`.
 */
async function approve(itemId, actor) {
  return sequelize.transaction(async (t) => {
    const item = await loadItem(itemId, { transaction: t });
    if (item.status !== 'under_review' || !item.reviewId) {
      throw new ConflictError(`Cannot approve from status "${item.status}"; item must be under_review`);
    }

    const review = await MedicalReview.findByPk(item.reviewId, { transaction: t });
    if (!review || review.status !== 'pending') {
      throw new ConflictError('No pending review to approve for this item');
    }
    assertReviewerOrAdmin(review, actor);

    const now = new Date();
    review.status = 'approved';
    review.approvedAt = now;
    review.notes = null;
    await review.save({ transaction: t });

    await ContentItemVersion.create({
      contentItemId: item.id,
      body: item.body,
      version: review.version,
      reviewerId: actor?.id || review.reviewerId,
      approvedAt: now
    }, { transaction: t });

    item.status = 'approved';
    await item.save({ transaction: t });

    logger.info('CMS: review approved', { itemId: item.id, reviewId: review.id, version: review.version, by: actor?.id });
    return { item, review };
  });
}

/**
 * Reviewer requests revision with mandatory notes. Returns the item to the
 * editor queue (status -> draft) and marks the review needs_revision.
 */
async function requestRevision(itemId, notes, actor) {
  if (!notes || !notes.trim()) {
    throw new ValidationError('notes are required when requesting a revision');
  }
  return sequelize.transaction(async (t) => {
    const item = await loadItem(itemId, { transaction: t });
    if (item.status !== 'under_review' || !item.reviewId) {
      throw new ConflictError(`Cannot request revision from status "${item.status}"; item must be under_review`);
    }

    const review = await MedicalReview.findByPk(item.reviewId, { transaction: t });
    if (!review || review.status !== 'pending') {
      throw new ConflictError('No pending review to revise for this item');
    }
    assertReviewerOrAdmin(review, actor);

    review.status = 'needs_revision';
    review.notes = notes.trim();
    await review.save({ transaction: t });

    item.status = 'draft';
    await item.save({ transaction: t });

    logger.info('CMS: revision requested', { itemId: item.id, reviewId: review.id, by: actor?.id });
    return { item, review };
  });
}

/**
 * Publisher publishes an approved item. THE GATE: rejects unless the linked
 * MedicalReview is approved (CMS spec §6 Stage 4 / §8).
 */
async function publish(itemId, actor) {
  return sequelize.transaction(async (t) => {
    const item = await loadItem(itemId, { transaction: t });
    const review = item.reviewId
      ? await MedicalReview.findByPk(item.reviewId, { transaction: t })
      : null;

    if (item.status !== 'approved' || !review || review.status !== 'approved') {
      throw new ConflictError('Publish blocked: item must be approved AND have an approved MedicalReview');
    }

    item.status = 'published';
    await item.save({ transaction: t });

    logger.info('CMS: content published', { itemId: item.id, reviewId: review.id, by: actor?.id });
    return { item, review };
  });
}

/**
 * Editing the body of an already approved/published item triggers re-review
 * (CMS spec §8 / §6 Stage 5): bump the review version, reset it to pending, and
 * move the item back to under_review. Plain draft edits are handled by the
 * controller's normal update path.
 */
async function reviseBody(itemId, newBody, actor) {
  if (!newBody || !newBody.trim()) {
    throw new ValidationError('body is required');
  }
  return sequelize.transaction(async (t) => {
    const item = await loadItem(itemId, { transaction: t });
    if (!['approved', 'published'].includes(item.status) || !item.reviewId) {
      throw new ConflictError(`reviseBody only applies to approved/published items; status is "${item.status}"`);
    }

    const review = await MedicalReview.findByPk(item.reviewId, { transaction: t });
    review.version += 1;
    review.status = 'pending';
    review.approvedAt = null;
    review.notes = null;
    await review.save({ transaction: t });

    item.body = newBody;
    item.status = 'under_review';
    await item.save({ transaction: t });

    logger.info('CMS: body revised, re-review triggered', { itemId: item.id, reviewId: review.id, version: review.version, by: actor?.id });
    return { item, review };
  });
}

/** Archive a published/approved/draft item (soft state, not a delete). */
async function archive(itemId, actor) {
  return sequelize.transaction(async (t) => {
    const item = await loadItem(itemId, { transaction: t });
    if (item.status === 'archived') {
      throw new ConflictError('Item is already archived');
    }
    item.status = 'archived';
    await item.save({ transaction: t });
    logger.info('CMS: content archived', { itemId: item.id, by: actor?.id });
    return { item };
  });
}

/** The actor must be the assigned reviewer or an admin. */
function assertReviewerOrAdmin(review, actor) {
  const isAdmin = actor?.cmsRole === 'admin';
  const isAssignedReviewer = actor && String(actor.id) === String(review.reviewerId);
  if (!isAdmin && !isAssignedReviewer) {
    throw new ConflictError('Only the assigned reviewer (or an admin) may act on this review');
  }
}

module.exports = {
  submitForReview,
  approve,
  requestRevision,
  publish,
  reviseBody,
  archive
};
