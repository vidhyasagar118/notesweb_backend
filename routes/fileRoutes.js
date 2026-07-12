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
  "video/webm",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // Audio / Music
  "audio/m4a",
"audio/x-aac",
  "audio/mpeg",       // MP3
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",        // M4A
  "audio/x-m4a",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-flac",
];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
  new Error(
    "Only PDF, image, video and audio files are allowed"
  )
);
    }

    cb(null, true);
}
});

// ================= UPLOAD =================
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

      const subject = req.body.subject?.trim();
      const semester = req.body.semester?.trim();

      if (!subject || !semester) {
        return res.status(400).json({
          message: "Semester and subject are required"
        });
      }

      let visibility =
        req.body.visibility === "private"
          ? "private"
          : "public";

      /*
        Check karo ki ye subject-folder pehle se private hai.
        Agar private hai, to future uploads bhi private honge.
      */
      const existingPrivateFolder = await File.findOne({
        userId: req.user.id,
        semester,
        subject,
        visibility: "private"
      });

      if (existingPrivateFolder) {
        visibility = "private";
      }

      /*
        User ne Private select kiya hai to same semester +
        subject ki purani sabhi files ko bhi private karo.
      */
      if (visibility === "private") {
        await File.updateMany(
          {
            userId: req.user.id,
            semester,
            subject
          },
          {
            $set: {
              visibility: "private"
            }
          }
        );
      }

      const savedFiles = [];

      for (const file of req.files) {
        const fileStream = fs.createReadStream(file.path);

        const safeFilename =
          `${Date.now()}-${file.originalname}`;

        const key =
          `${req.user.id}/${subject}/${safeFilename}`;

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
          semester,
          subject,
          filename: file.originalname,

          fileType: file.mimetype,
          fileSize: file.size,

          filepath: fileUrl,
          downloadUrl: fileUrl,
          publicId: key,

          visibility
        });

        savedFiles.push(newFile);
      }

      return res.status(201).json(savedFiles);
    } catch (err) {
      console.error("Upload error:", err);

      if (req.files) {
        req.files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      return res.status(500).json({
        message: "Upload failed",
        error: err.message
      });
    }
  }
);
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
    const groupCode =
      req.params.groupCode.trim().toUpperCase();

    const user = await User.findOne({
      groupCode
    });

    if (!user) {
      return res.status(404).json({
        message: "Invalid Group Code"
      });
    }

    /*
      Sirf public aur purani files return hongi.
      Private files query me aayengi hi nahi.
    */
    const files = await File.find({
      userId: user._id,

      $or: [
        {
          visibility: "public"
        },
        {
          visibility: {
            $exists: false
          }
        }
      ]
    });

    const grouped = {};

    files.forEach((file) => {
      if (!file.semester || !file.subject) {
        return;
      }

      if (!grouped[file.semester]) {
        grouped[file.semester] = {};
      }

      if (!grouped[file.semester][file.subject]) {
        grouped[file.semester][file.subject] = [];
      }

      grouped[file.semester][file.subject].push(file);
    });

    return res.json({
      owner: user.name,
      grouped
    });
  } catch (err) {
    console.error("Shared files error:", err);

    return res.status(500).json({
      message: "Unable to load shared files"
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