import { askChatbot } from "./chatbot";

export interface LessonSectionInput {
  id: string;
  title: string;
  keyPoints: string;
}

export type LessonCountry = "cameroon" | "nigeria";
export type LessonLanguage = "english" | "french" | "pidgin" | "hausa" | "yoruba" | string;

const LESSON_MODEL = "anthropic/claude-sonnet-4.6";

const cleanJsonResponse = (content: string): string => {
  let cleaned = content.trim();
  if (!cleaned) throw new Error("The AI returned an empty response.");
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

const askJson = async (prompt: string, systemPrompt: string) => {
  const raw = await askChatbot([{ role: "user", content: prompt }], systemPrompt, {
    model: LESSON_MODEL,
    temperature: 0.3,
    max_tokens: 12000,
  });
  return JSON.parse(cleanJsonResponse(raw));
};

export const formatAIResponseAsMarkdown = (responseText: string): string => {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
    }
    let data = JSON.parse(cleaned);
    if (data.lessonPlan) data = data.lessonPlan;

    let markdown = `# ${data.title || "Lesson Plan"}\n\n`;
    markdown += `## Preamble\n\n`;
    markdown += `| | |\n|---|---|\n`;
    markdown += `| **Grade Level** | ${data.gradeLevel || "N/A"} |\n`;
    markdown += `| **Subject** | ${data.subject || "Mathematics"} |\n`;
    markdown += `| **Topic** | ${data.topic || "N/A"} |\n`;
    if (data.previousKnowledge) {
      markdown += `| **Previous Knowledge** | ${data.previousKnowledge} |\n`;
    }
    markdown += `\n`;

    if (Array.isArray(data.lessonObjectives)) {
      markdown += `### Lesson Objectives\n`;
      markdown += `Learners will be able to:\n`;
      data.lessonObjectives.forEach((obj: string) => {
        markdown += `- ${obj}\n`;
      });
      markdown += "\n";
    }

    if (Array.isArray(data.materials)) {
      markdown += `### Materials\n`;
      data.materials.forEach((mat: string) => {
        markdown += `- ${mat}\n`;
      });
      markdown += "\n";
    }

    if (Array.isArray(data.sections)) {
      markdown += `## Lesson Body\n\n`;
      data.sections.forEach((sec: any) => {
        const duration = sec.duration ? ` (${sec.duration})` : "";
        markdown += `### ${sec.title || "Section"}${duration}\n\n`;
        if (sec.content) markdown += `**Content:**\n${sec.content}\n\n`;
        if (Array.isArray(sec.teacherActivities)) {
          markdown += `**Teacher's Activities:**\n`;
          sec.teacherActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += "\n";
        }
        if (Array.isArray(sec.learnerActivities)) {
          markdown += `**Pupil's Activities:**\n`;
          sec.learnerActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += "\n";
        }
      });
    }

    if (data.evaluation?.description) {
      markdown += `## Evaluation Summary\n${data.evaluation.description}\n\n`;
    }
    if (data.assignment?.description) {
      markdown += `## Assignment\n${data.assignment.description}\n\n`;
    }
    return markdown;
  } catch {
    return responseText;
  }
};

const languageInstructionFor = (language?: LessonLanguage) => {
  if (language === "french") {
    return "LANGUAGE REQUIREMENT: Generate the entire lesson plan in French. All content, activities, instructions, and objectives must be written in French.";
  }
  if (language === "pidgin") {
    return "LANGUAGE REQUIREMENT: Generate the entire lesson plan in English Pidgin (Cameroonian/Nigerian Pidgin English). Use common pidgin expressions and phrasing that teachers and students in Cameroon/Nigeria would naturally use and understand.";
  }
  if (language === "hausa") {
    return "LANGUAGE REQUIREMENT: Generate the entire lesson plan in Hausa. All content, activities, instructions, and objectives must be written in Hausa.";
  }
  if (language === "yoruba") {
    return "LANGUAGE REQUIREMENT: Generate the entire lesson plan in Yoruba. All content, activities, instructions, and objectives must be written in Yoruba.";
  }
  return "LANGUAGE REQUIREMENT: Generate the entire lesson plan in English.";
};

/** Phase 1→2: AI outline with 5–7 sections (same prompt family as web). */
export const generateLessonStructure = async (input: {
  topic: string;
  level: string;
  country: LessonCountry;
  language: LessonLanguage;
  topicCurriculumContext: string;
}) => {
  const countryName = input.country === "nigeria" ? "Nigeria" : "Cameroon";
  const shortLang =
    input.language === "french"
      ? "IMPORTANT: Generate all content in French."
      : input.language === "pidgin"
        ? "IMPORTANT: Generate all content in English Pidgin (Cameroonian/Nigerian Pidgin English)."
        : input.language === "hausa"
          ? "IMPORTANT: Generate all content in Hausa."
          : input.language === "yoruba"
            ? "IMPORTANT: Generate all content in Yoruba."
            : "IMPORTANT: Generate all content in English.";

  const prompt = `Based on the topic "${input.topic}" for ${input.level} students in ${countryName}, generate a structured lesson plan outline that strictly aligns with the official national curriculum standards.

${shortLang}

${input.topicCurriculumContext}

CRITICAL: Your lesson plan structure MUST:
1. Use the EXACT learning objectives from the curriculum alignment above
2. Incorporate the suggested teaching activities and methodology
3. Include the teaching aids/materials specified
4. Follow the assessment methods provided
5. Design homework based on the real-life applications listed

You must provide between 5 and 7 sections. Respond with ONLY a valid JSON object in the following format: { "sections": [{"title": "SECTION_TITLE", "keyPoints": "KEY_POINTS_HERE"}] }`;

  const response = await askJson(
    prompt,
    "You are an expert instructional designer. Return only valid JSON.",
  );

  if (!response?.sections || !Array.isArray(response.sections)) {
    throw new Error("The AI returned an unexpected data structure.");
  }

  return response.sections.map((s: any, index: number) => ({
    id: `section-${Date.now()}-${index}`,
    title: s.title || "Untitled Section",
    keyPoints: s.keyPoints || "",
    time: "",
    teacherActivities: "",
    learnerActivities: "",
  }));
};

/** Final detailed lesson plan — same contract as web `generateLessonPlan`. */
export const generateLessonPlan = async (
  topic: string,
  level: string,
  sections: LessonSectionInput[],
  curriculumContext?: string,
  country?: LessonCountry,
  language?: LessonLanguage,
) => {
  const sectionTitles = sections.map((s) => `"${s.title}"`).join(", ");
  const countryName = country === "nigeria" ? "Nigerian" : "Cameroonian";
  const educationalSystem =
    country === "nigeria" ? "Nigerian National Curriculum" : "Cameroon educational system";
  const languageInstruction = languageInstructionFor(language);

  const curriculumSection = curriculumContext
    ? `
IMPORTANT - CURRICULUM ALIGNMENT REQUIREMENTS:
The generated lesson plan MUST align pedagogically with the following curriculum content development plan. Ensure all activities, objectives, and content match the curriculum framework below:

${curriculumContext}

When generating the lesson plan, make sure to:
1. Use suggested activities from the curriculum where applicable
2. Align learning objectives with the curriculum objectives
3. Include age-appropriate content that matches the curriculum guidelines
4. Use local context and examples appropriate for ${countryName} students
5. Reference the key topics from the relevant curriculum unit
`
    : "";

  const prompt = `
You are an expert instructional designer specializing in clear, classroom-ready mathematics lesson plans following the ${educationalSystem} format. Generate a lesson plan for a "${level}" class on the topic: "${topic}".

${languageInstruction}
${curriculumSection}
The lesson plan follows the ${countryName} standardized format with a PREAMBLE and a BODY.

**PREAMBLE** includes: title, grade level, subject, topic, previous knowledge (what prior knowledge students need), lesson objectives, and materials.

**BODY** consists of exactly THREE phases:
1. **INTRODUCTION** (5 Minutes) — Link previous knowledge to new knowledge. Review what students already know and bridge it to today's topic.
2. **PRESENTATION** (15 Minutes) — The main lesson delivery. The CONTENT field must contain the actual subject matter: clear definitions, mathematical notation, visual descriptions (e.g., "Set A = {orange, apple, mango}"), detailed explanations, and multiple worked examples with step-by-step solutions. This is the CORE of the lesson.
3. **EVALUATION OR CONCLUSION** (10 Minutes) — Assess learners' understanding through exercises, word problems, and practice problems.

Each phase has FOUR components:
- **Stage/Duration**: The phase name and time allocation.
- **Content**: The actual subject matter — definitions, explanations, examples, exercises. Be specific, but concise enough to fit in one complete JSON response.
- **Teacher's Activities**: Specific teacher actions (questions asked, demonstrations, instructions).
- **Pupil's Activities**: Learner responses, actions, and expected behaviors.

IMPORTANT LENGTH RULES:
- Return valid JSON only. Do not use markdown fences.
- Keep each section's "content" between 600 and 1200 characters.
- Keep each of "teacherActivities" and "learnerActivities" to 4-6 items per section.
- Do not use emojis.
- Prefer short paragraphs and compact arrays so the full JSON is not cut off.

Your response MUST be a single JSON object with a root key "lessonPlan".

The "lessonPlan" object must contain:
1. "title": A concise and descriptive title for the lesson.
2. "gradeLevel": "${level}".
3. "subject": "Mathematics".
4. "topic": "${topic}".
5. "previousKnowledge": A clear statement describing what prior knowledge students already have that connects to this new topic.
6. "lessonObjectives": An array of at least 3 clear, measurable learning objectives. Do NOT prefix with 'Students will be able to...'.
7. "materials": A comprehensive array of all materials.
8. "sections": An array of EXACTLY 3 section objects. Each MUST have:
    - "title": "INTRODUCTION", "PRESENTATION", or "EVALUATION OR CONCLUSION".
    - "duration": "5 Minutes", "15 Minutes", or "10 Minutes" respectively.
    - "content": A detailed but compact string with the ACTUAL SUBJECT MATTER for this phase.
    - "teacherActivities": An array of strings describing specific teacher actions.
    - "learnerActivities": An array of strings describing specific pupil actions and expected responses.
9. "evaluation": An object with a "description" key summarizing the assessment approach.
10. "assignment": An object with a "description" key with PRACTICAL, HANDS-ON HOMEWORK with SPECIFIC EXERCISES (3–5 numbered problems). NEVER use phrases like "Students will..." — only the actual problems/tasks.

${sectionTitles ? `The user has organized their lesson with these sections: ${sectionTitles}. Incorporate their intent into the three required phases (INTRODUCTION, PRESENTATION, EVALUATION OR CONCLUSION), merging overlapping sections where needed.` : ""}

Ensure the entire output is a single, valid JSON object. Do not include any explanatory text outside the JSON structure.
`;

  const response = await askJson(
    prompt,
    "You are an expert instructional designer. Return only valid JSON with a root key lessonPlan.",
  );

  return {
    rawObject: response,
    jsonString: JSON.stringify(response),
  };
};

/** Build a print-ready HTML document for expo-print PDF export. */
export const buildLessonPlanHtml = (markdown: string, topic: string, level: string) => {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1f2937; padding: 24px; line-height: 1.45; }
    .header { background: #009e60; color: #fff; padding: 16px 18px; border-radius: 10px; margin-bottom: 18px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 6px 0 0; opacity: 0.9; font-size: 13px; }
    .gold { height: 3px; background: #F4B400; margin: -4px 0 18px; border-radius: 2px; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Mother of Math | Lesson Plan</h1>
    <p>${topic} · ${level}</p>
  </div>
  <div class="gold"></div>
  <pre>${escaped}</pre>
</body>
</html>`;
};
