const express = require("express");
const router = express.Router();
const { sendContactMail } = require("../controllers/contactController");

router.post("/", sendContactMail);


router.get("/test", (req, res) => {
  res.send("Contact Route Working");
});

module.exports = router;
module.exports = router;