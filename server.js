const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

app.use(cors({
    origin: "*"
}));

app.use(express.json());

app.use("/uploads",
    express.static(path.join(__dirname, "uploads"))
);

app.use("/api/auth",
    require("./routes/authRoutes")
);

app.use("/api/files",
    require("./routes/fileRoutes")
);

app.get("/", (req, res) => {
    res.send("Backend Running 🚀");
});

mongoose.connect(process.env.MONGO_URI)
.then(() => {

    console.log("MongoDB Connected");

    app.listen(process.env.PORT || 5000, () => {
        console.log("Server running");
    });

})
.catch(err => console.log(err));