const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const waitingUsers = {
  IT: [],
  'Non-IT': [],
  Government: [],
};

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join', (data) => {
    const { role, username } = data;
    console.log(`User ${username} joined with role: ${role}`);
    waitingUsers[role].push({ socket, username });

    if (waitingUsers[role].length >= 2) {
      const user1 = waitingUsers[role].shift();
      const user2 = waitingUsers[role].shift();

      console.log(`Matching ${user1.username} with ${user2.username}`);

      user1.socket.emit('match', { partnerUsername: user2.username });
      user2.socket.emit('match', { partnerUsername: user1.username });

      user1.socket.on('offer', (offer) => {
        console.log(`Offer from ${user1.username} to ${user2.username}`);
        user2.socket.emit('offer', offer);
      });
      user2.socket.on('answer', (answer) => {
        console.log(`Answer from ${user2.username} to ${user1.username}`);
        user1.socket.emit('answer', answer);
      });

      user1.socket.on('ice-candidate', (candidate) => {
        console.log(`ICE candidate from ${user1.username} to ${user2.username}`);
        user2.socket.emit('ice-candidate', candidate);
      });
      user2.socket.on('ice-candidate', (candidate) => {
        console.log(`ICE candidate from ${user2.username} to ${user1.username}`);
        user1.socket.emit('ice-candidate', candidate);
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    // Remove the disconnected user from waiting lists
    for (const role in waitingUsers) {
      const index = waitingUsers[role].findIndex(user => user.socket === socket);
      if (index !== -1) {
        console.log(`Removed disconnected user from ${role} waiting list`);
        waitingUsers[role].splice(index, 1);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});