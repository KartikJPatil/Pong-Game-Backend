const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const io = new Server(server, {
  cors: { origin: "*" }
});

const games = {}; // roomCode => { players: [socketId, ...], sides: {}, ball: {}, scores: {} }

io.on("connection", (socket) => {
  console.log(`[CONNECT] Socket ${socket.id} connected`);

  // Join room
  socket.on("join", ({ room }) => {
    if (!games[room]) games[room] = { players: [], sides: {}, ball: null, scores: { left: 0, right: 0 } };
    if (games[room].players.length < 2) {
      games[room].players.push(socket.id);
      socket.join(room);

      // Assign sides: first is 'left', second is 'right'
      const side = games[room].players.length === 1 ? "left" : "right";
      games[room].sides[socket.id] = side;
      socket.emit("side", side);

      io.to(room).emit("players", games[room].players.length);
      console.log(`[JOIN] Socket ${socket.id} joined room ${room} as ${side}. Players: ${games[room].players.length}`);
    } else {
      socket.emit("full");
      console.log(`[FULL] Room ${room} is full. Socket ${socket.id} rejected`);
    }
  });

  // Relay paddle movement to the other player
  socket.on("paddle_move", ({ room, position }) => {
    const side = games[room]?.sides?.[socket.id];
    if (!side) return;
    socket.to(room).emit("opponent_paddle_move", { side, position });
  });

  // Relay ball state to the other player (authority: left side)
  socket.on("ball_update", ({ room, ball }) => {
    // Save authoritative ball state for resync/reconnect
    if (games[room]) games[room].ball = ball;
    socket.to(room).emit("ball_update", { ball });
  });

  // Relay score update (optional, if you want both to update score)
  socket.on("score_update", ({ room, scores }) => {
    if (games[room]) games[room].scores = scores;
    socket.to(room).emit("score_update", { scores });
  });

  // Handle disconnects and cleanup
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (games[room]) {
        games[room].players = games[room].players.filter(id => id !== socket.id);
        delete games[room].sides[socket.id];
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
