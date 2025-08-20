const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'conversation_id',
    references: {
      model: 'chat_conversations',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  threadId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'thread_id'
  },
  messageType: {
    type: DataTypes.ENUM('user', 'assistant'),
    allowNull: false,
    field: 'message_type'
  },
  contentType: {
    type: DataTypes.ENUM('text', 'image', 'voice', 'file'),
    allowNull: false,
    defaultValue: 'text',
    field: 'content_type'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Message text content'
  },
  attachmentPath: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'attachment_path',
    comment: 'Path to attached file (image/voice/file)'
  },
  attachmentUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'attachment_url',
    comment: 'Cloud URL for attached file'
  },
  attachmentType: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'attachment_type',
    comment: 'MIME type of attachment'
  },
  attachmentSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'attachment_size',
    comment: 'Size of attachment in bytes'
  },
  isStreaming: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_streaming',
    comment: 'Whether this message was received via streaming'
  },
  streamingComplete: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'streaming_complete',
    comment: 'Whether streaming is complete for this message'
  },
  aiResponseTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'ai_response_time',
    comment: 'AI response time in milliseconds'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional message metadata'
  }
}, {
  tableName: 'chat_messages',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    {
      fields: ['conversation_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['thread_id']
    },
    {
      fields: ['conversation_id', 'created_at']
    }
  ]
});

// Instance methods
ChatMessage.prototype.getSafeMessageInfo = function() {
  return {
    id: this.id,
    messageType: this.messageType,
    contentType: this.contentType,
    content: this.content,
    attachmentUrl: this.attachmentUrl,
    attachmentType: this.attachmentType,
    attachmentSize: this.attachmentSize,
    isStreaming: this.isStreaming,
    streamingComplete: this.streamingComplete,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = ChatMessage; 