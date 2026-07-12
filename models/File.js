const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  subject: String,
  semester: String,
  filename: String,

  fileType: String,
  fileSize: Number,

  filepath: String,
  downloadUrl: String,
  publicId: String,

  uploadedAt: {
    type: Date,
    default: Date.now
  },
  visibility: {
  type: String,
  enum: ["public", "private"],
  default: "public"
}
});

module.exports = mongoose.model("File", fileSchema);