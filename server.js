const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const games = {}; // roomCode => { players: [socketId, ...], state }

io.on("connection", (socket) => {
  // Join room
  socket.on("join", ({ room }) => {
    if (!games[room]) games[room] = { players: [], state: null };
    if (games[room].players.length < 2) {
      games[room].players.push(socket.id);
      socket.join(room);
      io.to(room).emit("players", games[room].players.length);

      // Host (first) initializes state
      if (games[room].players.length === 1) {
        socket.emit("host");
      }
    } else {
      socket.emit("full");
    }
  });

  // Sync game state from host
  socket.on("sync_state", ({ room, state }) => {
    socket.to(room).emit("state_update", state);
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
        if (games[room].players.length === 0) delete games[room];
        else io.to(room).emit("players", games[room].players.length);
      }
    }
  });
});

server.listen(4000, () => console.log("Pong server listening on *:4000"));