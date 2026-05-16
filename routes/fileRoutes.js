const router = require("express").Router();

const multer = require("multer");

const fs = require("fs");

const auth = require("../middleware/authMiddleware");

const File = require("../models/File");

const User = require("../models/User");

const cloudinary = require("../config/cloudinary");



// TEMP STORAGE

const upload = multer({
    dest: "/tmp/"
});



// UPLOAD FILES

router.post(
    "/upload",
    auth,
    upload.array("files", 20),

    async (req, res) => {

        try {

            const savedFiles = [];

            for (const file of req.files) {

                // Upload to cloudinary

                const result = await cloudinary.uploader.upload(
                    file.path,
                    {
                        resource_type: "raw",
                        folder: `notesweb/${req.user.id}/${req.body.subject}`
                    }
                );

                // Save DB

                const newFile = await File.create({

                    userId: req.user.id,

                    subject: req.body.subject,

                    semester: req.body.semester,

                    filename: file.originalname,

                    filepath: result.secure_url,

                    publicId: result.public_id
                });

                savedFiles.push(newFile);

                // delete temp file

                fs.unlinkSync(file.path);
            }

            res.json(savedFiles);

        } catch (err) {

            console.log(err);

            res.status(500).json({
                message: "Upload failed"
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
                resource_type: "raw"
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
});

module.exports = router;