const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Create a new group or channel with members and admins
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, description, members = [], admins = [] } = req.body;
    const userId = req.user.id;

    // Create new group/channel
    const [result] = await pool.query(
      'INSERT INTO chats (name, type, description) VALUES (?, ?, ?)',
      [name, type, description]
    );
    const chatId = result.insertId;

    // Add creator as owner
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
      [chatId, userId, 'owner']
    );

    // Add other members (admins and regular members)
    const uniqueMembers = Array.from(new Set([...members, ...admins])).filter(id => id !== userId);
    for (const memberId of uniqueMembers) {
      const role = admins.includes(memberId) ? 'admin' : 'member';
      await pool.query(
        'INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
        [chatId, memberId, role]
      );
    }

    res.status(201).json({
      chatId,
      name,
      type,
      description
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add member to group/channel
router.post('/:chatId/members', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId, role = 'member' } = req.body;
    const currentUserId = req.user.id;

    // Verify current user has permission to add members
    const [currentUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, currentUserId]
    );

    if (currentUserRole.length === 0 || 
        (currentUserRole[0].role !== 'owner' && currentUserRole[0].role !== 'admin')) {
      return res.status(403).json({ message: 'Not authorized to add members' });
    }

    // Add new member
    await pool.query(
      'INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)',
      [chatId, userId, role]
    );

    res.status(201).json({ message: 'Member added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove member from group/channel
router.delete('/:chatId/members/:userId', auth, async (req, res) => {
  try {
    const { chatId, userId } = req.params;
    const currentUserId = req.user.id;

    const [currentUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, currentUserId]
    );
    const [targetUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (currentUserRole.length === 0) return res.status(403).json({ message: 'Not a member' });

    if (currentUserRole[0].role === 'owner') {
      // Owner gali šalinti bet ką, išskyrus save
      if (userId == currentUserId) return res.status(403).json({ message: 'Cannot remove yourself' });
    } else if (currentUserRole[0].role === 'admin') {
      // Admin gali šalinti tik memberius
      if (targetUserRole[0].role !== 'member') {
        return res.status(403).json({ message: 'Admins can only remove members' });
      }
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Remove member
    await pool.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update member role
router.patch('/:chatId/members/:userId/role', auth, async (req, res) => {
  try {
    const { chatId, userId } = req.params;
    const { role } = req.body;
    const currentUserId = req.user.id;

    const [currentUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, currentUserId]
    );
    const [targetUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (currentUserRole.length === 0) return res.status(403).json({ message: 'Not a member' });

    if (currentUserRole[0].role === 'owner') {
      // Owner gali keisti bet kieno roles (išskyrus save)
      if (userId == currentUserId) return res.status(403).json({ message: 'Cannot change own role' });
    } else if (currentUserRole[0].role === 'admin') {
      // Admin gali padaryti memberį admin, bet negali nuimti admin nuo kito admino ar owner
      if (targetUserRole[0].role !== 'member' || role !== 'admin') {
        return res.status(403).json({ message: 'Admins can only promote members to admin' });
      }
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update role
    await pool.query(
      'UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?',
      [role, chatId, userId]
    );

    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get group/channel members
router.get('/:chatId/members', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const [members] = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, cm.role
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = ?
    `, [chatId]);

    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave group/channel
router.delete('/:chatId/leave', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Remove user from chat
    await pool.query(
      'DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete group/channel (only owner)
router.delete('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    // Check if user is owner
    const [rows] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );
    if (rows.length === 0 || rows[0].role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can delete group/channel' });
    }
    // Delete chat (CASCADE deletes members/messages)
    await pool.query('DELETE FROM chats WHERE id = ?', [chatId]);
    res.json({ message: 'Group/channel deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete message (admin/owner only)
router.delete('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const currentUserId = req.user.id;

    // Check user's role
    const [currentUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, currentUserId]
    );

    if (currentUserRole.length === 0) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Get message info
    const [message] = await pool.query(
      'SELECT sender_id FROM messages WHERE id = ? AND chat_id = ?',
      [messageId, chatId]
    );

    if (message.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check permissions
    const isOwner = currentUserRole[0].role === 'owner';
    const isAdmin = currentUserRole[0].role === 'admin';
    const isMessageOwner = message[0].sender_id === currentUserId;

    // Owner gali ištrinti bet kurią žinutę
    // Admin gali ištrinti bet kurią žinutę
    // Vartotojas gali ištrinti tik savo žinutes
    if (!isOwner && !isAdmin && !isMessageOwner) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Delete message
    await pool.query(
      'DELETE FROM messages WHERE id = ? AND chat_id = ?',
      [messageId, chatId]
    );

    // Delete associated reactions
    await pool.query(
      'DELETE FROM message_reactions WHERE message_id = ?',
      [messageId]
    );

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete all messages in chat (owner only)
router.delete('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user.id;

    // Check if user is owner
    const [currentUserRole] = await pool.query(
      'SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, currentUserId]
    );

    if (currentUserRole.length === 0 || currentUserRole[0].role !== 'owner') {
      return res.status(403).json({ message: 'Only owner can delete all messages' });
    }

    // Delete all messages
    await pool.query(
      'DELETE FROM messages WHERE chat_id = ?',
      [chatId]
    );

    res.json({ message: 'All messages deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update message reaction
router.put('/:chatId/messages/:messageId/reaction', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // Check if user is a member of the chat
    const [member] = await pool.query(
      'SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, userId]
    );

    if (!member.length) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }

    // Update existing reaction
    await pool.query(
      'UPDATE message_reactions SET emoji = ? WHERE message_id = ? AND user_id = ?',
      [emoji, messageId, userId]
    );

    // Get updated reactions
    const [reactions] = await pool.query(
      'SELECT * FROM message_reactions WHERE message_id = ?',
      [messageId]
    );

    res.json({ reactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 