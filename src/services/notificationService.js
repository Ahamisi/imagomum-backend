const logger = require('../utils/logger');

/**
 * Weekly-delivery notification dispatch (CMS spec §7 step 7).
 *
 * Pluggable per-channel dispatcher keyed on UserProfile.notificationPref
 * (push | sms | whatsapp). Providers (FCM, an SMS gateway, WhatsApp Business
 * API) are NOT wired yet — each channel currently logs the send and reports
 * success so the delivery engine's status transitions can be exercised. Swap
 * the channel bodies for real provider calls when credentials are available.
 */

const channels = {
  push: async (user, delivery) => {
    logger.info('notify[push]: STUB — would send push', { userId: user.id, deliveryId: delivery.id });
    return { channel: 'push', sent: true, stub: true };
  },
  sms: async (user, delivery) => {
    logger.info('notify[sms]: STUB — would send SMS', { userId: user.id, deliveryId: delivery.id, phone: user.phone || null });
    return { channel: 'sms', sent: true, stub: true };
  },
  whatsapp: async (user, delivery) => {
    logger.info('notify[whatsapp]: STUB — would send WhatsApp', { userId: user.id, deliveryId: delivery.id });
    return { channel: 'whatsapp', sent: true, stub: true };
  }
};

/**
 * Dispatch the "your weekly content is ready" notification on the user's
 * preferred channel. Defaults to push. Never throws — a failed notification
 * must not roll back a successfully created delivery.
 */
async function dispatchNotification(user, delivery) {
  const pref = user.notificationPref || 'push';
  const send = channels[pref] || channels.push;
  try {
    return await send(user, delivery);
  } catch (err) {
    logger.error('notify: dispatch failed', { userId: user.id, deliveryId: delivery.id, pref, error: err.message });
    return { channel: pref, sent: false, error: err.message };
  }
}

module.exports = { dispatchNotification };
