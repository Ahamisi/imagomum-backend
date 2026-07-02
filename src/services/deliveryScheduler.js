const cron = require('node-cron');
const { runWeeklyDeliveries } = require('./deliveryService');
const logger = require('../utils/logger');

/**
 * Weekly delivery scheduler (CMS spec §7) — in-process node-cron.
 *
 * Runs the delivery engine every Sunday 06:00 WAT. No Redis/queue: for a once-a-
 * week batch, an in-process cron on a single always-on replica (min=max=1) is
 * the cheapest correct option, and the engine (runWeeklyDeliveries) is idempotent
 * so a mistimed/duplicate run never double-delivers.
 *
 * Gated behind WEEKLY_DELIVERY_SCHEDULER=enabled. Exposes status + a manual
 * trigger for the admin monitoring endpoint.
 */

const CRON = process.env.WEEKLY_DELIVERY_CRON || '0 6 * * 0'; // Sunday 06:00
const TZ = 'Africa/Lagos'; // WAT, UTC+1, no DST

let task = null;

const state = {
  enabled: false,
  cron: CRON,
  timezone: TZ,
  isRunning: false,
  lastRunAt: null,
  lastTrigger: null,
  lastResult: null,
  lastError: null,
  lastDurationMs: null,
  runCount: 0
};

/** Run the engine once, tracking state. Guards against overlapping runs. */
async function runOnce(trigger) {
  if (state.isRunning) {
    logger.warn('delivery scheduler: run already in progress, skipping', { trigger });
    return { skipped: true, reason: 'already-running' };
  }
  state.isRunning = true;
  const startedAt = Date.now();
  try {
    const result = await runWeeklyDeliveries({ now: new Date() });
    state.lastResult = result;
    state.lastError = null;
    return result;
  } catch (err) {
    state.lastError = err.message;
    logger.error('delivery scheduler: run failed', { trigger, error: err.message });
    throw err;
  } finally {
    state.isRunning = false;
    state.lastRunAt = new Date().toISOString();
    state.lastTrigger = trigger;
    state.lastDurationMs = Date.now() - startedAt;
    state.runCount += 1;
  }
}

function initDeliveryScheduler() {
  if (process.env.WEEKLY_DELIVERY_SCHEDULER !== 'enabled') {
    logger.info('delivery scheduler: disabled (set WEEKLY_DELIVERY_SCHEDULER=enabled to run)');
    return null;
  }
  if (!cron.validate(CRON)) {
    logger.error('delivery scheduler: invalid cron expression', { cron: CRON });
    return null;
  }
  task = cron.schedule(CRON, () => { runOnce('cron').catch(() => {}); }, { timezone: TZ });
  state.enabled = true;
  logger.info('delivery scheduler: enabled', { cron: CRON, tz: TZ });
  return { task };
}

/** Manually trigger a run now (admin monitoring endpoint). */
async function triggerNow() {
  return runOnce('manual');
}

/** Next Sunday 06:00 WAT as a UTC instant (WAT is UTC+1 -> 05:00 UTC). */
function nextRunAt() {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 5, 0, 0, 0));
  let add = (7 - next.getUTCDay()) % 7; // days until Sunday
  if (add === 0 && now.getTime() >= next.getTime()) add = 7;
  next.setUTCDate(next.getUTCDate() + add);
  return next.toISOString();
}

function getSchedulerStatus() {
  return { ...state, nextRunAt: state.enabled ? nextRunAt() : null };
}

function closeDeliveryScheduler() {
  if (task) { task.stop(); task = null; }
  state.enabled = false;
}

module.exports = { initDeliveryScheduler, triggerNow, getSchedulerStatus, closeDeliveryScheduler };
