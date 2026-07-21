const router = require("express").Router();
const User = require("../models/User");
const File = require("../models/File");

let cachedStats = null;
let cacheTime = 0;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

router.get("/", async (req, res, next) => {
  try {
    const now = Date.now();

    // Cached data तुरंत भेजो
    if (cachedStats && now - cacheTime < CACHE_DURATION) {
      return res.json(cachedStats);
    }

    // सभी queries एक साथ चलेंगी
    const [totalStudents, totalNotes, subjects] = await Promise.all([
      User.countDocuments({}),
      File.countDocuments({}),
      File.distinct("subject")
    ]);

    cachedStats = {
      totalStudents,
      totalNotes,
      subjects: subjects.filter(Boolean).length
    };

    cacheTime = now;

    return res.json(cachedStats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;