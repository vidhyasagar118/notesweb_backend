const router = require("express").Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const auth = require("../middleware/authMiddleware");
const File = require("../models/File");
const User = require("../models/User");
const drive = require("../config/googleDrive");

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const tempDir = path.join(__dirname, "../temp");

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

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
        fileSize: 100 * 1024 * 1024
    }
});

async function createFolder(name, parentId = null) {

    const query = parentId
        ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
        : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const existing = await drive.files.list({
        q: query,
        fields: "files(id, name)"
    });

    if (existing.data.files.length > 0) {
        return existing.data.files[0].id;
    }

    const folder = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentId ? [parentId] : []
        },
        fields: "id"
    });

    return folder.data.id;
}

router.post("/upload", auth, upload.array("files", 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No files uploaded" });
        }

        const savedFiles = [];

        for (const file of req.files) {

            const semesterFolderId = await createFolder(
                req.body.semester,
                ROOT_FOLDER_ID
            );

            const subjectFolderId = await createFolder(
                req.body.subject,
                semesterFolderId
            );

            const response = await drive.files.create({
                requestBody: {
                    name: file.originalname,
                    parents: [subjectFolderId]
                },

                media: {
                    mimeType: mime.lookup(file.originalname),
                    body: fs.createReadStream(file.path)
                },

                fields: "id, webViewLink"
            });

            const fileId = response.data.id;

            await drive.permissions.create({
                fileId,
                requestBody: {
                    role: "reader",
                    type: "anyone"
                }
            });

            const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;
            const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

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

            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
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

router.get("/myfiles", auth, async (req, res) => {
    try {
        const files = await File.find({ userId: req.user.id });

        const grouped = {};

        files.forEach(file => {
            if (!grouped[file.semester]) grouped[file.semester] = {};
            if (!grouped[file.semester][file.subject]) grouped[file.semester][file.subject] = [];

            grouped[file.semester][file.subject].push(file);
        });

        res.json(grouped);

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

router.delete("/:id", auth, async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) return res.status(404).json({ message: "File not found" });

        if (file.userId.toString() !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await drive.files.delete({
            fileId: file.publicId
        });

        await File.findByIdAndDelete(req.params.id);

        res.json({ message: "Deleted Successfully" });

    } catch (err) {
        res.status(500).json({ message: "Delete failed" });
    }
});

router.get("/shared/:groupCode", auth, async (req, res) => {
    try {
        const user = await User.findOne({ groupCode: req.params.groupCode });

        if (!user) return res.status(404).json({ message: "Group not found" });

        const files = await File.find({ userId: user._id });

        const grouped = {};

        files.forEach(file => {
            if (!grouped[file.semester]) grouped[file.semester] = {};
            if (!grouped[file.semester][file.subject]) grouped[file.semester][file.subject] = [];

            grouped[file.semester][file.subject].push(file);
        });

        res.json({
            owner: user.name,
            grouped
        });

    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;