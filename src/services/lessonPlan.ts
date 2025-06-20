import { sendMessage } from "./api";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import PptxGenJS from "pptxgenjs";

interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
}

export const formatAIResponseAsMarkdown = (responseText: string): string => {
  try {
    // The AI sometimes wraps the JSON in markdown code fences like ```json ... ```
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
    }

    let data = JSON.parse(cleaned);

    // The AI often wraps the response in a "lessonPlan" object.
    if (data.lessonPlan) {
      data = data.lessonPlan;
    }

    let markdown = `# Lesson Plan: ${data.title || 'N/A'}\n\n`;
    markdown += `**Grade Level:** ${data.gradeLevel || 'N/A'}\n`;
    markdown += `**Subject:** ${data.subject || 'N/A'}\n`;
    markdown += `**Topic:** ${data.topic || 'N/A'}\n\n`;

    const formatTitle = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    // Handle specific sections first
    if (data.lessonObjectives && Array.isArray(data.lessonObjectives)) {
      markdown += `## Lesson Objectives\n`;
      data.lessonObjectives.forEach((obj: string) => markdown += `- ${obj}\n`);
      markdown += '\n';
    }

    if (data.materials && Array.isArray(data.materials)) {
      markdown += `## Materials\n`;
      data.materials.forEach((mat: string) => markdown += `- ${mat}\n`);
      markdown += '\n';
    }

    if (data.sections && Array.isArray(data.sections)) {
      markdown += `## Lesson Procedure\n`;
      data.sections.forEach((sec: any) => {
        markdown += `### ${sec.title || 'Section'}\n\n`;

        if (sec.teacherActivities && Array.isArray(sec.teacherActivities)) {
          markdown += `**Teacher Activities:**\n`;
          sec.teacherActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += '\n';
        }

        if (sec.learnerActivities && Array.isArray(sec.learnerActivities)) {
          markdown += `**Learner Activities:**\n`;
          sec.learnerActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += '\n';
        }
      });
    }

    if (data.evaluation && data.evaluation.description) {
      markdown += `## Evaluation\n`;
      markdown += `${data.evaluation.description}\n\n`;
    }

    if (data.assignment && data.assignment.description) {
      markdown += `## Assignment\n`;
      markdown += `${data.assignment.description}\n\n`;
    }

    return markdown;

  } catch (error) {
    console.error("Failed to parse or format AI response. Returning raw text.", error);
    return responseText; // Fallback to raw text if parsing fails
  }
};

export const generateLessonPlan = async (topic: string, level: string, sections: LessonSection[]) => {
  const sectionTitles = sections.map(s => `"${s.title}"`).join(', ');

  const prompt = `
You are an expert instructional designer specializing in creating exceptionally detailed, comprehensive, and explanatory mathematics lesson plans. Your task is to generate an exhaustive and deeply detailed lesson plan for a "${level}" class on the topic: "${topic}".

Your response MUST be a single JSON object with a root key "lessonPlan".

The "lessonPlan" object must contain:
1.  "title": A concise and descriptive title for the lesson.
2.  "gradeLevel": The target grade level ("${level}").
3.  "subject": "Mathematics".
4.  "topic": The specific topic ("${topic}").
5.  "lessonObjectives": An array of at least 3 clear, measurable, and detailed learning objectives.
6.  "materials": A comprehensive array of all necessary materials, including digital resources if applicable.
7.  "sections": An array of objects for the main lesson parts: ${sectionTitles}. Each section object MUST have the following keys:
    - "title": The section title (e.g., "INTRODUCTION").
    - "teacherActivities": An array of strings describing the teacher's actions. This must be extremely detailed, providing not just instructions but also the *actual content* the teacher should use. For example, instead of saying "Explain the concept of photosynthesis," it should say, "Explain that photosynthesis is the process plants use to turn sunlight into food, just like how we eat to get energy. Ask students: 'What do you think would happen to a plant if it didn't get any sunlight?'" Provide concrete examples, sample questions, and brief scripts within the 'teacherActivities' section.
    - "learnerActivities": An equally detailed list of the learners' corresponding actions, responses, and expected thought processes. Describe what the students are expected to do, say, and think at each step.
8.  "evaluation": An object with a "description" key containing a highly detailed and multi-faceted plan for assessing student understanding. Explain the specific formative (e.g., questioning, observation) and summative (e.g., exit ticket, quiz) assessment strategies.
9.  "assignment": An object with a "description" key for the homework task. The description must be comprehensive, providing clear instructions and including an example if the task is complex.

**Crucial Formatting Example:**
For a section, the structure MUST be:
{
  "title": "INTRODUCTION",
  "teacherActivities": [
    "Teacher will start by asking probing questions to activate prior knowledge, such as 'What do we mean by a collection of items? Can you give me an example?'. The goal is to get students thinking about grouping.",
    "Display a virtual basket of fruits on the smartboard and ask students to name the fruits they see. This serves as a visual and engaging entry point.",
    "Explain the mathematical term 'set' as a 'well-defined collection of distinct objects'. Emphasize 'well-defined' by providing examples and non-examples (e.g., 'the set of tall students in this class' is not well-defined)."
  ],
  "learnerActivities": [
    "Students will brainstorm and share examples of collections from their daily lives.",
    "Students will actively participate by identifying the fruits and discussing their properties.",
    "Learners will copy the formal definition of a set into their notebooks and ask clarifying questions."
  ]
}

Ensure the entire output is a single, valid JSON object. Do not include any explanatory text outside of the JSON structure itself.
  `;

  try {
    const response = await sendMessage(prompt);
    // Format the response to ensure it's clean markdown
    return response.text;
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    throw new Error("Failed to generate lesson plan");
  }
};

export const exportToPDF = async (jsonContent: string, topic: string, level: string) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const primaryColor = '#009e60';
    const secondaryColor = '#4b371c';

    // --- LOAD LOGOS ---
    const logoUrls = [
      '/logos/ebase_africa.svg',
      '/logos/eef.svg',
      '/logos/better_purpose.avif',
      '/logos/gates_foundation.svg'
    ];
    const logoHeight = 8; // Final adjusted logo height
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

    // --- DEFINE REPEATING HEADER/FOOTER ---
    const addHeaderAndFooter = (data: any) => {
      // Header Bar
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor('#FFFFFF');
      doc.text('Mother of Math | Lesson Plan', pageWidth / 2, 16, { align: 'center' });

      // Footer
      doc.setFont('helvetica', 'normal'); // Reset font style for footer
      doc.setFontSize(9); // Use a slightly smaller, crisper font size
      doc.setTextColor('#666666'); // Use a neutral dark gray for better readability
      const pageCount = doc.internal.pages.length;
      if (pageCount > 1) {
        doc.text(`Page ${data.pageNumber} / ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }
    };

    // --- PARSE JSON ---
    let lessonPlan;
    try {
      let cleaned = jsonContent.trim().replace(/^```[a-zA-Z]*\s*|```\s*$/gm, '');
      const parsedJson = JSON.parse(cleaned);
      lessonPlan = parsedJson.lessonPlan || parsedJson;
      if (!lessonPlan || typeof lessonPlan !== 'object') throw new Error('Invalid data format.');
    } catch (e) {
      console.error("Failed to parse lesson plan JSON:", e);
      throw new Error("Invalid lesson plan data provided.");
    }

    // --- DRAW PAGE 1 CONTENT ---
    let yPos = 35; // Initial Y position for logos

    // Logos (centered, only on page 1)
    if (successfulLogos.length > 0) {
      const totalLogoWidth = successfulLogos.reduce((sum, logo) => sum + logo.width, 0) + (successfulLogos.length - 1) * logoPadding;
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
      yPos += logoHeight + 10; // Move Y down for title
    } else {
      yPos = 45; // Default title position if no logos
    }

    // Title (only on page 1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(secondaryColor);
    const titleLines = doc.splitTextToSize(topic, pageWidth - margin * 2);
    doc.text(titleLines, pageWidth / 2, yPos, { align: 'center' });
    yPos += titleLines.length * 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(secondaryColor);
    doc.text(`Class Level: ${lessonPlan.gradeLevel || level}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // --- DRAW TABLES (with repeating header/footer) ---
    const tableOptions = {
      startY: yPos,
      didDrawPage: addHeaderAndFooter,
      margin: { top: 30 }, // Margin for repeating header
      theme: 'grid' as const,
      styles: { cellPadding: 4, fontSize: 10, lineWidth: 0.1, lineColor: '#C8C8C8' },
    };

    autoTable(doc, {
      ...tableOptions,
      body: [
        { content: 'Lesson Objectives' },
        { content: lessonPlan.lessonObjectives.join('\n') },
        { content: 'Materials' },
        { content: lessonPlan.materials.join('\n') },
      ],
      didParseCell: (data) => {
        if (data.section === 'body') {
          const cellContent = data.cell.raw as string;
          if (cellContent === 'Lesson Objectives' || cellContent === 'Materials') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = primaryColor;
            data.cell.styles.textColor = '#FFFFFF';
          }
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    if (lessonPlan.sections && lessonPlan.sections.length > 0) {
      for (const section of lessonPlan.sections) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(secondaryColor);
        doc.text(section.title, margin, yPos);
        yPos += 8;
        const activities = section.teacherActivities.map((ta: string, i: number) => [ta, section.learnerActivities[i] || '']);
        autoTable(doc, { ...tableOptions, startY: yPos, head: [['Teacher Activities', 'Learner Activities']], body: activities, theme: 'striped' as const,
          headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontSize: 11 },
          styles: { ...tableOptions.styles, valign: 'middle' },
          columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' } },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    const finalSections = [];
    if (lessonPlan.evaluation?.description) {
      finalSections.push({ content: 'Evaluation', styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' } });
      finalSections.push({ content: lessonPlan.evaluation.description });
    }
    if (lessonPlan.assignment?.description) {
      finalSections.push({ content: 'Assignment', styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' } });
      finalSections.push({ content: lessonPlan.assignment.description });
    }
    if (finalSections.length > 0) {
      autoTable(doc, { ...tableOptions, startY: yPos, body: finalSections });
    }

    // Loop to update footers with the final page count
    const pageCount = doc.internal.pages.length;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addHeaderAndFooter({ pageNumber: i });
    }

    doc.save(`${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lesson_plan.pdf`);

  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw new Error("Failed to export to PDF");
  }
};

export const exportToPowerPoint = async (content: string, topic: string) => {
  const pptx = new PptxGenJS();

  // Define Mother of Math branding colors
  const primaryColor = '9b87f5'; // Purple from the favicon
  const darkColor = '333333';
  const lightColor = 'ffffff';
  const accentColor = '6a4de7'; // Darker purple for emphasis

  // Set the master slide background and theme
  pptx.defineLayout({ name: 'MAMA_MATH', width: 10, height: 5.625 });
  pptx.layout = 'MAMA_MATH';

  // Create a background for all slides
  pptx.defineSlideMaster({
    title: 'MAMA_MASTER',
    background: { color: 'F9F8FF' }, // Very light purple background
    objects: [
      // Header bar
      { rect: { x: 0, y: 0, w: '100%', h: 0.5, fill: { color: primaryColor } } },

      // Footer with logo text
      { text: {
          text: 'MOTHER OF MATH',
          options: {
            x: 0.5, y: 5.1, w: 4, h: 0.3,
            color: primaryColor,
            fontFace: 'Arial',
            fontSize: 10,
            bold: true
          }
        }
      },

      // Slide number
      { text: {
          text: 'SLIDE_NUM / TOTAL_SLIDES',
          options: {
            x: 8.5, y: 5.1, w: 1, h: 0.3,
            color: darkColor,
            fontFace: 'Arial',
            fontSize: 10
          }
        }
      }
    ],
    slideNumber: { x: 8.5, y: 5.1 }
  });

  // Create title slide
  const titleSlide = pptx.addSlide({ masterName: 'MAMA_MASTER' });

  // Add main title
  titleSlide.addText(topic, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 1.5,
    fontSize: 40,
    color: primaryColor,
    bold: true,
    align: 'center',
    fontFace: 'Arial',
    valign: 'middle',
    wrap: true
  });

  // Add subtitle
  titleSlide.addText('Lesson Plan', {
    x: 0.5,
    y: 3,
    w: 9,
    h: 0.5,
    fontSize: 24,
    color: accentColor,
    align: 'center',
    fontFace: 'Arial'
  });

  // Add date
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  titleSlide.addText(`Created on: ${today}`, {
    x: 0.5,
    y: 3.5,
    w: 9,
    h: 0.5,
    fontSize: 16,
    color: darkColor,
    align: 'center',
    italic: true,
    fontFace: 'Arial'
  });

  // Add Mother of Math branded element
  titleSlide.addText('MOTHER OF MATH', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.5,
    fontSize: 16,
    color: lightColor,
    bold: true,
    align: 'center',
    fontFace: 'Arial'
  });

  // Process content into well-structured sections
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);

  const sections: { title: string; content: string[] }[] = [];
  let currentSection: { title: string; content: string[] } | null = null;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();

    if (!trimmedPara) continue;

    if (trimmedPara === trimmedPara.toUpperCase() || trimmedPara.startsWith('#')) {
      const headingText = trimmedPara.startsWith('#') ? trimmedPara.substring(1).trim() : trimmedPara;
      currentSection = {
        title: headingText,
        content: []
      };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.content.push(trimmedPara);
    } else {
      currentSection = {
        title: 'Overview',
        content: [trimmedPara]
      };
      sections.push(currentSection);
    }
  }

  sections.forEach((section) => {
    const slide = pptx.addSlide({ masterName: 'MAMA_MASTER' });

    slide.addText(section.title, {
      x: 0.5,
      y: 0.7,
      w: 9,
      h: 0.5,
      fontSize: 28,
      color: primaryColor,
      bold: true,
      fontFace: 'Arial',
      align: 'left',
      wrap: true
    });

    slide.addShape('line', {
      x: 0.5,
      y: 1.3,
      w: 9,
      h: 0,
      line: { color: primaryColor, width: 2 }
    });

    let yPos = 1.5;

    for (const contentItem of section.content) {
      if (contentItem.includes('\n') && (contentItem.trim().startsWith('- ') || contentItem.trim().startsWith('* '))) {
        const bulletPoints = contentItem.split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.trim().replace(/^[-*]\s/, '').trim());

        slide.addText(bulletPoints.map(text => ({ 
          text: text,
          options: { bullet: true }
        })), {
          x: 0.6,
          y: yPos,
          w: 8.8,
          h: bulletPoints.length * 0.3 + 0.2,
          fontSize: 16,
          color: darkColor,
          fontFace: 'Arial',
          bullet: { type: 'bullet' },
          paraSpaceBefore: 6,
          paraSpaceAfter: 6,
          wrap: true
        });

        yPos += 0.2 + (bulletPoints.length * 0.25);
      } else if (contentItem.includes('\n') && contentItem.match(/^\d+\.\s/)) {
        const numberedPoints = contentItem.split('\n').filter(line => line.trim().length > 0);

        for (let i = 0; i < numberedPoints.length; i++) {
          const text = numberedPoints[i].replace(/^\d+\.\s/, '').trim();
          
          slide.addText(`${i+1}. ${text}`, {
            x: 0.6,
            y: yPos,
            w: 8.8,
            h: 0.3,
            fontSize: 16,
            color: darkColor,
            fontFace: 'Arial',
            paraSpaceBefore: 2,
            paraSpaceAfter: 2,
            wrap: true
          });
          
          yPos += 0.3;
        }
      } else {
        const estimatedLines = Math.ceil(contentItem.length / 60);
        const estimatedHeight = Math.max(0.3, Math.min(3.0, estimatedLines * 0.16));

        slide.addText(contentItem, {
          x: 0.5,
          y: yPos,
          w: 9,
          h: estimatedHeight,
          fontSize: 16,
          color: darkColor,
          fontFace: 'Arial',
          align: 'left',
          valign: 'top',
          paraSpaceBefore: 2,
          paraSpaceAfter: 4,
          wrap: true
        });

        yPos += estimatedHeight + 0.1;
      }

      yPos += 0.1;
    }
  });

  await pptx.writeFile({
    fileName: `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_lesson_plan.pptx`
  });
};