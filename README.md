# Real-time Chat Application

A modern real-time chat application built with React, Node.js, Express, MongoDB, and Socket.IO.

## Features

- Real-time messaging
- Private and group chats
- User authentication
- Message search
- Typing indicators
- Read receipts
- Online/offline status
- File sharing
- Message notifications

## Tech Stack

### Frontend
- React
- Vite
- Socket.IO Client
- Tailwind CSS
- React Router
- Axios
- React Icons

### Backend
- Node.js
- Express
- MongoDB
- Socket.IO
- JWT Authentication
- Mongoose

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/chat_app
   JWT_SECRET=your_jwt_secret_key_here
   FRONTEND_URL=http://localhost:5173
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the frontend directory with the following variables:
   ```
   VITE_API_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── socket.js
│   │   └── server.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── .env
└── README.md
```

## API Endpoints

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- GET /api/auth/me - Get current user

### Users
- GET /api/users - Get all users
- GET /api/users/:id - Get user by ID
- PUT /api/users/:id - Update user
- DELETE /api/users/:id - Delete user

### Chats
- GET /api/chat - Get all chats for current user
- POST /api/chat/private - Create private chat
- POST /api/chat/group - Create group chat
- GET /api/chat/:chatId/messages - Get chat messages
- POST /api/chat/:chatId/members - Add member to group chat
- DELETE /api/chat/:chatId/members/:userId - Remove member from group chat
- GET /api/chat/search - Search messages

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 