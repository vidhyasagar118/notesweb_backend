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
router.post("/ask-from-pdf", async (req, res) => {
  try {
    const { fileUrl, question } = req.body;

    const text = await extractPDFText(fileUrl);

    // ❌ Case 1: No text
    if (!text || text.trim().length === 0) {
      return res.json({
        answer: "PDF is handwritten, so I am unable to answer ✍️"
      });
    }

    // ❌ Case 2: Very low words → handwritten / image PDF
    const wordCount = text.trim().split(/\s+/).length;

    // ❌ Case 3: Too many weird characters (optional smart check)
    const specialCharRatio =
      (text.match(/[^a-zA-Z0-9\s]/g) || []).length / text.length;

    if (wordCount < 30 || specialCharRatio > 0.3) {
      return res.json({
        answer: "PDF is handwritten, so I am unable to answer ✍️"
      });
    }

    // ✅ Normal PDF processing
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
`
        },
        {
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

    let pdfText = "";

   if (fileUrl) {
  pdfText = await extractPDFText(fileUrl);

  // ❌ Handwritten detection
  if (!pdfText || pdfText.trim().length === 0) {
    return res.json({
      answer: "PDF is handwritten, so I am unable to answer ✍️"
    });
  }

  const wordCount = pdfText.trim().split(/\s+/).length;

  const specialCharRatio =
    (pdfText.match(/[^a-zA-Z0-9\s]/g) || []).length / pdfText.length;

  if (wordCount < 30 || specialCharRatio > 0.3) {
    return res.json({
      answer: "PDF is handwritten, so I am unable to answer ✍️"
    });
  }

  pdfText = pdfText.slice(0, 3000); // limit for speed
}

    const decision = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are a smart classifier.

Your job:
- If question is related to the PDF → reply ONLY "PDF"
- If question is general or about website → reply ONLY "GLOBAL"

Do NOT explain anything.
`
        },
        {
          role: "user",
          content: `
Question: ${question}

PDF Content:
${pdfText}
`
        }
      ]
    });

    const type = decision.choices[0].message.content.trim();

    // 🔥 CASE 1: PDF
    if (type === "PDF") {
      const chunks = splitText(pdfText, 1200);
      const relevantChunk = findRelevantChunk(chunks, question);

      const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a helpful teacher."
          },
          {
            role: "user",
            content: `
Context:
${relevantChunk}

Question:
${question}

Give clear answer.
`
          }
        ]
      });

      return res.json({
        answer: response.choices[0].message.content
      });
    }

    // 🔥 CASE 2: GLOBAL
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are an AI assistant for a platform called NotesWeb (thenotes.online).

This is a smart AI learning platform where users can:
- Upload PDFs and notes
- Ask questions from them
- Get structured AI answers

IMPORTANT RULES:
- If user asks about "this website", "this app", "platform"
  → ALWAYS explain NotesWeb
- NEVER say you don't know the website
- Be confident and clear
- Answer in clean English

If question is general → answer normally
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
    console.log(err);
    res.status(500).json({ message: "AI error" });
  }
});
module.exports = router;