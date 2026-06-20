const router = require("express").Router();
const User = require("../models/User");
const File = require("../models/File");

router.get("/", async (req, res) => {

  const totalStudents = await User.countDocuments();
  const totalNotes = await File.countDocuments();

  const subjects = await File.distinct("subject");

  res.json({
    totalStudents,
    totalNotes,
    subjects: subjects.length
  });
});

module.exports = router;