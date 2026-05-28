const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");

// ❌ const cloudinary = require("../config/cloudinary");  // REMOVED
const drive = require("../config/googleDrive"); // ✅ ADDED

const File = require("../models/File");
const authMiddleware = require("../middleware/authMiddleware");

// 📦 Multer setup
const upload = multer({ dest: "uploads/" });
const User = require("../models/User");

/**
 * 📤 UPLOAD FILE
 */
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // ============================
        // 🔥 GOOGLE DRIVE UPLOAD (REPLACED)
        // ============================
        const fileMetadata = {
            name: file.originalname,
            parents: ["1ikfR5-5_0XS1fTWOfK_j3DSF7TuHCyKx"], // same folder
        };

        const media = {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.path),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: "id, webViewLink, webContentLink",
        });

        // 🌍 public access
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: "reader",
                type: "anyone",
            },
        });

        // ============================
        // 🧹 REMOVE TEMP FILE
        // ============================
        fs.unlinkSync(file.path);

        // ============================
        // 💾 SAVE (SAME STRUCTURE, ONLY VALUES CHANGED)
        // ============================
        const newFile = await File.create({
            userId: req.user.id,
            subject: req.body.subject,
            semester: req.body.semester,
            filename: file.originalname,

            // 🔥 ONLY THESE 3 LINES CHANGED
            filepath: response.data.webViewLink,
            downloadUrl: response.data.webContentLink,
            publicId: response.data.id,

            // 👇 AGAR TERE ORIGINAL ME YE THE → UNTOUCHED
            type: req.body.type,
            description: req.body.description,
        });

        res.status(200).json({
            message: "File uploaded successfully",
            file: newFile,
        });

    } catch (error) {
   if (req.file) {
       fs.unlinkSync(req.file.path); // 🧹 cleanup even on error
   }

   console.error(error);
   res.status(500).json({ message: "Upload failed", error });
}
});

/**
 * 📥 GET FILES (UNCHANGED)
 */
router.get("/", authMiddleware, async (req, res) => {
    try {
        const { subject, semester } = req.query;

        let query = { userId: req.user.id };

        if (subject) query.subject = subject;
        if (semester) query.semester = semester;

        const files = await File.find(query).sort({ createdAt: -1 });

        res.status(200).json(files);
    } catch (error) {
        res.status(500).json({ message: "Error fetching files" });
    }
});

/**
 * ❌ DELETE FILE
 */
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: "File not found" });
        }

        // ============================
        // 🔥 GOOGLE DRIVE DELETE (REPLACED)
        // ============================
        await drive.files.delete({
            fileId: file.publicId,
        });

        // ============================
        // 🗑 DB DELETE (UNCHANGED)
        // ============================
        await file.deleteOne();

        res.status(200).json({ message: "File deleted successfully" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Delete failed", error });
    }
});

// ================= MY FILES =================

router.get("/myfiles", authMiddleware, async (req, res) => {
    try {

        const files = await File.find({
            userId: req.user.id
        });

        const grouped = {};

        files.forEach(file => {

            if (!grouped[file.semester]) {
                grouped[file.semester] = {};
            }

            if (!grouped[file.semester][file.subject]) {
                grouped[file.semester][file.subject] = [];
            }

            grouped[file.semester][file.subject].push(file);
        });

        res.json(grouped);

    } catch (err) {

        res.status(500).json({
            message: "Server Error"
        });
    }
});

// ========= SHARED =================

router.get("/shared/:groupCode", authMiddleware, async (req, res) => {
    try {

        const user = await User.findOne({
            groupCode: req.params.groupCode
        });

        if (!user) {

            return res.status(404).json({
                message: "Group not found"
            });
        }

        const files = await File.find({
            userId: user._id
        });

        const grouped = {};

        files.forEach(file => {

            if (!grouped[file.semester]) {
                grouped[file.semester] = {};
            }

            if (!grouped[file.semester][file.subject]) {
                grouped[file.semester][file.subject] = [];
            }

            grouped[file.semester][file.subject].push(file);
        });

        res.json({
            owner: user.name,
            grouped
        });

    } catch (err) {

        res.status(500).json({
            message: "Server Error"
        });
    }
});

module.exports = router;

