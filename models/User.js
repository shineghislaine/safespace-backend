import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: "" },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },

  // ✅ New field for admin approval
  isApproved: { type: Boolean, default: false },

    // ✅ Add this field
  loadsheet: { type: String, default: "" },


  role: { type: String, enum: ["user", "admin"], default: "user" },

  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  tempBanExpiresAt: { type: Date, default: null },
}, { timestamps: true }); // NEW

export default mongoose.model("User", userSchema);
