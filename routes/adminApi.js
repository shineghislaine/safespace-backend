// backend/routes/adminApi.js
import express from "express";
import User from "../models/User.js";
import Channel from "../models/Channel.js";
import BannedWord from "../models/BannedWord.js";
import Report from "../models/Report.js";
import { authMiddleware, adminMiddleware } from "./auth.js";

const router = express.Router();

/**
 * GET /api/admin/users
 * List users (limited fields)
 */
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, "username email role isActive isSuspended isOnline lastSeen createdAt");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch users" });
  }
});

/**
 * PUT /api/admin/users/:id/deactivate
 * Mark user inactive (permanent-ish)
 */
router.put("/users/:id/deactivate", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    res.json({ message: "✅ User deactivated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to deactivate user" });
  }
});

/**
 * PUT /api/admin/users/:id/activate
 */
router.put("/users/:id/activate", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    );
    res.json({ message: "✅ User activated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to activate user" });
  }
});

/* ---------------- Channels ---------------- */

/**
 * GET /api/admin/channels
 * list channels
 */
router.get("/channels", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const channels = await Channel.find().populate("createdBy", "username email");
    res.json(channels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch channels" });
  }
});

/**
 * DELETE /api/admin/channels/:id
 * delete a channel
 */
router.delete("/channels/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await Channel.findByIdAndDelete(req.params.id);
    res.json({ message: "✅ Channel deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to delete channel" });
  }
});

/* ---------------- Banned Words ---------------- */

/**
 * GET /api/admin/banned-words
 */
router.get("/banned-words", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const words = await BannedWord.find();
    res.json(words);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch banned words" });
  }
});

/**
 * POST /api/admin/banned-words
 */
router.post("/banned-words", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || !word.trim()) return res.status(400).json({ message: "❌ Word required" });

    const existing = await BannedWord.findOne({ word: word.trim().toLowerCase() });
    if (existing) return res.status(400).json({ message: "⚠️ Word already banned" });

    const newWord = new BannedWord({ word: word.trim().toLowerCase() });
    await newWord.save();
    res.json({ message: "✅ Word banned successfully", newWord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to ban word" });
  }
});

/**
 * DELETE /api/admin/banned-words/:id
 */
router.delete("/banned-words/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await BannedWord.findByIdAndDelete(req.params.id);
    res.json({ message: "✅ Banned word removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to delete banned word" });
  }
});

/* ---------------- Reports ---------------- */

// ✅ GET all reports
router.get("/reports", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch reports" });
  }
});

// ✅ PUT /api/admin/reports/:id/action
// Actions: permanent-ban | temp-ban | unban
router.put("/reports/:id/action", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, hours } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: "❌ Report not found" });

    const user = await User.findOne({ username: report.user });
    if (!user) return res.status(404).json({ message: "❌ User not found" });

    if (action === "permanent-ban") {
      user.isSuspended = true;
      user.tempBanExpiresAt = null;
      report.actionTaken = "banned";
    } 
    else if (action === "temp-ban") {
      const expireDate = new Date(Date.now() + hours * 60 * 60 * 1000);
      user.isSuspended = true;
      user.tempBanExpiresAt = expireDate;
      report.actionTaken = "temp-ban";
      report.expiresAt = expireDate;
    }
    else if (action === "unban") {
      user.isSuspended = false;
      user.tempBanExpiresAt = null;
      report.actionTaken = "none";
    } 
    else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await user.save();
    await report.save();

    const io = req.app.get("io");
if (io && user._id) {
  io.emit("forceLogout", { username: user.username });
}

    res.json({ message: "✅ Report action applied successfully", report });
  } catch (err) {
    console.error("❌ Error applying report action:", err);
    res.status(500).json({ message: "Server error applying report action" });
  }
});


export default router;
