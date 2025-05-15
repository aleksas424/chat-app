const nodemailer = require('nodemailer');

// Sukuriame transporter objektą
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Generuojame atsitiktinį verifikacijos kodą
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Siunčiame verifikacijos email
async function sendVerificationEmail(email) {
    const verificationCode = generateVerificationCode();
    
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Jūsų verifikacijos kodas',
        text: `Jūsų verifikacijos kodas yra: ${verificationCode}`
    };

    try {
        await transporter.sendMail(mailOptions);
        return verificationCode;
    } catch (error) {
        console.error('Klaida siunčiant email:', error);
        throw error;
    }
}

module.exports = {
    sendVerificationEmail
}; 