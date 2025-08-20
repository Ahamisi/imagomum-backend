'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'chat_conversations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
        allowNull: false
      },
      message_type: {
        type: Sequelize.ENUM('user', 'assistant'),
        allowNull: false
      },
      content_type: {
        type: Sequelize.ENUM('text', 'image', 'voice', 'file'),
        allowNull: false,
        defaultValue: 'text'
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      attachment_path: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attachment_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attachment_type: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attachment_size: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      is_streaming: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      streaming_complete: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      ai_response_time: {
        type: Sequelize.INTEGER,
        allowNull: true
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
    await queryInterface.addIndex('chat_messages', ['conversation_id']);
    await queryInterface.addIndex('chat_messages', ['user_id']);
    await queryInterface.addIndex('chat_messages', ['thread_id']);
    await queryInterface.addIndex('chat_messages', ['conversation_id', 'created_at']);
    await queryInterface.addIndex('chat_messages', ['message_type']);
    await queryInterface.addIndex('chat_messages', ['content_type']);
    await queryInterface.addIndex('chat_messages', ['deleted_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('chat_messages');
  }
};
