'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_conversations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      thread_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: true
      },
      last_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      last_message_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      message_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('chat_conversations', ['user_id']);
    await queryInterface.addIndex('chat_conversations', ['thread_id'], { unique: true });
    await queryInterface.addIndex('chat_conversations', ['user_id', 'last_message_at']);
    await queryInterface.addIndex('chat_conversations', ['deleted_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('chat_conversations');
  }
};
