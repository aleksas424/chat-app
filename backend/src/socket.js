const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.name}`);

    // Update user status to online
    await User.findByIdAndUpdate(socket.user._id, {
      status: 'online',
      lastSeen: new Date()
    });

    // Join user's chat rooms
    const userChats = await Chat.find({ members: socket.user._id });
    userChats.forEach(chat => {
      socket.join(chat._id.toString());
    });

    // Broadcast user's online status to all their chats
    userChats.forEach(chat => {
      socket.to(chat._id.toString()).emit('user_status_change', {
        userId: socket.user._id,
        status: 'online'
      });
    });

    // Handle joining a chat
    socket.on('join_chat', async (chatId) => {
      socket.join(chatId);
    });

    // Handle leaving a chat
    socket.on('leave_chat', async (chatId) => {
      socket.leave(chatId);
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content } = data;

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.members.includes(socket.user._id)) {
          return;
        }

        const message = new Message({
          chatId,
          senderId: socket.user._id,
          content,
          readBy: [socket.user._id]
        });

        await message.save();
        await message.populate('senderId', 'name');

        // Update chat's last message
        chat.lastMessage = message._id;
        await chat.save();

        io.to(chatId).emit('new_message', message);
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    // Handle typing status
    socket.on('typing', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('typing', {
        chatId,
        userId: socket.user._id,
        name: socket.user.name
      });
    });

    // Handle read receipts
    socket.on('mark_read', async (data) => {
      try {
        const { messageId } = data;
        const message = await Message.findById(messageId);
        
        if (message && !message.readBy.includes(socket.user._id)) {
          message.readBy.push(socket.user._id);
          await message.save();
          
          io.to(message.chatId.toString()).emit('message_read', {
            messageId,
            userId: socket.user._id
          });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
}; 