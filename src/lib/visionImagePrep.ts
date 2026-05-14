/**
 * Prepares images for vision-model APIs (OpenRouter / Claude, etc.).
 * Full-resolution phone photos (multi‑MB JPEGs) often exceed provider limits
 * or trigger generic errors like "Provider returned error" when combined with
 * `detail: "high"`. We downscale and JPEG‑encode to a safe payload while
 * keeping enough resolution for handwriting.
 */

const VISION_MAX_LONG_EDGE = 2200;
const MAX_DATA_URL_CHARS = 1_750_000; // ~1.3MB binary — stays under typical gateway limits

function drawToCanvas(
  source: CanvasImageSource,
  sw: number,
  sh: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  let w = sw;
  let h = sh;
  const max = VISION_MAX_LONG_EDGE;
  if (w > max || h > max) {
    if (w >= h) {
      h = Math.round((h * max) / w);
      w = max;
    } else {
      w = Math.round((w * max) / h);
      h = max;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  ctx.drawImage(source, 0, 0, w, h);
  return { canvas };
}

function jpegDataUrlUnderBudget(canvas: HTMLCanvasElement): string {
  let quality = 0.9;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.52) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}

/** FileReader + HTMLImageElement fallback when createImageBitmap fails. */
function resizeViaImageElement(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const sw = img.naturalWidth || img.width;
          const sh = img.naturalHeight || img.height;
          const { canvas } = drawToCanvas(img, sw, sh);
          resolve(jpegDataUrlUnderBudget(canvas));
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns a `data:image/jpeg;base64,...` URL suitable for `image_url.url`
 * in chat/completions vision requests.
 */
export async function fileToDataUrlForVisionApi(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Vision prep only supports image files");
  }

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      try {
        const { canvas } = drawToCanvas(bitmap, bitmap.width, bitmap.height);
        return jpegDataUrlUnderBudget(canvas);
      } finally {
        bitmap.close();
      }
    } catch {
      // HEIC, some GIFs, or older browsers — fall back
    }
  }

  return resizeViaImageElement(file);
}

/** Re-encode an existing data URL (e.g. from preview) for the vision API. */
export async function dataUrlToPreparedVisionDataUrl(dataUrl: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const file = new File([blob], "vision-input.jpg", { type });
  return fileToDataUrlForVisionApi(file);
}
