const express = require("express");
const router = express.Router();
const Groq = require("groq-sdk");

const extractPDFText = require("../utils/extractText");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ✅ SPLIT TEXT
function splitText(text, chunkSize = 1000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// ✅ FIND BEST CHUNK
function findRelevantChunk(chunks, question) {
  const words = question.toLowerCase().split(" ");

  let bestChunk = chunks[0];
  let maxScore = 0;

  for (const chunk of chunks) {
    let score = 0;

    for (const word of words) {
      if (chunk.toLowerCase().includes(word)) {
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

// 🔥 MAIN ROUTE
router.post("/ask-from-pdf", async (req, res) => {
  try {
    const { fileUrl, question } = req.body;

const result = await extractPDFText(fileUrl);


if (result.isScanned) {
  return res.json({
    answer:
      "This PDF contains scanned images  or handwritten, so I am unable to answer ✍️. OCR support is required to read it."
  });
}

const text = result.text;

    if (!text || text.trim().length === 0) {
      return res.json({
        answer: "No readable content found in PDF 😕"
      });
    }

    const cleanedText = text.replace(/\s+/g, " ");

    const chunks = splitText(cleanedText, 1200);

    const relevantChunk = findRelevantChunk(chunks, question);

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are a professional computer science teacher.

Rules:
- Answer in clear and proper English
- Use simple language
- Explain concepts step by step
- Do NOT use Hinglish or mixed language
- Improve the wording if the PDF text is messy
- Keep the answer clean and well-structured
`},{
  role: "user",
  content: `
Context:
${relevantChunk}

Question:
${question}

Give answer in this format:

1. Proper Heading
2. Short Definition
3. Transition Table (in table format)
5. Simple ASCII Diagram
6. Use proper spacing and line breaks
7. Keep it clean and readable
`
}
      ]
    });

    res.json({
      answer: response.choices[0].message.content
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "AI error" });
  }
});

// 🌍 GLOBAL AI
router.post("/global-ask", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
         content: `
You are an AI assistant inside a Smart AI Learning Platform.

Your job is to help users understand and use this platform effectively.

IMPORTANT RULES:

* Do NOT ask for any website URL
* Always assume the user is talking about THIS platform
* If user asks about "this site", "this app", "features", "what is this", etc → show full platform introduction
* Answer clearly, confidently, and in an attractive way
* Do not ask unnecessary questions

---

IF USER ASKS ABOUT THE PLATFORM, REPLY LIKE THIS:

## 🚀 Welcome to Your Smart AI Learning Platform

This platform is designed to make learning faster, easier, and smarter using AI.

### 📄 Upload & Learn from Notes

You can upload your study notes or PDFs, and the AI will instantly understand the content. Instead of reading everything manually, just ask questions and get clear answers directly from your notes.

### 🤖 AI-Powered Answers

Our intelligent AI can:

* Answer questions from your uploaded PDFs
* Explain complex topics in simple language
* Provide structured and well-formatted answers

### 🧠 Smart Switching (Best Feature)

The AI automatically decides:

* If your question is from your notes → answers from PDF
* If it's general → answers using global knowledge

So you always get the most relevant answer without doing anything extra.

### ✨ Key Features

* 📌 Clean and easy-to-use interface
* 📌 Fast and accurate answers
* 📌 Supports detailed explanations with examples
* 📌 Works like a personal teacher

### 📖 How to Use

1. Upload your PDF or notes
2. Ask any question related to your content
3. Get instant, clear, and structured answers

### 🎯 Why Use This Platform?

* Saves time ⏳
* Improves understanding 📚
* No need to search manually 🔍
* Learn smarter, not harder 💡

---

FOR NORMAL QUESTIONS:

* Answer normally (PDF or general)
* Keep answers clean and helpful

`
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    res.json({
      answer: response.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ message: "AI error" });
  }
});
router.post("/smart-ask", async (req, res) => {
  try {
    const { fileUrl, question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({
        answer: "Please enter a question."
      });
    }

    // ============================
    // STEP 1: PEHLE DECIDE KARO
    // PDF question hai ya GLOBAL
    // ============================
    const decision = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are an AI request router.

Decide whether the user's question requires information from the currently opened PDF.

Reply PDF only when the question clearly refers to:
- this PDF
- this document
- these notes
- this chapter
- content, table, topic, date, notice or information inside the uploaded document

Reply GLOBAL when the question is:
- general knowledge
- about development
- about programming
- about websites, apps, companies or technology
- not clearly related to the opened PDF

Examples:

Question: What is written in this PDF?
Answer: PDF

Question: Explain the second chapter from these notes.
Answer: PDF

Question: Give me proper information about development.
Answer: GLOBAL

Question: What is web development?
Answer: GLOBAL

Question: Explain React.
Answer: GLOBAL

If unsure, reply GLOBAL.

Return only one word:
PDF
or
GLOBAL
`
        },
        {
          role: "user",
          content: question.trim()
        }
      ]
    });

    const rawType =
      decision.choices?.[0]?.message?.content?.trim().toUpperCase() || "";

    const type = rawType === "PDF" ? "PDF" : "GLOBAL";

    console.log("AI ROUTE TYPE:", type);
    console.log("QUESTION:", question);

    // ============================
    // CASE 1: GLOBAL QUESTION
    // PDF KO EXTRACT HI MAT KARO
    // ============================
    if (type === "GLOBAL") {
      const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `
You are a smart and helpful AI assistant.

Rules:
- Answer the user's general question directly.
- Use clear and proper English.
- Explain step by step when needed.
- Keep the response clean and well structured.
- Do not force the answer to relate to the opened PDF.
`
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
    }

    // ============================
    // CASE 2: PDF QUESTION
    // AB PDF EXTRACT KARO
    // ============================
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
        answer: "I could not read this PDF. Please try uploading it again."
      });
    }

    if (pdfData.isScanned || !pdfData.text) {
      return res.json({
        source: "PDF",
        answer:
          "This PDF appears to contain scanned images instead of selectable text. OCR support is required to read it."
      });
    }

    const cleanedText = pdfData.text.replace(/\s+/g, " ").trim();

    const chunks = splitText(cleanedText, 1200);
    const relevantChunk = findRelevantChunk(chunks, question);

    
      
    // 🔥 CASE 2: GLOBAL
const response = await groq.chat.completions.create({
  model: "llama-3.1-8b-instant",
  messages: [
    {
      role: "system",
      content: `
You are an AI assistant inside a Smart AI Learning Platform.

IMPORTANT RULES:

1. When the user says:
- this website
- this site
- this app
- this platform
- website
- site
- features
- what is this
- tell me about this website
- give information about this site

Always assume the user is asking about THIS Smart AI Learning Platform.

2. Do not ask for a URL.

3. Do not say:
- "Which website?"
- "Please provide the URL"
- "I don't see the website"
- "Please provide more context"

4. For platform-related questions, explain this platform clearly.

Platform information:

## Smart AI Learning Platform

This is an AI-powered learning platform designed to help students upload, view and understand their study PDFs and notes.

### Main Features

- Users can upload and manage study PDFs
- Users can view PDFs directly on the website
- AI can answer questions from readable PDF content
- AI can also answer general knowledge and programming questions
- Smart switching decides whether a question is related to the PDF or general knowledge
- Answers are displayed in a clean chat interface
- The platform works like a personal learning assistant

### How It Works

1. The user uploads a PDF
2. The user opens the PDF
3. The user asks a question
4. If the question is related to the PDF, the AI uses the PDF content
5. If the question is general, the AI answers using general knowledge

### Important Limitation

Scanned or image-based PDFs require OCR before their text can be read.

For normal questions unrelated to the platform, answer normally and clearly.
`
    },
    {
      role: "user",
      content: question
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