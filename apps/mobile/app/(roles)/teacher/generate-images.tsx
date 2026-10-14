import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Download,
  Eraser,
  Grid3X3,
  ImageIcon,
  Lightbulb,
  Pencil,
  RectangleHorizontal,
  RectangleVertical,
  Settings2,
  Share2,
  Sparkles,
  Square,
  Star,
  Trash2,
} from "lucide-react-native";
import { SketchBoard, type SketchBoardHandle } from "../../../src/components/SketchBoard";
import {
  AmberBanner,
  DashedZone,
  PageHero,
  SegmentIconTabs,
  SelectTile,
  TipCard,
} from "../../../src/components/WebMatchChrome";
import { downloadAndShare } from "../../../src/native/downloads";
import { savedFileHint } from "../../../src/native/saveFile";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  ART_STYLES,
  ASPECT_RATIOS,
  DAILY_IMAGE_LIMIT,
  QUICK_IDEAS,
  enhanceImagePrompt,
  generateSlideImage,
} from "../../../src/services/imageGeneration";
import { imageStorage, type StoredImage } from "../../../src/services/imageStorage";
import { colors, fonts, layout, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  Select,
  Sheet,
  Skeleton,
  Text,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

type Tab = "text" | "sketch" | "gallery" | "favorites";
type AspectId = (typeof ASPECT_RATIOS)[number]["id"];
type StyleId = (typeof ART_STYLES)[number]["id"];
type CountId = "1" | "2" | "3" | "4";

const PROMPT_MAX = 800;
const QUICK_VISIBLE = QUICK_IDEAS.slice(0, 2);

const SKETCH_COLORS = ["#000000", "#009e60", "#4b371c", "#2563eb", "#dc2626"];

const PRO_TIPS = [
  "Be specific about subjects and settings",
  "Mention colors, lighting, or mood",
  "Our AI enhances prompts automatically",
  "Try different styles for variety",
];

const SKETCH_TIPS = [
  "Stick figures work great",
  "Draw geometric shapes",
  "Outline a classroom layout",
  "The AI will figure out the context",
];

const COUNT_OPTIONS: { value: CountId; label: string }[] = [
  { value: "1", label: "1 image" },
  { value: "2", label: "2 images" },
  { value: "3", label: "3 images" },
  { value: "4", label: "4 images" },
];

const STYLE_OPTIONS = ART_STYLES.map((s) => ({
  value: s.id as StyleId,
  label: s.label,
}));

const ASPECT_ICONS: Record<AspectId, ReactNode> = {
  portrait: <RectangleVertical size={20} color={colors.brandDeep} />,
  classic: <Square size={20} color={colors.brandDeep} />,
  tall: <RectangleVertical size={20} color={colors.brandDeep} />,
  wide: <RectangleHorizontal size={20} color={colors.brandDeep} />,
};

const tabIconColor = (active: boolean) =>
  active ? colors.brandDeep : colors.textMuted;

export default function GenerateImagesScreen() {
  const { width } = useWindowDimensions();
  const contentW = Math.min(width - space.lg * 2, layout.contentMaxWidth);
  const galleryCols = contentW >= 520 ? 2 : 1;
  const cardGap = space.md;
  const cardW =
    galleryCols === 1
      ? contentW
      : Math.floor((contentW - cardGap * (galleryCols - 1)) / galleryCols);
  const thumbHeight = Math.round(cardW * (9 / 16));

  const [tab, setTab] = useState<Tab>("text");
  const [prompt, setPrompt] = useState("");
  const [sketchDesc, setSketchDesc] = useState("");
  const [aspectId, setAspectId] = useState<AspectId>("classic");
  const [styleId, setStyleId] = useState<StyleId>("illustration");
  const [countId, setCountId] = useState<CountId>("1");
  const [promptError, setPromptError] = useState<string | null>(null);

  const [gallery, setGallery] = useState<StoredImage[]>([]);
  const [generationsToday, setGenerationsToday] = useState(0);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selected, setSelected] = useState<StoredImage | null>(null);
  const [penColor, setPenColor] = useState("#000000");
  const [sketchBoardKey, setSketchBoardKey] = useState(0);
  const sketchBoardRef = useRef<SketchBoardHandle>(null);
  const generatingLock = useRef(false);

  const numImages = Number(countId) || 1;
  const remaining = Math.max(0, DAILY_IMAGE_LIMIT - generationsToday);
  const favorites = useMemo(() => gallery.filter((img) => img.is_favorite), [gallery]);

  const selectedRatio =
    ASPECT_RATIOS.find((r) => r.id === aspectId)?.ratio ?? "4:3";

  const loadGallery = useCallback(async () => {
    try {
      const [images, count] = await Promise.all([
        imageStorage.getImages(),
        imageStorage.getGenerationsCountToday(),
      ]);
      setGallery(images);
      setGenerationsToday(count);
    } catch (e) {
      showError("Could not load gallery", e);
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadGallery();
    } finally {
      setRefreshing(false);
    }
  };

  const runGenerate = async (opts: {
    basePrompt: string;
    fromSketch: boolean;
    displayPrompt: string;
    referenceImage?: string;
  }) => {
    if (generatingLock.current) return;
    const trimmed = opts.basePrompt.trim();
    if (!trimmed) {
      setPromptError(
        opts.fromSketch
          ? "Draw something on the board first so we can turn it into an image."
          : "Please enter a prompt.",
      );
      return;
    }

    if (opts.fromSketch && !opts.referenceImage) {
      setPromptError("Draw something on the board first so the AI can follow your sketch.");
      return;
    }

    const count = Math.min(4, Math.max(1, Number(numImages) || 1));
    if (generationsToday + count > DAILY_IMAGE_LIMIT) {
      showError(
        "Daily limit reached",
        `You can only generate ${remaining} more image${remaining === 1 ? "" : "s"} today.`,
      );
      return;
    }

    setPromptError(null);
    generatingLock.current = true;
    setIsGenerating(true);

    const enhanced = enhanceImagePrompt(trimmed, styleId, opts.fromSketch);
    const savedUrls: string[] = [];

    try {
      for (let i = 0; i < count; i++) {
        const imageUrl = await generateSlideImage(enhanced, selectedRatio, opts.referenceImage);
        if (!imageUrl) continue;

        const saved = await imageStorage.saveImage(imageUrl, {
          prompt: opts.displayPrompt,
          enhancedPrompt: enhanced,
          aspectRatio: selectedRatio,
          style: styleId,
        });
        if (saved) savedUrls.push(saved.image_url);
      }

      if (savedUrls.length === 0) {
        showError("Generation failed", "No images were returned. Please try again.");
        return;
      }

      await loadGallery();
      setGenerationsToday((prev) => prev + savedUrls.length);
      setTab("gallery");
      showSuccess(
        "Images ready",
        `Generated ${savedUrls.length} image${savedUrls.length === 1 ? "" : "s"} for your classroom.`,
      );
    } catch (e) {
      showError("Generation failed", e);
    } finally {
      generatingLock.current = false;
      setIsGenerating(false);
    }
  };

  const handleTextGenerate = () =>
    void runGenerate({
      basePrompt: prompt,
      fromSketch: false,
      displayPrompt: prompt.trim(),
    });

  const handleSketchGenerate = async () => {
    if (!sketchBoardRef.current?.hasStrokes()) {
      setPromptError("Draw something on the board first so the AI can follow your sketch.");
      return;
    }
    const png = await sketchBoardRef.current.capturePng();
    if (!png) {
      setPromptError("Could not read your sketch. Try drawing again, then generate.");
      return;
    }
    void runGenerate({
      basePrompt:
        sketchDesc.trim() ||
        "Recreate the attached sketch exactly as drawn. Do not invent extra objects.",
      fromSketch: true,
      displayPrompt: "Generated from Teacher Sketch",
      referenceImage: png,
    });
  };

  const handleToggleFavorite = async (image: StoredImage) => {
    const next = !image.is_favorite;
    try {
      await imageStorage.toggleFavorite(image.id, next);
      setGallery((prev) =>
        prev.map((img) => (img.id === image.id ? { ...img, is_favorite: next } : img)),
      );
      setSelected((cur) =>
        cur?.id === image.id ? { ...cur, is_favorite: next } : cur,
      );
      showSuccess(
        next ? "Added to favorites" : "Removed from favorites",
        next ? "Find it anytime under Favorites." : "Star it again whenever you like.",
      );
    } catch (e) {
      showError("Could not update favorite", e);
    }
  };

  const handleDelete = (image: StoredImage) => {
    confirmDelete("this image", () => {
      void (async () => {
        try {
          const ok = await imageStorage.deleteImage(image.id, image.storage_path);
          if (!ok) {
            showError("Delete failed", "Could not delete this image.");
            return;
          }
          setGallery((prev) => prev.filter((img) => img.id !== image.id));
          setSelected((cur) => (cur?.id === image.id ? null : cur));
          showSuccess("Image deleted", "Removed from your gallery.");
        } catch (e) {
          showError("Delete failed", e);
        }
      })();
    });
  };

  const handleDownload = async (image: StoredImage) => {
    try {
      await downloadAndShare(image.image_url, `mom-image-${image.id}.png`);
      showSuccess("Saved to your phone", savedFileHint(`mom-image-${image.id}.png`));
    } catch (e) {
      showError("Download failed", e);
    }
  };

  const handleShare = async (image: StoredImage) => {
    try {
      const result = await Share.share({
        message: `Mother of Math — ${image.prompt}\n${image.image_url}`,
        url: image.image_url,
        title: "Mother of Math image",
      });
      if (result.action === Share.dismissedAction) return;
    } catch {
      try {
        await Clipboard.setStringAsync(image.image_url);
        showSuccess("Link copied", "Image URL copied to clipboard.");
      } catch (e) {
        try {
          await Linking.openURL(image.image_url);
        } catch (err) {
          showError("Share failed", err);
        }
      }
    }
  };

  const renderTipList = (items: string[]) => (
    <View style={styles.tipList}>
      {items.map((tip) => (
        <Text key={tip} variant="micro" color={colors.textMuted}>
          • {tip}
        </Text>
      ))}
    </View>
  );

  const renderEmptyGallery = (opts: {
    icon: ReactNode;
    title: string;
    subtitle: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <View style={styles.empty}>
      {opts.icon}
      <Text variant="bodySm" weight="semibold" center style={{ marginTop: space.lg }}>
        {opts.title}
      </Text>
      <Text variant="caption" color={colors.textMuted} center style={{ marginTop: space.xs }}>
        {opts.subtitle}
      </Text>
      {opts.actionLabel && opts.onAction ? (
        <Button
          label={opts.actionLabel}
          onPress={opts.onAction}
          variant="outline"
          size="sm"
          fullWidth={false}
          style={{ marginTop: space.lg }}
          icon={<Sparkles size={16} color={colors.brandDark} />}
        />
      ) : null}
    </View>
  );

  const renderSettings = (opts?: { showCount?: boolean; title?: string }) => {
    const showCount = opts?.showCount !== false;
    const settingsTitle = opts?.title ?? "Settings";
    return (
      <Card>
        <View style={styles.sectionHeader}>
          <Settings2 size={18} color={colors.brand} />
          <Text variant="subtitle" weight="semibold">
            {settingsTitle}
          </Text>
        </View>

        <View style={{ marginTop: space.lg, gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Text variant="caption" weight="semibold" color={colors.textSecondary}>
              Aspect Ratio
            </Text>
            <View style={styles.aspectGrid}>
              {ASPECT_RATIOS.map((ratio) => (
                <SelectTile
                  key={ratio.id}
                  selected={aspectId === ratio.id}
                  onPress={() => setAspectId(ratio.id)}
                >
                  {ASPECT_ICONS[ratio.id]}
                  <Text variant="micro" weight="medium" center>
                    {ratio.label}
                  </Text>
                  <Text variant="micro" color={colors.textMuted} center>
                    {ratio.ratio}
                  </Text>
                </SelectTile>
              ))}
            </View>
          </View>

          <Select<StyleId>
            label="Art Style"
            value={styleId}
            options={STYLE_OPTIONS}
            onChange={setStyleId}
          />

          {showCount ? (
            <Select<CountId>
              label="Number of Images"
              value={countId}
              options={COUNT_OPTIONS}
              onChange={setCountId}
            />
          ) : null}
        </View>
      </Card>
    );
  };

  const renderGenerating = () => (
    <Card>
      <Skeleton height={thumbHeight} />
      <Skeleton height={10} width="88%" style={{ marginTop: space.lg }} />
      <Skeleton height={10} width="72%" style={{ marginTop: space.sm }} />
      <Text variant="micro" color={colors.textMuted} center style={{ marginTop: space.lg }}>
        Creating classroom visuals… this can take up to a minute.
      </Text>
    </Card>
  );

  const renderImageCard = (image: StoredImage) => (
    <Card
      key={image.id}
      padded={false}
      style={
        galleryCols === 2
          ? [styles.imageCard, { width: cardW }]
          : styles.imageCard
      }
    >
      <Pressable
        onPress={() => setSelected(image)}
        accessibilityRole="button"
        accessibilityLabel="Open image"
      >
        <View style={styles.cardTitle}>
          <Text
            variant="caption"
            weight="semibold"
            numberOfLines={1}
            style={styles.promptUpper}
          >
            {image.prompt}
          </Text>
        </View>
        <Image
          source={{ uri: image.image_url }}
          style={{
            width: "100%",
            height: thumbHeight,
            backgroundColor: colors.gray100,
          }}
          resizeMode="cover"
        />
      </Pressable>
      <View style={styles.cardFooter}>
        <Badge label={image.aspect_ratio || "4:3"} tone="neutral" />
        <View style={styles.cardActions}>
          <IconButton
            accessibilityLabel={image.is_favorite ? "Unfavorite" : "Favorite"}
            onPress={() => void handleToggleFavorite(image)}
            size={36}
          >
            <Star
              size={16}
              color={image.is_favorite ? colors.amber : colors.textMuted}
              fill={image.is_favorite ? colors.amber : "transparent"}
            />
          </IconButton>
          <IconButton
            accessibilityLabel="Download"
            onPress={() => void handleDownload(image)}
            size={36}
          >
            <Download size={16} color={colors.textMuted} />
          </IconButton>
          <IconButton
            accessibilityLabel="Share"
            onPress={() => void handleShare(image)}
            size={36}
          >
            <Share2 size={16} color={colors.textMuted} />
          </IconButton>
          <IconButton
            accessibilityLabel="Delete"
            onPress={() => handleDelete(image)}
            size={36}
            tone="danger"
          >
            <Trash2 size={16} color={colors.dangerText} />
          </IconButton>
        </View>
      </View>
    </Card>
  );

  const renderTextTab = () => (
    <View style={{ gap: space.md }}>
      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="subtitle" weight="semibold">
            Create Your Image
          </Text>
        </View>
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: space.sm }}
        >
          Describe what you want to see. Our AI will enhance your prompt.
        </Text>

        <View style={{ marginTop: space.md }}>
          <Input
            value={prompt}
            onChangeText={(v) => {
              if (v.length <= PROMPT_MAX) {
                setPrompt(v);
                if (promptError) setPromptError(null);
              }
            }}
            placeholder="Example: Children learning multiplication with colorful blocks"
            error={promptError}
            multiline
          />
        </View>

        <View style={styles.charRow}>
          <Text variant="micro" color={colors.textMuted}>
            {prompt.length} characters
          </Text>
          <View style={styles.aiEnhanced}>
            <Sparkles size={12} color={colors.textMuted} />
            <Text variant="micro" color={colors.textMuted}>
              AI-enhanced automatically
            </Text>
          </View>
        </View>

        <View style={styles.ideasBlock}>
          <View style={styles.ideasLabel}>
            <Lightbulb size={16} color={colors.amber} />
            <Text variant="caption" weight="semibold">
              Quick Ideas
            </Text>
          </View>
          <View style={styles.ideaPills}>
            {QUICK_VISIBLE.map((idea) => (
              <Pressable
                key={idea}
                onPress={() => {
                  setPrompt(idea);
                  setPromptError(null);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ideaPill,
                  pressed && styles.ideaPillPressed,
                ]}
              >
                <Text variant="micro" numberOfLines={2}>
                  {idea}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {renderSettings()}

      <TipCard title="Pro Tips">
        {renderTipList(PRO_TIPS)}
      </TipCard>

      <Button
        label={
          isGenerating
            ? "Generating…"
            : `Generate ${numImages} Image${numImages > 1 ? "s" : ""}`
        }
        onPress={handleTextGenerate}
        loading={isGenerating}
        disabled={isGenerating || remaining === 0 || !prompt.trim()}
        size="lg"
      />

      {isGenerating ? renderGenerating() : null}
    </View>
  );

  const renderSketchTab = () => (
    <View style={{ gap: space.md }}>
      <Card>
        <View style={styles.sectionHeader}>
          <Pencil size={18} color={colors.brand} />
          <Text variant="subtitle" weight="semibold">
            Free Draw / Sketch Board
          </Text>
        </View>
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: space.sm }}
        >
          Draw a simple shape or scene. Our AI will analyze your sketch and generate a
          high-quality educational image based on it.
        </Text>

        <View style={styles.toolRow}>
          <View style={styles.colorSwatches}>
            {SKETCH_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setPenColor(c)}
                accessibilityRole="button"
                accessibilityLabel={`Pen color ${c}`}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  penColor === c && styles.colorSwatchOn,
                ]}
              />
            ))}
          </View>
          <Pressable
            onPress={() => setPenColor("#ffffff")}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.toolBtn,
              penColor === "#ffffff" && styles.toolBtnOn,
              pressed && styles.toolBtnPressed,
            ]}
          >
            <Eraser size={14} color={colors.textSecondary} />
            <Text variant="micro" weight="medium">
              Eraser
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSketchBoardKey((k) => k + 1)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed]}
          >
            <Trash2 size={14} color={colors.dangerText} />
            <Text variant="micro" weight="medium" color={colors.dangerText}>
              Clear
            </Text>
          </Pressable>
        </View>

        <DashedZone style={styles.sketchZone}>
          <SketchBoard ref={sketchBoardRef} key={sketchBoardKey} color={penColor} height={220} />
        </DashedZone>

        <View style={{ marginTop: space.md }}>
          <Input
            label="Optional notes"
            value={sketchDesc}
            onChangeText={(v) => {
              if (v.length <= PROMPT_MAX) {
                setSketchDesc(v);
                if (promptError) setPromptError(null);
              }
            }}
            placeholder="Add context for your sketch (optional)…"
            error={promptError}
            multiline
          />
        </View>
      </Card>

      {renderSettings({ showCount: false, title: "Style Settings" })}

      <TipCard icon={<Lightbulb size={16} color={colors.brand} />} title="Sketch Ideas">
        {renderTipList(SKETCH_TIPS)}
      </TipCard>

      <Button
        label={isGenerating ? "Generating…" : "Create from Sketch"}
        onPress={handleSketchGenerate}
        loading={isGenerating}
        disabled={isGenerating || remaining === 0}
        size="lg"
        style={styles.sketchCta}
        icon={<Sparkles size={20} color={colors.white} />}
      />

      {isGenerating ? renderGenerating() : null}
    </View>
  );

  const renderGalleryList = (images: StoredImage[]) => (
    <View style={[styles.grid, galleryCols === 2 && styles.gridWide]}>
      {images.map(renderImageCard)}
    </View>
  );

  const renderGalleryTab = () => {
    if (loadingGallery) {
      return (
        <Card>
          <Skeleton height={thumbHeight} />
          <Skeleton height={12} width="60%" style={{ marginTop: space.md }} />
        </Card>
      );
    }

    if (gallery.length === 0) {
      return renderEmptyGallery({
        icon: <ImageIcon size={48} color={colors.textFaint} />,
        title: "No images yet",
        subtitle: "Generate your first image to see it here",
        actionLabel: "Generate Image",
        onAction: () => setTab("text"),
      });
    }

    return renderGalleryList(gallery);
  };

  const renderFavoritesTab = () => {
    if (loadingGallery) {
      return (
        <Card>
          <Skeleton height={thumbHeight} />
        </Card>
      );
    }

    if (favorites.length === 0) {
      return renderEmptyGallery({
        icon: <Star size={48} color={colors.textFaint} />,
        title: "No favorites yet",
        subtitle: "Click the star icon on any image to add it to favorites",
      });
    }

    return renderGalleryList(favorites);
  };

  return (
    <DashboardShell
      title="Image Generator"
      subtitle="Create classroom visuals with AI"
      hideTitle
      hideAvatar
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      <PageHero
        icon={<ImageIcon size={22} color={colors.brand} />}
        title="Image Generator"
        subtitle="Create classroom visuals with AI"
      />

      <SegmentIconTabs
        items={[
          {
            value: "text" as Tab,
            label: "Text to Image",
          },
          {
            value: "sketch" as Tab,
            label: "Sketch",
            icon: (active) => <Pencil size={14} color={tabIconColor(active)} />,
          },
          {
            value: "gallery" as Tab,
            label: "Gallery",
            icon: (active) => <Grid3X3 size={14} color={tabIconColor(active)} />,
            badge: gallery.length,
          },
          {
            value: "favorites" as Tab,
            label: "Favorites",
            icon: (active) => <Star size={14} color={tabIconColor(active)} />,
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      <AmberBanner variant="brand">
        <Text variant="caption" weight="semibold" color={colors.brandDeep} style={{ flex: 1 }}>
          Daily Limit: {generationsToday} / {DAILY_IMAGE_LIMIT} images generated today.
        </Text>
      </AmberBanner>

      {tab === "text"
        ? renderTextTab()
        : tab === "sketch"
          ? renderSketchTab()
          : tab === "favorites"
            ? renderFavoritesTab()
            : renderGalleryTab()}

      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.prompt ? selected.prompt.slice(0, 48) : "Image"}
        subtitle={
          selected ? `${selected.aspect_ratio} · ${selected.style}` : undefined
        }
        footer={
          selected ? (
            <View style={styles.lightboxActions}>
              <Button
                label={selected.is_favorite ? "Unfavorite" : "Favorite"}
                variant="outline"
                size="sm"
                fullWidth={false}
                icon={
                  <Star
                    size={16}
                    color={colors.brandDark}
                    fill={selected.is_favorite ? colors.amber : "transparent"}
                  />
                }
                onPress={() => void handleToggleFavorite(selected)}
              />
              <Button
                label="Download"
                variant="outline"
                size="sm"
                fullWidth={false}
                icon={<Download size={16} color={colors.brandDark} />}
                onPress={() => void handleDownload(selected)}
              />
              <Button
                label="Share"
                variant="outline"
                size="sm"
                fullWidth={false}
                icon={<Share2 size={16} color={colors.brandDark} />}
                onPress={() => void handleShare(selected)}
              />
              <Button
                label="Delete"
                variant="danger"
                size="sm"
                fullWidth={false}
                icon={<Trash2 size={16} color={colors.white} />}
                onPress={() => handleDelete(selected)}
              />
            </View>
          ) : null
        }
      >
        {selected ? (
          <View style={styles.lightboxStage}>
            <Image
              source={{ uri: selected.image_url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          </View>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  charRow: {
    marginTop: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  aiEnhanced: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ideasBlock: {
    marginTop: space.lg,
    gap: space.sm,
  },
  ideasLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  ideaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  ideaPill: {
    maxWidth: "100%",
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.bgSunken,
  },
  ideaPillPressed: {
    backgroundColor: colors.gray200,
  },
  aspectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  grid: {
    gap: space.md,
  },
  empty: {
    alignItems: "center",
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  tipList: {
    gap: 4,
  },
  toolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.md,
  },
  colorSwatches: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchOn: {
    borderColor: colors.brand,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolBtnOn: {
    borderColor: colors.brandMute,
    backgroundColor: colors.brandTint,
  },
  toolBtnPressed: {
    opacity: 0.88,
  },
  sketchZone: {
    marginTop: space.md,
    padding: 0,
    overflow: "hidden",
  },
  sketchCta: {
    minHeight: 56,
  },
  gridWide: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  imageCard: {
    overflow: "hidden",
  },
  cardTitle: {
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  promptUpper: {
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontFamily: fonts.medium,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  lightboxStage: {
    backgroundColor: "#000",
    borderRadius: radius.md,
    overflow: "hidden",
  },
  lightboxImage: {
    width: "100%",
    height: 320,
    backgroundColor: "#000",
  },
  lightboxActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
});
