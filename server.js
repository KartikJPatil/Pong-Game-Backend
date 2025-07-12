const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
// For deployment: Use process.env.PORT or default to 4000
const PORT = process.env.PORT || 4000;
const io = new Server(server, {
  cors: { origin: "*" }
});

const games = {}; // roomCode => { players: [socketId, ...], state }

io.on("connection", (socket) => {
  console.log(`[CONNECT] Socket ${socket.id} connected`);

  // Join room
  socket.on("join", ({ room }) => {
    if (!games[room]) games[room] = { players: [], state: null };
    if (games[room].players.length < 2) {
      games[room].players.push(socket.id);
      socket.join(room);
      io.to(room).emit("players", games[room].players.length);
      console.log(`[JOIN] Socket ${socket.id} joined room ${room}. Players: ${games[room].players.length}`);

      // Host (first) initializes state
      if (games[room].players.length === 1) {
        socket.emit("host");
        console.log(`[ROLE] Socket ${socket.id} is HOST for room ${room}`);
      } else if (games[room].players.length === 2) {
        socket.emit("guest");
        console.log(`[ROLE] Socket ${socket.id} is GUEST for room ${room}`);
      }
    } else {
      socket.emit("full");
      console.log(`[FULL] Room ${room} is full. Socket ${socket.id} rejected`);
    }
  });

  // Sync game state from host
  socket.on("sync_state", ({ room, state }) => {
    socket.to(room).emit("state_update", state);
    // Optionally store state for debugging or reconnection
    if (games[room]) games[room].state = state;
  });

  // Guest paddle input
  socket.on("paddle_input", ({ room, input }) => {
    socket.to(room).emit("guest_paddle_input", input);
  });

  // Leave room
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (games[room]) {
        games[room].players = games[room].players.filter(id => id !== socket.id);
        console.log(`[LEAVE] Socket ${socket.id} left room ${room}. Players now: ${games[room].players.length}`);
        if (games[room].players.length === 0) {
          delete games[room];
          console.log(`[CLEANUP] Room ${room} deleted`);
        } else {
          io.to(room).emit("players", games[room].players.length);
        }
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[DISCONNECT] Socket ${socket.id} disconnected: ${reason}`);
  });
});

server.listen(PORT, () => console.log(`Pong server listening on *:${PORT}`));
