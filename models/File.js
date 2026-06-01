<<<<<<< HEAD
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
=======
const newFile = await File.create({
    userId: req.user.id,
    subject: req.body.subject,
    semester: req.body.semester,
    filename: file.originalname,

    filepath: response.data.webViewLink,       // ✅ correct
    downloadUrl: response.data.webContentLink, // ✅ correct
    publicId: response.data.id                // ✅ correct
});
>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28
