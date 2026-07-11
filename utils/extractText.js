const axios = require("axios");
const pdfParse = require("pdf-parse");

const extractPDFText = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer"
    });

    const data = await pdfParse(response.data);
    let text = data.text || "";

    // 🔥 SMART CHECK (NO AWS)
    const wordCount = text.trim().split(/\s+/).length;

    let isHandwritten = false;

    if (!text || wordCount < 30) {
      isHandwritten = true;
    }

    return {
      text,
      isHandwritten
    };

  } catch (err) {
    console.log(err);
    return {
      text: "",
      isHandwritten: true
    };
  }
};

module.exports = extractPDFText;