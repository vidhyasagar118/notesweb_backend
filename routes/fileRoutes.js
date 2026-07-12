const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const User = require("../models/User");
const auth = require("../middleware/authMiddleware");
const File = require("../models/File");

const s3 = require("../config/s3");

const {
  PutObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
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
    storage,
limits: {
    fileSize: 1024 * 1024 * 1024
},


  fileFilter: (req, file, cb) => {

    const allowedTypes = [
  // PDF
  "application/pdf",

  // Videos
  "video/mp4",
  "video/x-msvideo",
  "video/x-matroska",
  "video/quicktime",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

    if (!allowedTypes.includes(file.mimetype)) {
        return cb(
            new Error("Only PDF and Video  images files allowed")
        );
    }

    cb(null, true);
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

const fileStream = fs.createReadStream(file.path);
 const key =
        `${req.user.id}/${req.body.subject}/${Date.now()}-${file.originalname}`;

await s3.send(
  new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: file.mimetype
  })
);
   


    if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
    }

    const fileUrl =
        `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    const newFile = await File.create({
        userId: req.user.id,
        subject: req.body.subject,
        semester: req.body.semester,
        filename: file.originalname,

        fileType: file.mimetype,
        fileSize: file.size,

        filepath: fileUrl,
        downloadUrl: fileUrl,
        publicId: key
    });

    savedFiles.push(newFile);
}
return res.json(savedFiles);

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

if (!file) {
    return res.status(404).json({
        message: "File not found"
    });
}

if (
    file.userId.toString() !== req.user.id
) {
    return res.status(403).json({
        message: "Unauthorized"
    });
}

        if (!file) return res.status(404).json({ message: "File not found" });

await s3.send(
    new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: file.publicId
    })
);

        await File.findByIdAndDelete(req.params.id);

        res.json({ message: "Deleted Successfully" });

    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
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
                message: "Invalid Group Code"
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
            message: err.message
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
            message: err.message
        });
    }
});

module.exports = router;