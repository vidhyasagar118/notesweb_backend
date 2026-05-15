const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function generateGroupCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post("/register", async (req, res) => {
    try {
        const { name, password } = req.body;

        const existing = await User.findOne({ name });

        if (existing) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            password: hashed,
            groupCode: generateGroupCode()
        });

        res.json({ message: "Account Created" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { name, password } = req.body;

        const user = await User.findOne({ name });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({ message: "Wrong password" });
        }

        const token = jwt.sign(
            {
                id: user._id,
                name: user.name
            },
            process.env.JWT_SECRET
        );

        res.json({
            token,
            user,
            message: "Login Success"
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;