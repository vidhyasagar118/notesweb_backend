
const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");

const storage = multer.diskStorage({
    destination: async function(req, file, cb) {
        const subject = req.body.subject;
        const userFolder = req.user.id;

        const uploadPath = `uploads/${userFolder}/${subject}`;

        fs.mkdirSync(uploadPath, { recursive: true });

        cb(null, uploadPath);
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

router.post("/upload", auth, upload.single("file"), async (req, res) => {

    const newFile = await File.create({
        userId: req.user.id,
        subject: req.body.subject,
        filename: req.file.filename,
        filepath: req.file.path
    });

    res.json(newFile);
});

router.get("/myfiles", auth, async (req, res) => {

    const files = await File.find({ userId: req.user.id });

    const grouped = {};

    files.forEach(file => {
        if (!grouped[file.subject]) {
            grouped[file.subject] = [];
        }

        grouped[file.subject].push(file);
    });

    res.json(grouped);
});

router.get("/shared/:groupCode", auth, async (req, res) => {

    const user = await User.findOne({ groupCode: req.params.groupCode });

    if (!user) {
        return res.status(404).json({ message: "Invalid Group Code" });
    }

    const files = await File.find({ userId: user._id });

    const grouped = {};

    files.forEach(file => {
        if (!grouped[file.subject]) {
            grouped[file.subject] = [];
        }

        grouped[file.subject].push(file);
    });

    res.json({
        owner: user.name,
        grouped
    });
});

router.delete("/:id", auth, async (req, res) => {

    try {

        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        // only owner can delete
        if (file.userId.toString() !== req.user.id) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        // delete physical file
        fs.unlinkSync(file.filepath);

        // delete from mongodb
        await File.findByIdAndDelete(req.params.id);

        res.json({
            message: "File deleted"
        });

    } catch (err) {

        res.status(500).json({
            message: "Delete failed"
        });
    }
});
module.exports = router;