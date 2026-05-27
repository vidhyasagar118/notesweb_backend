const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
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

        await cloudinary.uploader.destroy(file.publicId, {
            resource_type: "raw"
        });

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