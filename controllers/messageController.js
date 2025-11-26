const Messages = require("../models/messageModel");

// 📌 Get both text + file messages
module.exports.getMessages = async (req, res, next) => {
  try {
    const { from, to } = req.body;

    const messages = await Messages.find({
      users: { $all: [from, to] }
    }).sort({ updatedAt: 1 });

    const projectedMessages = messages.map((msg) => {
      return {
        _id: msg._id,
        fromSelf: msg.sender.toString() === from,
        message: msg.isDeleted ? "This message was deleted" : msg.message.text || null,
        fileUrl: msg.isDeleted ? null : msg.message.fileUrl || null,
        fileType: msg.isDeleted ? null : msg.message.fileType || null,
        type: msg.message.fileUrl && !msg.isDeleted ? "file" : "text",
        isDeleted: msg.isDeleted,
      };
    });

    res.json(projectedMessages);
  } catch (ex) {
    next(ex);
  }
};

// 📌 Text message
module.exports.addMessage = async (req, res, next) => {
  try {
    const { from, to, message } = req.body;

    const data = await Messages.create({
      message: { text: message },
      users: [from, to],
      sender: from,
    });

    // 🔥 return DB inserted id
    return res.json({ msg: "Message added successfully.", id: data._id });
  } catch (ex) {
    next(ex);
  }
};

// 📌 File message
module.exports.addFileMessage = async (req, res, next) => {
  try {
    const { from, to } = req.body;
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype;

    const data = await Messages.create({
      message: { fileUrl, fileType },
      users: [from, to],
      sender: from,
    });

    // 🔥 return DB inserted id
    return res.json({ fileUrl, fileType, id: data._id });
  } catch (ex) {
    next(ex);
  }
};

// 🧹 Delete for Me
module.exports.deleteForMe = async (req, res, next) => {
  try {
    const { messageId, userId } = req.body;

    await Messages.findByIdAndUpdate(messageId, {
      $pull: { users: userId },
    });

    return res.json({ msg: "Message deleted for you." });
  } catch (ex) {
    next(ex);
  }
};

// 🛑 Delete for Everyone
module.exports.deleteForEveryone = async (req, res, next) => {
  try {
    const { messageId } = req.body;

    await Messages.findByIdAndUpdate(messageId, {
      isDeleted: true,
      message: { text: "", fileUrl: "", fileType: "" },
    });

    return res.json({ msg: "Message deleted for everyone." });
  } catch (ex) {
    next(ex);
  }
};
