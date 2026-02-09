const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

// Store messages in memory (for production use database)
let messages = [];
let users = new Map(); // socketId -> username

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

  // Update online count for all users
  io.emit('online count', users.size + 1);

  // User sets their username
  socket.on('set username', (username) => {
    users.set(socket.id, username);
    console.log(`User ${username} connected`);
    
    // Broadcast system message
    const systemMessage = {
      id: Date.now(),
      author: 'Система',
      text: `${username} приєднався до чату`,
      timestamp: new Date().toISOString(),
      isSystem: true
    };
    io.emit('new message', systemMessage);
    
    // Update online count
    io.emit('online count', users.size);
  });

  // Receive new message
  socket.on('send message', (data) => {
    const message = {
      id: Date.now() + Math.random(),
      author: data.author,
      text: data.text,
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
    const username = users.get(socket.id);
    if (username) {
      console.log(`User ${username} disconnected`);
      
      const systemMessage = {
        id: Date.now(),
        author: 'Система',
        text: `${username} покинув чат`,
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
