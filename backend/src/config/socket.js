const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: true, // Dynamically allow the requesting origin
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    },
    transports: ["polling", "websocket"], // Allow fallback to polling
    allowEIO3: true // Compatibility for older clients if needed
  });

  io.on("connection", (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on("join", (userId) => {
      socket.join(`user_${userId}`);
      console.log(`[SOCKET] User ${userId} joined their personal room.`);
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] User disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIO };
