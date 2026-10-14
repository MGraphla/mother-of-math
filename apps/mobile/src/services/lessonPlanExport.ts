import { Buffer } from "buffer";
import * as Print from "expo-print";
import PptxGenJS from "pptxgenjs";
import { shareBase64File, shareLocalFile } from "../native/shareFile";
import { generateLessonPlanImages, generateLessonPlanPdfImages } from "./imageGeneration";
import { formatAIResponseAsMarkdown } from "./lessonPlan";

// pptxgenjs / jszip expect Node's Buffer when packing the .pptx on Hermes.
if (typeof (globalThis as { Buffer?: typeof Buffer }).Buffer === "undefined") {
  (globalThis as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export type ExportProgress = (message: string) => void;

const PRIMARY = "#009e60";
const BROWN = "#4b371c";
const GOLD = "#F4B400";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const safeFileStem = (topic: string) =>
  topic.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase() || "lesson_plan";

export const parseLessonPlanPayload = (raw: string | object | null | undefined): any | null => {
  if (raw == null) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw.trim().replace(/^```[a-zA-Z]*\s*|```\s*$/gm, "")) : raw;
    const plan = (parsed as any)?.lessonPlan ?? parsed;
    if (!plan || typeof plan !== "object") return null;
    return plan;
  } catch {
    return null;
  }
};

const toDataUrl = (src: string) =>
  src.startsWith("data:") || src.startsWith("http") ? src : `data:image/png;base64,${src}`;

const imgTag = (src: string | null | undefined, className: string) =>
  src ? `<div class="${className}"><img src="${toDataUrl(src)}" /></div>` : "";

/** Branded HTML used by expo-print — mirrors the web PDF tables, including AI illustrations. */
export const buildStructuredLessonPlanHtml = (
  lessonPlan: any,
  topic: string,
  level: string,
  images: Record<string, string | null> = {},
) => {
  const title = escapeHtml(lessonPlan.title || topic || "Lesson Plan");
  const grade = escapeHtml(lessonPlan.gradeLevel || level || "—");
  const subject = escapeHtml(lessonPlan.subject || "Mathematics");
  const topicLabel = escapeHtml(lessonPlan.topic || topic || "—");
  const previous = escapeHtml(lessonPlan.previousKnowledge || "—");
  const objectives = Array.isArray(lessonPlan.lessonObjectives)
    ? lessonPlan.lessonObjectives.map((o: string) => `<li>${escapeHtml(o)}</li>`).join("")
    : "";
  const materials = Array.isArray(lessonPlan.materials)
    ? lessonPlan.materials.map((m: string) => `<li>${escapeHtml(m)}</li>`).join("")
    : "";

  const sections = Array.isArray(lessonPlan.sections) ? lessonPlan.sections : [];
  const sectionRows = sections
    .map((sec: any) => {
      const stage = `${escapeHtml(sec.title || "Section")}${sec.duration ? `<br/><span class="dur">${escapeHtml(sec.duration)}</span>` : ""}`;
      const content = escapeHtml(sec.content || "").replace(/\n/g, "<br/>");
      const teacher = Array.isArray(sec.teacherActivities)
        ? sec.teacherActivities.map((a: string) => `• ${escapeHtml(a)}`).join("<br/>")
        : "—";
      const learner = Array.isArray(sec.learnerActivities)
        ? sec.learnerActivities.map((a: string) => `• ${escapeHtml(a)}`).join("<br/>")
        : "—";
      return `<tr>
        <td class="stage">${stage}</td>
        <td>${content || "—"}</td>
        <td>${teacher}</td>
        <td>${learner}</td>
      </tr>`;
    })
    .join("");

  const evaluation = escapeHtml(lessonPlan.evaluation?.description || "");
  const assignment = escapeHtml(lessonPlan.assignment?.description || "").replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 18mm 12mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.45; }
    .banner { background: ${PRIMARY}; color: #fff; padding: 14px 16px; border-radius: 10px 10px 0 0; }
    .banner h1 { margin: 0; font-size: 18px; }
    .banner p { margin: 4px 0 0; opacity: 0.92; font-size: 12px; }
    .gold { height: 4px; background: ${GOLD}; margin-bottom: 16px; }
    h2 { color: ${BROWN}; font-size: 14px; margin: 18px 0 8px; }
    table.meta, table.body { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.meta td { border: 1px solid #d1d5db; padding: 7px 8px; vertical-align: top; }
    table.meta td.label { width: 28%; background: ${PRIMARY}; color: #fff; font-weight: bold; }
    table.body th { background: ${PRIMARY}; color: #fff; padding: 8px; text-align: left; font-size: 10px; }
    table.body td { border: 1px solid #c8c8c8; padding: 7px; vertical-align: top; font-size: 10px; }
    td.stage { background: #E6F7EE; font-weight: bold; width: 18%; color: ${BROWN}; }
    .dur { font-weight: normal; color: #4b5563; font-size: 9px; }
    ul { margin: 0; padding-left: 16px; }
    .hero-img, .mid-img { text-align: center; margin: 10px 0 14px; }
    .hero-img img { width: 100%; height: auto; border-radius: 8px; border: 3px solid ${PRIMARY}; }
    .mid-img img { width: 68%; height: auto; border-radius: 8px; border: 3px solid ${PRIMARY}; }
    .footer { margin-top: 20px; font-size: 9px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="banner">
    <h1>Mother of Math | Lesson Plan</h1>
    <p>${topicLabel} · ${grade}</p>
  </div>
  <div class="gold"></div>
  ${imgTag(images.hero, "hero-img")}

  <h2>Preamble</h2>
  <table class="meta">
    <tr><td class="label">Title</td><td>${title}</td></tr>
    <tr><td class="label">Grade Level</td><td>${grade}</td></tr>
    <tr><td class="label">Subject</td><td>${subject}</td></tr>
    <tr><td class="label">Topic</td><td>${topicLabel}</td></tr>
    <tr><td class="label">Previous Knowledge</td><td>${previous}</td></tr>
  </table>

  <h2>Lesson Objectives</h2>
  <ul>${objectives || "<li>—</li>"}</ul>

  <h2>Materials</h2>
  <ul>${materials || "<li>—</li>"}</ul>

  <h2>Lesson Body</h2>
  <table class="body">
    <thead>
      <tr>
        <th>Stages / Duration</th>
        <th>Content</th>
        <th>Teacher's Activities</th>
        <th>Pupil's Activities</th>
      </tr>
    </thead>
    <tbody>
      ${sectionRows || `<tr><td colspan="4">No sections</td></tr>`}
    </tbody>
  </table>

  ${imgTag(images.presentation, "mid-img")}

  ${
    evaluation
      ? `<h2>Evaluation Summary</h2><p>${evaluation.replace(/\n/g, "<br/>")}</p>`
      : ""
  }
  ${assignment ? `<h2>Assignment</h2><p>${assignment}</p>` : ""}
  ${imgTag(images.evaluation, "mid-img")}

  <p class="footer">Mothers for Mathematics · Curriculum-aligned lesson plan</p>
</body>
</html>`;
};

const buildMarkdownFallbackHtml = (markdown: string, topic: string, level: string) => {
  const body = escapeHtml(markdown).replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Helvetica,Arial,sans-serif;padding:24px;color:#1f2937;font-size:12px;line-height:1.45}
    .banner{background:${PRIMARY};color:#fff;padding:14px 16px;border-radius:10px;margin-bottom:14px}
    .banner h1{margin:0;font-size:18px}.banner p{margin:4px 0 0;opacity:.9}
  </style></head><body>
  <div class="banner"><h1>Mother of Math | Lesson Plan</h1><p>${escapeHtml(topic)} · ${escapeHtml(level)}</p></div>
  <div>${body}</div></body></html>`;
};

export const exportLessonPlanPdf = async (
  rawJson: string | object | null | undefined,
  topic: string,
  level: string,
  markdownFallback?: string,
  onProgress?: ExportProgress,
  cachedImages?: Record<string, string | null>,
) => {
  onProgress?.("Generating AI images for your PDF...");
  const plan = parseLessonPlanPayload(rawJson);
  let images = cachedImages ?? {};
  if (!cachedImages?.hero && !cachedImages?.presentation && !cachedImages?.evaluation) {
    try {
      images = await generateLessonPlanPdfImages(topic, level, onProgress);
    } catch {
      onProgress?.("Image generation unavailable — building PDF...");
    }
  }

  onProgress?.("Building your PDF document…");
  const html = plan
    ? buildStructuredLessonPlanHtml(plan, topic, level, images)
    : buildMarkdownFallbackHtml(
        markdownFallback || formatAIResponseAsMarkdown(typeof rawJson === "string" ? rawJson : JSON.stringify(rawJson ?? {})),
        topic,
        level,
      );

  onProgress?.("Rendering PDF…");
  const printed = await Print.printToFileAsync({ html, base64: true });
  const fileName = `${safeFileStem(topic)}_lesson_plan.pdf`;

  onProgress?.("Saving to your phone…");
  if (printed.base64) {
    await shareBase64File(printed.base64, fileName, "application/pdf");
  } else {
    await shareLocalFile(printed.uri, fileName, "application/pdf");
  }
  onProgress?.("PDF saved to your phone.");
  return fileName;
};

export const exportLessonPlanPptx = async (
  rawJson: string | object | null | undefined,
  topic: string,
  level: string,
  markdownFallback?: string,
  onProgress?: ExportProgress,
) => {
  onProgress?.("Building your PowerPoint presentation…");

  const plan = parseLessonPlanPayload(rawJson);
  let images: Record<string, string | null> = {};
  if (plan) {
    try {
      images = await generateLessonPlanImages(
        topic,
        level || plan.gradeLevel || "",
        Array.isArray(plan.sections) ? plan.sections : [],
        onProgress,
      );
    } catch {
      onProgress?.("Image generation unavailable — creating branded slides...");
    }
  }

  const pptx = new PptxGenJS();
  const PRIMARY_HEX = "009e60";
  const PRIMARY_DK = "007a4a";
  const BROWN_HEX = "4b371c";
  const GOLD_HEX = "F4B400";
  const DARK = "1a1a2e";
  const LIGHT = "ffffff";
  const BG = "F0FFF4";
  const BG_WARM = "FFF8F0";
  const MID = "333333";

  pptx.defineLayout({ name: "MAMA_MATH", width: 10, height: 5.625 });
  pptx.layout = "MAMA_MATH";
  pptx.author = "Mother of Math";
  pptx.company = "Mothers for Mathematics";
  pptx.subject = topic;
  pptx.title = `Lesson Plan: ${topic}`;

  const addHeader = (slide: PptxGenJS.Slide, title: string, color = PRIMARY_HEX) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.65, fill: { color } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.65, w: 10, h: 0.04, fill: { color: GOLD_HEX } });
    slide.addText(title, {
      x: 0.4,
      y: 0.05,
      w: 9.2,
      h: 0.55,
      fontSize: 18,
      color: LIGHT,
      bold: true,
      fontFace: "Arial",
      valign: "middle",
    });
  };

  const addFooter = (slide: PptxGenJS.Slide) => {
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 5.15, w: 10, h: 0.03, fill: { color: PRIMARY_HEX } });
    slide.addText("MOTHER OF MATH", {
      x: 0.4,
      y: 5.22,
      w: 3.5,
      h: 0.3,
      fontSize: 9,
      color: PRIMARY_HEX,
      bold: true,
      fontFace: "Arial",
    });
    slide.addText("Mothers for Mathematics", {
      x: 5.5,
      y: 5.22,
      w: 4,
      h: 0.3,
      fontSize: 8,
      color: "999999",
      fontFace: "Arial",
      align: "right",
    });
  };

  const addSlideImage = (
    slide: PptxGenJS.Slide,
    imageData: string | null | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!imageData) return;
    try {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: x - 0.05,
        y: y - 0.05,
        w: w + 0.1,
        h: h + 0.1,
        fill: { color: PRIMARY_HEX },
      });
      slide.addImage({
        data: toDataUrl(imageData),
        x,
        y,
        w,
        h,
        sizing: { type: "cover", w, h },
      });
    } catch {
      // Skip a failed illustration so the rest of the deck still exports.
    }
  };

  if (plan) {
    // Title
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: DARK };
    titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 5.2, h: 5.625, fill: { color: PRIMARY_HEX } });
    titleSlide.addShape(pptx.ShapeType.line, {
      x: 0.5,
      y: 0.85,
      w: 2.2,
      h: 0,
      line: { color: GOLD_HEX, width: 3 },
    });
    titleSlide.addText("MOTHER OF MATH", {
      x: 0.5,
      y: 1.0,
      w: 4.2,
      h: 0.35,
      fontSize: 12,
      color: GOLD_HEX,
      bold: true,
      fontFace: "Arial",
    });
    titleSlide.addText(plan.title || topic, {
      x: 0.5,
      y: 1.6,
      w: 4.2,
      h: 1.6,
      fontSize: 28,
      color: LIGHT,
      bold: true,
      fontFace: "Arial",
      valign: "top",
    });
    titleSlide.addText(`${plan.gradeLevel || level || ""}\n${plan.subject || "Mathematics"}`, {
      x: 0.5,
      y: 3.5,
      w: 4.2,
      h: 0.9,
      fontSize: 14,
      color: LIGHT,
      fontFace: "Arial",
    });
    titleSlide.addText("Curriculum-aligned lesson plan", {
      x: 5.6,
      y: images.title ? 4.9 : 2.3,
      w: 3.8,
      h: 0.4,
      fontSize: 12,
      color: LIGHT,
      fontFace: "Arial",
    });
    addSlideImage(titleSlide, images.title, 5.35, 0.35, 4.35, 4.4);

    // Objectives
    const objSlide = pptx.addSlide();
    objSlide.background = { color: BG };
    addHeader(objSlide, "Lesson Objectives");
    const objectives = Array.isArray(plan.lessonObjectives) ? plan.lessonObjectives : [];
    objSlide.addText(
      objectives.length
        ? objectives.map((text: string) => ({ text, options: { bullet: true } }))
        : [{ text: "No objectives listed", options: { bullet: false } }],
      {
        x: 0.6,
        y: 1.0,
        w: images.objectives ? 5.4 : 8.8,
        h: 3.6,
        fontSize: 16,
        color: MID,
        fontFace: "Arial",
        paraSpaceAfter: 8,
      },
    );
    addSlideImage(objSlide, images.objectives, 6.3, 0.9, 3.2, 3.9);
    addFooter(objSlide);

    // Materials
    const matSlide = pptx.addSlide();
    matSlide.background = { color: BG };
    addHeader(matSlide, "Materials");
    const materials = Array.isArray(plan.materials) ? plan.materials : [];
    matSlide.addText(
      materials.length
        ? materials.map((text: string) => ({ text, options: { bullet: true } }))
        : [{ text: "No materials listed", options: { bullet: false } }],
      {
        x: 0.6,
        y: 1.0,
        w: images.materials ? 5.4 : 8.8,
        h: 3.6,
        fontSize: 16,
        color: MID,
        fontFace: "Arial",
        paraSpaceAfter: 8,
      },
    );
    addSlideImage(matSlide, images.materials, 6.3, 0.9, 3.2, 3.9);
    addFooter(matSlide);

    // Sections — teacher + learner slides
    const sections = Array.isArray(plan.sections) ? plan.sections : [];
    for (const [idx, sec] of sections.entries()) {
      const teacherImg = images[`section_teacher_${idx}`];
      const learnerImg = images[`section_learner_${idx}`];
      const teacherSlide = pptx.addSlide();
      teacherSlide.background = { color: BG };
      addHeader(teacherSlide, `${sec.title || "Section"} · Teacher`, PRIMARY_HEX);
      teacherSlide.addText(sec.duration ? String(sec.duration) : "", {
        x: 0.5,
        y: 0.8,
        w: teacherImg ? 5.5 : 9,
        h: 0.3,
        fontSize: 12,
        color: BROWN_HEX,
        bold: true,
        fontFace: "Arial",
      });
      teacherSlide.addText(sec.content || "", {
        x: 0.5,
        y: 1.15,
        w: teacherImg ? 5.5 : 9,
        h: 1.5,
        fontSize: 13,
        color: MID,
        fontFace: "Arial",
        valign: "top",
      });
      const teacherActs = Array.isArray(sec.teacherActivities) ? sec.teacherActivities : [];
      teacherSlide.addText("Teacher's Activities", {
        x: 0.5,
        y: 2.75,
        w: teacherImg ? 5.5 : 9,
        h: 0.3,
        fontSize: 13,
        color: PRIMARY_DK,
        bold: true,
        fontFace: "Arial",
      });
      teacherSlide.addText(
        teacherActs.length
          ? teacherActs.map((text: string) => ({ text, options: { bullet: true } }))
          : [{ text: "—", options: { bullet: false } }],
        {
          x: 0.5,
          y: 3.1,
          w: teacherImg ? 5.5 : 9,
          h: 1.7,
          fontSize: 13,
          color: MID,
          fontFace: "Arial",
        },
      );
      addSlideImage(teacherSlide, teacherImg, 6.3, 0.9, 3.2, 3.8);
      addFooter(teacherSlide);

      const learnerSlide = pptx.addSlide();
      learnerSlide.background = { color: BG_WARM };
      addHeader(learnerSlide, `${sec.title || "Section"} · Learners`, BROWN_HEX);
      const learnerActs = Array.isArray(sec.learnerActivities) ? sec.learnerActivities : [];
      learnerSlide.addText(
        learnerActs.length
          ? learnerActs.map((text: string) => ({ text, options: { bullet: true } }))
          : [{ text: "—", options: { bullet: false } }],
        {
          x: 0.6,
          y: 1.0,
          w: learnerImg ? 5.4 : 8.8,
          h: 3.6,
          fontSize: 16,
          color: MID,
          fontFace: "Arial",
          paraSpaceAfter: 8,
        },
      );
      addSlideImage(learnerSlide, learnerImg, 6.3, 0.9, 3.2, 3.8);
      addFooter(learnerSlide);
    }

    if (plan.evaluation?.description) {
      const evalSlide = pptx.addSlide();
      evalSlide.background = { color: BG };
      addHeader(evalSlide, "Evaluation");
      evalSlide.addText(String(plan.evaluation.description), {
        x: 0.6,
        y: 1.0,
        w: images.evaluation ? 5.4 : 8.8,
        h: 3.6,
        fontSize: 15,
        color: MID,
        fontFace: "Arial",
        valign: "top",
      });
      addSlideImage(evalSlide, images.evaluation, 6.3, 0.9, 3.2, 3.9);
      addFooter(evalSlide);
    }

    if (plan.assignment?.description) {
      const assignSlide = pptx.addSlide();
      assignSlide.background = { color: BG };
      addHeader(assignSlide, "Assignment");
      assignSlide.addText(String(plan.assignment.description), {
        x: 0.6,
        y: 1.0,
        w: images.assignment ? 5.4 : 8.8,
        h: 3.6,
        fontSize: 15,
        color: MID,
        fontFace: "Arial",
        valign: "top",
      });
      addSlideImage(assignSlide, images.assignment, 6.3, 0.9, 3.2, 3.9);
      addFooter(assignSlide);
    }

    // Closing
    const end = pptx.addSlide();
    end.background = { color: PRIMARY_HEX };
    end.addText("Thank you", {
      x: 0.5,
      y: images.closing ? 1.5 : 2.0,
      w: 9,
      h: 0.7,
      fontSize: 36,
      color: LIGHT,
      bold: true,
      align: "center",
      fontFace: "Arial",
    });
    end.addText("Mother of Math · Mothers for Mathematics", {
      x: 0.5,
      y: images.closing ? 2.2 : 2.8,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: GOLD_HEX,
      align: "center",
      fontFace: "Arial",
    });
    addSlideImage(end, images.closing, 2.4, 2.85, 5.2, 2.0);
  } else {
    // Markdown/text fallback — chunk into slides
    const text =
      markdownFallback ||
      formatAIResponseAsMarkdown(typeof rawJson === "string" ? rawJson : JSON.stringify(rawJson ?? {}));
    const chunks = text.split(/\n(?=# )/).filter(Boolean);
    const pieces = chunks.length ? chunks : [text];
    pieces.forEach((chunk, i) => {
      const slide = pptx.addSlide();
      slide.background = { color: BG };
      addHeader(slide, i === 0 ? topic || "Lesson Plan" : `Part ${i + 1}`);
      slide.addText(chunk.slice(0, 1800), {
        x: 0.5,
        y: 0.9,
        w: 9,
        h: 3.9,
        fontSize: 13,
        color: MID,
        fontFace: "Arial",
        valign: "top",
      });
      addFooter(slide);
    });
  }

  onProgress?.("Saving to your phone…");
  const output = await pptx.write({ outputType: "base64" });
  const base64 = typeof output === "string" ? output : String(output);
  const fileName = `${safeFileStem(topic)}_lesson_plan.pptx`;
  await shareBase64File(
    base64,
    fileName,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  onProgress?.("PowerPoint saved to your phone.");
  return fileName;
};

/** @deprecated Prefer structured exporters; kept for older call sites. */
export const buildLessonPlanHtml = (markdown: string, topic: string, level: string) =>
  buildMarkdownFallbackHtml(markdown, topic, level);
