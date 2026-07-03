/* eslint-disable no-console */
/**
 * Idempotent reference-data seeding, run on startup after migrations.
 *
 *  1. The 7 canonical ContentSources (spec §3.2 / §4) via findOrCreate — so
 *     generated/curated content can FK-link to its source in every environment.
 *  2. Optional admin bootstrap: if BOOTSTRAP_ADMIN_EMAIL is set, grant that user
 *     cms_role='admin' (only if not already admin). Set the env var once to seed
 *     the first CMS admin, then unset it.
 *
 * Non-fatal by design (exits 0 on error) so a seeding hiccup never blocks boot.
 */
const ContentSource = require('../src/models/ContentSource');
const User = require('../src/models/User');
const { sequelize } = require('../src/config/database');
const { initAssociations } = require('../src/models/associations');
const medlinePlus = require('../src/services/medlinePlusService');
const topicBuilder = require('../src/services/topicBuilderService');

// name -> canonical config. licenseType is required (no default).
const SOURCES = [
  { name: 'WHO', type: 'manual_curation', licenseType: 'CC BY-NC-SA 3.0 IGO', attributionRequired: true, syncFrequency: 'manual', apiEndpoint: null },
  { name: 'NHS', type: 'api', licenseType: 'Open Government Licence v3.0', attributionRequired: true, syncFrequency: 'weekly', apiEndpoint: 'https://api.nhs.uk/' },
  { name: 'MedlinePlus', type: 'api', licenseType: 'US Government public domain', attributionRequired: false, syncFrequency: 'monthly', apiEndpoint: 'https://wsearch.nlm.nih.gov/ws/query' },
  { name: 'ACOG', type: 'manual_curation', licenseType: 'ACOG - benchmark reference only (not reproduced)', attributionRequired: true, syncFrequency: 'manual', apiEndpoint: null },
  { name: 'FMOH', type: 'manual_curation', licenseType: 'Federal Ministry of Health Nigeria', attributionRequired: true, syncFrequency: 'manual', apiEndpoint: null },
  { name: 'YouTube', type: 'api', licenseType: 'YouTube Standard License', attributionRequired: true, syncFrequency: 'manual', apiEndpoint: 'https://www.googleapis.com/youtube/v3/' },
  { name: 'Original', type: 'original', licenseType: 'Imago Mum first-party', attributionRequired: false, syncFrequency: 'manual', apiEndpoint: null }
];

(async () => {
  let created = 0;
  for (const s of SOURCES) {
    const [, wasCreated] = await ContentSource.findOrCreate({ where: { name: s.name }, defaults: s });
    if (wasCreated) created += 1;
  }
  console.log(`seed-reference-data: content sources ok (${created} created, ${SOURCES.length - created} existed)`);

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (email) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.warn(`seed-reference-data: BOOTSTRAP_ADMIN_EMAIL="${email}" set but no such user`);
    } else if (user.cmsRole !== 'admin') {
      user.cmsRole = 'admin';
      await user.save();
      console.log(`seed-reference-data: bootstrapped admin ${email} — unset BOOTSTRAP_ADMIN_EMAIL now`);
    } else {
      console.log(`seed-reference-data: ${email} already admin`);
    }
  }

  // Optional CMS content seeding: ingest MedlinePlus + scaffold the Appendix B
  // topic map. Gated by SEED_CMS_CONTENT so it only runs when explicitly enabled
  // (it makes external API calls); both operations are idempotent. Produces
  // DRAFTS only — nothing is published/delivered without medical review.
  if (process.env.SEED_CMS_CONTENT === 'enabled') {
    initAssociations();
    try {
      const mp = await medlinePlus.ingest({ persist: true });
      console.log(`seed-cms-content: MedlinePlus ${mp.created} created, ${mp.skipped} existed`);
    } catch (e) {
      console.warn('seed-cms-content: MedlinePlus ingest failed (non-fatal):', e.message);
    }
    try {
      const tb = await topicBuilder.buildTopics({ persist: true });
      console.log(`seed-cms-content: Topic Builder ${tb.topicsCreated} topics / ${tb.itemsCreated} items created`);
    } catch (e) {
      console.warn('seed-cms-content: Topic Builder failed (non-fatal):', e.message);
    }
  }

  // Operator-triggered bulk publish + delivery run. Gated by
  // PUBLISH_SEEDED_CONTENT because it BYPASSES the medical-review gate: it
  // auto-approves every draft via a system reviewer and marks it published, then
  // runs the weekly delivery batch so eligible mothers receive content now.
  // Enable once, let it run, then unset. Idempotent (already-published skipped).
  if (process.env.PUBLISH_SEEDED_CONTENT === 'enabled') {
    initAssociations();
    const { getModels } = require('../src/models/associations');
    const { ContentItem, MedicalReview } = getModels();
    const { runWeeklyDeliveries } = require('../src/services/deliveryService');
    try {
      const drafts = await ContentItem.findAll({ where: { status: ['draft', 'under_review', 'approved'] } });
      let published = 0;
      for (const item of drafts) {
        const review = await MedicalReview.create({
          contentItemId: item.id,
          reviewerId: 'system@imagomum',
          reviewerCredentials: 'Automated publish — clinical review bypassed by operator',
          status: 'approved',
          approvedAt: new Date()
        });
        await item.update({ reviewId: review.id, status: 'published' });
        published += 1;
      }
      console.log(`publish-seeded-content: published ${published} items (review bypassed)`);
      const res = await runWeeklyDeliveries({});
      console.log(`publish-seeded-content: delivery run ${JSON.stringify(res)}`);
    } catch (e) {
      console.warn('publish-seeded-content: failed (non-fatal):', e.message);
    }
  }

  await sequelize.close();
})().catch((e) => { console.error('seed-reference-data: non-fatal error:', e.message); process.exit(0); });
