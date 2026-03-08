import { sendMessage } from "./api";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import PptxGenJS from "pptxgenjs";
import { generateLessonPlanImages, generateSlideImage } from "./imageGeneration";

interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
}

export const formatAIResponseAsMarkdown = (responseText: string): string => {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
    }

    let data = JSON.parse(cleaned);
    if (data.lessonPlan) {
      data = data.lessonPlan;
    }

    let markdown = `# ${data.title || 'Lesson Plan'}\n\n`;

    // ── Preamble ──
    markdown += `## Preamble\n\n`;
    markdown += `| | |\n|---|---|\n`;
    markdown += `| **Grade Level** | ${data.gradeLevel || 'N/A'} |\n`;
    markdown += `| **Subject** | ${data.subject || 'Mathematics'} |\n`;
    markdown += `| **Topic** | ${data.topic || 'N/A'} |\n`;
    if (data.previousKnowledge) {
      markdown += `| **Previous Knowledge** | ${data.previousKnowledge} |\n`;
    }
    markdown += `\n`;

    if (data.lessonObjectives && Array.isArray(data.lessonObjectives)) {
      markdown += `### Lesson Objectives\n`;
      markdown += `Learners will be able to:\n`;
      data.lessonObjectives.forEach((obj: string) => markdown += `- ${obj}\n`);
      markdown += '\n';
    }

    if (data.materials && Array.isArray(data.materials)) {
      markdown += `### Materials\n`;
      data.materials.forEach((mat: string) => markdown += `- ${mat}\n`);
      markdown += '\n';
    }

    // ── Body — Lesson Phases ──
    if (data.sections && Array.isArray(data.sections)) {
      markdown += `## Lesson Body\n\n`;

      data.sections.forEach((sec: any) => {
        const duration = sec.duration ? ` (${sec.duration})` : '';
        markdown += `### ${sec.title || 'Section'}${duration}\n\n`;

        if (sec.content) {
          markdown += `**Content:**\n${sec.content}\n\n`;
        }

        if (sec.teacherActivities && Array.isArray(sec.teacherActivities)) {
          markdown += `**Teacher's Activities:**\n`;
          sec.teacherActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += '\n';
        }

        if (sec.learnerActivities && Array.isArray(sec.learnerActivities)) {
          markdown += `**Pupil's Activities:**\n`;
          sec.learnerActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += '\n';
        }
      });
    }

    if (data.evaluation && data.evaluation.description) {
      markdown += `## Evaluation Summary\n`;
      markdown += `${data.evaluation.description}\n\n`;
    }

    if (data.assignment && data.assignment.description) {
      markdown += `## Assignment\n`;
      markdown += `${data.assignment.description}\n\n`;
    }

    return markdown;

  } catch (error) {
    console.error("Failed to parse or format AI response. Returning raw text.", error);
    return responseText;
  }
};

export const generateLessonPlan = async (
  topic: string, 
  level: string, 
  sections: LessonSection[],
  curriculumContext?: string,
  country?: 'cameroon' | 'nigeria',
  language?: 'english' | 'french' | 'pidgin'
) => {
  const sectionTitles = sections.map(s => `"${s.title}"`).join(', ');
  const countryName = country === 'nigeria' ? 'Nigerian' : 'Cameroonian';
  const educationalSystem = country === 'nigeria' ? 'Nigerian National Curriculum' : 'Cameroon educational system';

  // Language instruction
  const languageInstruction = language === 'french' 
    ? 'LANGUAGE REQUIREMENT: Generate the entire lesson plan in French. All content, activities, instructions, and objectives must be written in French.'
    : language === 'pidgin'
    ? 'LANGUAGE REQUIREMENT: Generate the entire lesson plan in English Pidgin (Cameroonian/Nigerian Pidgin English). Use common pidgin expressions and phrasing that teachers and students in Cameroon/Nigeria would naturally use and understand.'
    : 'LANGUAGE REQUIREMENT: Generate the entire lesson plan in English.';

  // Include curriculum context if provided
  const curriculumSection = curriculumContext ? `
IMPORTANT - CURRICULUM ALIGNMENT REQUIREMENTS:
The generated lesson plan MUST align pedagogically with the following curriculum content development plan. Ensure all activities, objectives, and content match the curriculum framework below:

${curriculumContext}

When generating the lesson plan, make sure to:
1. Use suggested activities from the curriculum where applicable
2. Align learning objectives with the curriculum objectives
3. Include age-appropriate content that matches the curriculum guidelines
4. Use local context and examples appropriate for ${countryName} students
5. Reference the key topics from the relevant curriculum unit
` : '';

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
5. "previousKnowledge": A clear statement describing what prior knowledge students already have that connects to this new topic (e.g., "Students have learned about sets and can identify members of a set.").
6. "lessonObjectives": An array of at least 3 clear, measurable learning objectives. Do NOT prefix with 'Students will be able to...'. Just list the objective directly (e.g., "Define the concept of intersection of sets").
7. "materials": A comprehensive array of all materials (e.g., "Chalk", "Chalkboard", "Counters", "Textbooks", "Exercise books", "Didactic materials").
8. "sections": An array of EXACTLY 3 section objects. Each MUST have:
    - "title": "INTRODUCTION", "PRESENTATION", or "EVALUATION OR CONCLUSION".
    - "duration": "5 Minutes", "15 Minutes", or "10 Minutes" respectively.
  - "content": A detailed but compact string with the ACTUAL SUBJECT MATTER for this phase. For INTRODUCTION: review of prior concepts and bridge to new topic with definitions and simple examples. For PRESENTATION: core definitions, mathematical notation, visual descriptions, explanations, and at least two worked examples. For EVALUATION: exercise instructions, word problems, and specific practice problems with mathematical notation. Use newlines (\n) to separate ideas. Include notation like A={1,2,3} where appropriate.
    - "teacherActivities": An array of strings describing specific teacher actions. Be concrete: include exact questions to ask, exact content to write on the board, and specific instructions.
    - "learnerActivities": An array of strings describing specific pupil actions and expected responses.
9. "evaluation": An object with a "description" key summarizing the assessment approach.
10. "assignment": An object with a "description" key for homework, with clear instructions and examples.

**Crucial Formatting Example:**
{
  "title": "INTRODUCTION",
  "duration": "5 Minutes",
  "content": "A set is a collection of well-defined objects, numbers or ideas.\nThe different objects which form a set are called members or elements of a set.\nE.g. A={1,2,6,7}, the elements of A are 1, 2, 6, 7.",
  "teacherActivities": [
    "Teacher asks oral questions to review prior knowledge.",
    "What is a set?",
    "The different objects which form a set are called?",
    "Appoint learners to answer questions.",
    "Appreciate learners for their responses."
  ],
  "learnerActivities": [
    "Appointed learners answer questions.",
    "A set is a collection of well-defined objects, numbers or ideas.",
    "Learners listen and take to corrections."
  ]
}

${sectionTitles ? `The user has organized their lesson with these sections: ${sectionTitles}. Incorporate their intent into the three required phases (INTRODUCTION, PRESENTATION, EVALUATION OR CONCLUSION), merging overlapping sections where needed.` : ''}

Ensure the entire output is a single, valid JSON object. Do not include any explanatory text outside the JSON structure.
  `;

  try {
    const response = await sendMessage(prompt, undefined, 'json');
    console.log('Raw response from sendMessage:', response);
    return {
      rawObject: response,
      jsonString: JSON.stringify(response)
    };
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw new Error("Failed to generate lesson plan");
  }
};

export const exportToPDF = async (
  jsonContent: string,
  topic: string,
  level: string,
  onProgress?: (message: string) => void
) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const primaryColor = '#009e60';
    const secondaryColor = '#4b371c';

    // --- PARSE JSON FIRST (needed for image generation) ---
    let lessonPlan: any;
    try {
      let cleaned = jsonContent.trim().replace(/^```[a-zA-Z]*\s*|```\s*$/gm, '');
      const parsedJson = JSON.parse(cleaned);
      lessonPlan = parsedJson.lessonPlan || parsedJson;
      if (!lessonPlan || typeof lessonPlan !== 'object') {
        throw new Error('Invalid data format.');
      }
    } catch (e) {
      console.error("Failed to parse lesson plan JSON:", e);
      throw new Error("Invalid lesson plan data provided.");
    }

    // --- GENERATE AI IMAGES ---
    onProgress?.('Generating AI images for your PDF...');
    let pdfImages: Record<string, string | null> = {};
    try {
      const baseImagePrompt = `Professional, vibrant educational illustration. Modern flat vector design with soft gradients. Primary colors: rich green (#009e60), warm brown (#4b371c), gold (#F4B400), white. Setting: African/Cameroonian elementary school with diverse young Black children. NO text, NO words, NO letters, NO numbers overlaid on the image. Pure illustration ONLY. High quality, crisp.`;

      const imagePrompts = [
        {
          key: 'hero',
          prompt: `Create a wide, stunning hero illustration for a mathematics lesson about "${topic}" for ${level} students in Cameroon. Show young African children excitedly learning math in a bright, colorful classroom. Include a teacher at a green chalkboard. ${baseImagePrompt} Wide panoramic composition (16:9). Premium educational poster quality.`,
          ratio: '16:9',
        },
        {
          key: 'presentation',
          prompt: `Create an illustration showing a caring African teacher demonstrating math concepts about "${topic}" on a green chalkboard to eager ${level} students. Children raising hands, classroom has math posters on walls. ${baseImagePrompt} Medium shot showing teacher-student interaction.`,
          ratio: '4:3',
        },
        {
          key: 'evaluation',
          prompt: `Create an encouraging illustration of African children writing exercises in their notebooks during a math class about "${topic}". A teacher walks between desks checking work with a warm smile. ${baseImagePrompt} Warm assessment scene.`,
          ratio: '4:3',
        },
      ];

      onProgress?.('Generating 3 AI illustrations — this may take a moment...');

      const results = await Promise.allSettled(
        imagePrompts.map(({ key, prompt, ratio }) =>
          generateSlideImage(prompt, ratio).then(img => ({ key, img }))
        )
      );

      let successCount = 0;
      for (const result of results) {
        if (result.status === 'fulfilled') {
          pdfImages[result.value.key] = result.value.img;
          if (result.value.img) successCount++;
        }
      }

      if (successCount > 0) {
        onProgress?.(`Generated ${successCount}/3 images successfully!`);
      } else {
        onProgress?.('Images could not be generated — proceeding with branded PDF.');
      }
    } catch (error) {
      console.warn('PDF image generation failed:', error);
      onProgress?.('Image generation unavailable — building PDF...');
    }

    onProgress?.('Building your PDF document...');

    // --- LOAD LOGOS ---
    const logoUrls = [
      '/logos/ebase_africa.svg',
      '/logos/eef.svg',
      '/logos/better_purpose.avif',
      '/logos/gates_foundation.svg'
    ];
    const logoHeight = 8;
    const logoPadding = 4;

    const logoPromises = logoUrls.map(url =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const width = logoHeight * aspectRatio;
          resolve({ img, width, height: logoHeight });
          if (url.endsWith('.svg')) URL.revokeObjectURL(img.src);
        };
        img.onerror = reject;
        if (url.endsWith('.svg')) {
          fetch(url).then(r => r.text()).then(svgText => {
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            img.src = URL.createObjectURL(blob);
          }).catch(reject);
        } else {
          img.src = url;
        }
      })
    );
    const successfulLogos = (await Promise.allSettled(logoPromises))
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);

    // --- HELPER: Add page header/footer (repeating) ---
    const addHeaderAndFooter = (data: any) => {
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 22, 'F');
      // Gold accent line
      doc.setFillColor('#F4B400');
      doc.rect(0, 22, pageWidth, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor('#FFFFFF');
      doc.text('Mother of Math | Lesson Plan', pageWidth / 2, 14, { align: 'center' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor('#999999');
      doc.text('Mothers for Mathematics \u00b7 Cameroon', margin, pageHeight - 8);
      const pageCount = doc.internal.pages.length;
      if (pageCount > 1) {
        doc.text(`Page ${data.pageNumber}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }
    };

    // ===================================================================
    // PAGE 1 — TITLE & PREAMBLE
    // ===================================================================
    // Header bar
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setFillColor('#F4B400');
    doc.rect(0, 22, pageWidth, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor('#FFFFFF');
    doc.text('Mother of Math | Lesson Plan', pageWidth / 2, 14, { align: 'center' });

    let yPos = 30;

    // Logos
    if (successfulLogos.length > 0) {
      const totalLogoWidth = successfulLogos.reduce((sum: number, logo: any) => sum + logo.width, 0) + (successfulLogos.length - 1) * logoPadding;
      let currentX = (pageWidth - totalLogoWidth) / 2;
      for (const logo of successfulLogos) {
        const canvas = document.createElement('canvas');
        const scaleFactor = 5;
        canvas.width = logo.width * scaleFactor;
        canvas.height = logo.height * scaleFactor;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(logo.img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          doc.addImage(dataUrl, 'PNG', currentX, yPos, logo.width, logo.height, undefined, 'NONE');
          currentX += logo.width + logoPadding;
        }
      }
      yPos += logoHeight + 6;
    } else {
      yPos = 32;
    }

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(secondaryColor);
    const titleLines = doc.splitTextToSize(lessonPlan.title || topic, pageWidth - margin * 2);
    doc.text(titleLines, pageWidth / 2, yPos, { align: 'center' });
    yPos += titleLines.length * 9;

    // --- Hero AI Image ---
    if (pdfImages.hero) {
      try {
        const imgW = pageWidth - margin * 2;
        const imgH = imgW * (9 / 16); // 16:9 aspect ratio
        const maxImgH = 55; // Max height to avoid pushing content too far
        const finalH = Math.min(imgH, maxImgH);

        // Green border frame
        doc.setFillColor(primaryColor);
        doc.roundedRect(margin - 1, yPos - 1, imgW + 2, finalH + 2, 2, 2, 'F');
        doc.addImage(pdfImages.hero, 'PNG', margin, yPos, imgW, finalH);
        yPos += finalH + 6;
      } catch {
        // Skip image on error
      }
    }

    // --- PREAMBLE TABLE ---
    const preambleRows: any[][] = [
      ['Grade Level', lessonPlan.gradeLevel || level],
      ['Subject', lessonPlan.subject || 'Mathematics'],
      ['Topic', lessonPlan.topic || topic],
    ];
    if (lessonPlan.previousKnowledge) {
      preambleRows.push(['Previous Knowledge', lessonPlan.previousKnowledge]);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['PREAMBLE', '']],
      body: preambleRows,
      theme: 'grid' as const,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: primaryColor, textColor: '#FFFFFF', fontSize: 11,
        fontStyle: 'bold', halign: 'center',
      },
      styles: { cellPadding: 4, fontSize: 10, lineWidth: 0.2, lineColor: '#C8C8C8' },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold', fillColor: '#E6F7EE', textColor: secondaryColor },
        1: { cellWidth: 'auto' },
      },
      didDrawPage: addHeaderAndFooter,
    });
    yPos = (doc as any).lastAutoTable.finalY + 5;

    // Objectives table
    if (lessonPlan.lessonObjectives && Array.isArray(lessonPlan.lessonObjectives)) {
      const objText = 'Learners will be able to:\n' + lessonPlan.lessonObjectives.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n');
      autoTable(doc, {
        startY: yPos,
        head: [['LESSON OBJECTIVES']],
        body: [[objText]],
        theme: 'grid' as const,
        margin: { left: margin, right: margin, top: 28 },
        headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold' },
        styles: { cellPadding: 4, fontSize: 10, lineWidth: 0.2, lineColor: '#C8C8C8' },
        didDrawPage: addHeaderAndFooter,
      });
      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    // Materials table
    if (lessonPlan.materials && Array.isArray(lessonPlan.materials)) {
      autoTable(doc, {
        startY: yPos,
        head: [['MATERIALS']],
        body: [[lessonPlan.materials.join(', ')]],
        theme: 'grid' as const,
        margin: { left: margin, right: margin, top: 28 },
        headStyles: { fillColor: secondaryColor, textColor: '#FFFFFF', fontSize: 11, fontStyle: 'bold' },
        styles: { cellPadding: 4, fontSize: 10, lineWidth: 0.2, lineColor: '#C8C8C8' },
        didDrawPage: addHeaderAndFooter,
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // ===================================================================
    // LESSON BODY — 4-COLUMN TABLE (matching Cameroon format)
    // Columns: STAGES/DURATION | CONTENT | TEACHER'S ACTIVITIES | PUPIL'S ACTIVITIES
    // ===================================================================
    if (lessonPlan.sections && Array.isArray(lessonPlan.sections) && lessonPlan.sections.length > 0) {

      // Build table rows — one row per section/phase
      const bodyRows = lessonPlan.sections.map((section: any) => {
        const stage = `${section.title || 'SECTION'}\n${section.duration || ''}`.trim();
        const content = section.content || '';
        const teacherActs = Array.isArray(section.teacherActivities)
          ? section.teacherActivities.map((a: string) => `- ${a}`).join('\n')
          : '';
        const learnerActs = Array.isArray(section.learnerActivities)
          ? section.learnerActivities.map((a: string) => `- ${a}`).join('\n')
          : '';
        return [stage, content, teacherActs, learnerActs];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['STAGES/\nDURATION', 'CONTENT', "TEACHER'S\nACTIVITIES", "PUPIL'S\nACTIVITIES"]],
        body: bodyRows,
        theme: 'grid' as const,
        margin: { left: margin, right: margin, top: 28 },
        headStyles: {
          fillColor: primaryColor, textColor: '#FFFFFF', fontSize: 9,
          fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 3,
        },
        styles: {
          cellPadding: 3, fontSize: 8.5, lineWidth: 0.3, lineColor: '#AAAAAA',
          valign: 'top', overflow: 'linebreak',
        },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: 'bold', halign: 'center', fillColor: '#E6F7EE', textColor: secondaryColor, fontSize: 8 },
          1: { cellWidth: 62 },
          2: { cellWidth: 46 },
          3: { cellWidth: 46 },
        },
        didDrawPage: addHeaderAndFooter,
        // Style section header cells differently
        didParseCell: (data) => {
          // Alternate row background for readability
          if (data.section === 'body' && data.row.index % 2 === 1) {
            if (data.column.index !== 0) {
              data.cell.styles.fillColor = '#FAFAFA';
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 6;
    }

    // --- AI Presentation Image (between body and evaluation summary) ---
    if (pdfImages.presentation) {
      try {
        // Check if we need a new page
        if (yPos > pageHeight - 70) {
          doc.addPage();
          yPos = 30;
        }
        const imgW = (pageWidth - margin * 2) * 0.65;
        const imgH = imgW * (3 / 4);
        const maxH = 50;
        const finalH = Math.min(imgH, maxH);
        const xCenter = (pageWidth - imgW) / 2;

        doc.setFillColor(primaryColor);
        doc.roundedRect(xCenter - 1, yPos - 1, imgW + 2, finalH + 2, 2, 2, 'F');
        doc.addImage(pdfImages.presentation, 'PNG', xCenter, yPos, imgW, finalH);
        yPos += finalH + 8;
      } catch {
        // Skip on error
      }
    }

    // --- Evaluation Summary & Assignment ---
    const finalSections: any[][] = [];
    if (lessonPlan.evaluation?.description) {
      finalSections.push(['Evaluation Summary', lessonPlan.evaluation.description]);
    }
    if (lessonPlan.assignment?.description) {
      finalSections.push(['Assignment', lessonPlan.assignment.description]);
    }
    if (finalSections.length > 0) {
      autoTable(doc, {
        startY: yPos,
        body: finalSections,
        theme: 'grid' as const,
        margin: { left: margin, right: margin, top: 28 },
        styles: { cellPadding: 4, fontSize: 10, lineWidth: 0.2, lineColor: '#C8C8C8' },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' },
          1: { cellWidth: 'auto' },
        },
        didDrawPage: addHeaderAndFooter,
      });
      yPos = (doc as any).lastAutoTable.finalY + 6;
    }

    // --- AI Evaluation Image (at end if space) ---
    if (pdfImages.evaluation) {
      try {
        if (yPos > pageHeight - 65) {
          doc.addPage();
          yPos = 30;
        }
        const imgW = (pageWidth - margin * 2) * 0.55;
        const imgH = imgW * (3 / 4);
        const maxH = 45;
        const finalH = Math.min(imgH, maxH);
        const xCenter = (pageWidth - imgW) / 2;

        doc.setFillColor(secondaryColor);
        doc.roundedRect(xCenter - 1, yPos - 1, imgW + 2, finalH + 2, 2, 2, 'F');
        doc.addImage(pdfImages.evaluation, 'PNG', xCenter, yPos, imgW, finalH);
        yPos += finalH + 6;
      } catch {
        // Skip on error
      }
    }

    // --- Final footer pass ---
    const pageCount = doc.internal.pages.length;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addHeaderAndFooter({ pageNumber: i });
    }

    onProgress?.('Saving your PDF...');
    doc.save(`${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lesson_plan.pdf`);

  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw new Error("Failed to export to PDF");
  }
};

export const exportToPowerPoint = async (
  content: string,
  topic: string,
  level?: string,
  onProgress?: (message: string) => void
) => {
  const pptx = new PptxGenJS();

  // ── Mother of Math Branding — matches app CSS --primary hsl(144,100%,31%) ──
  const PRIMARY     = '009e60';   // App primary green
  const PRIMARY_DK  = '007a4a';   // Darker green
  const PRIMARY_LT  = '00c978';   // Lighter green
  const BROWN       = '4b371c';   // App secondary (warm brown)
  const BROWN_LT    = '6b5030';   // Lighter brown
  const DARK        = '1a1a2e';   // Near-black
  const MID         = '333333';   // Dark gray
  const LIGHT       = 'ffffff';   // White
  const BG          = 'F0FFF4';   // Very light green bg
  const BG_WARM     = 'FFF8F0';   // Warm white bg for learner slides
  const BG_CARD     = 'E6F7EE';   // Light green card bg
  const GOLD        = 'F4B400';   // Accent gold

  pptx.defineLayout({ name: 'MAMA_MATH', width: 10, height: 5.625 });
  pptx.layout = 'MAMA_MATH';
  pptx.author = 'Mother of Math';
  pptx.company = 'Mothers for Mathematics';
  pptx.subject = topic;
  pptx.title = `Lesson Plan: ${topic}`;

  // ── Parse JSON ──
  let lessonPlan: any = null;
  try {
    const cleaned = content.trim().replace(/^```[a-zA-Z]*\s*|```\s*$/gm, '');
    const parsed = JSON.parse(cleaned);
    lessonPlan = parsed.lessonPlan || parsed;
  } catch {
    // Will use text-based fallback
  }

  // ── Generate AI images ──
  let images: Record<string, string | null> = {};
  if (lessonPlan && typeof lessonPlan === 'object') {
    try {
      images = await generateLessonPlanImages(
        topic,
        level || lessonPlan.gradeLevel || '',
        lessonPlan.sections || [],
        onProgress
      );
    } catch (error) {
      console.warn('Image generation failed, proceeding without images:', error);
      onProgress?.('Image generation unavailable — creating branded slides...');
    }
  }

  onProgress?.('Building your PowerPoint presentation...');

  // ── HELPER: add branded header bar ──
  const addHeader = (slide: any, title: string, color: string = PRIMARY) => {
    // Green gradient header
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.65, fill: { color } });
    // Subtle accent line under header
    slide.addShape('rect', { x: 0, y: 0.65, w: 10, h: 0.04, fill: { color: GOLD } });
    slide.addText(title, {
      x: 0.4, y: 0.05, w: 9.2, h: 0.55,
      fontSize: 18, color: LIGHT, bold: true, fontFace: 'Arial', valign: 'middle',
    });
  };

  // ── HELPER: add branded footer ──
  const addFooter = (slide: any) => {
    // Green footer line
    slide.addShape('rect', { x: 0, y: 5.15, w: 10, h: 0.03, fill: { color: PRIMARY } });
    slide.addText('MOTHER OF MATH', {
      x: 0.4, y: 5.22, w: 3.5, h: 0.3,
      fontSize: 9, color: PRIMARY, bold: true, fontFace: 'Arial',
    });
    slide.addText('Mothers for Mathematics · Cameroon', {
      x: 5.5, y: 5.22, w: 4, h: 0.3,
      fontSize: 8, color: '999999', fontFace: 'Arial', align: 'right',
    });
  };

  // ── HELPER: add image to slide (with branded placeholder fallback) ──
  const addSlideImage = (
    slide: any,
    imageData: string | null | undefined,
    x: number, y: number, w: number, h: number,
    placeholderEmoji = '📐'
  ) => {
    if (imageData) {
      // Green border frame
      slide.addShape('rect', {
        x: x - 0.05, y: y - 0.05, w: w + 0.1, h: h + 0.1,
        fill: { color: PRIMARY }, rectRadius: 0.08,
      });
      slide.addImage({
        data: imageData, x, y, w, h,
        rounding: true,
        sizing: { type: 'cover', w, h },
      });
    } else {
      // Green-tinted placeholder card
      slide.addShape('rect', {
        x, y, w, h,
        fill: { color: BG_CARD }, rectRadius: 0.12,
        line: { color: PRIMARY, width: 1.5, dashType: 'dash' },
      });
      slide.addText(placeholderEmoji, {
        x, y: y + h / 2 - 0.4, w, h: 0.8,
        fontSize: 36, align: 'center', valign: 'middle', color: PRIMARY,
      });
    }
  };

  // ===================================================================
  // STRUCTURED JSON SLIDES
  // ===================================================================
  if (lessonPlan && typeof lessonPlan === 'object') {

    // ═══ TITLE SLIDE ═══
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: DARK };

    // Left green panel
    titleSlide.addShape('rect', { x: 0, y: 0, w: 5.2, h: 5.625, fill: { color: PRIMARY } });

    // Decorative accent circles
    titleSlide.addShape('ellipse', {
      x: -0.5, y: 3.8, w: 2, h: 2,
      fill: { color: PRIMARY_DK, transparency: 50 },
    });
    titleSlide.addShape('ellipse', {
      x: 3.8, y: -0.5, w: 1.5, h: 1.5,
      fill: { color: PRIMARY_LT, transparency: 40 },
    });

    // Gold accent line
    titleSlide.addShape('line', {
      x: 0.5, y: 0.85, w: 2.2, h: 0,
      line: { color: GOLD, width: 3 },
    });

    // Branding
    titleSlide.addText('MOTHER OF MATH', {
      x: 0.5, y: 0.4, w: 4.2, h: 0.35,
      fontSize: 11, color: LIGHT, bold: true, fontFace: 'Arial', charSpacing: 3,
    });

    // Title text
    const titleText = lessonPlan?.title || topic;
    titleSlide.addText(titleText, {
      x: 0.5, y: 1.2, w: 4.2, h: 2,
      fontSize: 28, color: LIGHT, bold: true, fontFace: 'Arial', valign: 'top', wrap: true,
    });

    // Level badge
    const levelText = level || lessonPlan?.gradeLevel || '';
    if (levelText) {
      titleSlide.addShape('rect', {
        x: 0.5, y: 3.4, w: 3, h: 0.42,
        fill: { color: GOLD }, rectRadius: 0.06,
      });
      titleSlide.addText(levelText, {
        x: 0.5, y: 3.4, w: 3, h: 0.42,
        fontSize: 14, color: DARK, bold: true, fontFace: 'Arial', align: 'center',
      });
    }

    // Date
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    titleSlide.addText(today, {
      x: 0.5, y: 4.0, w: 4.2, h: 0.35,
      fontSize: 12, color: BG_WARM, italic: true, fontFace: 'Arial',
    });

    titleSlide.addText('Mathematics Lesson Plan', {
      x: 0.5, y: 4.8, w: 4.2, h: 0.35,
      fontSize: 10, color: BG_WARM, fontFace: 'Arial',
    });

    // Right: Hero image
    if (images.title) {
      titleSlide.addImage({
        data: images.title,
        x: 5.2, y: 0, w: 4.8, h: 5.625,
        sizing: { type: 'cover', w: 4.8, h: 5.625 },
      });
    } else {
      titleSlide.addShape('rect', { x: 5.2, y: 0, w: 4.8, h: 5.625, fill: { color: PRIMARY_DK } });
      titleSlide.addShape('ellipse', {
        x: 6.2, y: 1.5, w: 2.8, h: 2.8,
        fill: { color: PRIMARY, transparency: 40 },
      });
      titleSlide.addText('📚', {
        x: 5.2, y: 1.8, w: 4.8, h: 2,
        fontSize: 64, align: 'center', valign: 'middle',
      });
    }

    // ═══ OBJECTIVES SLIDE ═══
    if (lessonPlan.lessonObjectives && Array.isArray(lessonPlan.lessonObjectives)) {
      const objSlide = pptx.addSlide();
      objSlide.background = { color: BG };
      addHeader(objSlide, 'LESSON OBJECTIVES');

      // Image on the right
      addSlideImage(objSlide, images.objectives, 6.3, 0.9, 3.2, 3.9, '🎯');

      const textW = 5.5;

      // Green vertical accent bar
      objSlide.addShape('rect', { x: 0.35, y: 0.85, w: 0.06, h: 4.0, fill: { color: PRIMARY } });

      // Intro text
      objSlide.addText('Learners will be able to:', {
        x: 0.55, y: 0.85, w: textW, h: 0.35,
        fontSize: 12, color: PRIMARY_DK, italic: true, fontFace: 'Arial',
      });

      // Numbered objectives
      objSlide.addText(
        lessonPlan.lessonObjectives.map((obj: string, i: number) => ({
          text: `${i + 1}.  ${obj}`,
          options: { color: MID, paraSpaceBefore: 8, paraSpaceAfter: 4 },
        })),
        {
          x: 0.6, y: 1.3, w: textW - 0.2, h: 3.5,
          fontSize: 14, fontFace: 'Arial', wrap: true, valign: 'top',
          lineSpacingMultiple: 1.15,
        }
      );

      addFooter(objSlide);
    }

    // ═══ MATERIALS SLIDE ═══
    if (lessonPlan.materials && Array.isArray(lessonPlan.materials)) {
      const matSlide = pptx.addSlide();
      matSlide.background = { color: LIGHT };
      addHeader(matSlide, 'MATERIALS NEEDED', BROWN);

      // Image on the right
      addSlideImage(matSlide, images.materials, 6.3, 0.9, 3.2, 3.9, '🧮');

      // Brown vertical accent bar
      matSlide.addShape('rect', { x: 0.35, y: 0.85, w: 0.06, h: 4.0, fill: { color: BROWN } });

      matSlide.addText(
        lessonPlan.materials.map((mat: string) => ({
          text: `  ${mat}`,
          options: { bullet: true, color: MID, paraSpaceBefore: 6, paraSpaceAfter: 4 },
        })),
        {
          x: 0.6, y: 0.9, w: 5.4, h: 3.8,
          fontSize: 15, fontFace: 'Arial', wrap: true, valign: 'top',
          bullet: { type: 'bullet' },
        }
      );

      addFooter(matSlide);
    }

    // ═══ SECTION SLIDES ═══
    if (lessonPlan.sections && Array.isArray(lessonPlan.sections)) {
      lessonPlan.sections.forEach((section: any, idx: number) => {
        const teacherImg = images[`section_teacher_${idx}`];
        const learnerImg = images[`section_learner_${idx}`];

        // ── TEACHER ACTIVITIES slide ──
        const tSlide = pptx.addSlide();
        tSlide.background = { color: BG };
        addHeader(tSlide, section.title || 'SECTION');

        // Sub-label with green accent bar
        tSlide.addShape('rect', { x: 0.4, y: 0.85, w: 0.06, h: 0.35, fill: { color: PRIMARY } });
        tSlide.addText('TEACHER ACTIVITIES', {
          x: 0.6, y: 0.85, w: 5, h: 0.35,
          fontSize: 12, color: PRIMARY, bold: true, fontFace: 'Arial',
        });

        // Image on the right
        addSlideImage(tSlide, teacherImg, 6.3, 0.9, 3.2, 3.8, '👩‍🏫');

        if (section.teacherActivities && Array.isArray(section.teacherActivities)) {
          tSlide.addText(
            section.teacherActivities.map((a: string) => ({
              text: a,
              options: { bullet: true, color: MID, paraSpaceBefore: 5, paraSpaceAfter: 3 },
            })),
            {
              x: 0.6, y: 1.35, w: 5.4, h: 3.5,
              fontSize: 13, fontFace: 'Arial', wrap: true, valign: 'top',
              bullet: { type: 'bullet' },
            }
          );
        }

        addFooter(tSlide);

        // ── LEARNER ACTIVITIES slide ──
        const lSlide = pptx.addSlide();
        lSlide.background = { color: BG_WARM };
        addHeader(lSlide, section.title || 'SECTION', BROWN);

        lSlide.addShape('rect', { x: 0.4, y: 0.85, w: 0.06, h: 0.35, fill: { color: BROWN } });
        lSlide.addText('LEARNER ACTIVITIES', {
          x: 0.6, y: 0.85, w: 5, h: 0.35,
          fontSize: 12, color: BROWN, bold: true, fontFace: 'Arial',
        });

        // Image on the right
        addSlideImage(lSlide, learnerImg, 6.3, 0.9, 3.2, 3.8, '👧🏾');

        if (section.learnerActivities && Array.isArray(section.learnerActivities)) {
          lSlide.addText(
            section.learnerActivities.map((a: string) => ({
              text: a,
              options: { bullet: true, color: MID, paraSpaceBefore: 5, paraSpaceAfter: 3 },
            })),
            {
              x: 0.6, y: 1.35, w: 5.4, h: 3.5,
              fontSize: 13, fontFace: 'Arial', wrap: true, valign: 'top',
              bullet: { type: 'bullet' },
            }
          );
        }

        addFooter(lSlide);
      });
    }

    // ═══ EVALUATION SLIDE ═══
    if (lessonPlan.evaluation?.description) {
      const evalSlide = pptx.addSlide();
      evalSlide.background = { color: BG };
      addHeader(evalSlide, 'EVALUATION');

      // Image on the right
      addSlideImage(evalSlide, images.evaluation, 6.3, 0.9, 3.2, 3.9, '📋');

      evalSlide.addShape('rect', { x: 0.35, y: 0.85, w: 0.06, h: 4.0, fill: { color: PRIMARY } });
      evalSlide.addText(lessonPlan.evaluation.description, {
        x: 0.55, y: 0.9, w: 5.4, h: 3.8,
        fontSize: 14, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
        lineSpacingMultiple: 1.3,
      });

      addFooter(evalSlide);
    }

    // ═══ ASSIGNMENT SLIDE ═══
    if (lessonPlan.assignment?.description) {
      const assignSlide = pptx.addSlide();
      assignSlide.background = { color: LIGHT };
      addHeader(assignSlide, 'ASSIGNMENT', BROWN);

      // Image on the right
      addSlideImage(assignSlide, images.assignment, 6.3, 0.9, 3.2, 3.9, '📝');

      assignSlide.addShape('rect', { x: 0.35, y: 0.85, w: 0.06, h: 4.0, fill: { color: BROWN } });
      assignSlide.addText(lessonPlan.assignment.description, {
        x: 0.55, y: 0.9, w: 5.4, h: 3.8,
        fontSize: 14, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
        lineSpacingMultiple: 1.3,
      });

      addFooter(assignSlide);
    }

    // ═══ CLOSING SLIDE ═══
    const closingSlide = pptx.addSlide();
    closingSlide.background = { color: DARK };

    // Left green panel
    closingSlide.addShape('rect', { x: 0, y: 0, w: 5.2, h: 5.625, fill: { color: PRIMARY } });

    // Decorative circles
    closingSlide.addShape('ellipse', {
      x: 3.5, y: 3.5, w: 2.5, h: 2.5,
      fill: { color: PRIMARY_DK, transparency: 50 },
    });
    closingSlide.addShape('ellipse', {
      x: -0.3, y: -0.3, w: 1.8, h: 1.8,
      fill: { color: PRIMARY_LT, transparency: 40 },
    });

    closingSlide.addText('Thank You!', {
      x: 0.5, y: 1.2, w: 4.2, h: 0.8,
      fontSize: 34, color: LIGHT, bold: true, fontFace: 'Arial',
    });
    closingSlide.addText('Happy Teaching & Learning', {
      x: 0.5, y: 2.2, w: 4.2, h: 0.5,
      fontSize: 16, color: BG_WARM, fontFace: 'Arial',
    });

    closingSlide.addShape('line', {
      x: 0.5, y: 3.2, w: 2.2, h: 0,
      line: { color: GOLD, width: 3 },
    });

    closingSlide.addText('MOTHER OF MATH', {
      x: 0.5, y: 3.6, w: 4.2, h: 0.35,
      fontSize: 12, color: LIGHT, bold: true, fontFace: 'Arial', charSpacing: 3,
    });
    closingSlide.addText('Mothers for Mathematics · Cameroon', {
      x: 0.5, y: 4.1, w: 4.2, h: 0.3,
      fontSize: 10, color: BG_WARM, fontFace: 'Arial',
    });

    // Right: closing image
    if (images.closing) {
      closingSlide.addImage({
        data: images.closing,
        x: 5.2, y: 0, w: 4.8, h: 5.625,
        sizing: { type: 'cover', w: 4.8, h: 5.625 },
      });
    } else {
      closingSlide.addShape('rect', { x: 5.2, y: 0, w: 4.8, h: 5.625, fill: { color: PRIMARY_DK } });
      closingSlide.addShape('ellipse', {
        x: 6.4, y: 1.6, w: 2.4, h: 2.4,
        fill: { color: PRIMARY, transparency: 40 },
      });
      closingSlide.addText('🎓', {
        x: 5.2, y: 1.8, w: 4.8, h: 2,
        fontSize: 64, align: 'center', valign: 'middle',
      });
    }

  } else {
    // ===================================================================
    // FALLBACK: text/markdown slides (no JSON available)
    // ===================================================================
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    const sections: { title: string; content: string[] }[] = [];
    let currentSection: { title: string; content: string[] } | null = null;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;

      if (trimmed === trimmed.toUpperCase() || trimmed.startsWith('#')) {
        const heading = trimmed.startsWith('#') ? trimmed.replace(/^#+\s*/, '').trim() : trimmed;
        currentSection = { title: heading, content: [] };
        sections.push(currentSection);
      } else if (currentSection) {
        currentSection.content.push(trimmed);
      } else {
        currentSection = { title: 'Overview', content: [trimmed] };
        sections.push(currentSection);
      }
    }

    // Title slide (fallback)
    const fbTitle = pptx.addSlide();
    fbTitle.background = { color: PRIMARY };
    fbTitle.addText(topic, {
      x: 1, y: 1.5, w: 8, h: 1.5,
      fontSize: 32, color: LIGHT, bold: true, align: 'center', fontFace: 'Arial', wrap: true,
    });
    if (level) {
      fbTitle.addText(level, {
        x: 1, y: 3.2, w: 8, h: 0.5,
        fontSize: 18, color: BG_WARM, align: 'center', fontFace: 'Arial',
      });
    }
    fbTitle.addText('MOTHER OF MATH', {
      x: 1, y: 4.5, w: 8, h: 0.4,
      fontSize: 11, color: LIGHT, bold: true, align: 'center', fontFace: 'Arial', charSpacing: 3,
    });

    // Content slides (fallback)
    sections.forEach(section => {
      const slide = pptx.addSlide();
      slide.background = { color: BG };
      addHeader(slide, section.title);

      let yPos = 0.9;
      for (const item of section.content) {
        if (item.includes('\n') && (item.trim().startsWith('- ') || item.trim().startsWith('* '))) {
          const bullets = item.split('\n')
            .filter(l => l.trim().length > 0)
            .map(l => l.trim().replace(/^[-*]\s/, '').trim());

          slide.addText(
            bullets.map(text => ({ text, options: { bullet: true } })),
            {
              x: 0.6, y: yPos, w: 8.8, h: bullets.length * 0.3 + 0.2,
              fontSize: 14, color: MID, fontFace: 'Arial',
              bullet: { type: 'bullet' }, paraSpaceBefore: 4, paraSpaceAfter: 4, wrap: true,
            }
          );
          yPos += 0.2 + bullets.length * 0.25;
        } else {
          const lines = Math.ceil(item.length / 60);
          const h = Math.max(0.3, Math.min(3.0, lines * 0.16));
          slide.addText(item, {
            x: 0.5, y: yPos, w: 9, h,
            fontSize: 14, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
          });
          yPos += h + 0.1;
        }
        yPos += 0.1;
      }

      addFooter(slide);
    });
  }

  onProgress?.('Saving your presentation...');

  await pptx.writeFile({
    fileName: `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lesson_plan.pptx`,
  });
};