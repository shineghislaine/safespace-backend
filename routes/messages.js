import express from "express";
import Message from "../models/Message.js";
import BannedWord from "../models/BannedWord.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

/**
 * Send a message
 */
router.post("/:channelId", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    const { channelId } = req.params;

    // 🔹 Load banned words
    const bannedWords = await BannedWord.find().lean();
    const bannedList = bannedWords.map((w) => w.word.toLowerCase());

    // 🔹 Check and censor banned words
    let filteredText = text;
    let containsBanned = false;

    bannedList.forEach((word) => {
      const regex = new RegExp(word, "gi"); // ✅ no word boundary
      if (regex.test(filteredText)) {
        containsBanned = true;
        filteredText = filteredText.replace(regex, "***");
      }
    });

    // 🔹 Save message
    const newMessage = new Message({
      channel: channelId,
      user: req.userId,
      text: filteredText,
    });

    await newMessage.save();

    res.status(201).json({
      message: "✅ Message sent",
      data: newMessage,
      bannedDetected: containsBanned,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to send message" });
  }
});

/**
 * Get messages in a channel
 */
router.get("/:channelId", authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;

    const messages = await Message.find({ channel: channelId }).sort({
      createdAt: 1,
    });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch messages" });
  }
});

export default router;
