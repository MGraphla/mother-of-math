import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Grid3X3,
  Star,
  Lightbulb,
  Settings2,
  ImageIcon,
  Download,
  Heart,
  Trash2,
  Loader2,
  RectangleVertical,
  Square,
  RectangleHorizontal,
  X,
  Share2,
  Pencil,
  Eraser
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { generateSlideImage } from "@/services/imageGeneration";
import { imageStorage } from "@/services/imageStorage";
import { sendMessage } from "@/services/api";
import { cn } from "@/lib/utils";

interface StoredImage {
  id: string;
  user_id: string;
  prompt: string;
  enhanced_prompt: string;
  aspect_ratio: string;
  style: string;
  image_url: string;
  storage_path: string;
  is_favorite: boolean;
  created_at: string;
}

const ASPECT_RATIOS = [
  { id: "portrait", label: "Portrait", icon: RectangleVertical, ratio: "9:16" },
  { id: "classic", label: "Classic", icon: Square, ratio: "4:3" },
  { id: "tall", label: "Tall", icon: RectangleVertical, ratio: "3:4" },
  { id: "wide", label: "Wide", icon: RectangleHorizontal, ratio: "16:9" },
];

const ART_STYLES = [
  { id: "illustration", label: "Illustration", description: "Clean vector-style artwork" },
  { id: "realistic", label: "Realistic", description: "Photorealistic imagery" },
  { id: "cartoon", label: "Cartoon", description: "Fun cartoon style" },
  { id: "watercolor", label: "Watercolor", description: "Soft watercolor painting" },
  { id: "sketch", label: "Sketch", description: "Hand-drawn pencil sketch" },
];

const QUICK_IDEAS = [
  "African children learning mathematics in a colorful classroom",
  "Teacher explaining fractions using colorful pie charts",
  "Learner working together on geometry problems",
  "Children counting with colorful blocks and beads",
  "Math equations on a green chalkboard",
];

const GenerateImages = () => {
  const [activeTab, setActiveTab] = useState("generate");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("classic");
  const [numImages, setNumImages] = useState(1);
  const [artStyle, setArtStyle] = useState("illustration");
  const [isGenerating, setIsGenerating] = useState(false);
  const [gallery, setGallery] = useState<StoredImage[]>([]);
  const [favorites, setFavorites] = useState<StoredImage[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [generationsToday, setGenerationsToday] = useState(0);
  const MAX_GENERATIONS_PER_DAY = 5;

  // Canvas Drawing State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState("#000000");

  // Load gallery images
  const loadGallery = async () => {
    setLoadingGallery(true);
    try {
      const images = await imageStorage.getImages();
      setGallery(images);
      setFavorites(images.filter((img) => img.is_favorite));
      
      // Load current day generations count
      const count = await imageStorage.getGenerationsCountToday();
      setGenerationsToday(count);
    } catch (error) {
      console.error("Failed to load gallery:", error);
    } finally {
      setLoadingGallery(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = penColor === "#ffffff" ? 20 : 3; // Thicker line for eraser
    ctx.lineCap = "round";
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Initialize canvas background when tab changes
  useEffect(() => {
    if (activeTab === "sketch") {
      // Small timeout to allow canvas to render
      setTimeout(clearCanvas, 100);
    }
  }, [activeTab]);

  const handleGenerateFromSketch = async () => {
    if (generationsToday + numImages > MAX_GENERATIONS_PER_DAY) {
      const remaining = Math.max(0, MAX_GENERATIONS_PER_DAY - generationsToday);
      toast.error(`Daily limit reached. You can only generate ${remaining} more images today.`);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    // PNG keeps thin pen strokes sharp; JPEG blurs small sketch lines and confuses vision models.
    const sketchBase64 = canvas.toDataURL("image/png");

    setIsGenerating(true);
    try {
      toast.info("Analyzing your sketch...");
      const description = await sendMessage(
        "Describe only what is drawn in this sketch—shapes, figures, layout, and spatial relationships—so an image model can recreate it faithfully. Do not analyze math mistakes; this is a teacher's rough drawing, not learner homework.",
        sketchBase64,
        "text",
        "sketch-to-image",
      );

      const descText =
        typeof description === "object" && description !== null && "text" in description
          ? String((description as { text: string }).text ?? "").trim()
          : String(description ?? "").trim();

      if (!descText) {
        toast.error("Could not read your sketch. Try drawing with a darker pen or clearer lines, then try again.");
        return;
      }

      const enhancedPrompt = enhancePrompt(descText, true);
      const selectedRatio = ASPECT_RATIOS.find((r) => r.id === aspectRatio)?.ratio || "4:3";

      const generatedImages: string[] = [];
      for (let i = 0; i < numImages; i++) {
        toast.info(`Generating image ${i + 1} of ${numImages} from sketch...`);
        const imageUrl = await generateSlideImage(enhancedPrompt, selectedRatio);
        
        if (imageUrl) {
          const saved = await imageStorage.saveImage(imageUrl, {
            prompt: "Generated from Teacher Sketch",
            enhancedPrompt: enhancedPrompt,
            aspectRatio: selectedRatio,
            style: artStyle,
          });

          if (saved) generatedImages.push(saved.image_url);
        }
      }

      if (generatedImages.length > 0) {
        toast.success(`Generated ${generatedImages.length} image(s) from sketch!`);
        await loadGallery();
        setGenerationsToday(prev => prev + generatedImages.length);
        setActiveTab("gallery");
      } else {
        toast.error("Failed to generate images from sketch. Please try again.");
      }
    } catch (error) {
      console.error("Sketch generation error:", error);
      toast.error("An error occurred while generating images from sketch.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Enhance prompt with style and context
  const enhancePrompt = (basePrompt: string, isFromSketch: boolean = false): string => {
    const styleMap: Record<string, string> = {
      illustration: "Clean vector-style illustration, flat design, modern educational artwork",
      realistic: "Photorealistic, high detail, professional photography style",
      cartoon: "Fun cartoon style, bright colors, child-friendly",
      watercolor: "Soft watercolor painting, artistic, gentle colors",
      sketch: "Hand-drawn pencil sketch, artistic linework",
    };

    const styleText = styleMap[artStyle] || styleMap.illustration;
    
    if (isFromSketch) {
      return `Recreate this scene as a polished illustration. Stay very close to this description—same subjects, composition, and spatial layout: ${basePrompt}

Rendering style: ${styleText}.
If the description is clearly a classroom or school activity, show an African/Cameroonian school setting; if it is something else (diagram, object, nature, abstract layout), keep that subject—do not force a classroom.
Use green (#009e60) and brown (#4b371c) as natural accents where they fit; do not let palette override what is described.
High quality, professional. NO text, NO words, NO letters, NO numbers overlaid on the image.`;
    }

    return `${basePrompt}. ${styleText}. 
Educational setting, African/Cameroonian school context. 
Primary colors: green (#009e60), brown (#4b371c), warm tones.
High quality, professional, suitable for classroom materials.
NO text, NO words, NO letters overlaid on the image.`;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (generationsToday + numImages > MAX_GENERATIONS_PER_DAY) {
      const remaining = MAX_GENERATIONS_PER_DAY - generationsToday;
      toast.error(`Daily limit reached. You can only generate ${remaining > 0 ? remaining : 0} more images today.`);
      return;
    }

    setIsGenerating(true);
    const selectedRatio = ASPECT_RATIOS.find((r) => r.id === aspectRatio)?.ratio || "4:3";
    const enhancedPrompt = enhancePrompt(prompt);

    try {
      const generatedImages: string[] = [];

      for (let i = 0; i < numImages; i++) {
        toast.info(`Generating image ${i + 1} of ${numImages}...`);
        const imageUrl = await generateSlideImage(enhancedPrompt, selectedRatio);

        if (imageUrl) {
          // Save to storage
          const saved = await imageStorage.saveImage(imageUrl, {
            prompt: prompt,
            enhancedPrompt: enhancedPrompt,
            aspectRatio: selectedRatio,
            style: artStyle,
          });

          if (saved) {
            generatedImages.push(saved.image_url);
          }
        }
      }

      if (generatedImages.length > 0) {
        toast.success(`Generated ${generatedImages.length} image(s)!`);
        await loadGallery();
        setGenerationsToday(prev => prev + generatedImages.length);
        setActiveTab("gallery");
      } else {
        toast.error("Failed to generate images. Please try again.");
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("An error occurred while generating images");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleFavorite = async (image: StoredImage) => {
    const newStatus = !image.is_favorite;
    const success = await imageStorage.toggleFavorite(image.id, newStatus);
    if (success) {
      await loadGallery();
      toast.success(newStatus ? "Added to favorites" : "Removed from favorites");
    }
  };

  const handleDelete = async (image: StoredImage) => {
    const success = await imageStorage.deleteImage(image.id, image.storage_path);
    if (success) {
      await loadGallery();
      toast.success("Image deleted");
      setSelectedImage((cur) => (cur?.id === image.id ? null : cur));
    } else {
      toast.error("Failed to delete image");
    }
  };

  const handleDownload = async (image: StoredImage) => {
    try {
      const response = await fetch(image.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-image-${image.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  const handleShare = async (image: StoredImage) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mother of Math - Generated Image',
          text: `Check out this image I generated: ${image.prompt}`,
          url: image.image_url,
        });
      } catch (err) {
        if ((err as any).name !== 'AbortError') {
          console.error("Share failed:", err);
        }
      }
    } else {
      navigator.clipboard.writeText(image.image_url);
      toast.success("Image link copied to clipboard!");
    }
  };

  const renderImageGrid = (images: StoredImage[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <AnimatePresence>
        {images.map((image) => (
          <motion.div
            key={image.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <Card className="overflow-hidden hover:shadow-md transition-shadow">
              {/* Title */}
              <div className="p-3 pb-2">
                <p className="text-sm font-medium text-foreground line-clamp-1 uppercase">
                  {image.prompt}
                </p>
              </div>
              
              {/* Image - clickable */}
              <div 
                className="cursor-pointer"
                onClick={() => setSelectedImage(image)}
              >
                <img
                  src={image.image_url}
                  alt={image.prompt}
                  className="w-full aspect-video object-cover hover:opacity-90 transition-opacity"
                />
              </div>
              
              {/* Bottom bar with aspect ratio badge and action icons */}
              <div className="p-3 pt-2 flex items-center justify-between">
                <Badge variant="secondary" className="text-xs font-medium">
                  {image.aspect_ratio || "16:9"}
                </Badge>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleFavorite(image)}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    title={image.is_favorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        image.is_favorite 
                          ? "fill-yellow-400 text-yellow-400" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    />
                  </button>
                  <button
                    onClick={() => handleDownload(image)}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    title="Download image"
                  >
                    <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button
                    onClick={() => handleShare(image)}
                    className="p-1.5 hover:bg-muted rounded-md transition-colors"
                    title="Share image"
                  >
                    <Share2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void handleDelete(image);
                    }}
                    className="p-1.5 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete image"
                  >
                    <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
          <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold leading-tight">Image Generator</h1>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            Create stunning AI-generated images for your classroom materials
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto w-full gap-1 p-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="generate" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">Text to Image</span>
          </TabsTrigger>
          <TabsTrigger value="sketch" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">Sketch</span>
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
            <Grid3X3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            Gallery
            {gallery.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {gallery.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-1 sm:gap-2 text-[11px] sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 col-span-2 sm:col-span-1">
            <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            Favorites
          </TabsTrigger>
        </TabsList>

        <div className="mt-2 sm:mt-4 mb-2 text-xs sm:text-sm font-medium text-amber-600 bg-amber-50 p-2 rounded-lg max-w-full sm:max-w-fit flex items-center gap-2">
          <span>⚠️</span>
          <span>Daily Limit: {generationsToday} / {MAX_GENERATIONS_PER_DAY} images generated today.</span>
        </div>

        {/* Generate Tab */}
        <TabsContent value="generate" className="mt-3 sm:mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
            {/* Left Column - Prompt */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              <Card>
                <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold text-lg">Create Your Image</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Describe what you want to see. Our AI will enhance your prompt.
                  </p>

                  <Textarea
                    placeholder="Example: Children learning multiplication with colorful blocks"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{prompt.length} characters</span>
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      AI-enhanced automatically
                    </span>
                  </div>

                  {/* Quick Ideas */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Quick Ideas
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_IDEAS.slice(0, 2).map((idea, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPrompt(idea)}
                          className="text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full transition-colors"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="w-full h-12 text-lg gap-2"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Generate {numImages} Image{numImages > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>

            {/* Right Column - Settings */}
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Settings</h2>
                  </div>

                  {/* Aspect Ratio */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.id}
                          onClick={() => setAspectRatio(ratio.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                            aspectRatio === ratio.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <ratio.icon className="h-5 w-5" />
                          <span className="text-xs">{ratio.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Number of Images */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Number of Images</label>
                      <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full">
                        {numImages}
                      </span>
                    </div>
                    <Slider
                      value={[numImages]}
                      onValueChange={(v) => setNumImages(v[0])}
                      min={1}
                      max={4}
                      step={1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 Image</span>
                      <span>4 Images</span>
                    </div>
                  </div>

                  {/* Art Style */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Art Style</label>
                    <Select value={artStyle} onValueChange={setArtStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ART_STYLES.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            <div>
                              <div className="font-medium">{style.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {style.description}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Pro Tips */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Pro Tips</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Be specific about subjects and settings</li>
                    <li>• Mention colors, lighting, or mood</li>
                    <li>• Our AI enhances prompts automatically</li>
                    <li>• Try different styles for variety</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        {/* Sketch Tab */}
        <TabsContent value="sketch" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-5 w-5 text-primary" />
                      <h2 className="font-semibold text-lg">Free Draw / Sketch Board</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Draw a simple shape or scene. Our AI will analyze your sketch and generate a high-quality educational image based on it.
                    </p>
                  </div>
                  
                  {/* Tools */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={penColor} 
                        onChange={(e) => setPenColor(e.target.value)} 
                        title="Pen Color"
                        className="w-8 h-8 rounded cursor-pointer border-none bg-transparent"
                      />
                      <Button variant="outline" size="sm" onClick={() => setPenColor("#ffffff")} title="Eraser">
                        <Eraser className="w-4 h-4 mr-1" /> Eraser
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearCanvas} title="Clear Board">
                        <Trash2 className="w-4 h-4 mr-1 text-red-500" /> Clear
                      </Button>
                    </div>
                  </div>

                  {/* Canvas */}
                  <div className="border-2 border-dashed rounded-lg overflow-hidden relative" style={{ touchAction: 'none' }}>
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={450}
                      className="w-full h-full bg-white cursor-crosshair touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseOut={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full h-14 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white"
                disabled={isGenerating}
                onClick={handleGenerateFromSketch}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing Sketch & Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Create from Sketch
                  </>
                )}
              </Button>
            </div>

            {/* Right column settings: We can reuse the same controls if we want, or simple instructions */}
            <div className="space-y-4">
               {/* Aspect Ratio */}
               <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">Style Settings</h2>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.id}
                          onClick={() => setAspectRatio(ratio.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                            aspectRatio === ratio.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          )}
                        >
                          <ratio.icon className="h-5 w-5" />
                          <span className="text-xs">{ratio.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Art Style</label>
                    <Select value={artStyle} onValueChange={setArtStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ART_STYLES.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            <div>
                              <div className="font-medium">{style.label}</div>
                              <div className="text-xs text-muted-foreground">{style.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Tips for sketch */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Sketch Ideas</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Stick figures work great</li>
                    <li>• Draw geometric shapes</li>
                    <li>• Outline a classroom layout</li>
                    <li>• The AI will figure out the context</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        {/* Gallery Tab */}
        <TabsContent value="gallery" className="mt-6">
          {loadingGallery ? (
              <div className="flex items-center justify-center h-48">
                <LoadingAnimation message="Loading gallery..." />
              </div>
            ) : gallery.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 font-medium">No images yet</h3>
              <p className="text-sm text-muted-foreground">
                Generate your first image to see it here
              </p>
              <Button className="mt-4" onClick={() => setActiveTab("generate")}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Image
              </Button>
            </div>
          ) : (
            renderImageGrid(gallery)
          )}
        </TabsContent>

        {/* Favorites Tab */}
        <TabsContent value="favorites" className="mt-6">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h3 className="mt-4 font-medium">No favorites yet</h3>
              <p className="text-sm text-muted-foreground">
                Click the star icon on any image to add it to favorites
              </p>
            </div>
          ) : (
            renderImageGrid(favorites)
          )}
        </TabsContent>
      </Tabs>

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {selectedImage && (
            <div className="relative">
              {/* Close button */}
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-3 right-3 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              {/* Image */}
              <img
                src={selectedImage.image_url}
                alt={selectedImage.prompt}
                className="w-full max-h-[80vh] object-contain bg-black"
              />
              
              {/* Image info */}
              <div className="p-4 bg-background">
                <h3 className="font-semibold text-lg mb-2">{selectedImage.prompt}</h3>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{selectedImage.aspect_ratio || "16:9"}</Badge>
                  <Badge variant="outline">{selectedImage.style || "illustration"}</Badge>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleFavorite(selectedImage)}
                    >
                      <Star
                        className={cn(
                          "h-4 w-4 mr-1",
                          selectedImage.is_favorite && "fill-yellow-400 text-yellow-400"
                        )}
                      />
                      {selectedImage.is_favorite ? "Favorited" : "Favorite"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(selectedImage)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDelete(selectedImage);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerateImages;

