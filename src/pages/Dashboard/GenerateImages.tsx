import { useState, useEffect } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateSlideImage } from "@/services/imageGeneration";
import { imageStorage } from "@/services/imageStorage";
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
  "Students working together on geometry problems",
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

  // Load gallery images
  const loadGallery = async () => {
    setLoadingGallery(true);
    try {
      const images = await imageStorage.getImages();
      setGallery(images);
      setFavorites(images.filter((img) => img.is_favorite));
    } catch (error) {
      console.error("Failed to load gallery:", error);
    } finally {
      setLoadingGallery(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  // Enhance prompt with style and context
  const enhancePrompt = (basePrompt: string): string => {
    const styleMap: Record<string, string> = {
      illustration: "Clean vector-style illustration, flat design, modern educational artwork",
      realistic: "Photorealistic, high detail, professional photography style",
      cartoon: "Fun cartoon style, bright colors, child-friendly",
      watercolor: "Soft watercolor painting, artistic, gentle colors",
      sketch: "Hand-drawn pencil sketch, artistic linework",
    };

    return `${basePrompt}. ${styleMap[artStyle] || styleMap.illustration}. 
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
                    onClick={() => handleDelete(image)}
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ImageIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Image Generator</h1>
          <p className="text-muted-foreground text-sm">
            Create stunning AI-generated images for your classroom materials
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="gallery" className="gap-2">
            <Grid3X3 className="h-4 w-4" />
            Gallery
            {gallery.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {gallery.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Star className="h-4 w-4" />
            Favorites
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Prompt */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
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

        {/* Gallery Tab */}
        <TabsContent value="gallery" className="mt-6">
          {loadingGallery ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        handleDelete(selectedImage);
                        setSelectedImage(null);
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
