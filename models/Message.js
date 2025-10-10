import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    channel: { type: String, required: true },
    user: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: true } // ✅ automatically adds createdAt & updatedAt
);

export default mongoose.model("Message", MessageSchema);
