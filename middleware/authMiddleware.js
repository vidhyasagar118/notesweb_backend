const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {


const authHeader = req.header("Authorization");

// ✅ Proper check
if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token" });
}

try {

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
    );

    req.user = decoded;
    next();

} catch (err) {

    console.log("JWT ERROR:", err);

    return res.status(401).json({
        message: "Invalid token"
    });
}


};
