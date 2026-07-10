const axios = require("axios");
const pdfParse = require("pdf-parse");
const {
  TextractClient,
  DetectDocumentTextCommand
} = require("@aws-sdk/client-textract");

const textract = new TextractClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// 🔥 GET KEY FROM S3 URL
function getKeyFromUrl(url) {
  const parts = url.split(".amazonaws.com/");
  return parts[1];
}

const extractPDFText = async (url) => {
  try {
    // ✅ STEP 1: Try normal PDF text
    const response = await axios.get(url, {
      responseType: "arraybuffer"
    });

    const data = await pdfParse(response.data);
    let text = data.text;

    // ✅ STEP 2: If text not found → use Textract
    if (!text || text.trim().length < 50) {
      console.log("⚠️ Using AWS Textract...");

      const key = getKeyFromUrl(url);

      const command = new DetectDocumentTextCommand({
        Document: {
          S3Object: {
            Bucket: process.env.AWS_BUCKET_NAME,
            Name: key
          }
        }
      });

      const result = await textract.send(command);

      text = result.Blocks
        .filter(b => b.BlockType === "LINE")
        .map(b => b.Text)
        .join(" ");
    }

    return text;

  } catch (err) {
    console.log(err);
    return "";
  }
};

module.exports = extractPDFText;