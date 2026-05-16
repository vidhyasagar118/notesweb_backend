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
router.post(
    "/upload",
    auth,
    upload.array("files", 20),
    async (req, res) => {

        try {

            const savedFiles = [];

            for (const file of req.files) {

                const newFile = await File.create({
                    userId: req.user.id,
                    subject: req.body.subject,
                    filename: file.filename,
                    semester: req.body.semester,
                    filepath: file.path.replace(/\\/g, "/")
                });

                savedFiles.push(newFile);
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
router.get("/myfiles", auth, async (req, res) => {

    try {

        const files = await File.find({
            userId: req.user.id
        });

        const grouped = {};

        files.forEach(file => {

            // Semester create
            if (!grouped[file.semester]) {
                grouped[file.semester] = {};
            }

            // Subject create
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
router.delete("/:id", auth, async (req, res) => {

    const file = await File.findById(req.params.id);

    if (!file) {
        return res.status(404).json({ message: "Not found" });
    }

    // OWNER CHECK
    if (file.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
    }

    await File.findByIdAndDelete(req.params.id);

    res.json({ message: "Deleted" });
});


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

    // semester create
    if (!grouped[file.semester]) {
        grouped[file.semester] = {};
    }

    // subject create
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