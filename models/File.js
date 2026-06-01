const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    subject: String,
    semester: String,
    filename: String,

    filepath: String,
    downloadUrl: String,
    publicId: String,

    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("File", fileSchema);