const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
const path = require("path");

// Load environment variables from the .env file in the project root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize OpenAI client with the API key from process.env
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

app.post("/analyze", async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
    return res.status(400).send({ error: "A valid transcript is required." });
  }

  // Check if the API key is loaded. If not, it's a server configuration issue.
  if (!openrouter.apiKey) {
    console.error("OpenRouter API key is not configured.");
    return res.status(500).send({ error: "Server configuration error: Missing API key." });
  }

  try {
    const analysisPrompt = `
      You are an expert teacher trainer and instructional coach.
      A user has just completed a mock interview to practice their teaching skills.
      Your task is to analyze the following interview transcript and provide constructive, specific, and encouraging feedback.

      The transcript is provided as a JSON array of objects, where 'role' is either 'assistant' (the interviewer) or 'user' (the teacher).

      Transcript:
      ${JSON.stringify(transcript, null, 2)}

      Please structure your feedback into the following sections:
      1.  **Overall Summary:** A brief overview of the user's performance.
      2.  **Strengths:** Identify 2-3 specific things the user did well. Quote parts of their answers to support your points.
      3.  **Areas for Improvement:** Identify 2-3 areas where the user could improve. Provide actionable suggestions and re-frame their responses where appropriate.
      4.  **Concluding Remarks:** End with an encouraging and motivational statement.

      Your feedback should be formatted in clear Markdown.
    `;

    const response = await openrouter.chat.completions.create({
      model: "openai/gpt-4o",
      messages: [
        {
          role: "system",
          content: analysisPrompt,
        },
      ],
    });

    const feedback = response.choices[0].message.content;
    res.status(200).send({ feedback });

  } catch (error) {
    console.error("Error calling OpenRouter API:", error);
    res.status(500).send({ error: "Failed to get analysis from AI." });
  }
});

// Expose the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
