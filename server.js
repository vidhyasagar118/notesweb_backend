const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

require("./config/cloudinary");

const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");

const contactRoutes=require("./routes/contactRoutes");
const statsRoutes = require("./routes/statsRoutes");

// ================= MIDDLEWARE =================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

// ================= ROUTES =================

app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);

app.use("/api/files", fileRoutes);
app.use(
  "/api/contact",
  require("./routes/contactRoutes")
);
app.get("/", (req, res) => {
    res.send("Backend Running 🚀");
});

// ================= ERROR HANDLER =================

app.use((err, req, res, next) => {

    console.log("GLOBAL ERROR:");
    console.log(err);

    res.status(500).json({
        message: err.message || "Server Error"
    });
});

// ================= DB =================

mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

    app.listen(process.env.PORT || 5000, () => {

        console.log("Server running on port 5000");
    });

})

.catch((err) => {

    console.log(err);
});