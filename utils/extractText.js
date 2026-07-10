const axios = require("axios");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const path = require("path");
const pdf = require("pdf-poppler");

const extractPDFText = async (url) => {
  const response = await axios.get(url, {
    responseType: "arraybuffer"
  });

  // ✅ STEP 1: NORMAL TEXT
  const data = await pdfParse(response.data);
  let text = data.text;

  // ✅ STEP 2: OCR (IF NO TEXT)
  if (!text || text.trim().length < 50) {
    console.log("⚠️ No text found, using OCR...");

    const pdfPath = path.join(__dirname, "temp.pdf");
    const outputDir = path.join(__dirname, "output");

    // ✅ save pdf
    fs.writeFileSync(pdfPath, response.data);

    // ✅ ensure folder exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log("PDF saved at:", pdfPath);
    console.log("Output dir:", outputDir);

    // 🔥 convert PDF → image
    await pdf.convert(pdfPath, {
      format: "png",
      out_dir: outputDir,
      out_prefix: "img", // ✅ FIXED
      page: null
    });

    const files = fs.readdirSync(outputDir);

    let ocrText = "";

    for (const file of files) {
      const result = await Tesseract.recognize(
        path.join(outputDir, file),
        "eng"
      );

      ocrText += result.data.text + "\n";
    }

    text = ocrText;

    // ✅ CLEANUP
    fs.unlinkSync(pdfPath);
    files.forEach(file =>
      fs.unlinkSync(path.join(outputDir, file))
    );
  }

  return text;
};

module.exports = extractPDFText;