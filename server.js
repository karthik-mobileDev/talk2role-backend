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
  IT: new Map(),
  'Non-IT': new Map(),
  Government: new Map(),
};

const connectedPeers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (data) => {
    const { role, username } = data;

    // Check if the user is already in the waiting list
    if (!waitingUsers[role].has(socket.id)) {
      console.log(`User ${username} (${socket.id}) joined with role: ${role}`);
      waitingUsers[role].set(socket.id, { socket, username });

      if (waitingUsers[role].size >= 2) {
        const users = Array.from(waitingUsers[role].values());
        const user1 = users[0];
        const user2 = users[1];

        console.log(`Matching ${user1.username} (${user1.socket.id}) with ${user2.username} (${user2.socket.id})`);

        connectedPeers.set(user1.socket.id, user2.socket.id);
        connectedPeers.set(user2.socket.id, user1.socket.id);

        user1.socket.emit('match', { partnerUsername: user2.username, initiator: true });
        user2.socket.emit('match', { partnerUsername: user1.username, initiator: false });

        // Remove matched users from the waiting list
        waitingUsers[role].delete(user1.socket.id);
        waitingUsers[role].delete(user2.socket.id);
      }
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
      if (waitingUsers[role].has(socket.id)) {
        console.log(`Removed disconnected user from ${role} waiting list`);
        waitingUsers[role].delete(socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});