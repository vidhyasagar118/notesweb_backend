const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");

const extractPDFText = require("../utils/extractText");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// =====================================================
// PLATFORM INFORMATION
// =====================================================
const PLATFORM_INFO = `
You are the official AI assistant of NotesWeb.

The user is already using the NotesWeb website.

IMPORTANT RULES:

Whenever the user says:

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

Instead, directly explain NotesWeb.

NotesWeb is an AI-powered learning platform designed for students.

Main features of NotesWeb:

- Students can upload PDFs and study notes.
- Students can organize notes semester-wise and subject-wise.
- Students can view PDFs directly inside the website.
- Students can ask questions from readable PDFs.
- Students can ask general knowledge and programming questions.
- Smart AI routing decides whether the question is related to the PDF or general knowledge.
- Answers are displayed in a clean AI chat interface.
- The AI works like a personal learning assistant.
- Users can manage, download and delete uploaded study files.

How NotesWeb works:

1. The user uploads a PDF.
2. The user opens the PDF.
3. The user asks a question.
4. If the question is about the opened PDF, the AI answers using PDF content.
5. If the question is general, the AI answers using general knowledge.

Important limitation:

Scanned or image-based PDFs require OCR because normal PDF text extraction cannot read images.

For questions unrelated to NotesWeb, answer normally using clear and helpful English.
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

- Use clear and proper English.
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
router.post("/smart-ask", async (req, res) => {
  try {
    const { fileUrl, question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        answer: "Please enter a question."
      });
    }

    const cleanQuestion = question.trim();

    // =================================================
    // STEP 1: DECIDE PDF OR GLOBAL
    // =================================================
    const decision = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are an AI request router.

Your job is to decide whether the user's question requires information from the currently opened PDF or should be answered using general knowledge.

Reply PDF only when the user clearly refers to:

- this PDF
- the PDF
- this document
- the document
- these notes
- this chapter
- this notice
- this file
- information inside the PDF
- a table, date, topic, subject, paragraph or content from the opened document

Reply GLOBAL when the question is about:

- this website
- this weebsite
- this site
- this app
- this platform
- website
- site
- app
- platform
- features
- NotesWeb
- general knowledge
- programming
- development
- web development
- websites
- apps
- companies
- technology
- anything not clearly related to the PDF

Examples:

Question: Give me information about this PDF.
Answer: PDF

Question: What is written in this document?
Answer: PDF

Question: Explain the notice in this PDF.
Answer: PDF

Question: Give me information about development.
Answer: GLOBAL

Question: Give me information about this website.
Answer: GLOBAL

Question: Give me information about this weebsite.
Answer: GLOBAL

Question: This website.
Answer: GLOBAL

Question: Website.
Answer: GLOBAL

Question: Explain React.
Answer: GLOBAL

If you are unsure, always reply GLOBAL.

Return only one word:

PDF

or

GLOBAL
`
        },
        {
          role: "user",
          content: cleanQuestion
        }
      ]
    });

    const rawType =
      decision.choices?.[0]?.message?.content;

    const type = normalizeRouteType(rawType);

    console.log("=================================");
    console.log("QUESTION:", cleanQuestion);
    console.log("AI ROUTE TYPE:", type);
    console.log("=================================");

    // =================================================
    // CASE 1: GLOBAL QUESTION
    // Do not extract PDF
    // =================================================
    if (type === "GLOBAL") {
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
            content: cleanQuestion
          }
        ]
      });

      return res.json({
        source: "GLOBAL",
        answer:
          response.choices?.[0]?.message?.content ||
          "Unable to generate an answer."
      });
    }

    // =================================================
    // CASE 2: PDF QUESTION
    // Only now extract PDF
    // =================================================
    if (!fileUrl) {
      return res.json({
        source: "PDF",
        answer: "Please open a PDF before asking a question about it."
      });
    }

    const pdfData = await extractPDFText(fileUrl);

    if (pdfData.error) {
      return res.json({
        source: "PDF",
        answer:
          "I could not read this PDF. Please upload the PDF again and try."
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
          "This PDF contains scanned images instead of selectable text. OCR support is required to read it."
      });
    }

    const cleanedText = pdfData.text
      .replace(/\s+/g, " ")
      .trim();

    const chunks = splitText(cleanedText, 1200);

    if (chunks.length === 0) {
      return res.json({
        source: "PDF",
        answer: "No readable content was found in this PDF."
      });
    }

    const relevantChunk = findRelevantChunk(
      chunks,
      cleanQuestion
    );

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are a helpful professional teacher.

Answer only using the provided PDF context.

Rules:

- Use clear and proper English.
- Use simple and understandable language.
- Explain step by step when necessary.
- Keep the answer clean and structured.
- Do not invent information.
- Do not use unrelated general knowledge.
- If the answer is not available in the provided PDF context, clearly say that it was not found in the PDF.
`
        },
        {
          role: "user",
          content: `
PDF Context:

${relevantChunk}

Question:

${cleanQuestion}

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
    console.error("Smart AI error:", err);

    return res.status(500).json({
      answer: "AI service error. Please try again."
    });
  }
});

module.exports = router;