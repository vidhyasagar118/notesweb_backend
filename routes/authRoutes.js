const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");

function generateGroupCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.get("/verify", auth, (req, res) => {
    res.json({ valid: true });
});

router.post("/register", async (req, res) => {

    const { name, password } = req.body;

    const existing = await User.findOne({ name });

    if (existing) {
        return res.status(400).json({ message: "User exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
        name,
        password: hashed,
        groupCode: generateGroupCode()
    });

    res.json({ message: "Registered" });
});

router.post("/login", async (req, res) => {

    const { name, password } = req.body;

    const user = await User.findOne({ name });

    if (!user) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
        { id: user._id, name: user.name },
        process.env.JWT_SECRET
    );

    res.json({ token, user });
});

module.exports = router;