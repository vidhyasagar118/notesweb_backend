const sendEmail = require("../utils/sendEmail");

const sendContactMail = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ message: "All fields required ❌" });
    }

    await sendEmail({ name, email, phone, message });

    res.status(200).json({ message: "Email sent successfully ✅" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error ❌" });
  }
};

module.exports = { sendContactMail };