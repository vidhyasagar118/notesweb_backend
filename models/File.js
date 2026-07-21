const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  subject: {
    type: String,
    trim: true,
    index: true
  },

  semester: {
    type: String,
    trim: true
  },

  filename: {
    type: String,
    trim: true
  },

  fileType: String,
  fileSize: Number,

  filepath: String,
  downloadUrl: String,
  publicId: String,

  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  visibility: {
    type: String,
    enum: ["public", "private"],
    default: "public",
    index: true
  }
});

// Dashboard और file-list queries के लिए
fileSchema.index({ userId: 1, semester: 1, subject: 1 });

// Public notes queries के लिए
fileSchema.index({ visibility: 1, semester: 1, subject: 1 });

module.exports = mongoose.model("File", fileSchema);