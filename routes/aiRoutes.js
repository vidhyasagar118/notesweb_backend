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