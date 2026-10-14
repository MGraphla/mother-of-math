import { supabase } from "../lib/supabase";

const IMAGE_MODEL = "google/gemini-3-pro-image-preview";
const REQUEST_TIMEOUT_MS = 60_000;

export const ASPECT_RATIOS = [
  { id: "portrait", label: "Portrait", ratio: "9:16" },
  { id: "classic", label: "Classic", ratio: "4:3" },
  { id: "tall", label: "Tall", ratio: "3:4" },
  { id: "wide", label: "Wide", ratio: "16:9" },
] as const;

export const ART_STYLES = [
  { id: "illustration", label: "Illustration" },
  { id: "realistic", label: "Realistic" },
  { id: "cartoon", label: "Cartoon" },
  { id: "watercolor", label: "Watercolor" },
  { id: "sketch", label: "Sketch" },
] as const;

export const QUICK_IDEAS = [
  "African children counting with beads in a bright classroom",
  "Teacher explaining fractions with fruit slices on a chalkboard",
  "Students measuring the playground with a long tape measure",
  "Colorful geometry shapes arranged on a wooden desk",
  "Children celebrating solving a math puzzle together",
] as const;

export const DAILY_IMAGE_LIMIT = 5;

const STYLE_PHRASES: Record<string, string> = {
  illustration: "modern flat vector educational illustration with soft gradients",
  realistic: "photorealistic educational scene, natural lighting",
  cartoon: "friendly cartoon style for primary school children",
  watercolor: "soft watercolor educational artwork",
  sketch: "clean hand-drawn sketch illustration",
};

/** Brand-aware prompt enhancement matching the web Generate Images page. */
export const enhanceImagePrompt = (
  basePrompt: string,
  styleId: string,
  fromSketch = false,
): string => {
  const style = STYLE_PHRASES[styleId] || STYLE_PHRASES.illustration;
  if (fromSketch) {
    return `Look at the attached teacher sketch and recreate ONLY what is drawn as a polished illustration.
${basePrompt.trim()}

Faithfulness rules (required):
- Same subjects, shapes, stick figures, lines, and layout as the sketch.
- Do not add objects that are not in the sketch: no fridge, no extra furniture, no extra people, no classroom, no scenery unless it is clearly drawn.
- If the sketch is simple or abstract, polish those exact marks. Do not replace them with a different invented scene.
Style: ${style}.
IMPORTANT: Absolutely NO text, NO words, NO letters, NO numbers overlaid on the image.`;
  }

  return `${basePrompt.trim()}.
Style: ${style}.
Primary color palette: rich green (#009e60), warm brown (#4b371c), soft gold (#F4B400), clean backgrounds.
Setting: African/Cameroonian elementary school with diverse young Black children and a caring teacher when people are shown.
IMPORTANT: Absolutely NO text, NO words, NO letters, NO numbers overlaid on the image. Pure illustration ONLY.
High quality, crisp, polished educational artwork.`;
};

/**
 * Generate an image via Supabase openrouter-proxy (Gemini image preview),
 * same model path as the web app.
 */
export const generateSlideImage = async (
  prompt: string,
  aspectRatio = "4:3",
  referenceImage?: string,
): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("You must be signed in to generate images.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const { data, error } = await supabase.functions.invoke("openrouter-proxy", {
      body: {
        openrouter: {
          model: IMAGE_MODEL,
          n: 1,
          messages: [
            {
              role: "user",
              content: referenceImage
                ? [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: referenceImage } },
                  ]
                : prompt,
            },
          ],
          modalities: ["image", "text"],
          stream: false,
          image_config: {
            aspect_ratio: aspectRatio,
            image_size: "1K",
          },
        },
        client_referer: "motherofmath://",
        client_title: "Mother of Math Mobile - Image Generator",
      },
    });

    clearTimeout(timeout);
    if (error) throw new Error(error.message || "Image generation failed.");

    const message = data?.choices?.[0]?.message;
    if (message?.images?.[0]?.image_url?.url) return message.images[0].image_url.url;
    if (typeof message?.content === "string") {
      const match = message.content.match(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/);
      if (match) return match[0];
    }
    return null;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") throw new Error("Image generation timed out. Please try again.");
    throw err;
  }
};

const tryGenerateSlideImage = async (prompt: string, aspectRatio: string): Promise<string | null> => {
  try {
    return await generateSlideImage(prompt, aspectRatio);
  } catch {
    return null;
  }
};

const lessonArtStyle = `Professional, vibrant educational illustration. Modern flat vector design with soft gradients.
Primary color palette: rich green (#009e60), warm brown (#4b371c), gold (#F4B400), white.
Setting: African/Cameroonian elementary school with diverse young Black children.
IMPORTANT: Absolutely NO text, NO words, NO letters, NO numbers overlaid on the image. Pure illustration ONLY.
High quality, crisp, polished educational artwork.`;

/** Three illustrations used in the web PDF (hero, presentation, evaluation). */
export const generateLessonPlanPdfImages = async (
  topic: string,
  level: string,
  onProgress?: (message: string) => void,
): Promise<Record<string, string | null>> => {
  onProgress?.("Generating 3 AI illustrations — this may take a moment…");

  const prompts = [
    {
      key: "hero",
      ratio: "16:9",
      prompt: `Create a wide, stunning hero illustration for a mathematics lesson about "${topic}" for ${level} students in Cameroon. Show young African children excitedly learning math in a bright, colorful classroom. Include a teacher at a green chalkboard. ${lessonArtStyle} Wide panoramic composition (16:9). Premium educational poster quality.`,
    },
    {
      key: "presentation",
      ratio: "4:3",
      prompt: `Create an illustration showing a caring African teacher demonstrating math concepts about "${topic}" on a green chalkboard to eager ${level} students. Children raising hands, classroom has math posters on walls. ${lessonArtStyle} Medium shot showing teacher-student interaction.`,
    },
    {
      key: "evaluation",
      ratio: "4:3",
      prompt: `Create an encouraging illustration of African children writing exercises in their notebooks during a math class about "${topic}". A teacher walks between desks checking work with a warm smile. ${lessonArtStyle} Warm assessment scene.`,
    },
  ];

  const results = await Promise.allSettled(
    prompts.map(({ key, prompt, ratio }) =>
      tryGenerateSlideImage(prompt, ratio).then((img) => ({ key, img })),
    ),
  );

  const images: Record<string, string | null> = {};
  let successCount = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      images[result.value.key] = result.value.img;
      if (result.value.img) successCount++;
    }
  }

  if (successCount > 0) {
    onProgress?.(`Generated ${successCount}/3 images successfully!`);
  } else {
    onProgress?.("Images could not be generated — proceeding with branded PDF.");
  }

  return images;
};

/** Full slide set used by the web PowerPoint exporter. */
export const generateLessonPlanImages = async (
  topic: string,
  level: string,
  sections: Array<{ title: string; teacherActivities?: string[]; learnerActivities?: string[] }>,
  onProgress?: (message: string) => void,
): Promise<Record<string, string | null>> => {
  onProgress?.("Generating AI images for your presentation…");

  const prompts: Array<{ key: string; prompt: string; ratio: string }> = [
    {
      key: "title",
      ratio: "16:9",
      prompt: `Create a wide, stunning hero cover illustration for a mathematics PowerPoint presentation. Topic: "${topic}" for ${level} students in Cameroon. Show young African children excitedly discovering math concepts in a bright classroom. The teacher is at the front near a green chalkboard. ${lessonArtStyle} Wide panoramic composition (16:9).`,
    },
    {
      key: "objectives",
      ratio: "4:3",
      prompt: `Cameroonian classroom scene: students raising hands with enthusiasm, eager to learn about "${topic}". A warm, caring teacher in green attire at the front. ${lessonArtStyle}`,
    },
    {
      key: "materials",
      ratio: "4:3",
      prompt: `Mathematics materials for a lesson about "${topic}": textbooks, exercise books, pencils, rulers, counting beads, wooden shapes, a small green chalkboard. Arranged neatly on a brown wooden desk. ${lessonArtStyle}`,
    },
  ];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const teacherHint = section.teacherActivities?.[0]?.substring(0, 120) || "";
    const learnerHint = section.learnerActivities?.[0]?.substring(0, 120) || "";
    prompts.push({
      key: `section_teacher_${i}`,
      ratio: "4:3",
      prompt: `Scene showing the TEACHER leading the "${section.title}" phase of a math lesson on "${topic}". The teacher is demonstrating concepts on a green chalkboard. ${teacherHint ? `Activity: ${teacherHint}` : ""} ${lessonArtStyle}`,
    });
    prompts.push({
      key: `section_learner_${i}`,
      ratio: "4:3",
      prompt: `Scene showing young STUDENTS working on the "${section.title}" phase of a "${topic}" lesson. Children collaborating at their desks. ${learnerHint ? `Activity: ${learnerHint}` : ""} ${lessonArtStyle}`,
    });
  }

  prompts.push(
    {
      key: "evaluation",
      ratio: "4:3",
      prompt: `A caring Cameroonian teacher reviewing the students' math work on "${topic}". She is leaning over a student's desk, smiling encouragingly. ${lessonArtStyle}`,
    },
    {
      key: "assignment",
      ratio: "4:3",
      prompt: `Students packing their bags with homework notebooks about "${topic}". A teacher is handing out assignment sheets. ${lessonArtStyle}`,
    },
    {
      key: "closing",
      ratio: "16:9",
      prompt: `Children celebrating together after completing a successful math lesson on "${topic}". Joyful scene, high-fives, teacher smiling proudly. ${lessonArtStyle}`,
    },
  );

  onProgress?.(`Generating ${prompts.length} AI images — this may take a moment…`);

  const results = await Promise.allSettled(
    prompts.map(({ key, prompt, ratio }) =>
      tryGenerateSlideImage(prompt, ratio).then((img) => ({ key, img })),
    ),
  );

  const images: Record<string, string | null> = {};
  let successCount = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      images[result.value.key] = result.value.img;
      if (result.value.img) successCount++;
    }
  }

  if (successCount > 0) {
    onProgress?.(`Generated ${successCount}/${prompts.length} images successfully!`);
  } else {
    onProgress?.("Images could not be generated — proceeding with branded slides.");
  }

  return images;
};
