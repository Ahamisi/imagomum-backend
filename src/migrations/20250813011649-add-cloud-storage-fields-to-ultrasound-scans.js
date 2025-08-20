'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ultrasound_scans', 'cloud_url', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Public URL of file in cloud storage (Azure Blob Storage)'
    });

    await queryInterface.addColumn('ultrasound_scans', 'cloud_blob_name', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Blob name/path in cloud storage for management operations'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('ultrasound_scans', 'cloud_url');
    await queryInterface.removeColumn('ultrasound_scans', 'cloud_blob_name');
  }
};
