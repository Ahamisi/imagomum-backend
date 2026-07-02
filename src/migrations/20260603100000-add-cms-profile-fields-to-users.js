'use strict';

/**
 * Extends the existing users table with the CMS UserProfile dimensions
 * the personalisation engine evaluates (see CMS spec §3.1).
 *
 * Reuses existing columns rather than duplicating them:
 *   - dueDate            -> users.edd
 *   - onboardingDate     -> users.onboarding_completed_at
 *
 * New columns are nullable so existing rows are not invalidated; the API
 * layer enforces presence at onboarding time.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'gestational_week_at_signup', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Gestational week (1-42) captured when the user completed onboarding'
    });

    await queryInterface.addColumn('users', 'location_state', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Nigerian state - used for localising content and clinic references'
    });

    await queryInterface.addColumn('users', 'location_lga', {
      type: Sequelize.STRING(80),
      allowNull: true,
      comment: 'Local Government Area for more granular localisation'
    });

    await queryInterface.addColumn('users', 'parity_status', {
      type: Sequelize.ENUM('primigravida', 'multigravida'),
      allowNull: true,
      comment: 'Whether this is a first pregnancy or a subsequent one'
    });

    await queryInterface.addColumn('users', 'age_group', {
      type: Sequelize.ENUM('<20', '20-25', '26-30', '31-35', '36+'),
      allowNull: true,
      comment: 'Age bracket for risk-stratified content targeting'
    });

    await queryInterface.addColumn('users', 'language_preference', {
      type: Sequelize.ENUM('en', 'yo', 'ha', 'ig'),
      allowNull: false,
      defaultValue: 'en',
      comment: 'Preferred language: English, Yoruba, Hausa, or Igbo'
    });

    await queryInterface.addColumn('users', 'risk_flags', {
      type: Sequelize.ARRAY(Sequelize.TEXT),
      allowNull: true,
      comment: 'e.g. ["gestational_diabetes","hypertension","anemia","twins"]'
    });

    await queryInterface.addColumn('users', 'notification_pref', {
      type: Sequelize.ENUM('push', 'sms', 'whatsapp'),
      allowNull: false,
      defaultValue: 'push',
      comment: 'Preferred channel for weekly tip notifications'
    });

    await queryInterface.addIndex('users', ['location_state']);
    await queryInterface.addIndex('users', ['language_preference']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', ['location_state']);
    await queryInterface.removeIndex('users', ['language_preference']);

    await queryInterface.removeColumn('users', 'gestational_week_at_signup');
    await queryInterface.removeColumn('users', 'location_state');
    await queryInterface.removeColumn('users', 'location_lga');
    await queryInterface.removeColumn('users', 'parity_status');
    await queryInterface.removeColumn('users', 'age_group');
    await queryInterface.removeColumn('users', 'language_preference');
    await queryInterface.removeColumn('users', 'risk_flags');
    await queryInterface.removeColumn('users', 'notification_pref');

    // Drop the ENUM types Postgres created for the columns above
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_parity_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_age_group";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_language_preference";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_notification_pref";');
  }
};
