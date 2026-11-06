const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowedOrigins = [
          process.env.CLIENT_URL,
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:4000",
          "http://127.0.0.1:4000"
        ].filter(Boolean);
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://192.168.") ||
          origin.startsWith("http://10.") ||
          origin.startsWith("http://172.16.")
        ) {
          return callback(null, true);
        }
        return callback(new Error("CORS policy violation on WebSocket handshake"));
      },
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["polling", "websocket"],
    allowEIO3: true
  });

  // JWT Authentication Middleware for Socket.io
  io.use((socket, next) => {
    let token = socket.handshake.auth?.token;
    if (!token && socket.handshake.headers?.cookie) {
      const match = socket.handshake.headers.cookie.match(/machip_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        socket.user = decoded;
      } catch (err) {
        console.warn(`[SOCKET] Warning: Token verification failed for ${socket.id}:`, err.message);
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id}`);

    socket.on("join", (userId) => {
      const requestedId = parseInt(userId, 10);
      if (isNaN(requestedId)) return;

      // Zero-Trust Room Authorization Check:
      // If user is authenticated, ensure they only join their own room, unless they have staff role (1, 2, 4)
      if (socket.user) {
        const isStaff = [1, 2, 4].includes(parseInt(socket.user.user_RoleId, 10)) ||
          ["Admin Manager", "Supervisor", "Admin Accountant", "Admin"].includes(socket.user.user_Role);
        const isSelf = parseInt(socket.user.user_Id, 10) === requestedId;

        if (isSelf || isStaff) {
          socket.join(`user_${requestedId}`);
          console.log(`[SOCKET] User ${requestedId} joined their personal room.`);
        } else {
          console.warn(`[SOCKET] Forbidden: User ${socket.user.user_Id} attempted to join room user_${requestedId}.`);
        }
      } else {
        // Development fallback only
        if (process.env.NODE_ENV !== "production") {
          socket.join(`user_${requestedId}`);
        }
      }
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
