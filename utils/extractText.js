const axios = require("axios");
const pdfParse = require("pdf-parse");

const extractPDFText = async (url) => {
  try {
    if (!url) {
      return {
        text: "",
        isScanned: false,
        error: "PDF URL missing"
      };
    }

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000
    });

    const data = await pdfParse(response.data);
    const text = (data.text || "").trim();

    const wordCount = text
      ? text.split(/\s+/).filter(Boolean).length
      : 0;

    // Text bahut kam mila to scanned/image PDF ho sakti hai.
    const isScanned = wordCount < 30;

    return {
      text,
      isScanned,
      wordCount
    };
  } catch (err) {
    console.error("PDF extraction error:", err.message);

    return {
      text: "",
      isScanned: false,
      wordCount: 0,
      error: err.message
    };
  }
};

module.exports = extractPDFText;