import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },   // NEW
  verificationCode: { type: String },   

  role: { type: String, enum: ["user", "admin"], default: "user" }, // ✅ role field
  
    // ✅ Online status tracking
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  
   // Admin controls
    isActive: { type: Boolean, default: true },   // if false -> deactivated
    isSuspended: { type: Boolean, default: false }, // if true -> cannot send messages
    tempBanExpiresAt: { type: Date, default: null }, // optional expiry date for temp bans
    
}, { timestamps: true }); // NEW

export default mongoose.model("User", userSchema);
