const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const cloudinary = require("../config/cloudinary");

// ================= TEMP FOLDER =================

const tempDir = path.join(__dirname, "../temp");

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// ================= MULTER =================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

// ================= UPLOAD =================

router.post("/upload", auth, upload.array("files", 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const savedFiles = [];

        for (const file of req.files) {

            const result = await cloudinary.uploader.upload(file.path, {
                resource_type: "raw",
                folder: `notesweb/${req.user.id}/${req.body.subject}`,
                use_filename: true,
                unique_filename: true
            });

            fs.unlinkSync(file.path);

            const rawUrl = result.secure_url;

            const downloadUrl = rawUrl.replace(
                "/upload/",
                "/upload/fl_attachment/"
            );

            const newFile = await File.create({
                userId: req.user.id,
                subject: req.body.subject,
                semester: req.body.semester,
                filename: file.originalname,
                filepath: rawUrl,
                downloadUrl: downloadUrl,
                publicId: result.public_id
            });

            savedFiles.push(newFile);
        }

        res.json(savedFiles);

    } catch (err) {
        console.log(err);

        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        res.status(500).json({
            message: "Upload failed",
            error: err.message
        });
    }
});

// ================= DELETE =================

router.delete("/:id", auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) return res.status(404).json({ message: "File not found" });

        await cloudinary.uploader.destroy(file.publicId, {
            resource_type: "raw"
        });

        await File.findByIdAndDelete(req.params.id);

        res.json({ message: "Deleted Successfully" });

    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});

module.exports = router;