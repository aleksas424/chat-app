const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../config/database');

// Get all users (except current user)
router.get('/', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE id != ?',
      [req.user.id]
    );
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 