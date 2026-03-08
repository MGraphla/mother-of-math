// src/services/imageGeneration.ts
// AI-powered image generation for PowerPoint slides using Google Gemini via OpenRouter

import { getApiKey } from './api';

const IMAGE_MODEL = 'google/gemini-3-pro-image-preview';
const FALLBACK_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000; // 60 seconds per image

/**
 * Generate a single image using Gemini Image Preview via OpenRouter.
 * Returns a base64 data URL (data:image/png;base64,...) or null if generation fails.
 */
export const generateSlideImage = async (
  prompt: string,
  aspectRatio: string = '16:9'
): Promise<string | null> => {
  const apiKey = getApiKey();
  const apiUrl = import.meta.env.VITE_OPENROUTER_API_URL || FALLBACK_API_URL;

  if (!apiKey) {
    console.warn('[ImageGen] No API key available');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Mother of Math',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
        stream: false,
        image_config: {
          aspect_ratio: aspectRatio,
          image_size: '1K',
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('[ImageGen] API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    // OpenRouter returns images in message.images array
    if (message?.images?.[0]?.image_url?.url) {
      return message.images[0].image_url.url;
    }

    console.warn('[ImageGen] No image in response');
    return null;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      console.warn('[ImageGen] Request timed out');
    } else {
      console.error('[ImageGen] Error:', error);
    }
    return null;
  }
};

/**
 * Build a descriptive prompt for educational slide illustrations.
 * All images use the app's green (#009e60) and brown (#4b371c) brand palette.
 */
const buildPrompt = (
  context: string,
  style: 'hero' | 'section' | 'activity' | 'materials' | 'evaluation' | 'celebration' = 'section'
): string => {
  const baseStyle = `Professional, vibrant educational illustration for a premium PowerPoint presentation.
Modern flat vector design with soft gradients and clean rounded shapes.
Primary color palette: rich green (#009e60), warm brown (#4b371c), soft gold/yellow (#F4B400), clean white backgrounds.
Setting: African/Cameroonian elementary school with diverse young Black children.
IMPORTANT: Absolutely NO text, NO words, NO letters, NO numbers, NO writing overlaid on the image. Pure illustration ONLY.
High quality, crisp, polished artwork, suitable as a professional PowerPoint slide image.`;

  switch (style) {
    case 'hero':
      return `Create a wide, stunning hero cover illustration for a mathematics PowerPoint presentation.
${context}
${baseStyle}
Wide panoramic composition (16:9). Vibrant, warm, and extremely inviting. Premium quality educational poster feel.
Include subtle mathematical elements (rulers, geometric shapes, chalk boards) woven naturally into the scene.
Use a lush green and warm brown color scheme to feel natural and African-inspired.`;

    case 'activity':
      return `Create an illustration showing African children engaged in a hands-on math learning activity.
${context}
${baseStyle}
Show students actively collaborating and learning together with a caring teacher. Warm, encouraging classroom atmosphere.
Medium shot composition showing engagement and discovery. Green and brown tones should dominate the palette.`;

    case 'materials':
      return `Create a beautifully arranged flat-lay or tabletop illustration of mathematics learning materials.
${context}
${baseStyle}
Show neatly arranged educational supplies: books, pencils, rulers, counting blocks, shapes, chalk, small chalkboard.
Clean, organized composition. Use green accents and warm brown wooden table/desk surface. Birds-eye or slightly angled view.`;

    case 'evaluation':
      return `Create an encouraging illustration showing a teacher gently reviewing student work.
${context}
${baseStyle}
Show a warm, caring African teacher looking over a child's notebook with a smile. The child looks hopeful.
Include a checkmark or star motif to suggest assessment. Green classroom accents, brown wooden furniture.`;

    case 'celebration':
      return `Create a joyful, uplifting illustration of African children celebrating a learning achievement.
${context}
${baseStyle}
Triumphant, happy atmosphere. Children smiling, clapping, or showing excitement. A proud teacher nearby.
Include subtle mathematical decorative elements. Warm golden lighting with green accents.`;

    default:
      return `Create a clean, appealing illustration for an educational presentation slide in an African/Cameroonian school.
${context}
${baseStyle}
Professional and visually engaging, suitable for a classroom presentation. Warm green and brown tones.`;
  }
};

/**
 * Generate all images needed for a standard lesson plan PowerPoint.
 * Generates an image for EVERY slide for complete visual coverage.
 */
export const generateLessonPlanImages = async (
  topic: string,
  level: string,
  sections: Array<{ title: string; teacherActivities?: string[]; learnerActivities?: string[] }>,
  onProgress?: (message: string) => void
): Promise<Record<string, string | null>> => {
  onProgress?.('Generating AI images for your presentation...');

  const prompts: Array<{ key: string; prompt: string; ratio: string }> = [
    // Title hero
    {
      key: 'title',
      prompt: buildPrompt(
        `Topic: "${topic}" for ${level} students in Cameroon. Show young African children excitedly discovering math concepts in a bright, colorful Cameroonian classroom. The teacher is at the front near a green chalkboard. Include visual representations of the math topic naturally in the scene.`,
        'hero'
      ),
      ratio: '16:9',
    },
    // Objectives
    {
      key: 'objectives',
      prompt: buildPrompt(
        `Cameroonian classroom scene: students raising hands with enthusiasm, eager to learn about "${topic}".
A warm, caring female teacher in green attire at the front with a pointer. Bright, motivating learning environment with green walls.`,
        'section'
      ),
      ratio: '4:3',
    },
    // Materials
    {
      key: 'materials',
      prompt: buildPrompt(
        `Mathematics materials for a lesson about "${topic}": textbooks, exercise books, pencils, rulers, counting beads, wooden shapes, a small green chalkboard, chalk, flashcards.
Arranged neatly on a brown wooden desk in a Cameroonian classroom.`,
        'materials'
      ),
      ratio: '4:3',
    },
  ];

  // Section images — generate for EACH section (teacher + learner per section share the same image)
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const teacherHint = section.teacherActivities?.[0]?.substring(0, 120) || '';
    const learnerHint = section.learnerActivities?.[0]?.substring(0, 120) || '';

    prompts.push({
      key: `section_teacher_${i}`,
      prompt: buildPrompt(
        `Scene showing the TEACHER leading the "${section.title}" phase of a math lesson on "${topic}".
The teacher is demonstrating concepts on a green chalkboard or guiding students. ${teacherHint ? `Activity: ${teacherHint}` : ''}
Show the teacher actively engaged with the full class in a Cameroonian school.`,
        'activity'
      ),
      ratio: '4:3',
    });

    prompts.push({
      key: `section_learner_${i}`,
      prompt: buildPrompt(
        `Scene showing young STUDENTS working on the "${section.title}" phase of a "${topic}" lesson.
Children collaborating at their desks, writing in notebooks, using manipulatives. ${learnerHint ? `Activity: ${learnerHint}` : ''}
Engaged expressions, a warm supportive Cameroonian classroom with green walls.`,
        'activity'
      ),
      ratio: '4:3',
    });
  }

  // Evaluation
  prompts.push({
    key: 'evaluation',
    prompt: buildPrompt(
      `A caring Cameroonian teacher reviewing the students' math work on "${topic}".
She is leaning over a student's desk, smiling encouragingly with a green pen. Other students working at their desks.
Warm assessment scene showing formative evaluation in progress.`,
      'evaluation'
    ),
    ratio: '4:3',
  });

  // Assignment
  prompts.push({
    key: 'assignment',
    prompt: buildPrompt(
      `Students excitedly packing their bags with homework notebooks about "${topic}".
A teacher is handing out assignment sheets at the classroom door. End-of-lesson energy.
Cameroonian school setting, afternoon light. Green school bags and accessories.`,
      'section'
    ),
    ratio: '4:3',
  });

  // Closing
  prompts.push({
    key: 'closing',
    prompt: buildPrompt(
      `Children celebrating together after completing a successful math lesson on "${topic}".
Joyful scene in a Cameroonian school compound. Children high-fiving, clapping, teacher smiling proudly.
Community spirit, warm golden afternoon light. Green school uniforms.`,
      'celebration'
    ),
    ratio: '16:9',
  });

  onProgress?.(`Generating ${prompts.length} AI images — this may take a moment...`);

  // Fire all requests in parallel
  const results = await Promise.allSettled(
    prompts.map(({ key, prompt, ratio }) =>
      generateSlideImage(prompt, ratio).then(img => ({ key, img }))
    )
  );

  const images: Record<string, string | null> = {};
  let successCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      images[result.value.key] = result.value.img;
      if (result.value.img) successCount++;
    }
  }

  if (successCount > 0) {
    onProgress?.(`Generated ${successCount}/${prompts.length} images successfully!`);
  } else {
    onProgress?.('Images could not be generated — proceeding with branded slides.');
  }

  return images;
};

/**
 * Generate all images needed for a story lesson plan PowerPoint.
 * Images for EVERY story slide.
 */
export const generateStoryLessonPlanImages = async (
  topic: string,
  level: string,
  storyTheme: string,
  storySections: Array<{ title: string; storyContent?: string; teacherGuidance?: string[]; studentActivities?: string[] }>,
  onProgress?: (message: string) => void
): Promise<Record<string, string | null>> => {
  onProgress?.('Generating AI story illustrations...');

  const prompts: Array<{ key: string; prompt: string; ratio: string }> = [
    // Title hero
    {
      key: 'title',
      prompt: buildPrompt(
        `A captivating storybook cover for a mathematical story about "${topic}" with theme: "${storyTheme}".
Set in a Cameroonian village or market. Young African children as the main characters, wide-eyed and curious.
Magical, warm storytelling atmosphere with subtle math patterns (shapes, counting items) woven into the environment.
Green vegetation, brown village huts, golden sunlight.`,
        'hero'
      ),
      ratio: '16:9',
    },
    // Characters
    {
      key: 'characters',
      prompt: buildPrompt(
        `Group portrait of diverse young Cameroonian children as main characters of a math adventure story about "${topic}".
Include a warm, friendly female teacher/parent figure. Each child has unique personality through expressions and posture.
Village school compound with green trees and a brown wooden school building in background.`,
        'section'
      ),
      ratio: '4:3',
    },
    // Objectives
    {
      key: 'objectives',
      prompt: buildPrompt(
        `Cameroonian teacher pointing at learning goals on a green chalkboard in a colorful classroom.
Students look up attentively, excited to start a story-based math lesson about "${topic}".
Warm, encouraging educational scene.`,
        'section'
      ),
      ratio: '4:3',
    },
  ];

  // Story section illustrations — one per section
  for (let i = 0; i < storySections.length; i++) {
    const section = storySections[i];
    prompts.push({
      key: `story_${i}`,
      prompt: buildPrompt(
        `Children's storybook illustration for scene: "${section.title}" in a math adventure about "${topic}".
Story: ${section.storyContent?.substring(0, 200) || topic}
Cameroonian setting — show children solving problems together.
Warm, narrative illustration style like a children's picture book with green and brown earth tones.`,
        'section'
      ),
      ratio: '4:3',
    });

    // Activity slides for sections with guidance/activities
    if (section.teacherGuidance?.length || section.studentActivities?.length) {
      prompts.push({
        key: `activity_${i}`,
        prompt: buildPrompt(
          `Students doing a hands-on math activity for "${section.title}" in a "${topic}" lesson.
${section.studentActivities?.[0] ? 'Activity: ' + section.studentActivities[0].substring(0, 100) : ''}
Show children working in small groups, counting objects, drawing, or using manipulatives.
Cameroonian classroom with green walls and wooden desks.`,
          'activity'
        ),
        ratio: '4:3',
      });
    }
  }

  // Practice & assessment
  prompts.push({
    key: 'practice',
    prompt: buildPrompt(
      `Children practicing math problems inspired by a story about "${topic}".
Some students write in notebooks, others use counting objects. Teacher circulates to help.
Bright Cameroonian classroom. Green accents, warm learning environment.`,
      'evaluation'
    ),
    ratio: '4:3',
  });

  // Extensions & culture
  prompts.push({
    key: 'extensions',
    prompt: buildPrompt(
      `Cameroonian families and community members helping children learn math through daily life activities.
A market scene or family compound where elders show counting and measurement to children.
Rich cultural setting with local foods (plantains, groundnuts), baskets, and CFA franc coins.`,
      'section'
    ),
    ratio: '4:3',
  });

  // Closing
  prompts.push({
    key: 'closing',
    prompt: buildPrompt(
      `Joyful conclusion: Cameroonian children celebrating after their "${topic}" math story adventure.
Golden sunset over a village school, children together with families. Achievement and community spirit.
Warm, heartfelt illustration with green trees and brown huts in the background.`,
      'celebration'
    ),
    ratio: '16:9',
  });

  onProgress?.(`Generating ${prompts.length} story illustrations...`);

  const results = await Promise.allSettled(
    prompts.map(({ key, prompt, ratio }) =>
      generateSlideImage(prompt, ratio).then(img => ({ key, img }))
    )
  );

  const images: Record<string, string | null> = {};
  let successCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      images[result.value.key] = result.value.img;
      if (result.value.img) successCount++;
    }
  }

  if (successCount > 0) {
    onProgress?.(`Generated ${successCount}/${prompts.length} story illustrations!`);
  } else {
    onProgress?.('Illustrations could not be generated — proceeding with branded slides.');
  }

  return images;
};
