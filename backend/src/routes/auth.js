const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { sendVerificationEmail } = require('./emailVerification');

// Laikinai saugome verifikacijos kodus (gali būti pakeista į duomenų bazę)
const verificationCodes = new Map();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Siunčiame verifikacijos email
    const verificationCode = await sendVerificationEmail(email);
    
    // Išsaugome verifikacijos kodą (laikinai)
    verificationCodes.set(email, {
      code: verificationCode,
      password: hashedPassword,
      name: name,
      timestamp: Date.now()
    });

    res.status(200).json({ message: 'Verifikacijos kodas išsiųstas į jūsų email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verifikacijos endpoint'as
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const userData = verificationCodes.get(email);

    if (!userData) {
      return res.status(400).json({ message: 'Neteisingas email arba kodas' });
    }

    // Tikriname ar kodas teisingas
    if (userData.code !== code) {
      return res.status(400).json({ message: 'Neteisingas verifikacijos kodas' });
    }

    // Tikriname ar kodas dar galioja (15 minučių)
    if (Date.now() - userData.timestamp > 15 * 60 * 1000) {
      verificationCodes.delete(email);
      return res.status(400).json({ message: 'Verifikacijos kodas nebegalioja' });
    }

    // Create new user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [userData.name, email, userData.password]
    );

    // Išvalome laikiną verifikacijos duomenis
    verificationCodes.delete(email);

    // Generate JWT token
    const token = jwt.sign(
      { id: result.insertId, name: userData.name, email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name: userData.name,
        email
      }
    });
  } catch (error) {
    console.error('Verifikacijos klaida:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if user exists
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    console.log('User found:', users.length > 0);

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 