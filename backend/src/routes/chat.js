const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Get all chats for a user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get private chats
    const [privateChats] = await pool.query(`
      SELECT c.id, c.type, c.name, c.created_at,
             CASE 
               WHEN c.type = 'private' THEN u.name
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
      SELECT m.*, u.name as sender_name
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

    res.status(201).json({
      messageId: result.insertId,
      chatId,
      content,
      senderId: userId,
      createdAt: new Date()
    });
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

module.exports = router; 