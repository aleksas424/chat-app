# Chat Application

A real-time chat application built with React, Node.js, Express, and MySQL.

## Features

- User authentication (JWT)
- Private messaging
- Group chats
- Channels
- Real-time messaging
- Role-based permissions
- Modern UI with Tailwind CSS

## Project Structure

```
.
├── frontend/          # React frontend application
├── backend/          # Node.js backend server
└── README.md
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the following variables:
   ```
   PORT=5000
   JWT_SECRET=your_jwt_secret
   MYSQL_HOST=localhost
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=chat_app
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Tech Stack

- Frontend: React, Tailwind CSS, shadcn/ui, Socket.IO Client
- Backend: Node.js, Express, MySQL, Socket.IO
- Authentication: JWT
- Database: MySQL 