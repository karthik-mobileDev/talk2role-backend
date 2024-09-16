const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const waitingUsers = {
  IT: [],
  'Non-IT': [],
  Government: [],
};

const connectedPeers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (data) => {
    const { role, username } = data;
    console.log(`User ${username} (${socket.id}) joined with role: ${role}`);
    waitingUsers[role].push({ socket, username });

    if (waitingUsers[role].length >= 2) {
      const user1 = waitingUsers[role].shift();
      const user2 = waitingUsers[role].shift();

      console.log(`Matching ${user1.username} (${user1.socket.id}) with ${user2.username} (${user2.socket.id})`);

      connectedPeers.set(user1.socket.id, user2.socket.id);
      connectedPeers.set(user2.socket.id, user1.socket.id);

      user1.socket.emit('match', { partnerUsername: user2.username, initiator: true });
      user2.socket.emit('match', { partnerUsername: user1.username, initiator: false });
    }
  });

  socket.on('offer', (offer) => {
    const partnerId = connectedPeers.get(socket.id);
    if (partnerId) {
      console.log(`Offer from ${socket.id} to ${partnerId}`);
      io.to(partnerId).emit('offer', offer);
    }
  });

  socket.on('answer', (answer) => {
    const partnerId = connectedPeers.get(socket.id);
    if (partnerId) {
      console.log(`Answer from ${socket.id} to ${partnerId}`);
      io.to(partnerId).emit('answer', answer);
    }
  });

  socket.on('ice-candidate', (candidate) => {
    const partnerId = connectedPeers.get(socket.id);
    if (partnerId) {
      console.log(`ICE candidate from ${socket.id} to ${partnerId}`);
      io.to(partnerId).emit('ice-candidate', candidate);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const partnerId = connectedPeers.get(socket.id);
    if (partnerId) {
      console.log(`Notifying partner ${partnerId} about disconnection`);
      io.to(partnerId).emit('partner-disconnected');
      connectedPeers.delete(partnerId);
    }
    connectedPeers.delete(socket.id);

    // Remove from waiting lists
    for (const role in waitingUsers) {
      const index = waitingUsers[role].findIndex(user => user.socket.id === socket.id);
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