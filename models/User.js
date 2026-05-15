const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    password: String,
    groupCode: { type: String, unique: true }
});

module.exports = mongoose.model("User", userSchema);