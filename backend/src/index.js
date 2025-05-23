require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const fileUpload = require('express-fileupload');
const socketIo = require('socket.io');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const groupRoutes = require('./routes/group');
const userRoutes = require('./routes/user');
const { setupSocketHandlers } = require('./sockets/socketHandlers');
const auth = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

// Čia įrašyk savo Vercel frontend URL!
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://chat-app-jade-six.vercel.app',
  'https://chat-app-eeo6.vercel.app' // <-- pridėk šį naują adresą!
];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io available in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(fileUpload())

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', auth, chatRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/users', userRoutes);

// Socket.IO setup
setupSocketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});