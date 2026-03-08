import { sendMessage } from "./api";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import PptxGenJS from "pptxgenjs";
import { generateStoryLessonPlanImages } from "./imageGeneration";

interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
}

export const formatStoryAIResponseAsMarkdown = (responseText: string): string => {
  try {
    // The AI sometimes wraps the JSON in markdown code fences like ```json ... ```
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '').trim();
    }

    let data = JSON.parse(cleaned);

    // The AI often wraps the response in a "storyLessonPlan" object.
    if (data.storyLessonPlan) {
      data = data.storyLessonPlan;
    }

    let markdown = `# Story-Based Lesson Plan: ${data.title || 'N/A'}\n\n`;
    markdown += `**Grade Level:** ${data.gradeLevel || 'N/A'}\n`;
    markdown += `**Subject:** ${data.subject || 'N/A'}\n`;
    markdown += `**Topic:** ${data.topic || 'N/A'}\n`;
    markdown += `**Story Theme:** ${data.storyTheme || 'Mathematical Adventure'}\n\n`;

    // Story Overview
    if (data.storyOverview) {
      markdown += `## Story Overview\n`;
      markdown += `${data.storyOverview}\n\n`;
    }

    // Characters
    if (data.characters && Array.isArray(data.characters)) {
      markdown += `## Main Characters\n`;
      data.characters.forEach((character: any) => {
        if (typeof character === 'string') {
          markdown += `- ${character}\n`;
        } else {
          markdown += `- **${character.name}**: ${character.description}\n`;
        }
      });
      markdown += '\n';
    }

    // Setting
    if (data.setting) {
      markdown += `## Setting\n`;
      markdown += `${data.setting}\n\n`;
    }

    // Learning Objectives
    if (data.lessonObjectives && Array.isArray(data.lessonObjectives)) {
      markdown += `## Learning Objectives\n`;
      data.lessonObjectives.forEach((obj: string) => markdown += `- ${obj}\n`);
      markdown += '\n';
    }

    // Materials
    if (data.materials && Array.isArray(data.materials)) {
      markdown += `## Materials Needed\n`;
      data.materials.forEach((mat: string) => markdown += `- ${mat}\n`);
      markdown += '\n';
    }

    // Story Sections
    if (data.storySections && Array.isArray(data.storySections)) {
      markdown += `## The Mathematical Story\n\n`;
      data.storySections.forEach((section: any, index: number) => {
        markdown += `### ${section.title || `Part ${index + 1}`}\n\n`;
        
        if (section.storyContent) {
          markdown += `**Story:**\n`;
          markdown += `${section.storyContent}\n\n`;
        }

        if (section.mathConcept) {
          markdown += `**Math Concept:**\n`;
          markdown += `${section.mathConcept}\n\n`;
        }

        if (section.teacherGuidance && Array.isArray(section.teacherGuidance)) {
          markdown += `**Teacher Guidance:**\n`;
          section.teacherGuidance.forEach((guidance: string) => {
            markdown += `- ${guidance}\n`;
          });
          markdown += '\n';
        }

        if (section.studentActivities && Array.isArray(section.studentActivities)) {
          markdown += `**Student Activities:**\n`;
          section.studentActivities.forEach((activity: string) => {
            markdown += `- ${activity}\n`;
          });
          markdown += '\n';
        }
      });
    }

    // Practice Activities
    if (data.practiceActivities && Array.isArray(data.practiceActivities)) {
      markdown += `## Practice Activities\n`;
      data.practiceActivities.forEach((activity: string) => markdown += `- ${activity}\n`);
      markdown += '\n';
    }

    // Assessment
    if (data.assessment && data.assessment.description) {
      markdown += `## Assessment\n`;
      markdown += `${data.assessment.description}\n\n`;
    }

    // Extension Activities
    if (data.extensionActivities && Array.isArray(data.extensionActivities)) {
      markdown += `## Extension Activities\n`;
      data.extensionActivities.forEach((activity: string) => markdown += `- ${activity}\n`);
      markdown += '\n';
    }

    // Cultural Connections
    if (data.culturalConnections) {
      markdown += `## Cultural Connections\n`;
      markdown += `${data.culturalConnections}\n\n`;
    }

    return markdown;

  } catch (error) {
    console.error("Failed to parse or format story AI response. Returning raw text.", error);
    return responseText; // Fallback to raw text if parsing fails
  }
};

export const generateStoryLessonPlan = async (topic: string, level: string, sections: LessonSection[]) => {
  const sectionDetails = sections.map(s => `"${s.title}": ${s.keyPoints}`).join('\n');

  const prompt = `
You are an expert in creating engaging, culturally relevant mathematical stories for young learners in Cameroon. Your task is to generate a comprehensive story-based lesson plan for a "${level}" class on the topic: "${topic}".

The teacher has defined the following lesson structure:
${sectionDetails}

Your response MUST be a single JSON object with a root key "storyLessonPlan".

The "storyLessonPlan" object must contain:

1. "title": A captivating title for the story lesson (e.g., "Ambe's Market Adventure: Learning ${topic}")
2. "gradeLevel": The target grade level ("${level}")
3. "subject": "Mathematics"
4. "topic": The specific topic ("${topic}")
5. "storyTheme": A brief description of the story's main theme
6. "storyOverview": A 2-3 sentence summary of the complete story

7. "characters": An array of character objects with Cameroonian names:
   - Main characters: Ambe, Manka, Chia, Ngum
   - Supporting adults: Mama, Papa, Auntie Ngum, Uncle Bih
   Each character should have "name" and "description" fields

8. "setting": Describe the local Cameroonian setting (e.g., "Mile 3 Bamenda", "Ntarinkon Market", "village school", "family compound")

9. "lessonObjectives": [
      "Students will be able to add two or more numbers using appropriate strategies.",
      "Students will be able to subtract numbers within 1000 with regrouping.",
      "Students will be able to divide numbers within 100 using basic division strategies."
    ],

10. "materials": Array of materials needed (story props, local objects, manipulatives, etc.)

11. "storySections": An array following the teacher's structure with these exact sections:
${sections.map(s => `    - "${s.title}": ${s.keyPoints}`).join('\n')}
    
    Each section must have:
    - "title": Exact section name from teacher's structure
    - "storyContent": The actual story narrative (3-4 paragraphs, age-appropriate language with dialogue)
    - "mathConcept": The specific mathematical concept being taught
    - "teacherGuidance": Array of detailed instructions for the teacher (what to say, questions to ask)
    - "studentActivities": Array of specific activities students do (counting, grouping, acting out)
    - "keyPoints": How this section addresses the teacher's specified key points

12. "practiceActivities": Array of 4-5 follow-up activities that extend the story
13. "assessment": Object with detailed "description" of formative and summative assessment strategies
14. "extensionActivities": Array of activities for advanced learners or homework
15. "culturalConnections": Description of how the story connects to Cameroonian culture and daily life

**CRITICAL STORY REQUIREMENTS:**
- Use simple, clear language appropriate for ${level} students in Cameroon
- Include rich sensory details (bright colors, market sounds, food smells)
- Feature local foods (plantains, groundnuts, tomatoes, corn), places (markets, compounds), and customs
- Make ${topic} problems arise naturally from daily activities
- Characters work together and celebrate learning
- Include counting, grouping, or measurement in familiar contexts
- Use CFA francs, local measurements, and familiar objects

**Story Flow Example:**
- Opening: Character in familiar Cameroonian setting with sensory details
- Problem: ${topic} challenge emerges from daily activity
- Development: Characters collaborate to solve using ${topic} concepts
- Resolution: Joyful ending that reinforces ${topic} learning

**Sample Opening:**
"The morning sun painted the sky orange over Mile 3 as Ambe heard the rooster crow and the sound of Mama grinding corn. The sweet smell of ripe plantains filled the air as he put on his favorite blue shirt..."

Ensure the story is educationally sound, culturally authentic, and perfectly aligned with the teacher's specified structure and key points.
  `;

  try {
    const response = await sendMessage(prompt, undefined, 'json');
    // Format the response to ensure it's clean markdown
    return formatStoryAIResponseAsMarkdown(JSON.stringify(response));
  } catch (error) {
    console.error("Error generating story lesson plan:", error);
    throw new Error("Failed to generate story lesson plan");
  }
};

export const exportToPDF = async (jsonContent: string, topic: string, level: string, onProgress?: (message: string) => void) => {
  try {
    onProgress?.('Preparing your story lesson plan...');
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
    const logoHeight = 12; // Increased logo height for better visibility
    const logoPadding = 6;

    const logoPromises = logoUrls.map(url =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Add CORS support
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const width = logoHeight * aspectRatio;
          resolve({ img, width, height: logoHeight });
          if (url.endsWith('.svg')) URL.revokeObjectURL(img.src);
        };
        img.onerror = (error) => {
          console.warn(`Failed to load logo: ${url}`, error);
          resolve(null); // Don't reject, just return null
        };
        
        if (url.endsWith('.svg')) {
          fetch(url)
            .then(r => r.text())
            .then(svgText => {
              const blob = new Blob([svgText], { type: 'image/svg+xml' });
              img.src = URL.createObjectURL(blob);
            })
            .catch(error => {
              console.warn(`Failed to fetch SVG: ${url}`, error);
              resolve(null);
            });
        } else {
          img.src = url;
        }
      })
    );
    
    const logoResults = await Promise.allSettled(logoPromises);
    const successfulLogos = logoResults
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<any>).value);

    onProgress?.('Building your PDF document...');

    // --- DEFINE REPEATING HEADER/FOOTER ---
    const addHeaderAndFooter = (data: any) => {
      // Header Bar
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor('#FFFFFF');
      doc.text('Mother of Math | Story Lesson Plan', pageWidth / 2, 16, { align: 'center' });

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#666666');
      const pageCount = doc.internal.pages.length;
      if (pageCount > 1) {
        doc.text(`Page ${data.pageNumber} / ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }
    };

    // --- PARSE JSON ---
    let storyLessonPlan;
    try {
      let cleaned = jsonContent.trim().replace(/^```[a-zA-Z]*\s*|```\s*$/gm, '');
      const parsedJson = JSON.parse(cleaned);
      storyLessonPlan = parsedJson.storyLessonPlan || parsedJson;
      if (!storyLessonPlan || typeof storyLessonPlan !== 'object') throw new Error('Invalid data format.');
    } catch (e) {
      console.error("Failed to parse story lesson plan JSON:", e);
      // Fallback to markdown parsing if JSON parsing fails
      return exportMarkdownToPDF(jsonContent, topic, level);
    }

    // Clean up any markdown formatting from the content
    const cleanContent = (text: string) => {
      if (!text) return '';
      return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
        .replace(/##\s*/g, '') // Remove heading markdown
        .replace(/\*\s*/g, '• ') // Convert asterisks to bullet points
        .trim();
    };

    // Apply cleaning to all text content
    if (storyLessonPlan.storyOverview) {
      storyLessonPlan.storyOverview = cleanContent(storyLessonPlan.storyOverview);
    }
    if (storyLessonPlan.setting) {
      storyLessonPlan.setting = cleanContent(storyLessonPlan.setting);
    }
    if (storyLessonPlan.characters) {
      storyLessonPlan.characters = storyLessonPlan.characters.map((char: any) => 
        typeof char === 'string' ? cleanContent(char) : {
          ...char,
          name: cleanContent(char.name || ''),
          description: cleanContent(char.description || '')
        }
      );
    }
    if (storyLessonPlan.lessonObjectives) {
      storyLessonPlan.lessonObjectives = storyLessonPlan.lessonObjectives.map((obj: string) => cleanContent(obj));
    }
    if (storyLessonPlan.materials) {
      storyLessonPlan.materials = storyLessonPlan.materials.map((mat: string) => cleanContent(mat));
    }
    if (storyLessonPlan.storySections) {
      storyLessonPlan.storySections = storyLessonPlan.storySections.map((section: any) => ({
        ...section,
        title: cleanContent(section.title || ''),
        storyContent: cleanContent(section.storyContent || ''),
        teacherGuidance: section.teacherGuidance?.map((guide: string) => cleanContent(guide)) || [],
        studentActivities: section.studentActivities?.map((activity: string) => cleanContent(activity)) || []
      }));
    }
    if (storyLessonPlan.assessment?.description) {
      storyLessonPlan.assessment.description = cleanContent(storyLessonPlan.assessment.description);
    }
    if (storyLessonPlan.practiceActivities) {
      storyLessonPlan.practiceActivities = storyLessonPlan.practiceActivities.map((activity: string) => cleanContent(activity));
    }
    if (storyLessonPlan.extensionActivities) {
      storyLessonPlan.extensionActivities = storyLessonPlan.extensionActivities.map((activity: string) => cleanContent(activity));
    }
    if (storyLessonPlan.culturalConnections) {
      storyLessonPlan.culturalConnections = cleanContent(storyLessonPlan.culturalConnections);
    }

    // --- DRAW PAGE 1 CONTENT ---
    let yPos = 35;

    // Logos (centered, only on page 1)
    if (successfulLogos.length > 0) {
      console.log(`Loading ${successfulLogos.length} logos for PDF`);
      const totalLogoWidth = successfulLogos.reduce((sum, logo) => sum + logo.width, 0) + (successfulLogos.length - 1) * logoPadding;
      let currentX = (pageWidth - totalLogoWidth) / 2;
      
      for (const logo of successfulLogos) {
        try {
          const canvas = document.createElement('canvas');
          const scaleFactor = 3; // Reduced scale factor for better performance
          canvas.width = logo.width * scaleFactor;
          canvas.height = logo.height * scaleFactor;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(logo.img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png', 0.9);
            doc.addImage(dataUrl, 'PNG', currentX, yPos, logo.width, logo.height, undefined, 'FAST');
            currentX += logo.width + logoPadding;
          }
        } catch (error) {
          console.warn('Error adding logo to PDF:', error);
        }
      }
      yPos += logoHeight + 15;
    } else {
      console.log('No logos loaded, skipping logo section');
      yPos = 45;
    }

    // Title (only on page 1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(secondaryColor);
    const titleLines = doc.splitTextToSize(`Story Lesson Plan: ${topic}`, pageWidth - margin * 2);
    doc.text(titleLines, pageWidth / 2, yPos, { align: 'center' });
    yPos += titleLines.length * 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(secondaryColor);
    doc.text(`Class Level: ${storyLessonPlan.gradeLevel || level}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // --- DRAW TABLES (with repeating header/footer) ---
    const tableOptions = {
      startY: yPos,
      didDrawPage: addHeaderAndFooter,
      margin: { top: 30 },
      theme: 'grid' as const,
      styles: { cellPadding: 4, fontSize: 10, lineWidth: 0.1, lineColor: '#C8C8C8' },
    };

    // Story Overview and Characters
    const storyInfoBody = [];
    if (storyLessonPlan.storyOverview) {
      storyInfoBody.push({ content: 'Story Overview' });
      storyInfoBody.push({ content: storyLessonPlan.storyOverview });
    }
    if (storyLessonPlan.characters && storyLessonPlan.characters.length > 0) {
      storyInfoBody.push({ content: 'Main Characters' });
      const charactersText = storyLessonPlan.characters.map((char: any) => 
        typeof char === 'string' ? char : `${char.name}: ${char.description}`
      ).join('\n');
      storyInfoBody.push({ content: charactersText });
    }
    if (storyLessonPlan.setting) {
      storyInfoBody.push({ content: 'Setting' });
      storyInfoBody.push({ content: storyLessonPlan.setting });
    }

    if (storyInfoBody.length > 0) {
      autoTable(doc, {
        ...tableOptions,
        body: storyInfoBody,
        didParseCell: (data) => {
          if (data.section === 'body') {
            const cellContent = data.cell.raw as string;
            if (cellContent === 'Story Overview' || cellContent === 'Main Characters' || cellContent === 'Setting') {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = primaryColor;
              data.cell.styles.textColor = '#FFFFFF';
            }
          }
        },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Learning Objectives and Materials
    autoTable(doc, {
      ...tableOptions,
      startY: yPos,
      body: [
        { content: 'Learning Objectives' },
        { content: (storyLessonPlan.lessonObjectives || []).join('\n') },
        { content: 'Materials Needed' },
        { content: (storyLessonPlan.materials || []).join('\n') },
      ],
      didParseCell: (data) => {
        if (data.section === 'body') {
          const cellContent = data.cell.raw as string;
          if (cellContent === 'Learning Objectives' || cellContent === 'Materials Needed') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = primaryColor;
            data.cell.styles.textColor = '#FFFFFF';
          }
        }
      },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Story Sections
    if (storyLessonPlan.storySections && storyLessonPlan.storySections.length > 0) {
      for (const section of storyLessonPlan.storySections) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(secondaryColor);
        doc.text(section.title, margin, yPos);
        yPos += 8;

        // Story Content
        if (section.storyContent) {
          autoTable(doc, {
            ...tableOptions,
            startY: yPos,
            body: [
              { content: 'Story Content' },
              { content: section.storyContent }
            ],
            didParseCell: (data) => {
              if (data.section === 'body' && data.cell.raw === 'Story Content') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = '#E8F5E8';
                data.cell.styles.textColor = secondaryColor;
              }
            },
          });
          yPos = (doc as any).lastAutoTable.finalY + 5;
        }

        // Teacher Guidance and Student Activities
        if (section.teacherGuidance && section.studentActivities) {
          const activities = Math.max(section.teacherGuidance.length, section.studentActivities.length);
          const activityRows = [];
          for (let i = 0; i < activities; i++) {
            activityRows.push([
              section.teacherGuidance[i] || '',
              section.studentActivities[i] || ''
            ]);
          }
          
          autoTable(doc, {
            ...tableOptions,
            startY: yPos,
            head: [['Teacher Guidance', 'Student Activities']],
            body: activityRows,
            theme: 'striped' as const,
            headStyles: { fillColor: primaryColor, textColor: '#FFFFFF', fontSize: 11 },
            styles: { ...tableOptions.styles, valign: 'middle' },
            columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' } },
          });
          yPos = (doc as any).lastAutoTable.finalY + 10;
        }
      }
    }

    // Assessment and Extension Activities
    const finalSections = [];
    if (storyLessonPlan.assessment?.description) {
      finalSections.push({ content: 'Assessment', styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' } });
      finalSections.push({ content: storyLessonPlan.assessment.description });
    }
    if (storyLessonPlan.practiceActivities && storyLessonPlan.practiceActivities.length > 0) {
      finalSections.push({ content: 'Practice Activities', styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' } });
      finalSections.push({ content: storyLessonPlan.practiceActivities.join('\n') });
    }
    if (storyLessonPlan.extensionActivities && storyLessonPlan.extensionActivities.length > 0) {
      finalSections.push({ content: 'Extension Activities', styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' } });
      finalSections.push({ content: storyLessonPlan.extensionActivities.join('\n') });
    }
    if (storyLessonPlan.culturalConnections) {
      finalSections.push({ content: 'Cultural Connections', styles: { fontStyle: 'bold', fillColor: primaryColor, textColor: '#FFFFFF' } });
      finalSections.push({ content: storyLessonPlan.culturalConnections });
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

    onProgress?.('Saving your PDF...');
    doc.save(`${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_story_lesson_plan.pdf`);

  } catch (error) {
    console.error("Error exporting story lesson plan to PDF:", error);
    throw new Error("Failed to export to PDF");
  }
};

// Fallback function for markdown content
const exportMarkdownToPDF = async (content: string, topic: string, level: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  const primaryColor = '#009e60';
  const secondaryColor = '#4b371c';
  
  // Header
  doc.setFillColor(primaryColor);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor('#FFFFFF');
  doc.text('Mother of Math | Story Lesson Plan', pageWidth / 2, 16, { align: 'center' });
  
  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(secondaryColor);
  doc.text(`Story Lesson Plan: ${topic}`, margin, 40);
  
  // Grade level
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Grade Level: ${level}`, margin, 55);
  
  // Clean content function
  const cleanContent = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/##\s*/g, '') // Remove heading markdown
      .replace(/\*\s*/g, '• ') // Convert asterisks to bullet points
      .trim();
  };

  // Content
  const lines = content.split('\n').map(line => cleanContent(line));
  let yPosition = 70;
  
  lines.forEach((line) => {
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      // Add header to new page
      doc.setFillColor(primaryColor);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor('#FFFFFF');
      doc.text('Mother of Math | Story Lesson Plan', pageWidth / 2, 16, { align: 'center' });
      yPosition = 35;
    }
    
    if (line.startsWith('# ')) {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor);
      doc.text(line.substring(2), margin, yPosition);
      yPosition += 10;
    } else if (line.startsWith('## ')) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor);
      doc.text(line.substring(3), margin, yPosition);
      yPosition += 8;
    } else if (line.startsWith('### ')) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(secondaryColor);
      doc.text(line.substring(4), margin, yPosition);
      yPosition += 7;
    } else if (line.trim()) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor('#333333');
      const splitText = doc.splitTextToSize(line, maxWidth);
      doc.text(splitText, margin, yPosition);
      yPosition += splitText.length * 5;
    } else {
      yPosition += 5;
    }
  });
  
  doc.save(`story-lesson-plan-${topic.replace(/\s+/g, '-').toLowerCase()}.pdf`);
};

export const exportToPowerPoint = async (
  content: string,
  topic: string,
  onProgress?: (message: string) => void
) => {
  const pptx = new PptxGenJS();

  // ── Mother of Math Story Branding — matches app CSS --primary hsl(144,100%,31%) ──
  const PRIMARY     = '009e60';   // App primary green
  const PRIMARY_DK  = '007a4a';   // Darker green
  const PRIMARY_LT  = '00c978';   // Lighter green
  const BROWN       = '4b371c';   // Warm brown (story theme + app secondary)
  const BROWN_LT    = '6b5030';   // Lighter brown
  const DARK        = '1a1a2e';   // Near-black
  const MID         = '333333';   // Dark gray
  const LIGHT       = 'ffffff';   // White
  const BG          = 'FFF8F0';   // Warm white bg
  const BG_STORY    = 'FDF6EC';   // Story warm bg
  const BG_GREEN    = 'F0FFF4';   // Light green bg
  const GOLD        = 'F4B400';   // Accent gold

  pptx.defineLayout({ name: 'MAMA_STORY', width: 10, height: 5.625 });
  pptx.layout = 'MAMA_STORY';
  pptx.author = 'Mother of Math';
  pptx.company = 'Mothers for Mathematics';
  pptx.subject = `Story Lesson: ${topic}`;
  pptx.title = `Story Lesson Plan: ${topic}`;

  // ── Parse JSON (the story plan may be in raw JSON or markdown) ──
  let storyPlan: any = null;
  try {
    const cleaned = content.trim().replace(/^```[a-zA-Z]*\s*|```\s*$/gm, '');
    const parsed = JSON.parse(cleaned);
    storyPlan = parsed.storyLessonPlan || parsed;
  } catch {
    // Will use text-based fallback
  }

  // ── Generate AI story illustrations ──
  let images: Record<string, string | null> = {};
  if (storyPlan && typeof storyPlan === 'object') {
    try {
      images = await generateStoryLessonPlanImages(
        topic,
        storyPlan.gradeLevel || '',
        storyPlan.storyTheme || topic,
        storyPlan.storySections || [],
        onProgress
      );
    } catch (error) {
      console.warn('Story image generation failed:', error);
      onProgress?.('Image generation unavailable — creating branded slides...');
    }
  }

  onProgress?.('Building your story PowerPoint presentation...');

  // ── HELPERS ──
  const addHeader = (slide: any, title: string, color: string = PRIMARY) => {
    // Header bar
    slide.addShape('rect', { x: 0, y: 0, w: 10, h: 0.65, fill: { color } });
    // Gold accent line under header
    slide.addShape('rect', { x: 0, y: 0.65, w: 10, h: 0.04, fill: { color: GOLD } });
    slide.addText(title, {
      x: 0.4, y: 0.05, w: 9.2, h: 0.55,
      fontSize: 18, color: LIGHT, bold: true, fontFace: 'Arial', valign: 'middle',
    });
  };

  const addFooter = (slide: any) => {
    slide.addShape('rect', { x: 0, y: 5.15, w: 10, h: 0.03, fill: { color: PRIMARY } });
    slide.addText('MOTHER OF MATH', {
      x: 0.4, y: 5.22, w: 3.5, h: 0.3,
      fontSize: 9, color: PRIMARY, bold: true, fontFace: 'Arial',
    });
    slide.addText('Story-Based Learning · Cameroon', {
      x: 5.5, y: 5.22, w: 4, h: 0.3,
      fontSize: 8, color: '999999', fontFace: 'Arial', align: 'right',
    });
  };

  const addSlideImage = (
    slide: any,
    imageData: string | null | undefined,
    x: number, y: number, w: number, h: number,
    emoji = '📖'
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
      // Green-tinted placeholder
      slide.addShape('rect', {
        x, y, w, h,
        fill: { color: BG_GREEN }, rectRadius: 0.12,
        line: { color: PRIMARY, width: 1.5, dashType: 'dash' },
      });
      slide.addText(emoji, {
        x, y: y + h / 2 - 0.4, w, h: 0.8,
        fontSize: 36, align: 'center', valign: 'middle', color: PRIMARY,
      });
    }
  };

  // ===================================================================
  // STRUCTURED JSON STORY SLIDES
  // ===================================================================
  if (storyPlan && typeof storyPlan === 'object') {

    // ═══ TITLE SLIDE ═══
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: DARK };

    // Left warm-brown panel
    titleSlide.addShape('rect', { x: 0, y: 0, w: 5.2, h: 5.625, fill: { color: BROWN } });

    // Decorative circles
    titleSlide.addShape('ellipse', {
      x: -0.3, y: 4, w: 1.8, h: 1.8,
      fill: { color: PRIMARY, transparency: 50 },
    });
    titleSlide.addShape('ellipse', {
      x: 3.8, y: -0.3, w: 1.2, h: 1.2,
      fill: { color: GOLD, transparency: 40 },
    });
    titleSlide.addShape('ellipse', {
      x: 1.5, y: 4.5, w: 1.2, h: 1.2,
      fill: { color: PRIMARY_LT, transparency: 60 },
    });

    // Branding
    titleSlide.addText('MOTHER OF MATH', {
      x: 0.5, y: 0.4, w: 4.2, h: 0.35,
      fontSize: 11, color: LIGHT, bold: true, fontFace: 'Arial', charSpacing: 3,
    });
    titleSlide.addShape('line', {
      x: 0.5, y: 0.85, w: 2.2, h: 0,
      line: { color: GOLD, width: 3 },
    });

    // Story title
    const storyTitle = storyPlan.title || `Story Lesson: ${topic}`;
    titleSlide.addText(storyTitle, {
      x: 0.5, y: 1.2, w: 4.2, h: 1.8,
      fontSize: 26, color: LIGHT, bold: true, fontFace: 'Arial', valign: 'top', wrap: true,
    });

    // Theme badge
    if (storyPlan.storyTheme) {
      titleSlide.addShape('rect', {
        x: 0.5, y: 3.2, w: 3.5, h: 0.38,
        fill: { color: PRIMARY }, rectRadius: 0.06,
      });
      titleSlide.addText(`Theme: ${storyPlan.storyTheme}`, {
        x: 0.5, y: 3.2, w: 3.5, h: 0.38,
        fontSize: 11, color: LIGHT, bold: true, fontFace: 'Arial', align: 'center',
      });
    }

    // Level badge
    if (storyPlan.gradeLevel) {
      titleSlide.addShape('rect', {
        x: 0.5, y: 3.72, w: 2.5, h: 0.38,
        fill: { color: GOLD }, rectRadius: 0.06,
      });
      titleSlide.addText(storyPlan.gradeLevel, {
        x: 0.5, y: 3.72, w: 2.5, h: 0.38,
        fontSize: 12, color: DARK, bold: true, fontFace: 'Arial', align: 'center',
      });
    }

    titleSlide.addText('Mathematical Storytelling', {
      x: 0.5, y: 4.8, w: 4.2, h: 0.3,
      fontSize: 10, color: BG, fontFace: 'Arial',
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
      titleSlide.addText('📖', {
        x: 5.2, y: 1.8, w: 4.8, h: 2,
        fontSize: 64, align: 'center', valign: 'middle',
      });
    }

    // ═══ STORY OVERVIEW & CHARACTERS SLIDE ═══
    if (storyPlan.storyOverview || storyPlan.characters) {
      const overviewSlide = pptx.addSlide();
      overviewSlide.background = { color: BG };
      addHeader(overviewSlide, 'STORY OVERVIEW', BROWN);

      // Always show character image
      addSlideImage(overviewSlide, images.characters, 6.3, 0.9, 3.2, 3.9, '👧🏾');

      const textW = 5.5;
      let yPos = 0.85;

      // Story overview
      if (storyPlan.storyOverview) {
        overviewSlide.addText(storyPlan.storyOverview, {
          x: 0.5, y: yPos, w: textW, h: 1.2,
          fontSize: 13, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
          italic: true, lineSpacingMultiple: 1.2,
        });
        yPos += 1.3;
      }

      // Setting
      if (storyPlan.setting) {
        overviewSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: PRIMARY } });
        overviewSlide.addText('SETTING', {
          x: 0.6, y: yPos, w: 3, h: 0.3,
          fontSize: 10, color: PRIMARY, bold: true, fontFace: 'Arial',
        });
        yPos += 0.35;
        overviewSlide.addText(storyPlan.setting, {
          x: 0.6, y: yPos, w: textW - 0.2, h: 0.6,
          fontSize: 12, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
        });
        yPos += 0.7;
      }

      // Characters
      if (storyPlan.characters && Array.isArray(storyPlan.characters)) {
        overviewSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: BROWN } });
        overviewSlide.addText('MAIN CHARACTERS', {
          x: 0.6, y: yPos, w: 3, h: 0.3,
          fontSize: 10, color: BROWN, bold: true, fontFace: 'Arial',
        });
        yPos += 0.35;

        const charTexts = storyPlan.characters.map((c: any) => ({
          text: typeof c === 'string' ? c : `${c.name}: ${c.description}`,
          options: { bullet: true, color: MID, paraSpaceBefore: 3, paraSpaceAfter: 2 },
        }));
        overviewSlide.addText(charTexts, {
          x: 0.6, y: yPos, w: textW - 0.2, h: 5 - yPos,
          fontSize: 11, fontFace: 'Arial', wrap: true, valign: 'top',
          bullet: { type: 'bullet' },
        });
      }

      addFooter(overviewSlide);
    }

    // ═══ OBJECTIVES SLIDE ═══
    if (storyPlan.lessonObjectives && Array.isArray(storyPlan.lessonObjectives)) {
      const objSlide = pptx.addSlide();
      objSlide.background = { color: BG_GREEN };
      addHeader(objSlide, 'LEARNING OBJECTIVES');

      // Image on the right
      addSlideImage(objSlide, images.objectives, 6.3, 0.9, 3.2, 3.9, '🎯');

      // Green vertical accent bar
      objSlide.addShape('rect', { x: 0.35, y: 0.85, w: 0.06, h: 4.0, fill: { color: PRIMARY } });

      objSlide.addText('Through this story, learners will be able to:', {
        x: 0.55, y: 0.85, w: 5.5, h: 0.35,
        fontSize: 12, color: PRIMARY_DK, italic: true, fontFace: 'Arial',
      });

      objSlide.addText(
        storyPlan.lessonObjectives.map((obj: string, i: number) => ({
          text: `${i + 1}.  ${obj}`,
          options: { color: MID, paraSpaceBefore: 8, paraSpaceAfter: 4 },
        })),
        {
          x: 0.6, y: 1.3, w: 5.3, h: 3.5,
          fontSize: 14, fontFace: 'Arial', wrap: true, valign: 'top',
          lineSpacingMultiple: 1.15,
        }
      );

      addFooter(objSlide);
    }

    // ═══ STORY SECTION SLIDES ═══
    if (storyPlan.storySections && Array.isArray(storyPlan.storySections)) {
      storyPlan.storySections.forEach((section: any, idx: number) => {
        const storyImg = images[`story_${idx}`];
        const activityImg = images[`activity_${idx}`];

        // STORY CONTENT slide
        const storySlide = pptx.addSlide();
        storySlide.background = { color: BG_STORY };
        addHeader(storySlide, section.title || `PART ${idx + 1}`, BROWN);

        // Story image on the right
        addSlideImage(storySlide, storyImg, 6.3, 0.9, 3.2, 3.5, '🎭');

        const txtW = 5.4;

        // Story content
        if (section.storyContent) {
          storySlide.addShape('rect', { x: 0.4, y: 0.85, w: 0.06, h: 0.3, fill: { color: GOLD } });
          storySlide.addText('THE STORY', {
            x: 0.6, y: 0.85, w: 3, h: 0.3,
            fontSize: 10, color: BROWN, bold: true, fontFace: 'Arial',
          });

          storySlide.addText(section.storyContent, {
            x: 0.6, y: 1.25, w: txtW, h: 2.2,
            fontSize: 12, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
            italic: true, lineSpacingMultiple: 1.25,
          });
        }

        // Math concept callout
        if (section.mathConcept) {
          storySlide.addShape('rect', {
            x: 0.5, y: 3.55, w: txtW + 0.2, h: 0.75,
            fill: { color: PRIMARY, transparency: 90 },
            rectRadius: 0.06,
          });
          storySlide.addShape('rect', { x: 0.5, y: 3.55, w: 0.06, h: 0.75, fill: { color: PRIMARY } });
          storySlide.addText(`Math Concept: ${section.mathConcept}`, {
            x: 0.7, y: 3.55, w: txtW, h: 0.75,
            fontSize: 11, color: PRIMARY_DK, fontFace: 'Arial', wrap: true, valign: 'middle',
            bold: true,
          });
        }

        addFooter(storySlide);

        // TEACHER GUIDANCE + STUDENT ACTIVITIES slide
        if (
          (section.teacherGuidance && section.teacherGuidance.length > 0) ||
          (section.studentActivities && section.studentActivities.length > 0)
        ) {
          const actSlide = pptx.addSlide();
          actSlide.background = { color: BG_GREEN };
          addHeader(actSlide, `${section.title || `PART ${idx + 1}`} — ACTIVITIES`, PRIMARY);

          // Activity image on the right
          addSlideImage(actSlide, activityImg, 6.3, 0.9, 3.2, 3.8, '👧🏾');

          let yPos = 0.85;

          // Teacher Guidance
          if (section.teacherGuidance && Array.isArray(section.teacherGuidance)) {
            actSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: PRIMARY } });
            actSlide.addText('TEACHER GUIDANCE', {
              x: 0.6, y: yPos, w: 4, h: 0.3,
              fontSize: 10, color: PRIMARY, bold: true, fontFace: 'Arial',
            });
            yPos += 0.35;

            actSlide.addText(
              section.teacherGuidance.map((g: string) => ({
                text: g,
                options: { bullet: true, color: MID, paraSpaceBefore: 3, paraSpaceAfter: 2 },
              })),
              {
                x: 0.6, y: yPos, w: 5.4, h: 1.8,
                fontSize: 11, fontFace: 'Arial', wrap: true, valign: 'top',
                bullet: { type: 'bullet' },
              }
            );
            yPos += 1.9;
          }

          // Student Activities
          if (section.studentActivities && Array.isArray(section.studentActivities)) {
            actSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: BROWN } });
            actSlide.addText('STUDENT ACTIVITIES', {
              x: 0.6, y: yPos, w: 4, h: 0.3,
              fontSize: 10, color: BROWN, bold: true, fontFace: 'Arial',
            });
            yPos += 0.35;

            actSlide.addText(
              section.studentActivities.map((a: string) => ({
                text: a,
                options: { bullet: true, color: MID, paraSpaceBefore: 3, paraSpaceAfter: 2 },
              })),
              {
                x: 0.6, y: yPos, w: 5.4, h: 5 - yPos,
                fontSize: 11, fontFace: 'Arial', wrap: true, valign: 'top',
                bullet: { type: 'bullet' },
              }
            );
          }

          addFooter(actSlide);
        }
      });
    }

    // ═══ PRACTICE & ASSESSMENT SLIDE ═══
    if (storyPlan.practiceActivities || storyPlan.assessment?.description) {
      const practiceSlide = pptx.addSlide();
      practiceSlide.background = { color: BG_GREEN };
      addHeader(practiceSlide, 'PRACTICE & ASSESSMENT');

      // Image on the right
      addSlideImage(practiceSlide, images.practice, 6.3, 0.9, 3.2, 3.9, '📋');

      let yPos = 0.85;

      if (storyPlan.practiceActivities && Array.isArray(storyPlan.practiceActivities)) {
        practiceSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: PRIMARY } });
        practiceSlide.addText('PRACTICE ACTIVITIES', {
          x: 0.6, y: yPos, w: 4, h: 0.3,
          fontSize: 10, color: PRIMARY, bold: true, fontFace: 'Arial',
        });
        yPos += 0.35;

        practiceSlide.addText(
          storyPlan.practiceActivities.map((a: string) => ({
            text: a,
            options: { bullet: true, color: MID, paraSpaceBefore: 4, paraSpaceAfter: 2 },
          })),
          {
            x: 0.6, y: yPos, w: 5.4, h: 1.8,
            fontSize: 12, fontFace: 'Arial', wrap: true, valign: 'top',
            bullet: { type: 'bullet' },
          }
        );
        yPos += 1.9;
      }

      if (storyPlan.assessment?.description) {
        practiceSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: BROWN } });
        practiceSlide.addText('ASSESSMENT', {
          x: 0.6, y: yPos, w: 4, h: 0.3,
          fontSize: 10, color: BROWN, bold: true, fontFace: 'Arial',
        });
        yPos += 0.35;

        practiceSlide.addText(storyPlan.assessment.description, {
          x: 0.6, y: yPos, w: 5.4, h: 5 - yPos,
          fontSize: 12, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
          lineSpacingMultiple: 1.2,
        });
      }

      addFooter(practiceSlide);
    }

    // ═══ EXTENSION & CULTURAL CONNECTIONS SLIDE ═══
    if (storyPlan.extensionActivities || storyPlan.culturalConnections) {
      const extSlide = pptx.addSlide();
      extSlide.background = { color: BG };
      addHeader(extSlide, 'EXTENSIONS & CULTURAL CONNECTIONS', BROWN);

      // Image on the right
      addSlideImage(extSlide, images.extensions, 6.3, 0.9, 3.2, 3.9, '🌍');

      let yPos = 0.85;

      if (storyPlan.extensionActivities && Array.isArray(storyPlan.extensionActivities)) {
        extSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: GOLD } });
        extSlide.addText('EXTENSION ACTIVITIES', {
          x: 0.6, y: yPos, w: 4, h: 0.3,
          fontSize: 10, color: BROWN, bold: true, fontFace: 'Arial',
        });
        yPos += 0.35;

        extSlide.addText(
          storyPlan.extensionActivities.map((a: string) => ({
            text: a,
            options: { bullet: true, color: MID, paraSpaceBefore: 4, paraSpaceAfter: 2 },
          })),
          {
            x: 0.6, y: yPos, w: 5.4, h: 1.8,
            fontSize: 12, fontFace: 'Arial', wrap: true, valign: 'top',
            bullet: { type: 'bullet' },
          }
        );
        yPos += 1.9;
      }

      if (storyPlan.culturalConnections) {
        extSlide.addShape('rect', { x: 0.4, y: yPos, w: 0.06, h: 0.3, fill: { color: PRIMARY } });
        extSlide.addText('CULTURAL CONNECTIONS', {
          x: 0.6, y: yPos, w: 4, h: 0.3,
          fontSize: 10, color: PRIMARY, bold: true, fontFace: 'Arial',
        });
        yPos += 0.35;

        extSlide.addText(storyPlan.culturalConnections, {
          x: 0.6, y: yPos, w: 5.4, h: 5 - yPos,
          fontSize: 12, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
          lineSpacingMultiple: 1.2,
        });
      }

      addFooter(extSlide);
    }

    // ═══ CLOSING SLIDE ═══
    const closingSlide = pptx.addSlide();
    closingSlide.background = { color: DARK };

    closingSlide.addShape('rect', { x: 0, y: 0, w: 5.2, h: 5.625, fill: { color: BROWN } });

    // Decorative circles
    closingSlide.addShape('ellipse', {
      x: 3.5, y: 3.5, w: 2.5, h: 2.5,
      fill: { color: PRIMARY, transparency: 50 },
    });
    closingSlide.addShape('ellipse', {
      x: -0.3, y: -0.3, w: 1.6, h: 1.6,
      fill: { color: PRIMARY_LT, transparency: 40 },
    });

    closingSlide.addText('The End!', {
      x: 0.5, y: 1.2, w: 4.2, h: 0.8,
      fontSize: 34, color: LIGHT, bold: true, fontFace: 'Arial',
    });
    closingSlide.addText('Happy Storytelling & Learning', {
      x: 0.5, y: 2.2, w: 4.2, h: 0.5,
      fontSize: 16, color: BG, fontFace: 'Arial',
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
      fontSize: 10, color: BG, fontFace: 'Arial',
    });

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
    // FALLBACK: markdown/text-based slides
    // ===================================================================
    const fbTitle = pptx.addSlide();
    fbTitle.background = { color: BROWN };
    fbTitle.addText(`Story Lesson Plan: ${topic}`, {
      x: 1, y: 1.5, w: 8, h: 1.5,
      fontSize: 30, color: LIGHT, bold: true, align: 'center', fontFace: 'Arial', wrap: true,
    });
    fbTitle.addText('Mathematical Storytelling Approach', {
      x: 1, y: 3.5, w: 8, h: 0.5,
      fontSize: 16, color: BG, align: 'center', fontFace: 'Arial',
    });
    fbTitle.addText('MOTHER OF MATH', {
      x: 1, y: 4.5, w: 8, h: 0.4,
      fontSize: 11, color: LIGHT, bold: true, align: 'center', fontFace: 'Arial', charSpacing: 3,
    });

    const sections = content.split('## ').filter(s => s.trim());
    sections.forEach(section => {
      const slide = pptx.addSlide();
      slide.background = { color: BG_STORY };
      const lines = section.split('\n');
      const title = lines[0].replace(/^#+\s*/, '');

      addHeader(slide, title, BROWN);

      const body = lines.slice(1).join('\n').trim();
      if (body) {
        slide.addText(body, {
          x: 0.5, y: 0.9, w: 9, h: 4,
          fontSize: 13, color: MID, fontFace: 'Arial', wrap: true, valign: 'top',
          lineSpacingMultiple: 1.2,
        });
      }

      addFooter(slide);
    });
  }

  onProgress?.('Saving your presentation...');

  await pptx.writeFile({
    fileName: `story-lesson-plan-${topic.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pptx`,
  });
};
