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
      socket.userName = decoded.name;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    // Handle new messages
    socket.on('message', async (data) => {
      try {
        const { text } = data;

        // Insert message into database
        const [result] = await pool.query(
          'INSERT INTO messages (sender_id, content) VALUES (?, ?)',
          [socket.userId, text]
        );

        const message = {
          id: result.insertId,
          text,
          user: socket.userName,
          userId: socket.userId,
          timestamp: new Date()
        };

        // Broadcast to all connected clients
        io.emit('message', message);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.userId);
    });
  });
};

module.exports = { setupSocketHandlers }; 