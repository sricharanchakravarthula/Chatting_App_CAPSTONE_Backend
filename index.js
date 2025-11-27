const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const messageRoutes = require("./routes/messages");
const { Server } = require("socket.io");

const app = express();

/* ------------------ MIDDLEWARES ------------------ */
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://chatting-app-capstone-frontend.vercel.app",
  ],
  credentials: true,
}));
app.use(express.json());

/* ------------------ SERVE UPLOADS ------------------ */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ------------------ MULTER UPLOAD ------------------ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/api/messages/upload", upload.single("file"), (req, res) => {
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  return res.json({
    fileUrl,
    fileType: req.file.mimetype,
  });
});

/* ------------------ DATABASE ------------------ */
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB Connection Successful"))
  .catch((err) =>
    console.error("MongoDB Connection Error:", err.message)
  );

/* ------------------ ROUTES ------------------ */
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

/* ------------------ START SERVER ------------------ */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`🚀 Server started on port ${PORT}`)
);

/* ------------------ SOCKET.IO ------------------ */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://chatting-app-capstone-frontend.vercel.app",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000, // prevent disconnect during long calls
});

global.onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ New socket:", socket.id);

  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  /* ---------- TEXT MESSAGE ---------- */
  socket.on("send-msg", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket) socket.to(recvSocket).emit("msg-recieve", data.msg);
  });

  /* ---------- FILE MESSAGE ---------- */
  socket.on("send-file", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket)
      socket.to(recvSocket).emit("file-recieve", {
        fileUrl: data.fileUrl,
        fileType: data.fileType,
      });
  });

  /* ---------- AUDIO CALL EVENTS ---------- */
  socket.on("call-user", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket)
      socket.to(recvSocket).emit("incoming-call", { from: data.from });
  });

  socket.on("call-accepted", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket) socket.to(recvSocket).emit("call-accepted");
  });

  socket.on("call-rejected", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket) socket.to(recvSocket).emit("call-rejected");
  });

  socket.on("send-offer", ({ to, offer }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket) socket.to(recvSocket).emit("receive-offer", { offer });
  });

  socket.on("send-answer", ({ to, answer }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket) socket.to(recvSocket).emit("receive-answer", { answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket)
      socket.to(recvSocket).emit("receive-ice-candidate", { candidate });
  });

  /* ---------- END CALL ---------- */
  socket.on("end-call", ({ to }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket) socket.to(recvSocket).emit("end-call");
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);
  });
});
