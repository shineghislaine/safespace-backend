import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import { createServer } from "http";
import { Server } from "socket.io";
import Message from "./models/Message.js";
import Channel from "./models/Channel.js";
import User from "./models/User.js";
import adminApi from "./routes/adminApi.js"; // <- new
import messagesRoutes from "./routes/messages.js";
import publicApi from "./routes/publicApi.js"; // <- new
import BannedWord from "./models/BannedWord.js";
import uploadRoutes from "./routes/upload.js";


dotenv.config();


const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminApi);

app.use("/api/messages", messagesRoutes);
app.use("/api/public", publicApi);
app.use("/api/upload", uploadRoutes);


app.get("/", (req, res) => {
  res.send("SafeSpace backend is running 🚀");
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error(err));

// Create HTTP server and Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.set("io", io);

io.on("connection", async (socket) => {
  console.log("✅ New client connected:", socket.id);

  // Handle user online status
 socket.on("setUser", async ({ userId, username }) => {
  try {
    socket.userId = userId;
    socket.username = username;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, isOnline: true, lastSeen: new Date() },
      { new: true }
    );

    if (!updatedUser) {
      console.warn(`⚠️ No user found with ID ${userId}`);
      return;
    }

    const allUsers = await User.find({}, "username isOnline lastSeen");
    io.emit("userStatusList", allUsers);
  } catch (err) {
    console.error("Error in setUser:", err);
  }
});

  // Send channel list
  const channels = await Channel.find({});
  if (channels.length === 0) {
    const general = new Channel({ name: "General" });
    await general.save();
    socket.emit("channelList", [general.name]);
  } else {
    socket.emit("channelList", channels.map((c) => c.name));
  }

  // Create new channel
  socket.on("createChannel", async (name) => {
    try {
      const existing = await Channel.findOne({ name });
      if (!existing) {
        const newChannel = new Channel({ name });
        await newChannel.save();

        const updated = await Channel.find({});
        io.emit("channelList", updated.map((c) => c.name));

        console.log(`📢 New channel created: ${name}`);
      }
    } catch (err) {
      console.error("Error creating channel:", err);
    }
  });

  // Join channel
  socket.on("joinChannel", async (channel) => {

    // Leave all previous rooms except the socket’s own id room
  for (const room of socket.rooms) {
    if (room !== socket.id) {
      socket.leave(room);
    }
  }

    socket.join(channel);
    console.log(`${socket.id} joined channel: ${channel}`);

    const messages = await Message.find({ channel })
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    for (const m of messages) {
      const u = await User.findOne({ username: m.user }).lean();
      m.avatar = u?.avatar || "";
    }

    socket.emit("channelMessages", messages);
  });

// Send message
socket.on("sendMessage", async (msg) => {
  try {
    // 🔹 Always re-fetch the latest user record from DB
    const sender = await User.findOne({ username: msg.user });
    if (!sender) return;

    // 🕒 Auto-unban if temporary ban expired
    if (sender.tempBanExpiresAt && sender.tempBanExpiresAt < new Date()) {
      sender.isSuspended = false;
      sender.tempBanExpiresAt = null;
      await sender.save();
      console.log(`✅ Auto-unbanned user: ${sender.username}`);
    }

    // 🚫 Still banned
    if (sender.isSuspended) {
      socket.emit("errorMessage", "You are banned from sending messages.");
      console.log(`🚫 Message blocked from banned user: ${sender.username}`);
      return;
    }

    const bannedWords = await BannedWord.find().lean();
    const bannedList = bannedWords.map((w) => w.word.toLowerCase());

    let filteredText = msg.text;
    let foundBadWord = null;

    // 🔹 Detect and replace banned words
    bannedList.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      if (regex.test(filteredText)) {
        foundBadWord = word;
        filteredText = filteredText.replace(regex, "***");
      }
    });

    // 🔹 Log report if needed
    if (foundBadWord) {
      const Report = (await import("./models/Report.js")).default;
      await Report.create({
        user: msg.user,
        message: msg.text,
        channel: msg.channel,
        badWord: foundBadWord,
      });

      console.log(`⚠️ Report logged for user: ${msg.user} (word: ${foundBadWord})`);
    }

    // 🔹 Save message
    const message = new Message({
      channel: msg.channel,
      user: msg.user,
      text: filteredText,
    });
    await message.save();

    // ✅ Use msg.avatar (frontend) if available, otherwise fallback to latest DB avatar
    const avatarUrl = msg.avatar
      ? msg.avatar.startsWith("http")
        ? msg.avatar
        : `${process.env.BASE_URL || ""}${msg.avatar}`
      : sender.avatar
      ? sender.avatar.startsWith("http")
        ? sender.avatar
        : `${process.env.BASE_URL || ""}/uploads/${sender.avatar}`
      : "";

    // ✅ Send fully enriched message to everyone
    const enrichedMessage = {
      ...message.toObject(),
      user: sender.username,
      avatar: avatarUrl,
    };

    io.to(msg.channel).emit("receiveMessage", enrichedMessage);
  } catch (err) {
    console.error("❌ Error sending message:", err);
  }
});

  // Handle disconnect
  socket.on("disconnect", async () => {
    if (socket.username) {
      await User.findOneAndUpdate(
        { username: socket.username },
        { isOnline: false, lastSeen: new Date() }
      );

      const allUsers = await User.find({}, "username isOnline lastSeen");
      io.emit("userStatusList", allUsers);
    }
    console.log("❌ Client disconnected:", socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
