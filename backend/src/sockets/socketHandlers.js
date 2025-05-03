const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const setupSocketHandlers = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    // Join chat rooms
    socket.on('join-chats', async (chatIds) => {
      chatIds.forEach(chatId => {
        socket.join(`chat:${chatId}`);
      });
    });

    // Handle new messages
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content } = data;

        // Verify user is a member of the chat
        const [members] = await pool.query(
          'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, socket.userId]
        );

        if (members.length === 0) {
          return socket.emit('error', { message: 'Not a member of this chat' });
        }

        // Insert message into database
        const [result] = await pool.query(
          'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
          [chatId, socket.userId, content]
        );

        // Get sender info
        const [users] = await pool.query(
          'SELECT name FROM users WHERE id = ?',
          [socket.userId]
        );

        const message = {
          id: result.insertId,
          chatId,
          content,
          senderId: socket.userId,
          senderName: users[0].name,
          createdAt: new Date()
        };

        // Broadcast message to chat room
        io.to(`chat:${chatId}`).emit('new-message', message);
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('user-typing', {
        userId: socket.userId,
        chatId
      });
    });

    // Handle stop typing
    socket.on('stop-typing', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('user-stop-typing', {
        userId: socket.userId,
        chatId
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
    });
  });
};

module.exports = { setupSocketHandlers }; 