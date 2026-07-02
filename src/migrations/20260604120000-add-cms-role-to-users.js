'use strict';

/**
 * Adds CMS staff RBAC to the users table (CMS spec §10 - editor|reviewer|
 * publisher|admin). NULL cms_role = a regular app user (mother), not CMS staff.
 *
 * cms_credentials stores a reviewer's professional credentials, copied onto the
 * MedicalReview audit record at review time (CMS spec §8).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // NOTE: no `comment` on the ENUM column - Sequelize 6 generates malformed
    // SQL for addColumn when an ENUM type is combined with a comment. The
    // documentation lives on the User model attribute instead.
    await queryInterface.addColumn('users', 'cms_role', {
      type: Sequelize.ENUM('editor', 'reviewer', 'publisher', 'admin'),
      allowNull: true
    });

    await queryInterface.addColumn('users', 'cms_credentials', {
      type: Sequelize.STRING(200),
      allowNull: true
    });

    await queryInterface.addIndex('users', ['cms_role']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', ['cms_role']);
    await queryInterface.removeColumn('users', 'cms_role');
    await queryInterface.removeColumn('users', 'cms_credentials');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_cms_role";');
  }
};
