const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

let io;

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('name email');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    // Join a chat room
    socket.on('join_chat', (chatId) => {
      socket.join(chatId);
      console.log(`${socket.user.name} joined chat: ${chatId}`);
    });

    // Leave a chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
      console.log(`${socket.user.name} left chat: ${chatId}`);
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      const { chatId, content } = data;
      
      // Broadcast the message to all users in the chat
      io.to(chatId).emit('new_message', {
        chatId,
        sender: {
          id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email
        },
        content,
        createdAt: new Date()
      });
    });

    // Handle typing status
    socket.on('typing', (data) => {
      const { chatId, isTyping } = data;
      socket.to(chatId).emit('user_typing', {
        chatId,
        userId: socket.user._id,
        name: socket.user.name,
        isTyping
      });
    });

    // Handle read receipts
    socket.on('mark_read', (data) => {
      const { chatId, messageId } = data;
      socket.to(chatId).emit('message_read', {
        chatId,
        messageId,
        userId: socket.user._id
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
}; 