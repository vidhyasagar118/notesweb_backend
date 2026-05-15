const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();

const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");

app.use(cors());

app.use(express.json());

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

app.use("/api/auth", authRoutes);

app.use("/api/files", fileRoutes);

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

.catch((err) => {
  console.log(err);
});