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
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR (first_name = ? AND last_name = ?)',
      [email, firstName, lastName]
    );

    if (existingUsers.length > 0) {
      if (existingUsers[0].email === email) {
        return res.status(400).json({ message: 'Vartotojas su tokiu el. paštu jau egzistuoja' });
      } else {
        return res.status(400).json({ message: 'Vartotojas su tokiu vardu ir pavarde jau egzistuoja' });
      }
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
      firstName: firstName,
      lastName: lastName,
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
      'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)',
      [userData.firstName, userData.lastName, email, userData.password]
    );

    // Išvalome laikiną verifikacijos duomenis
    verificationCodes.delete(email);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.insertId, 
        firstName: userData.firstName,
        lastName: userData.lastName,
        email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email
      }
    });
  } catch (error) {
    console.error('Verifikacijos klaida:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send login verification code
router.post('/send-login-code', async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Vartotojas su tokiu el. paštu nerastas' });
    }

    // Send verification code
    const verificationCode = await sendVerificationEmail(email);
    
    // Store verification code temporarily
    verificationCodes.set(email, {
      code: verificationCode,
      timestamp: Date.now()
    });

    res.status(200).json({ message: 'Verifikacijos kodas išsiųstas į jūsų email' });
  } catch (error) {
    console.error('Error sending login code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login with verification code
router.post('/login', async (req, res) => {
  try {
    const { email, code } = req.body;

    // Check if user exists
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Vartotojas su tokiu el. paštu nerastas' });
    }

    const user = users[0];
    const userData = verificationCodes.get(email);

    if (!userData) {
      return res.status(400).json({ message: 'Neteisingas email arba kodas' });
    }

    // Check if code is correct
    if (userData.code !== code) {
      return res.status(400).json({ message: 'Neteisingas verifikacijos kodas' });
    }

    // Check if code is still valid (15 minutes)
    if (Date.now() - userData.timestamp > 15 * 60 * 1000) {
      verificationCodes.delete(email);
      return res.status(400).json({ message: 'Verifikacijos kodas nebegalioja' });
    }

    // Clear verification data
    verificationCodes.delete(email);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
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
      'SELECT id, first_name, last_name, email FROM users WHERE id = ?',
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