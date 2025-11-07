import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { sendVerificationEmail } from "../utils/sendEmails.js";

const router = express.Router();


// --- FILE UPLOAD CONFIG ---
  const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });
const upload = multer({ storage });


export const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "❌ Access denied. Admins only." });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: "❌ Server error" });
  }
};


// --- AUTH MIDDLEWARE ---
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "❌ Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;

    // ✅ NEW: Check if user is still active
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "❌ User not found" });
    }

    // ✅ If user is deactivated, automatically block access
    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "❌ Your account has been deactivated by admin" });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "❌ Invalid token" });
  }
};

// REGISTER
router.post("/register", upload.single("loadsheet"), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    

    const existingEmail = await User.findOne({ email });
    if (existingEmail)
      return res.status(400).json({ message: "❌ Email already in use" });

    const existingUsername = await User.findOne({ username });
    if (existingUsername)
      return res.status(400).json({ message: "❌ Username already taken" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const loadsheetPath = req.file ? `/uploads/${req.file.filename}` : "";
    let newUser;

    if (role === "admin") {
      // ✅ Auto-verify admin (no email code)
      newUser = new User({
        username,
        email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        isApproved: true, // Admins auto-approved
      });
    } else {
      // Generate 6-digit verification code for normal users
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      newUser = new User({
        username,
        email,
        password: hashedPassword,
        role: "user",
        verificationCode,
        loadsheet: loadsheetPath, // ✅ save path
        isVerified: false,
        isApproved: false, // Needs admin approval
      });

      // Send verification email only to normal users
      await sendVerificationEmail(email, verificationCode);
    }

    await newUser.save();

    res.status(201).json({
      message:
        role === "admin"
          ? "✅ Admin registered successfully (auto-verified)"
          : "✅ User registered, please check email for verification code",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});


// VERIFY EMAIL
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "❌ User not found" });

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "❌ Invalid verification code" });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    await user.save();

    res.json({
      message: "✅ Email verified successfully. Please wait for admin approval before logging in.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// RESEND VERIFICATION CODE
router.post("/resend-code", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "❌ User not found" });

    if (user.isVerified) {
      return res.status(400).json({ message: "⚠️ User is already verified" });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = newCode;
    await user.save();

    await sendVerificationEmail(user.email, newCode);

    res.json({ message: "📩 A new verification code has been sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "❌ Invalid credentials" });

    if (!user.isVerified) {
      return res.status(400).json({ message: "⚠️ Please verify your email first" });
    }
    if (!user.isApproved) {
       return res.status(403).json({ message: "⏳ Your account is awaiting admin approval. Please wait for confirmation.",});
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "❌ Your account has been deactivated by admin" });
    }

    

    //add
    if (user.isSuspended) {
  // If temporary ban expired → lift automatically
  if (user.tempBanExpiresAt && user.tempBanExpiresAt < new Date()) {
    user.isSuspended = false;
    user.tempBanExpiresAt = null;
    await user.save();
  } else {
    // Still banned (permanent or temporary)
    if (user.tempBanExpiresAt) {
      const remainingMs = user.tempBanExpiresAt - new Date();
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      return res.status(403).json({
        message: `🚫 You are temporarily banned. Try again in about ${remainingHours} hour(s).`,
      });
    } else {
      return res.status(403).json({
        message: "🚫 Your account has been permanently banned by an admin.",
      });
    }
  }
}

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "❌ Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        role: user.role,   // ✅ include role here
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// --- GET CURRENT USER ---
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "❌ User not found" });
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});

router.get("/admin/dashboard", authMiddleware, adminMiddleware, (req, res) => {
  res.json({ message: "✅ Welcome Admin Dashboard" });
});

// --- ADMIN APPROVAL ROUTES ---

// Get list of users waiting for approval
router.get("/pending-approvals", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pendingUsers = await User.find({ isVerified: true, isApproved: false });
    res.json(pendingUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// Approve a user
router.put("/approve/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "❌ User not found" });

    user.isApproved = true;
    await user.save();

    res.json({ message: `✅ ${user.username} has been approved!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "❌ Server error" });
  }
});

// --- UPDATE USER PROFILE (username + avatar only) ---
router.put("/update", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    const { username } = req.body;
    const userId = req.userId;

    // Load current user to get old username
    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "❌ User not found" });

    const oldUsername = currentUser.username;

    // Prepare update fields
    let updateFields = {};
    if (username) updateFields.username = username;
    if (req.file) updateFields.avatar = `/uploads/${req.file.filename}`;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    ).select("-password");

    // If username changed, update existing messages in DB
    if (username && oldUsername && oldUsername !== username) {
      await Message.updateMany({ user: oldUsername }, { $set: { user: username } });
    }

    // Notify connected sockets (optional, helpful for live update)
    try {
      const io = req.app.get("io");
      if (io) {
        io.emit("usernameUpdated", { oldUsername, newUsername: updatedUser.username });
      }
    } catch (e) {
      console.warn("Could not emit usernameUpdated:", e);
    }

    res.json({
      message: "✅ Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(500).json({ message: "❌ Failed to update profile" });
  }
});


export default router;
