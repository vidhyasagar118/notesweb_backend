<<<<<<< HEAD
const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");
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

            const result = await cloudinary.uploader.upload(
                file.path,
                {
                    resource_type: "raw", // ✅ PDF ke liye correct
                    folder: `notesweb/${req.user.id}/${req.body.subject}`,
                    use_filename: true,
                    unique_filename: true
                }
            );

            // delete temp file
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            // ✅ IMPORTANT FIX
            const rawUrl = result.secure_url;

            // ❌ REMOVE THIS (galti yahi thi)
            // const viewUrl = rawUrl.replace("/raw/upload/", "/image/upload/");

            // ✅ USE RAW DIRECTLY
            const viewUrl = rawUrl;

const downloadUrl = rawUrl.replace(
   "/upload/",
   "/upload/fl_attachment/"
);
            const newFile = await File.create({
                userId: req.user.id,
                subject: req.body.subject,
                semester: req.body.semester,
                filename: file.originalname,
                filepath: viewUrl,
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
=======
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
>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28
    }
});

// ================= MY FILES =================

<<<<<<< HEAD
router.get("/myfiles", auth, async (req, res) => {
    try {
        const files = await File.find({ userId: req.user.id });
=======
router.get("/myfiles", authMiddleware, async (req, res) => {
    try {

        const files = await File.find({
            userId: req.user.id
        });
>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28

        const grouped = {};

        files.forEach(file => {
<<<<<<< HEAD
            if (!grouped[file.semester]) grouped[file.semester] = {};
            if (!grouped[file.semester][file.subject]) grouped[file.semester][file.subject] = [];
=======

            if (!grouped[file.semester]) {
                grouped[file.semester] = {};
            }

            if (!grouped[file.semester][file.subject]) {
                grouped[file.semester][file.subject] = [];
            }
>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28

            grouped[file.semester][file.subject].push(file);
        });

        res.json(grouped);

    } catch (err) {
<<<<<<< HEAD
        res.status(500).json({ message: "Server Error" });
    }
});

// ================= DELETE =================

router.delete("/:id", auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) return res.status(404).json({ message: "File not found" });

        if (file.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await cloudinary.uploader.destroy(file.publicId, {
            resource_type: "raw"
        });

        await File.findByIdAndDelete(req.params.id);

        res.json({ message: "Deleted Successfully" });

    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});

// ================= SHARED =================

router.get("/shared/:groupCode", auth, async (req, res) => {
    try {
        const user = await User.findOne({ groupCode: req.params.groupCode });

        if (!user) return res.status(404).json({ message: "Group not found" });

        const files = await File.find({ userId: user._id });
=======

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
>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28

        const grouped = {};

        files.forEach(file => {
<<<<<<< HEAD
            if (!grouped[file.semester]) grouped[file.semester] = {};
            if (!grouped[file.semester][file.subject]) grouped[file.semester][file.subject] = [];
=======

            if (!grouped[file.semester]) {
                grouped[file.semester] = {};
            }

            if (!grouped[file.semester][file.subject]) {
                grouped[file.semester][file.subject] = [];
            }
>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28

            grouped[file.semester][file.subject].push(file);
        });

        res.json({
            owner: user.name,
            grouped
        });

    } catch (err) {
<<<<<<< HEAD
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;
=======

        res.status(500).json({
            message: "Server Error"
        });
    }
});

module.exports = router;

>>>>>>> dc61b2a2b18c9b30610a763fe21eccce3733ad28
