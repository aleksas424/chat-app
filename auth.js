const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail } = require('./emailVerification');

// Laikinai saugome verifikacijos kodus (gali būti pakeista į duomenų bazę)
const verificationCodes = new Map();

// Registracijos endpoint'as
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;

        // Siunčiame verifikacijos email
        const verificationCode = await sendVerificationEmail(email);
        
        // Išsaugome verifikacijos kodą (laikinai)
        verificationCodes.set(email, {
            code: verificationCode,
            password: await bcrypt.hash(password, 10),
            username: username,
            timestamp: Date.now()
        });

        res.json({ message: 'Verifikacijos kodas išsiųstas į jūsų email' });
    } catch (error) {
        console.error('Registracijos klaida:', error);
        res.status(500).json({ error: 'Registracijos klaida' });
    }
});

// Verifikacijos endpoint'as
router.post('/verify', async (req, res) => {
    try {
        const { email, code } = req.body;
        const userData = verificationCodes.get(email);

        if (!userData) {
            return res.status(400).json({ error: 'Neteisingas email arba kodas' });
        }

        // Tikriname ar kodas teisingas
        if (userData.code !== code) {
            return res.status(400).json({ error: 'Neteisingas verifikacijos kodas' });
        }

        // Tikriname ar kodas dar galioja (15 minučių)
        if (Date.now() - userData.timestamp > 15 * 60 * 1000) {
            verificationCodes.delete(email);
            return res.status(400).json({ error: 'Verifikacijos kodas nebegalioja' });
        }

        // Čia galite pridėti kodą, kuris išsaugo vartotoją į duomenų bazę
        // const user = await User.create({
        //     email,
        //     password: userData.password,
        //     username: userData.username
        // });

        // Išvalome laikiną verifikacijos duomenis
        verificationCodes.delete(email);

        // Generuojame JWT token
        const token = jwt.sign(
            { email: email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            message: 'Registracija sėkminga',
            token: token
        });
    } catch (error) {
        console.error('Verifikacijos klaida:', error);
        res.status(500).json({ error: 'Verifikacijos klaida' });
    }
});

// Prisijungimo endpoint'as
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Čia turėtumėte patikrinti vartotoją duomenų bazėje
        // const user = await User.findOne({ email });
        // if (!user) {
        //     return res.status(400).json({ error: 'Vartotojas nerastas' });
        // }

        // const validPassword = await bcrypt.compare(password, user.password);
        // if (!validPassword) {
        //     return res.status(400).json({ error: 'Neteisingas slaptažodis' });
        // }

        const token = jwt.sign(
            { email: email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token: token });
    } catch (error) {
        console.error('Prisijungimo klaida:', error);
        res.status(500).json({ error: 'Prisijungimo klaida' });
    }
});

module.exports = router; 