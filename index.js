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

/* =============== MIDDLEWARES =============== */
app.use(cors());
app.use(express.json());

/* 🔥 Serve uploaded files */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* 🔥 Multer local storage config */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* 📁 File upload API */
app.post("/api/messages/upload", upload.single("file"), (req, res) => {
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  return res.json({
    fileUrl,
    fileType: req.file.mimetype,
  });
});

/* =============== DATABASE =============== */
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.error("MongoDB Connection Error:", err.message));

/* =============== ROUTES =============== */
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

/* =============== START SERVER =============== */
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});

/* =============== SOCKET.IO SERVER =============== */
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://chatting-app-frontend-tan.vercel.app"],
    credentials: true,
  },
});

global.onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("⚡ New socket:", socket.id);

  /* 🔹 Register user */
  socket.on("add-user", (userId) => {
    onlineUsers.set(userId, socket.id);
  });

  /* 💬 TEXT MESSAGE */
  socket.on("send-msg", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket)
      socket.to(recvSocket).emit("msg-recieve", data.msg);
  });

  /* 📁 FILE MESSAGE */
  socket.on("send-file", (data) => {
    const recvSocket = onlineUsers.get(data.to);
    if (recvSocket)
      socket.to(recvSocket).emit("file-recieve", {
        fileUrl: data.fileUrl,
        fileType: data.fileType,
      });
  });

  /* 📞 AUDIO CALL — Send call notification */
  socket.on("call-user", (data) => {
    const receiverId = typeof data.to === "string" ? data.to : data.to._id;
    const recvSocket = onlineUsers.get(receiverId);
    console.log("📞 Calling:", receiverId, "->", recvSocket);
    if (recvSocket)
      socket.to(recvSocket).emit("incoming-call", { from: data.from });
  });

  /* ✔ CALL ACCEPT */
  socket.on("call-accepted", (data) => {
    const callerId = typeof data.to === "string" ? data.to : data.to._id;
    const recvSocket = onlineUsers.get(callerId);
    if (recvSocket)
      socket.to(recvSocket).emit("call-accepted");
  });

  /* ❌ CALL REJECT */
  socket.on("call-rejected", (data) => {
    const callerId = typeof data.to === "string" ? data.to : data.to._id;
    const recvSocket = onlineUsers.get(callerId);
    if (recvSocket)
      socket.to(recvSocket).emit("call-rejected");
  });

  /* 🔥 WEBRTC — Offer */
  socket.on("send-offer", ({ to, offer }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket)
      socket.to(recvSocket).emit("receive-offer", { offer });
  });

  /* 🔥 WEBRTC — Answer */
  socket.on("send-answer", ({ to, answer }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket)
      socket.to(recvSocket).emit("receive-answer", { answer });
  });

  /* 🔥 WEBRTC — ICE Candidate */
  socket.on("ice-candidate", ({ to, candidate }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket)
      socket.to(recvSocket).emit("receive-ice-candidate", { candidate });
  });

  /* 🔴 END CALL */
  socket.on("end-call", ({ to }) => {
    const recvSocket = onlineUsers.get(to);
    if (recvSocket)
      socket.to(recvSocket).emit("end-call");
  });

  socket.on("disconnect", () => {
    console.log("🔌 Socket disconnected:", socket.id);
  });
});
