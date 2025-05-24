const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/database');
const path = require('path');
const axios = require('axios')
const fs = require('fs');
const FormData = require('form-data');

// Get all chats for a user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get private chats
    const [privateChats] = await pool.query(`
      SELECT c.id, c.type, c.name, c.created_at,
             CASE 
               WHEN c.type = 'private' THEN CONCAT(u.first_name, ' ', u.last_name)
               ELSE c.name
             END as display_name
      FROM chats c
      LEFT JOIN chat_members cm ON c.id = cm.chat_id
      LEFT JOIN users u ON (
        c.type = 'private' AND 
        u.id != ? AND 
        u.id IN (SELECT user_id FROM chat_members WHERE chat_id = c.id)
      )
      WHERE cm.user_id = ?
    `, [userId, userId]);

    res.json(privateChats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a specific chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Get messages
    const [messages] = await pool.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ?
      ORDER BY m.created_at ASC
    `, [chatId]);

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new private chat
router.post('/private', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    // Check if chat already exists
    const [existingChats] = await pool.query(`
      SELECT c.id
      FROM chats c
      JOIN chat_members cm1 ON c.id = cm1.chat_id
      JOIN chat_members cm2 ON c.id = cm2.chat_id
      WHERE c.type = 'private'
      AND cm1.user_id = ?
      AND cm2.user_id = ?
    `, [currentUserId, userId]);

    if (existingChats.length > 0) {
      return res.json({ chatId: existingChats[0].id });
    }

    // Create new chat
    const [chatResult] = await pool.query(
      'INSERT INTO chats (type) VALUES (?)',
      ['private']
    );

    const chatId = chatResult.insertId;

    // Add members to chat
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?), (?, ?)',
      [chatId, currentUserId, chatId, userId]
    );

    res.status(201).json({ chatId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Insert message
    const [result] = await pool.query(
      'INSERT INTO messages (chat_id, sender_id, content) VALUES (?, ?, ?)',
      [chatId, userId, content]
    );

    // Get the full message with sender info
    const [rows] = await pool.query(
      `SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
      [result.insertId]
    );
    const newMessage = rows && rows.length > 0 ? rows[0] : null;

    // Emit socket event to all clients (optionally, only to chat members)
    const io = req.app.get('io');
    if (io && newMessage) {
      io.emit('new-message', {
        id: newMessage.id,
        chatId: newMessage.chat_id,
        content: newMessage.content,
        senderId: newMessage.sender_id,
        senderName: newMessage.sender_name,
        createdAt: newMessage.created_at
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a chat
router.delete('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Delete chat messages
    await pool.query('DELETE FROM messages WHERE chat_id = ?', [chatId]);

    // Delete chat members
    await pool.query('DELETE FROM chat_members WHERE chat_id = ?', [chatId]);

    // Delete chat
    await pool.query('DELETE FROM chats WHERE id = ?', [chatId]);

    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all messages
router.get('/messages', async (req, res) => {
  try {
    const [messages] = await pool.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as user_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      ORDER BY m.created_at DESC 
      LIMIT 50
    `);

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      text: msg.content,
      user: msg.user_name,
      userId: msg.sender_id,
      timestamp: msg.created_at
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Pridėti/pašalinti reakciją prie žinutės (toggle)
router.post('/:chatId/messages/:messageId/reaction', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Patikrinti ar vartotojas yra pokalbio narys
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Patikrinti ar jau yra tokia reakcija
    const [existing] = await pool.query(
      'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [messageId, userId, emoji]
    );

    if (existing.length > 0) {
      // Jei jau yra, pašalinti reakciją (toggle off)
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        [messageId, userId, emoji]
      );
    } else {
      // Jei nėra, pridėti reakciją (toggle on)
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)',
        [messageId, userId, emoji]
      );
    }

    // Gauti visas reakcijas šiai žinutei
    const [reactions] = await pool.query(
      'SELECT user_id, emoji FROM message_reactions WHERE message_id = ?',
      [messageId]
    );

    // Siųsti socket.io įvykį visiems
    const io = req.app.get('io');
    if (io) {
      io.emit('new-reaction', {
        messageId: Number(messageId),
        chatId: Number(chatId),
        reactions
      });
    }

    res.json({ success: true, reactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Edit a message
router.patch('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Get the message to verify ownership
    const [messages] = await pool.query(
      'SELECT * FROM messages WHERE id = ? AND chat_id = ?',
      [messageId, chatId]
    );

    if (messages.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (messages[0].sender_id !== userId) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    // Update the message
    await pool.query(
      'UPDATE messages SET content = ?, is_edited = true, edited_at = NOW() WHERE id = ?',
      [content, messageId]
    );

    // Get the updated message
    const [updatedMessage] = await pool.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [messageId]);

    res.json(updatedMessage && updatedMessage.length > 0 ? updatedMessage[0] : null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a message
router.delete('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Get the message to verify ownership
    const [messages] = await pool.query(
      'SELECT * FROM messages WHERE id = ? AND chat_id = ?',
      [messageId, chatId]
    );

    if (messages.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (messages[0].sender_id !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Delete the message
    await pool.query('DELETE FROM messages WHERE id = ?', [messageId]);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('message-deleted', {
        messageId: Number(messageId),
        chatId: Number(chatId)
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search messages in a chat
router.get('/:chatId/messages/search', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query } = req.query;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Search messages
    const [messages] = await pool.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ? AND m.content LIKE ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [chatId, `%${query}%`]);

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload file for a message
router.post('/:chatId/messages/file', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const file = req.files?.file; // <-- this is correct for express-fileupload

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Validate file
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: 'File size too large (max 10MB)' });
    }

    console.log('File uploaded:', file.name, 'Size:', file.size, 'Type:', file.mimetype);

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ message: 'File type not allowed' });
    }

    // Generate unique filename
    const uniqueFilename = `${Date.now()}-${file.name}`;
    //const uploadPath = path.join(__dirname, '../../uploads', uniqueFilename);

    // Save file
    //await file.mv(uploadPath);

    const formData = new FormData();
    formData.append('file', file.data, {
      filename: file.name,
      contentType: file.mimetype,
      knownLength: file.size
    });

    const responseApi = await axios.post('https://api.fivemerr.com/v1/media/images',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': 'fe4b24520b9211b2bbbf1900a892f040'
        }
      }
    )

    if (responseApi.status !== 200) {
      return res.status(500).json({ message: 'Failed to upload file' });
    }

    const fileUploadedUrl = responseApi.data.url;

    // Insert message with file info
    const [result] = await pool.query(
      'INSERT INTO messages (chat_id, sender_id, content, file_name, file_path, file_type) VALUES (?, ?, ?, ?, ?, ?)',
      [chatId, userId, file.name, file.name, fileUploadedUrl, file.mimetype]
    );

    // Get the full message with sender info
    const [rows] = await pool.query(`
      SELECT m.*, u.name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);
    const newMessage = rows && rows.length > 0 ? rows[0] : null;

    // Emit socket event
    const io = req.app.get('io');
    if (io && newMessage) {
      io.emit('new-message', {
        id: newMessage.id,
        chatId: newMessage.chat_id,
        content: newMessage.content,
        senderId: newMessage.sender_id,
        senderName: newMessage.sender_name,
        createdAt: newMessage.created_at,
        fileName: newMessage.file_name,
        filePath: newMessage.file_path,
        fileType: newMessage.file_type
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status
router.post('/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.user.id;

    // Update user status
    await pool.query(
      'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
      [status, userId]
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('user-status-changed', {
        userId,
        status,
        lastSeen: new Date()
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statuses
router.get('/statuses', auth, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT id, CONCAT(first_name, ' ', last_name) as name, status, last_seen
      FROM users
      WHERE id IN (
        SELECT DISTINCT user_id
        FROM chat_members
        WHERE chat_id IN (
          SELECT chat_id
          FROM chat_members
          WHERE user_id = ?
        )
      )
    `, [req.user.id]);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.post('/:chatId/messages/read', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    const { messageIds } = req.body;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Mark messages as read
    await pool.query(
      'INSERT INTO message_reads (message_id, user_id) VALUES ? ON DUPLICATE KEY UPDATE read_at = NOW()',
      [messageIds.map(id => [id, userId])]
    );

    // Get read status for all messages
    const [reads] = await pool.query(`
      SELECT message_id, user_id, read_at
      FROM message_reads
      WHERE message_id IN (?)
    `, [messageIds]);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('messages-read', {
        messageIds,
        userId,
        reads
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get message read status
router.get('/:chatId/messages/:messageId/reads', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Get read status
    const [reads] = await pool.query(`
      SELECT mr.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM message_reads mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = ?
    `, [messageId]);

    res.json(reads);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [counts] = await pool.query(`
      SELECT c.id as chat_id, COUNT(m.id) as unread_count
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      LEFT JOIN messages m ON c.id = m.chat_id
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = ?
      WHERE cm.user_id = ? AND m.id IS NOT NULL AND mr.message_id IS NULL
      GROUP BY c.id
    `, [userId, userId]);

    res.json(counts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notification settings
router.post('/notification-settings', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId, sound, desktop } = req.body;

    await pool.query(
      'INSERT INTO notification_settings (user_id, chat_id, sound, desktop) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE sound = VALUES(sound), desktop = VALUES(desktop)',
      [userId, chatId, sound, desktop]
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notification settings
router.get('/notification-settings', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [settings] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [userId]
    );

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Pin a message
router.post('/:chatId/messages/:messageId/pin', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Verify user has permission to pin messages
    if (members[0].role !== 'owner' && members[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only owners and admins can pin messages' });
    }

    // Unpin any previously pinned message
    await pool.query(
      'UPDATE messages SET pinned = false WHERE chat_id = ? AND pinned = true',
      [chatId]
    );

    // Pin the new message
    await pool.query(
      'UPDATE messages SET pinned = true WHERE id = ? AND chat_id = ?',
      [messageId, chatId]
    );

    // Get the pinned message
    const [pinnedMessage] = await pool.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [messageId]);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('message-pinned', {
        chatId: Number(chatId),
        message: pinnedMessage[0]
      });
    }

    res.json(pinnedMessage && pinnedMessage.length > 0 ? pinnedMessage[0] : null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unpin a message
router.post('/:chatId/messages/:messageId/unpin', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Verify user has permission to unpin messages
    if (members[0].role !== 'owner' && members[0].role !== 'admin') {
      return res.status(403).json({ message: 'Only owners and admins can unpin messages' });
    }

    // Unpin the message
    await pool.query(
      'UPDATE messages SET pinned = false WHERE id = ? AND chat_id = ?',
      [messageId, chatId]
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('message-unpinned', {
        chatId: Number(chatId),
        messageId: Number(messageId)
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get pinned message for a chat
router.get('/:chatId/pinned-message', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify user is a member of the chat
    const [members] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (members.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Get pinned message
    const [pinnedMessage] = await pool.query(`
      SELECT m.*, CONCAT(u.first_name, ' ', u.last_name) as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = ? AND m.pinned = true
    `, [chatId]);

    res.json(pinnedMessage && pinnedMessage.length > 0 ? pinnedMessage[0] : null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 