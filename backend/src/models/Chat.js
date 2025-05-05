const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  name: {
    type: String,
    required: function() {
      return this.type === 'group';
    }
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'group';
    }
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true
});

// Index for faster queries
chatSchema.index({ members: 1 });
chatSchema.index({ type: 1, members: 1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat; 