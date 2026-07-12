const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");

const extractPDFText = require("../utils/extractText");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// =====================================================
// DETECT FILE CATEGORY
// =====================================================
function detectFileCategory({
  fileCategory,
  mimeType,
  fileName,
  originalName,
  fileUrl,
}) {
  const suppliedCategory = String(
    fileCategory || ""
  )
    .trim()
    .toLowerCase();

  if (
    ["pdf", "image", "video", "audio"].includes(
      suppliedCategory
    )
  ) {
    return suppliedCategory;
  }

  const mime = String(
    mimeType || ""
  ).toLowerCase();

  const name = String(
    originalName ||
      fileName ||
      fileUrl ||
      ""
  ).toLowerCase();

  if (
    mime === "application/pdf" ||
    /\.pdf(\?|$)/i.test(name)
  ) {
    return "pdf";
  }

  if (
    mime.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(
      name
    )
  ) {
    return "image";
  }

  if (
    mime.startsWith("video/") ||
    /\.(mp4|avi|mkv|mov|webm)(\?|$)/i.test(
      name
    )
  ) {
    return "video";
  }

  if (
    mime.startsWith("audio/") ||
    /\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/i.test(
      name
    )
  ) {
    return "audio";
  }

  return "other";
}
// =====================================================
// IMAGE VISION AI
// =====================================================
async function askImageAI(
  fileUrl,
  question
) {
  const response =
    await groq.chat.completions.create({
      model:
        "meta-llama/llama-4-scout-17b-16e-instruct",

      temperature: 0.2,
      max_completion_tokens: 1500,

      messages: [
        {
          role: "system",
          content: `
You are a professional AI image analyzer and teacher.

Carefully inspect the uploaded image.

Rules:

- Read all clearly visible printed text.
- Read handwriting only when it is clearly visible.
- Explain diagrams, screenshots, tables, graphs and charts.
- Reply in the same language as the user's question.
- Hindi question → Hindi answer.
- English question → English answer.
- Hinglish question → Hinglish answer.
- Do not invent anything that is not visible.
- If the image is blurry, cropped or unreadable, clearly say so.
- Give clean and structured answers.
`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: question,
            },
            {
              type: "image_url",
              image_url: {
                url: fileUrl,
              },
            },
          ],
        },
      ],
    });

  return (
    response.choices?.[0]?.message
      ?.content ||
    "Image ko analyze nahi kar paya."
  );
}

// =====================================================
// VIDEO TRANSCRIPTION
// =====================================================
async function transcribeMedia(fileUrl) {
  const result =
    await groq.audio.transcriptions.create({
      url: fileUrl,
      model: "whisper-large-v3-turbo",
      response_format: "json",
      temperature: 0,
    });

  return result.text || "";
}

// =====================================================
// ANSWER FROM VIDEO TRANSCRIPT
// =====================================================
async function answerFromVideoTranscript(
  transcript,
  question
) {
  const chunks = splitText(
    transcript,
    6000
  );

  const relevantChunk =
    findRelevantChunk(
      chunks,
      question
    );

  const response =
    await groq.chat.completions.create({
      model:
        "llama-3.1-8b-instant",

      temperature: 0.3,

      messages: [
        {
          role: "system",
          content: `
You are a professional teacher.

The given context is the spoken transcript of an uploaded video.

Rules:

- Answer only using the transcript.
- Reply in the same language as the user.
- Do not invent visual information.
- If the answer is not present in the transcript, clearly say so.
- Keep the answer clean and structured.
`,
        },
        {
          role: "user",
          content: `
Video transcript:

${relevantChunk}

Question:

${question}
`,
        },
      ],
    });

  return (
    response.choices?.[0]?.message
      ?.content ||
    "Video transcript se answer generate nahi hua."
  );
}
// =====================================================
// PLATFORM INFORMATION
// =====================================================
const PLATFORM_INFO = `
You are the official AI assistant of NotesWeb.

The user is already using the NotesWeb website.

IMPORTANT RULES:

Whenever the user says any of the following:

- this website
- this weebsite
- this site
- this app
- this platform
- our website
- website
- site
- app
- platform
- features
- what is this website
- tell me about this website

- give me information about this site

Always assume the user is asking about NotesWeb.

Never ask:

- Which website?
- Which site?
- Please provide the URL.
- Please provide the website name.
- What website are you referring to?
- Please provide more context.

Instead, directly explain NotesWeb using the information below.

## 🚀 Welcome to NotesWeb – Smart AI Learning Platform

NotesWeb is an AI-powered learning platform designed to make learning faster, easier and smarter.

Instead of reading hundreds of pages manually, students can upload their study notes or PDFs and ask questions using the built-in AI assistant.

---

## 📄 Upload & Learn

Students can upload:

- Study notes
- Class PDFs
- University notes
- Books
- Lecture material

Students can organize uploaded files semester-wise and subject-wise.

---

## 🤖 AI-Powered Assistant

The built-in AI can:

- Answer questions from readable PDFs
- Explain difficult topics in simple English
- Give clean and structured answers
- Help with exam preparation
- Explain programming concepts
- Answer general knowledge questions

---

## 🧠 Smart AI Switching

NotesWeb uses Smart AI Routing.

The AI automatically decides:

- If the question is about the opened PDF, answer using PDF content.
- If the question is general, answer using general AI knowledge.
- If the question is about NotesWeb, explain the platform.

No manual switching is required.

---

## 📚 PDF Learning

Students can:

- View PDFs directly inside the website
- Ask questions from uploaded notes
- Download uploaded PDFs
- Delete uploaded files
- Save time while studying
- Find important information quickly

---

## ⚡ Main Features

- AI Chat Assistant
- PDF Question Answering
- Smart PDF Detection
- General AI Assistant
- Semester-wise Notes
- Subject-wise Notes
- Built-in PDF Viewer
- PDF Download
- PDF Delete
- Clean User Interface
- Responsive Design
- Fast AI Responses

---

## 📖 How to Use NotesWeb

1. Log in to NotesWeb.
2. Upload a study PDF.
3. Open the PDF.
4. Ask a question in the AI chat box.
5. The AI automatically decides whether to use PDF content or general knowledge.

---

## 🎯 Benefits

- Learn faster
- Save study time
- Improve understanding
- Avoid manual searching
- Get help like a personal AI teacher
- Use a simple and student-friendly interface

---

## ⚠️ Important Limitation

Normal text-based PDFs can be read directly.

Scanned, image-based or handwritten PDFs require OCR support because normal PDF text extraction cannot read text stored inside images.

For questions unrelated to NotesWeb, answer normally using the same language as the user's question.## 🌍 Language Support

Always detect the user's language automatically.

- If the user asks in English, reply in English.
- If the user asks in Hindi, reply in Hindi.
- If the user asks in Hinglish, reply in Hinglish.
- Never force English if the user is using another language.
- Keep the response in the same language as the user's question.
`;

// =====================================================
// SPLIT PDF TEXT INTO CHUNKS
// =====================================================
function splitText(text, chunkSize = 1200) {
  const chunks = [];

  if (!text) {
    return chunks;
  }

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

// =====================================================
// FIND MOST RELEVANT PDF CHUNK
// =====================================================
function findRelevantChunk(chunks, question) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return "";
  }

  const words = question
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);

  let bestChunk = chunks[0];
  let maxScore = 0;

  for (const chunk of chunks) {
    let score = 0;
    const lowerChunk = chunk.toLowerCase();

    for (const word of words) {
      if (lowerChunk.includes(word)) {
        score++;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestChunk = chunk;
    }
  }

  return bestChunk;
}

// =====================================================
// NORMALIZE ROUTER RESPONSE
// =====================================================
function normalizeRouteType(value) {
  const type = String(value || "")
    .trim()
    .toUpperCase();

  return type === "PDF" ? "PDF" : "GLOBAL";
}

// =====================================================
// ASK DIRECTLY FROM PDF
// Optional route
// =====================================================
router.post("/ask-from-pdf", async (req, res) => {
  try {
    const { fileUrl, question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        answer: "Please enter a question."
      });
    }

    if (!fileUrl) {
      return res.status(400).json({
        answer: "Please open a PDF before asking a PDF question."
      });
    }

    const result = await extractPDFText(fileUrl);

    if (result.error) {
      return res.json({
        answer: "I could not read this PDF. Please upload it again."
      });
    }

    if (result.isScanned || !result.text || !result.text.trim()) {
      return res.json({
        answer:
          "This PDF contains scanned images instead of selectable text. OCR support is required to read it."
      });
    }

    const cleanedText = result.text
      .replace(/\s+/g, " ")
      .trim();

    const chunks = splitText(cleanedText);
    const relevantChunk = findRelevantChunk(chunks, question);

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are a professional teacher.

Answer only using the provided PDF context.
Rules:

- Detect the language of the user's question automatically.
- If the user asks in English, answer in English.
- If the user asks in Hindi, answer in Hindi.
- If the user asks in Hinglish, answer in Hinglish.
- Keep the response in the same language as the user's question.
- Use simple language.
- Explain the answer step by step when needed.
- Keep the answer clean and structured.
- Do not invent information.
- If the answer is not available in the PDF context, clearly say that it was not found in the PDF.
`
        },
        {
          role: "user",
          content: `
PDF Context:

${relevantChunk}

Question:

${question.trim()}

Give a clear and structured answer.
`
        }
      ]
    });

    return res.json({
      source: "PDF",
      answer:
        response.choices?.[0]?.message?.content ||
        "Unable to generate an answer."
    });
  } catch (err) {
    console.error("Ask from PDF error:", err);

    return res.status(500).json({
      answer: "AI service error. Please try again."
    });
  }
});

// =====================================================
// GLOBAL AI
// Used when no PDF is open
// =====================================================
router.post("/global-ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        answer: "Please enter a question."
      });
    }

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: PLATFORM_INFO
        },
        {
          role: "user",
          content: question.trim()
        }
      ]
    });

    return res.json({
      source: "GLOBAL",
      answer:
        response.choices?.[0]?.message?.content ||
        "Unable to generate an answer."
    });
  } catch (err) {
    console.error("Global AI error:", err);

    return res.status(500).json({
      answer: "AI service error. Please try again."
    });
  }
});

// =====================================================
// SMART AI
// Used when PDF is open
// First decides PDF or GLOBAL
// =====================================================
router.post(
  "/smart-ask",
  async (req, res) => {
    try {
      const {
        fileUrl,
        fileCategory,
        mimeType,
        fileName,
        originalName,
        fileSize,
        question,
      } = req.body;

      if (
        !question ||
        !question.trim()
      ) {
        return res.status(400).json({
          answer:
            "Please enter a question.",
        });
      }

      const cleanQuestion =
        question.trim();

      const lowerQuestion =
        cleanQuestion.toLowerCase();

      const category =
        detectFileCategory({
          fileCategory,
          mimeType,
          fileName,
          originalName,
          fileUrl,
        });

      console.log(
        "AI category:",
        category
      );

      console.log(
        "AI file:",
        fileUrl
      );

      const websiteKeywords = [
        "this website",
        "this weebsite",
        "this site",
        "this app",
        "this platform",
        "notesweb",
        "website features",
        "site features",
      ];

      const isWebsiteQuestion =
        websiteKeywords.some((keyword) =>
          lowerQuestion.includes(
            keyword
          )
        );

      if (isWebsiteQuestion) {
        const response =
          await groq.chat.completions.create({
            model:
              "llama-3.1-8b-instant",

            temperature: 0.4,

            messages: [
              {
                role: "system",
                content:
                  PLATFORM_INFO,
              },
              {
                role: "user",
                content:
                  cleanQuestion,
              },
            ],
          });

        return res.json({
          source: "GLOBAL",
          answer:
            response.choices?.[0]
              ?.message?.content ||
            "Unable to generate an answer.",
        });
      }

      if (!fileUrl) {
        const response =
          await groq.chat.completions.create({
            model:
              "llama-3.1-8b-instant",

            temperature: 0.4,

            messages: [
              {
                role: "system",
                content:
                  PLATFORM_INFO,
              },
              {
                role: "user",
                content:
                  cleanQuestion,
              },
            ],
          });

        return res.json({
          source: "GLOBAL",
          answer:
            response.choices?.[0]
              ?.message?.content ||
            "Unable to generate an answer.",
        });
      }

      // ===============================
      // IMAGE
      // ===============================

      if (category === "image") {
        const sizeInBytes =
          Number(fileSize || 0);

        const maxImageSize =
          20 * 1024 * 1024;

        if (
          sizeInBytes > maxImageSize
        ) {
          return res.json({
            source: "IMAGE",
            answer:
              "Image 20 MB se badi hai. AI analysis ke liye image compress karke upload karo.",
          });
        }

        const answer =
          await askImageAI(
            fileUrl,
            cleanQuestion
          );

        return res.json({
          source: "IMAGE",
          answer,
        });
      }

      // ===============================
      // VIDEO
      // ===============================

      if (category === "video") {
        const supportedVideo =
          /\.(mp4|webm)(\?|$)/i.test(
            originalName ||
              fileName ||
              fileUrl
          );

        if (!supportedVideo) {
          return res.json({
            source: "VIDEO",
            answer:
              "AVI, MKV aur MOV video ko AI directly transcribe nahi kar pa raha. Video ko MP4 ya WebM format me upload karo.",
          });
        }

const transcript =
  await transcribeMedia(fileUrl);

        if (!transcript.trim()) {
          return res.json({
            source: "VIDEO",
            answer:
              "Video me clear spoken audio nahi mila.",
          });
        }

        const answer =
          await answerFromVideoTranscript(
            transcript,
            cleanQuestion
          );

        return res.json({
          source: "VIDEO",
          answer,
        });
      }
      // ===============================
// AUDIO / MUSIC
// ===============================

if (category === "audio") {
  const supportedAudio =
    /\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/i.test(
      originalName ||
        fileName ||
        fileUrl
    );

  if (!supportedAudio) {
    return res.json({
      source: "AUDIO",
      answer:
        "Ye audio format AI transcription ke liye supported nahi hai.",
    });
  }

  const transcript =
    await transcribeMedia(fileUrl);

  if (!transcript.trim()) {
    return res.json({
      source: "AUDIO",
      answer:
        "Audio me clear speech ya lyrics detect nahi hui.",
    });
  }

  const answer =
    await answerFromVideoTranscript(
      transcript,
      cleanQuestion
    );

  return res.json({
    source: "AUDIO",
    answer,
  });
}

      // ===============================
      // PDF
      // ===============================

      if (category === "pdf") {
        const pdfData =
          await extractPDFText(
            fileUrl
          );

        if (pdfData.error) {
          return res.json({
            source: "PDF",
            answer:
              "PDF read nahi ho paayi. Please dobara upload karo.",
          });
        }

        if (
          pdfData.isScanned ||
          !pdfData.text ||
          !pdfData.text.trim()
        ) {
          return res.json({
            source: "PDF",
            answer:
              "Ye scanned ya image-based PDF hai. Iske liye PDF pages ko images me convert karke Vision AI se read karna hoga.",
          });
        }

        const cleanedText =
          pdfData.text
            .replace(/\s+/g, " ")
            .trim();

        const chunks = splitText(
          cleanedText,
          1200
        );

        if (chunks.length === 0) {
          return res.json({
            source: "PDF",
            answer:
              "PDF me readable content nahi mila.",
          });
        }

        const relevantChunk =
          findRelevantChunk(
            chunks,
            cleanQuestion
          );

        const response =
          await groq.chat.completions.create({
            model:
              "llama-3.1-8b-instant",

            temperature: 0.3,

            messages: [
              {
                role: "system",
                content: `
You are a helpful professional teacher.

Answer only using the provided PDF context.

Rules:

- Reply in the same language as the user.
- Use simple language.
- Keep the answer clean and structured.
- Do not invent information.
- If the answer is not available in the context, say so clearly.
`,
              },
              {
                role: "user",
                content: `
PDF Context:

${relevantChunk}

Question:

${cleanQuestion}
`,
              },
            ],
          });

        return res.json({
          source: "PDF",
          answer:
            response.choices?.[0]
              ?.message?.content ||
            "Unable to generate an answer.",
        });
      }

      return res.json({
        source: "OTHER",
        answer:
          "Ye file type AI analysis ke liye supported nahi hai.",
      });
    } catch (err) {
      console.error(
        "Smart AI error:",
        err.response?.data ||
          err.message ||
          err
      );

      return res.status(500).json({
        answer:
          err.response?.data?.error
            ?.message ||
          "AI service error. Please try again.",
      });
    }
  }
);

module.exports = router;