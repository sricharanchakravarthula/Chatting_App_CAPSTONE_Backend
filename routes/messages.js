const {
  addMessage,
  getMessages,
  addFileMessage,
  deleteForMe,
  deleteForEveryone,
} = require("../controllers/messageController");

const router = require("express").Router();
const multer = require("multer");
const path = require("path");

// 🔹 Configure multer storage (saving into "uploads" folder)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // make sure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// 🔹 Text + Message routes
router.post("/addmsg/", addMessage);
router.post("/getmsg/", getMessages);

// 🔹 File upload route
router.post("/addmsg/file", upload.single("file"), addFileMessage);

// 🆕 DELETE FOR ME
router.post("/deletemsg/me", deleteForMe);

// 🆕 DELETE FOR EVERYONE
router.post("/deletemsg/everyone", deleteForEveryone);

module.exports = router;
