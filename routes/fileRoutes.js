const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");

const drive = require("../config/googleDrive");

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
            return res.status(400).json({
                message: "No files uploaded"
            });
        }

        const savedFiles = [];

        for (const file of req.files) {

            // ================= GOOGLE DRIVE UPLOAD =================

            const response = await drive.files.create({

                requestBody: {
                    name: file.originalname,
                    parents: [
                        process.env.GOOGLE_DRIVE_FOLDER_ID
                    ]
                },

                media: {
                    mimeType: mime.lookup(file.path),
                    body: fs.createReadStream(file.path)
                }
            });

            const fileId = response.data.id;

            // ================= PUBLIC ACCESS =================

            await drive.permissions.create({

                fileId: fileId,

                requestBody: {
                    role: "reader",
                    type: "anyone"
                }
            });

            // ================= URLS =================

            const viewUrl =
                `https://drive.google.com/file/d/${fileId}/view`;

            const downloadUrl =
                `https://drive.google.com/uc?id=${fileId}&export=download`;

            // ================= DELETE TEMP FILE =================

            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }

            // ================= SAVE DB =================

            const newFile = await File.create({

                userId: req.user.id,

                subject: req.body.subject,

                semester: req.body.semester,

                filename: file.originalname,

                filepath: viewUrl,

                downloadUrl: downloadUrl,

                publicId: fileId
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

// ================= MY FILES =================

router.get("/myfiles", auth, async (req, res) => {

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

// ================= DELETE =================

router.delete("/:id", auth, async (req, res) => {

    try {

        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        if (file.userId.toString() !== req.user.id) {

            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        // ================= DELETE FROM DRIVE =================

        await drive.files.delete({
            fileId: file.publicId
        });

        // ================= DELETE DB =================

        await File.findByIdAndDelete(req.params.id);

        res.json({
            message: "Deleted Successfully"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Delete failed"
        });
    }
});

// ================= SHARED =================

router.get("/shared/:groupCode", auth, async (req, res) => {

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