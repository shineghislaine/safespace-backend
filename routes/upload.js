import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import User from "../models/User.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

// ✅ Ensure uploads directory exists
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ✅ Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// ✅ Upload avatar route
router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    const filePath = `/uploads/${req.file.filename}`;

    // Update user's avatar in DB
    const user = await User.findByIdAndUpdate(
      req.userId,
      { avatar: filePath },
      { new: true }
    ).select("username avatar");

    res.json({
      message: "✅ Avatar updated successfully",
      avatar: user.avatar,
    });
  } catch (err) {
    console.error("❌ Avatar upload failed:", err);
    res.status(500).json({ message: "Failed to upload avatar" });
  }
});

export default router;
