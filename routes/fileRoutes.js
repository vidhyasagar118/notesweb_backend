const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

// ================= MULTER =================

const upload = multer({
    dest: "temp/",
    limits: {
        fileSize: 20 * 1024 * 1024
    }
});

// ================= UPLOAD FILES =================

router.post(
    "/upload",
    auth,
    upload.array("files", 20),

    async (req, res) => {

        try {

            if (!req.files || req.files.length === 0) {

                return res.status(400).json({
                    message: "No files uploaded"
                });
            }

            const savedFiles = [];

            for (const file of req.files) {

                console.log("Uploading:", file.originalname);

                // ===== UPLOAD TO CLOUDINARY =====
                const result = await cloudinary.uploader.upload(
                    file.path,
                    {
                        resource_type: "raw",

                        folder: `notesweb/${req.user.id}/${req.body.subject}`,

                        use_filename: true,

                        unique_filename: true
                    }
                );

                // REMOVE TEMP FILE
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }

                // ORIGINAL FILE URL
                const viewUrl = result.secure_url;

                // DOWNLOAD URL
                const downloadUrl = result.secure_url + "?download=true";
                // ===== REMOVE TEMP FILE =====

                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }

                // ===== ORIGINAL FILE OPEN =====

                const viewUrl = result.secure_url;

                // ===== FORCE DOWNLOAD =====

                const downloadUrl = result.secure_url.replace(
                    "/upload/",
                    "/upload/fl_attachment/"
                );

                // ===== SAVE DB =====

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

            console.log("UPLOAD ERROR:");
            console.log(err);

            // ===== CLEAN TEMP FILES =====

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
    }
);

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

        console.log(err);

        res.status(500).json({
            message: "Server Error"
        });
    }
});

// ================= DELETE FILE =================

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

        // ===== DELETE FROM CLOUDINARY =====

        if (file.publicId && file.publicId.trim() !== "") {

            try {

                await cloudinary.uploader.destroy(file.publicId);

            } catch (cloudErr) {

                console.log("Cloudinary Delete Error:");
                console.log(cloudErr);
            }
        }

        // ===== DELETE FROM DB =====

        await File.findByIdAndDelete(req.params.id);

        res.json({
            message: "Deleted Successfully"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Delete failed",
            error: err.message
        });
    }
});

// ================= SHARED FILES =================

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

        console.log(err);

        res.status(500).json({
            message: "Server Error"
        });
    }
});

module.exports = router;