import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  user: { type: String, required: true }, // username of offender
  message: { type: String, required: true }, // the actual message content
  channel: { type: String, required: true }, // which channel
  badWord: { type: String, required: true }, // detected bad word
  actionTaken: {
    type: String,
    enum: ["none", "warning", "banned", "temp-ban"],
    default: "none",
  },
  expiresAt: { type: Date, default: null }, // for temporary bans
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Report", reportSchema);
