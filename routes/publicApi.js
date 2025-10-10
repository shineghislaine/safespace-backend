// routes/publicApi.js
import express from "express";
import BannedWord from "../models/BannedWord.js";

const router = express.Router();

// ✅ Public route: Get banned words (no admin check)
router.get("/banned-words", async (req, res) => {
  try {
    const words = await BannedWord.find().lean();
    res.json(words);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Failed to fetch banned words" });
  }
});

export default router;
