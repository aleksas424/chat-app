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

    // Update user status to online
    socket.on('connect', async () => {
      try {
        await pool.query(
          'UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
          ['online', socket.userId]
        );
        io.emit('user-status-changed', {
          userId: socket.userId,
          status: 'online',
          lastSeen: new Date()
        });
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    });

    // Join chat rooms
    socket.on('join-chats', async (chatIds) => {
      try {
        // Verify user is a member of these chats
        const [memberships] = await pool.query(
          'SELECT chat_id FROM chat_members WHERE user_id = ? AND chat_id IN (?)',
          [socket.userId, chatIds]
        );
        
        const validChatIds = memberships.map(m => m.chat_id);
        socket.join(validChatIds.map(id => `chat:${id}`));
      } catch (error) {
        console.error('Error joining chats:', error);
      }
    });

    // Handle new messages
    socket.on('message', async (data) => {
      try {
        const { chatId, content } = data;

        // Verify user is a member of the chat
        const [members] = await pool.query(
          'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, socket.userId]
        );

        if (members.length === 0) {
          socket.emit('error', { message: 'Not a member of this chat' });
          return;
        }

        // Insert message into database
        const [result] = await pool.query(
          'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
          [chatId, socket.userId, content]
        );

        // Get the full message with sender info
        const [rows] = await pool.query(`
          SELECT m.*, u.name as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.id = ?
        `, [result.insertId]);

        const message = rows[0];

        // Broadcast to chat room
        io.to(`chat:${chatId}`).emit('new-message', {
          id: message.id,
          chatId: message.chat_id,
          content: message.content,
          senderId: message.sender_id,
          senderName: message.sender_name,
          createdAt: message.created_at
        });

        // Update last message in chat
        await pool.query(
          'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [chatId]
        );
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing status
    socket.on('typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-typing', {
        userId: socket.userId,
        chatId
      });
    });

    socket.on('stop-typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-stop-typing', {
        userId: socket.userId,
        chatId
      });
    });

    // Handle message reactions
    socket.on('add-reaction', async ({ messageId, chatId, emoji }) => {
      try {
        // Verify user is a member of the chat
        const [members] = await pool.query(
          'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, socket.userId]
        );

        if (members.length === 0) {
          socket.emit('error', { message: 'Not a member of this chat' });
          return;
        }

        // Add or update reaction
        await pool.query(
          'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE emoji = VALUES(emoji)',
          [messageId, socket.userId, emoji]
        );

        // Get updated reactions
        const [reactions] = await pool.query(`
          SELECT mr.*, u.name as user_name
          FROM message_reactions mr
          JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id = ?
        `, [messageId]);

        // Broadcast updated reactions
        io.to(`chat:${chatId}`).emit('new-reaction', {
          messageId,
          reactions
        });
      } catch (error) {
        console.error('Error adding reaction:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // Handle message read status
    socket.on('mark-read', async ({ messageIds, chatId }) => {
      try {
        // Verify user is a member of the chat
        const [members] = await pool.query(
          'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, socket.userId]
        );

        if (members.length === 0) {
          socket.emit('error', { message: 'Not a member of this chat' });
          return;
        }

        // Mark messages as read
        const values = messageIds.map(messageId => [messageId, socket.userId]);
        await pool.query(
          'INSERT INTO message_reads (message_id, user_id) VALUES ? ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP',
          [values]
        );

        // Get read status
        const [reads] = await pool.query(`
          SELECT mr.*, u.name as user_name
          FROM message_reads mr
          JOIN users u ON mr.user_id = u.id
          WHERE mr.message_id IN (?)
        `, [messageIds]);

        // Broadcast read status
        io.to(`chat:${chatId}`).emit('messages-read', {
          messageIds,
          userId: socket.userId,
          reads
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        await pool.query(
          'UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
          ['offline', socket.userId]
        );
        io.emit('user-status-changed', {
          userId: socket.userId,
          status: 'offline',
          lastSeen: new Date()
        });
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    });
  });
};

module.exports = { setupSocketHandlers }; 