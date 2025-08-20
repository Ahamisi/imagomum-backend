const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatConversation = sequelize.define('ChatConversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  threadId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'thread_id'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Auto-generated title from first message'
  },
  lastMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'last_message'
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_message_at'
  },
  messageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'message_count'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional conversation metadata'
  }
}, {
  tableName: 'chat_conversations',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['thread_id'],
      unique: true
    },
    {
      fields: ['user_id', 'last_message_at']
    }
  ]
});

// Instance methods
ChatConversation.prototype.getSafeConversationInfo = function() {
  return {
    id: this.id,
    threadId: this.threadId,
    title: this.title,
    lastMessage: this.lastMessage,
    lastMessageAt: this.lastMessageAt,
    messageCount: this.messageCount,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = ChatConversation; 