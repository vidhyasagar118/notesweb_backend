const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        const subject = req.body.subject;
        const userFolder = req.user.id;

        const uploadPath = `uploads/${userFolder}/${subject}`;

        fs.mkdirSync(uploadPath, { recursive: true });

        cb(null, uploadPath);
    },

    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage });

router.post("/upload", auth, upload.single("file"), async (req, res) => {

    const newFile = await File.create({
        userId: req.user.id,
        subject: req.body.subject,
        filename: req.file.filename,

        // 🔥 CRITICAL FIX
        filepath: req.file.path.replace(/\\/g, "/")
    });

    res.json(newFile);
});

router.get("/myfiles", auth, async (req, res) => {

    const files = await File.find({ userId: req.user.id });

    const grouped = {};

    files.forEach(f => {
        if (!grouped[f.subject]) grouped[f.subject] = [];
        grouped[f.subject].push(f);
    });

    res.json(grouped);
});

router.delete("/:id", auth, async (req, res) => {

    const file = await File.findById(req.params.id);

    if (!file) return res.status(404).json({ message: "Not found" });

    fs.unlinkSync(file.filepath);

    await File.findByIdAndDelete(req.params.id);

    res.json({ message: "Deleted" });
});

module.exports = router;