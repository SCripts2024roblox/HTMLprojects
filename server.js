const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  maxHttpBufferSize: 5e6 // 5MB max file size
});
const path = require('path');

const PORT = process.env.PORT || 3000;

// Store messages in memory (for production use database)
let messages = [];
let users = new Map(); // socketId -> {username, avatar}

// Serve static files
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Send existing messages to new user
  socket.emit('load messages', messages);

  // Send all user avatars
  const userAvatars = Array.from(users.values()).map(u => ({
    username: u.username,
    avatar: u.avatar
  }));
  socket.emit('load avatars', userAvatars);

  // Update online count for all users
  io.emit('online count', users.size + 1);

  // User sets their username and avatar
  socket.on('set username', (data) => {
    users.set(socket.id, {
      username: data.username,
      avatar: data.avatar || null
    });
    console.log(`User ${data.username} connected`);
    
    // Broadcast user avatar to all
    io.emit('user avatar', {
      username: data.username,
      avatar: data.avatar
    });
    
    // Broadcast system message
    const systemMessage = {
      id: Date.now(),
      author: 'Система',
      text: `${data.username} приєднався до чату`,
      timestamp: new Date().toISOString(),
      isSystem: true
    };
    io.emit('new message', systemMessage);
    
    // Update online count
    io.emit('online count', users.size);
  });

  // Update user avatar
  socket.on('update avatar', (data) => {
    const user = users.get(socket.id);
    if (user) {
      user.avatar = data.avatar;
      users.set(socket.id, user);
      
      // Broadcast to all users
      io.emit('user avatar', {
        username: user.username,
        avatar: data.avatar
      });
    }
  });

  // Receive new message (text or image)
  socket.on('send message', (data) => {
    const message = {
      id: Date.now() + Math.random(),
      author: data.author,
      text: data.text || '',
      image: data.image || null,
      timestamp: new Date().toISOString(),
      isSystem: false
    };

    messages.push(message);
    
    // Keep only last 100 messages
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }

    // Broadcast to all users
    io.emit('new message', message);
  });

  // User typing indicator
  socket.on('typing', (username) => {
    socket.broadcast.emit('user typing', username);
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('user stop typing');
  });

  // User disconnects
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      console.log(`User ${user.username} disconnected`);
      
      const systemMessage = {
        id: Date.now(),
        author: 'Система',
        text: `${user.username} покинув чат`,
        timestamp: new Date().toISOString(),
        isSystem: true
      };
      io.emit('new message', systemMessage);
      
      users.delete(socket.id);
      io.emit('online count', users.size);
    }
  });
});

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
