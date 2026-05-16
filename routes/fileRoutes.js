const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");

// MULTER
const upload = multer({
    dest: "temp/",
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB
    }
});

// UPLOAD FILES
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

                const result = await cloudinary.uploader.upload(
                    file.path,
                    {
                        resource_type: "auto",
                        folder: `notesweb/${req.user.id}/${req.body.subject}`
                    }
                );

                const newFile = await File.create({

                    userId: req.user.id,

                    subject: req.body.subject,

                    semester: req.body.semester,

                    filename: file.originalname,

                    filepath: result.secure_url,

                    publicId: result.public_id
                });

                savedFiles.push(newFile);

                // DELETE TEMP FILE
                fs.unlinkSync(file.path);
            }

            res.json(savedFiles);

        } catch (err) {

            console.log("UPLOAD ERROR:");
            console.log(err);

            res.status(500).json({
                message: "Upload failed",
                error: err.message
            });
        }
    }
);

// MY FILES
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

// DELETE FILE
router.delete("/:id", auth, async (req, res) => {

    try {

        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({
                message: "Not found"
            });
        }

        if (file.userId.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        await cloudinary.uploader.destroy(
            file.publicId,
            {
                resource_type: "auto"
            }
        );

        await File.findByIdAndDelete(req.params.id);

        res.json({
            message: "Deleted"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Delete failed"
        });
    }
});

// SHARED FILES
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