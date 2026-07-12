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
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        message: "Name and password are required"
      });
    }

    const user = await User.findOne({ name });

    if (!user) {
  return res.status(404).json({
    message: "Account not found. Please create your account first (Pehle account create karein)."
  });
}
    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.status(401).json({
        message: "Invalid name or password"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        groupCode: user.groupCode
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Login failed"
    });
  }
});
module.exports = router;