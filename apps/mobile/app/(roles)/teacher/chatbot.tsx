import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  BookmarkCheck,
  Braces,
  Circle,
  Copy,
  FileText,
  FileType,
  Globe,
  GraduationCap,
  Hash,
  History,
  ImageIcon,
  Lightbulb,
  MessageSquarePlus,
  Mic,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  SendHorizontal,
  Sparkles,
  Star,
  Sun,
  Table2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  Zap,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { getTopicsForClassLevel, type TopicItem } from "../../../src/data/curriculumContent";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  addMessage,
  askChatbotStreaming,
  buildMamaSystemPrompt,
  createConversation,
  deleteConversation,
  getBookmarkedMessages,
  listConversations,
  listMessages,
  toggleMessageBookmark,
  updateMessageRating,
  type BookmarkedMessage,
  type ChatCountry,
  type ConversationRow,
  type MessageRow,
} from "../../../src/services/chatbot";
import {
  extractLatexSnippets,
  shareMarkdownTableExcel,
  shareRubricExcel,
  shareWorksheetDocx,
  shareWorksheetPdf,
} from "../../../src/services/chatbotDocumentExports";
import { savedFileHint } from "../../../src/native/saveFile";
import { colors, fonts, radius, shadow, space } from "../../../src/theme/tokens";
import {
  Badge,
  IconButton,
  RichText,
  Select,
  Sheet,
  SheetAction,
  Text,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

const COUNTRY_KEY = "mama-country";
const GRADE_KEY = "mama-chat-grade";
const DARK_KEY = "mama-dark";

const CAMEROON_GRADES = ["1", "2", "3", "4", "5", "6"] as const;
const NIGERIA_GRADES = ["1", "2", "3"] as const;

const TOPICS = [
  {
    titleKey: "topic.numbers" as const,
    query: "counting objects and numbers from 1 to 20",
    queryFr: "compter les objets et les nombres de 1 à 20",
    icon: Hash,
    colors: ["#3B82F6", "#4F46E5"] as [string, string],
  },
  {
    titleKey: "topic.measurement" as const,
    query: "writing and forming numbers clearly",
    queryFr: "écrire et former les nombres clairement",
    icon: Pencil,
    colors: ["#10B981", "#0D9488"] as [string, string],
  },
  {
    titleKey: "topic.data" as const,
    query: "simple adding with objects and counters",
    queryFr: "l'addition simple avec des objets et des jetons",
    icon: Plus,
    colors: ["#F97316", "#EF4444"] as [string, string],
  },
  {
    titleKey: "topic.geometry" as const,
    query: "simple shapes like circle, square and triangle",
    queryFr: "les formes simples comme le cercle, le carré et le triangle",
    icon: Circle,
    colors: ["#A855F7", "#DB2777"] as [string, string],
  },
];

const PROMPTS = [
  { key: "prompt.lesson" as const, icon: Lightbulb },
  { key: "prompt.activity" as const, icon: Star },
  { key: "prompt.assessment" as const, icon: GraduationCap },
  { key: "prompt.mistakes" as const, icon: Zap },
];

const FOLLOW_UPS = [
  "suggest.assess",
  "suggest.example",
  "suggest.worksheet",
  "suggest.activity",
] as const;

type ChatMessage = Pick<
  MessageRow,
  "id" | "role" | "content" | "created_at" | "rating" | "bookmarked"
> & { imageUri?: string };

const mamaLogo = require("../../../assets/mama-math.png");

function TypingDots() {
  const a = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = a.map((val, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(val, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a]);

  return (
    <View style={styles.dotsRow}>
      {a.map((val, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
              transform: [
                {
                  translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function StreamingCaret() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: 420,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.caret, { opacity }]} />;
}

/** Reveals incoming text on screen, frame by frame, even if the network dumps the whole reply at once. */
function useTypedReveal() {
  const [shown, setShown] = useState("");
  const targetRef = useRef("");
  const shownRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const pump = useCallback(() => {
    const target = targetRef.current;
    const current = shownRef.current;
    if (current.length >= target.length) {
      if (current !== target) {
        shownRef.current = target;
        setShown(target);
      }
      rafRef.current = null;
      return;
    }
    const remaining = target.length - current.length;
    const step = remaining > 240 ? 8 : remaining > 80 ? 4 : remaining > 24 ? 2 : 1;
    const next = target.slice(0, current.length + step);
    shownRef.current = next;
    setShown(next);
    rafRef.current = requestAnimationFrame(pump);
  }, []);

  const setTarget = useCallback(
    (next: string) => {
      targetRef.current = next;
      if (next.length < shownRef.current.length) {
        shownRef.current = next;
        setShown(next);
      }
      if (rafRef.current == null && shownRef.current !== targetRef.current) {
        rafRef.current = requestAnimationFrame(pump);
      }
    },
    [pump],
  );

  const reset = useCallback(() => {
    stop();
    targetRef.current = "";
    shownRef.current = "";
    setShown("");
  }, [stop]);

  const waitUntilCaughtUp = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const tick = () => {
          if (shownRef.current.length >= targetRef.current.length) {
            stop();
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      }),
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { shown, setTarget, reset, waitUntilCaughtUp };
}

function MamaAvatar({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.mamaAvatar, { width: size, height: size, borderRadius: radius.md }, shadow.xs]}>
      <Image source={mamaLogo} style={{ width: size, height: size, borderRadius: radius.md }} />
    </View>
  );
}

function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initial = (name.trim()[0] || "U").toUpperCase();
  return (
    <LinearGradient
      colors={["#374151", "#111827"]}
      style={[styles.userAvatar, { width: size, height: size, borderRadius: radius.md }]}
    >
      <Text variant="caption" weight="bold" color={colors.white}>
        {initial}
      </Text>
    </LinearGradient>
  );
}

export default function TeacherChatbotScreen() {
  const { user, profile } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const firstName = (profile?.full_name || user?.email || "Teacher").split(" ")[0];

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listTab, setListTab] = useState<"history" | "bookmarks">("history");
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<ChatCountry>("cameroon");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [curriculumTopics, setCurriculumTopics] = useState<TopicItem[]>([]);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const { shown: typedText, setTarget: setTypedTarget, reset: resetTyped, waitUntilCaughtUp } =
    useTypedReveal();

  const scrollRef = useRef<ScrollView | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const grades = selectedCountry === "nigeria" ? NIGERIA_GRADES : CAMEROON_GRADES;

  const countryOptions = useMemo(
    () => [
      { value: "cameroon" as const, label: `🇨🇲 ${t("app.country.cameroon")}` },
      { value: "nigeria" as const, label: `🇳🇬 ${t("app.country.nigeria")}` },
    ],
    [t],
  );

  const gradeOptions = useMemo(
    () =>
      grades.map((g) => ({
        value: g,
        label: `${t("app.primary")} ${g}`,
      })),
    [grades, t],
  );

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    void (async () => {
      const [country, grade, dark] = await Promise.all([
        AsyncStorage.getItem(COUNTRY_KEY),
        AsyncStorage.getItem(GRADE_KEY),
        AsyncStorage.getItem(DARK_KEY),
      ]);
      const nextCountry: ChatCountry =
        country === "nigeria" || country === "cameroon" ? country : "cameroon";
      setSelectedCountry(nextCountry);
      const allowed = nextCountry === "nigeria" ? NIGERIA_GRADES : CAMEROON_GRADES;
      if (grade && (allowed as readonly string[]).includes(grade)) setSelectedGrade(grade);
      setDarkMode(dark === "true");
    })();
  }, []);

  // Same as web: changing country clears class; selecting class loads that curriculum.
  useEffect(() => {
    void AsyncStorage.setItem(COUNTRY_KEY, selectedCountry);
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedGrade) void AsyncStorage.setItem(GRADE_KEY, selectedGrade);
    else void AsyncStorage.removeItem(GRADE_KEY);
  }, [selectedGrade]);

  useEffect(() => {
    void AsyncStorage.setItem(DARK_KEY, String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (selectedGrade) {
      setCurriculumTopics(getTopicsForClassLevel(selectedCountry, `Primary ${selectedGrade}`));
    } else {
      setCurriculumTopics([]);
    }
  }, [selectedCountry, selectedGrade]);

  const pickCountry = (country: ChatCountry) => {
    setSelectedCountry(country);
    setSelectedGrade("");
  };

  const pickGrade = (grade: string) => {
    setSelectedGrade(grade);
  };

  useEffect(() => {
    if (!listOpen || listTab !== "bookmarks" || !user) return;
    setBookmarksLoading(true);
    getBookmarkedMessages(user.id)
      .then(setBookmarks)
      .catch((e) => showError(t("chat.loadFailed"), e))
      .finally(() => setBookmarksLoading(false));
  }, [listOpen, listTab, user, t]);

  const openHistory = () => {
    setListTab("history");
    setListOpen(true);
  };

  const reloadConversations = useCallback(async () => {
    if (!user) return;
    const rows = await listConversations(user.id);
    setConversations(rows);
  }, [user]);

  useEffect(() => {
    reloadConversations()
      .catch((e) => showError(t("chat.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reloadConversations, t]);

  useEffect(() => {
    if (!activeId) {
      if (!sendingRef.current) setMessages([]);
      return;
    }
    if (sendingRef.current) return;
    listMessages(activeId)
      .then((rows) => {
        if (sendingRef.current) return;
        setMessages(rows);
      })
      .catch(() => {
        if (!sendingRef.current) setMessages([]);
      });
  }, [activeId]);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: false }),
    );
    return () => cancelAnimationFrame(frame);
  }, [messages.length, typedText, sending]);

  const startNewChat = async () => {
    setListOpen(false);
    setActiveId(null);
    setMessages([]);
    setDraft("");
    setPendingImage(null);
    setPendingImageName("");
    resetTyped();
  };

  const pickImage = async () => {
    if (!selectedGrade || sending) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showError(t("chat.pickImageFailed"), new Error("Permission denied"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      const dataUrl = asset.base64
        ? `data:${mime};base64,${asset.base64}`
        : asset.uri;
      setPendingImage(dataUrl);
      setPendingImageName(asset.fileName || "image.jpg");
    } catch (e) {
      showError(t("chat.pickImageFailed"), e);
    }
  };

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if ((!body && !pendingImage) || sending || !user) return;

    if (!selectedGrade) {
      showError(t("status.selectGrade"), new Error(t("status.selectGradeDesc")));
      return;
    }

    const imageForMsg = pendingImage;
    const imageName = pendingImageName;
    const displayText =
      body ||
      (language === "fr" ? "[Image jointe — veuillez analyser]" : "[Image attached — please analyze]");

    const userLocalId = `local-${Date.now()}`;
    const assistantLocalId = `local-assistant-${Date.now() + 1}`;

    setDraft("");
    setPendingImage(null);
    setPendingImageName("");
    sendingRef.current = true;
    setSending(true);
    resetTyped();
    setMessages((prev) => [
      ...prev,
      {
        id: userLocalId,
        role: "user",
        content: displayText,
        created_at: new Date().toISOString(),
        imageUri: imageForMsg || undefined,
      },
      {
        id: assistantLocalId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      let conversationId = activeIdRef.current;
      if (!conversationId) {
        const title = body.length > 50 ? `${body.slice(0, 50)}…` : body || "Image";
        const created = await createConversation(user.id, title, selectedGrade);
        conversationId = created.id;
        activeIdRef.current = created.id;
        setActiveId(created.id);
      }

      await addMessage(conversationId, "user", displayText);

      const history = [...messages, { role: "user" as const, content: displayText }].map((m) => {
        if (m.role === "user" && imageForMsg && m.content === displayText) {
          return {
            role: "user" as const,
            content: [
              { type: "text" as const, text: body || displayText },
              { type: "image_url" as const, image_url: { url: imageForMsg } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      // If image is on the latest turn only, ensure multimodal content:
      const apiMessages =
        imageForMsg
          ? [
              ...messages.map((m) => ({ role: m.role, content: m.content })),
              {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: body || displayText },
                  { type: "image_url" as const, image_url: { url: imageForMsg } },
                ],
              },
            ]
          : history;

      const system = buildMamaSystemPrompt(
        selectedGrade,
        language,
        selectedCountry,
        curriculumTopics,
      );
      const reply = await askChatbotStreaming(apiMessages, system, (fullText) => {
        if (activeIdRef.current && activeIdRef.current !== conversationId) return;
        setTypedTarget(fullText);
      });
      await waitUntilCaughtUp();
      await addMessage(conversationId, "assistant", reply);
      if (!activeIdRef.current || activeIdRef.current === conversationId) {
        setMessages(await listMessages(conversationId));
      }
      await reloadConversations();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("local-")));
      setDraft(body);
      if (imageForMsg) {
        setPendingImage(imageForMsg);
        setPendingImageName(imageName || "image.jpg");
      }
      showError(t("chat.error"), e);
    } finally {
      sendingRef.current = false;
      setSending(false);
      resetTyped();
    }
  };

  const regenerateLast = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || sending) return;
    setMessages((prev) => {
      const next = [...prev];
      if (next[next.length - 1]?.role === "assistant") next.pop();
      return next;
    });
    await send(lastUser.content);
  };

  const worksheetExportTitle = useMemo(
    () => `Primary ${selectedGrade || "?"} — MAMA Math`,
    [selectedGrade],
  );

  const handleRate = async (msgId: string, rating: number) => {
    if (msgId.startsWith("local-")) return;
    try {
      const msg = messages.find((m) => m.id === msgId);
      const newRating = msg?.rating === rating ? null : rating;
      await updateMessageRating(msgId, newRating);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: newRating } : m)));
      showSuccess(t("status.rated"), "");
    } catch (e) {
      showError(t("status.error"), e);
    }
  };

  const handleBookmark = async (msgId: string) => {
    if (msgId.startsWith("local-")) return;
    try {
      const msg = messages.find((m) => m.id === msgId);
      const newVal = !msg?.bookmarked;
      await toggleMessageBookmark(msgId, newVal);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, bookmarked: newVal } : m)));
      showSuccess(t(newVal ? "status.bookmarked" : "status.unbookmarked"), "");
    } catch (e) {
      showError(t("status.error"), e);
    }
  };

  const handleCopyLatex = async (md: string) => {
    const latex = extractLatexSnippets(md);
    if (!latex) {
      showError(t("chat.latexEmpty"), new Error(t("chat.latexEmptyDesc")));
      return;
    }
    await Clipboard.setStringAsync(latex);
    showSuccess(t("chat.latexCopied"), "");
  };

  const handleSharePdf = async (md: string) => {
    try {
      await shareWorksheetPdf(md, worksheetExportTitle);
      showSuccess(t("chat.pdfShared"), savedFileHint("mama-worksheet.pdf"));
    } catch (e) {
      showError(t("status.error"), e);
    }
  };

  const handleShareWord = async (md: string) => {
    try {
      await shareWorksheetDocx(md, worksheetExportTitle);
      showSuccess(t("chat.wordShared"), savedFileHint("mama-worksheet.docx"));
    } catch (e) {
      showError(t("status.error"), e);
    }
  };

  const handleShareExcel = async (md: string) => {
    try {
      const ok = await shareMarkdownTableExcel(md, "mama-chat-table");
      if (ok) {
        showSuccess(t("chat.excelShared"), savedFileHint("mama-chat-table.xls"));
        return;
      }
      await shareRubricExcel("mama-rubric");
      showSuccess(t("chat.excelTemplate"), t("chat.excelTemplateDesc"));
    } catch (e) {
      showError(t("status.error"), e);
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const flag = selectedCountry === "cameroon" ? "🇨🇲" : "🇳🇬";
  const gradeLabel = selectedGrade
    ? `${flag} ${t("app.primary")} ${selectedGrade}`
    : `${flag} ${t("app.selectClass")}`;

  const hasMessages = messages.length > 0;
  const footerText =
    selectedCountry === "nigeria" ? t("input.footerNigeria") : t("input.footer");
  const canCompose = !!selectedGrade && !sending;
  const canSend = canCompose && (!!draft.trim() || !!pendingImage);

  const palette = darkMode
    ? {
        bg: colors.gray900,
        surface: colors.gray800,
        text: colors.gray100,
        muted: colors.gray400,
        border: colors.gray700,
        bubble: colors.gray800,
      }
    : {
        bg: colors.bg,
        surface: colors.surface,
        text: colors.text,
        muted: colors.textMuted,
        border: colors.border,
        bubble: colors.surface,
      };

  return (
    <DashboardShell
      title={t("app.title")}
      subtitle={gradeLabel}
      loading={loading}
      scroll={false}
      padded={false}
      fill
      hideAvatar
      headerRight={
        <View style={styles.headerActions}>
          <IconButton accessibilityLabel={t("chat.history")} onPress={openHistory}>
            <History size={19} color={colors.textSecondary} />
          </IconButton>
          <IconButton
            accessibilityLabel={language === "fr" ? "Langue" : "Language"}
            onPress={() => setLanguage(language === "en" ? "fr" : "en")}
          >
            <Globe size={18} color={colors.textSecondary} />
          </IconButton>
          <IconButton
            accessibilityLabel={darkMode ? "Light mode" : "Dark mode"}
            onPress={() => setDarkMode((d) => !d)}
          >
            {darkMode ? (
              <Sun size={18} color={colors.amber} />
            ) : (
              <Moon size={18} color={colors.textSecondary} />
            )}
          </IconButton>
          <IconButton accessibilityLabel={t("chat.newChat")} onPress={startNewChat} tone="brand">
            <MessageSquarePlus size={19} color={colors.brandDeep} />
          </IconButton>
        </View>
      }
      footer={
        <View style={[styles.composerWrap, darkMode && { backgroundColor: colors.gray900, borderTopColor: colors.gray800 }]}>
          {hasMessages && !sending && selectedGrade ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followRow}
              style={styles.followScroll}
            >
              {FOLLOW_UPS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => void send(t(key))}
                  style={({ pressed }) => [
                    styles.followChip,
                    darkMode && styles.followChipDark,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text variant="micro" weight="medium" color={darkMode ? colors.emerald : colors.brandDark}>
                    {t(key)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {pendingImage ? (
            <View style={styles.pendingRow}>
              <Image source={{ uri: pendingImage }} style={styles.pendingThumb} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="caption" weight="semibold" color={colors.brandDeep} numberOfLines={1}>
                  {pendingImageName}
                </Text>
                <Text variant="micro" color={colors.brand}>
                  {t("chat.imageAttached")}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setPendingImage(null);
                  setPendingImageName("");
                }}
                hitSlop={8}
              >
                <X size={18} color={colors.brand} />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.composerBar, !selectedGrade && styles.composerBarDisabled]}>
            <Pressable
              onPress={() => void pickImage()}
              disabled={!canCompose}
              accessibilityLabel="Upload image"
              style={({ pressed }) => [styles.composerIconBtn, pressed && { opacity: 0.8 }]}
            >
              <ImageIcon size={20} color={colors.white} />
            </Pressable>

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={selectedGrade ? t("input.placeholder") : t("input.selectFirst")}
              placeholderTextColor="rgba(255,255,255,0.65)"
              style={styles.composerInput}
              multiline
              maxLength={4000}
              editable={canCompose}
            />

            <Pressable
              onPress={() =>
                Alert.alert(t("app.title"), t("chat.voiceUnavailable"))
              }
              disabled={!canCompose}
              accessibilityLabel="Voice"
              style={({ pressed }) => [styles.composerIconBtn, pressed && { opacity: 0.8 }]}
            >
              <Mic size={20} color={colors.white} />
            </Pressable>

            <Pressable
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t("chat.send")}
              style={({ pressed }) => [
                styles.sendBtn,
                canSend ? styles.sendBtnActive : styles.sendBtnIdle,
                pressed && { opacity: 0.9 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.brandDeep} />
              ) : (
                <SendHorizontal size={18} color={colors.brandDeep} />
              )}
            </Pressable>
          </View>

          <View style={styles.footerMeta}>
            <Text variant="micro" color={palette.muted} style={{ flex: 1 }}>
              {footerText}
            </Text>
            <View style={[styles.langBadge, darkMode && { backgroundColor: colors.gray800 }]}>
              <Text variant="micro" weight="semibold" color={palette.muted}>
                {language === "fr" ? "FR" : "EN"}
              </Text>
            </View>
          </View>
        </View>
      }
    >
      {/* Country → Class (loads curriculum), matching web header controls */}
      <View style={[styles.controlsRow, darkMode && { backgroundColor: colors.gray900, borderBottomColor: colors.gray800 }]}>
        <Select
          compact
          value={selectedCountry}
          options={countryOptions}
          onChange={pickCountry}
          placeholder="CM"
        />
        <Select
          compact
          value={selectedGrade}
          options={gradeOptions}
          onChange={pickGrade}
          placeholder={t("app.class")}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.flex, { backgroundColor: palette.bg }]}
        contentContainerStyle={styles.thread}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!hasMessages ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeLogoWrap}>
              <Image source={mamaLogo} style={styles.welcomeLogo} />
            </View>
            <Text variant="h1" weight="extrabold" center color={palette.text}>
              {t("welcome.hello")} {firstName}!
            </Text>
            <Text variant="bodySm" color={palette.muted} center style={styles.welcomeIntro}>
              {t("welcome.intro")}{" "}
              <Text variant="bodySm" weight="bold" color={colors.brand}>
                {t("welcome.name")}
              </Text>
              {t("welcome.description")}
            </Text>
            {!selectedGrade ? (
              <Text variant="caption" weight="semibold" color={colors.amberText} center>
                {t("welcome.selectGrade")}
              </Text>
            ) : (
              <>
                <Text
                  variant="micro"
                  weight="semibold"
                  color={colors.textFaint}
                  uppercase
                  style={styles.sectionLabel}
                >
                  {t("welcome.exploreTopic")}
                </Text>
                <View style={styles.topicGrid}>
                  {TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    const query = language === "fr" ? topic.queryFr : topic.query;
                    const prefix = language === "fr" ? "Parlez-moi de" : "Tell me about";
                    const gradeWord = language === "fr" ? "pour le Primaire" : "for Primary";
                    return (
                      <Pressable
                        key={topic.titleKey}
                        onPress={() =>
                          void send(`${prefix} ${query} ${gradeWord} ${selectedGrade}`)
                        }
                        style={styles.topicPress}
                      >
                        <LinearGradient colors={topic.colors} style={styles.topicCard}>
                          <Icon size={26} color={colors.white} />
                          <Text
                            variant="caption"
                            weight="semibold"
                            color={colors.white}
                            style={{ marginTop: 8 }}
                          >
                            {t(topic.titleKey)}
                          </Text>
                          <View style={styles.topicOrb} />
                        </LinearGradient>
                      </Pressable>
                    );
                  })}
                </View>

                <Text
                  variant="micro"
                  weight="semibold"
                  color={colors.textFaint}
                  uppercase
                  style={styles.sectionLabel}
                >
                  {t("welcome.quickPrompts")}
                </Text>
                <View style={styles.promptWrap}>
                  {PROMPTS.map((qp) => {
                    const Icon = qp.icon;
                    const gradeWord = language === "fr" ? "pour le Primaire" : "for Primary";
                    return (
                      <Pressable
                        key={qp.key}
                        onPress={() => void send(`${t(qp.key)} ${gradeWord} ${selectedGrade}`)}
                        style={({ pressed }) => [
                          styles.promptPill,
                          darkMode && styles.promptPillDark,
                          pressed && { backgroundColor: colors.brandTint, borderColor: colors.brandMute },
                        ]}
                      >
                        <Icon size={14} color={darkMode ? colors.emerald : colors.brandDark} />
                        <Text
                          variant="caption"
                          weight="medium"
                          color={darkMode ? colors.gray300 : colors.textSecondary}
                        >
                          {t(qp.key)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        ) : (
          messages.map((m, idx) => {
            const mine = m.role === "user";
            const isLastAssistant =
              !mine && idx === messages.length - 1 && messages[idx]?.role === "assistant";
            const isStreamingThis = sending && isLastAssistant;
            const assistantBody = isStreamingThis ? typedText : m.content;
            const timeStr = formatTime(m.created_at);
            return (
              <View
                key={m.id}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
              >
                {!mine ? <MamaAvatar size={34} /> : null}
                <View style={styles.bubbleCol}>
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleTheirs,
                      !mine && darkMode && { backgroundColor: palette.bubble, borderColor: palette.border },
                    ]}
                  >
                    {mine ? (
                      <LinearGradient
                        colors={["#009E3F", "#008033"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.bubbleMineFill}
                      >
                        {m.imageUri ? (
                          <Image source={{ uri: m.imageUri }} style={styles.bubbleImage} />
                        ) : null}
                        <Text variant="bodySm" color={colors.white} style={styles.bubbleText} selectable>
                          {m.content}
                        </Text>
                      </LinearGradient>
                    ) : isStreamingThis && !assistantBody.trim() ? (
                      <>
                        <TypingDots />
                        <Text variant="micro" color={colors.textFaint} style={{ marginTop: 4 }}>
                          {t("chat.thinking")}
                        </Text>
                      </>
                    ) : isStreamingThis ? (
                      <View>
                        <Text
                          variant="bodySm"
                          color={darkMode ? colors.gray200 : colors.textSecondary}
                          style={styles.bubbleText}
                          selectable
                        >
                          {assistantBody}
                        </Text>
                        <StreamingCaret />
                      </View>
                    ) : (
                      <RichText source={m.content} />
                    )}
                  </View>

                  {/* Timestamp + actions — same as web MessageBubble */}
                  <View style={[styles.metaRow, mine && styles.metaRowMine]}>
                    {timeStr ? (
                      <Text variant="micro" color={colors.textFaint}>
                        {timeStr}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={async () => {
                        await Clipboard.setStringAsync(m.content);
                        showSuccess(t("action.copied"), t("chat.messageCopied"));
                      }}
                      accessibilityLabel={t("action.copy")}
                      hitSlop={8}
                      style={styles.metaBtn}
                    >
                      <Copy size={13} color={colors.textFaint} />
                    </Pressable>
                    {isLastAssistant && !sending ? (
                      <Pressable
                        onPress={() => void regenerateLast()}
                        accessibilityLabel={t("action.regenerate")}
                        hitSlop={8}
                        style={styles.metaBtn}
                      >
                        <RefreshCw size={13} color={colors.textFaint} />
                      </Pressable>
                    ) : null}
                    {!mine ? (
                      <>
                        <Pressable
                          onPress={() => void handleBookmark(m.id)}
                          accessibilityLabel={
                            m.bookmarked ? t("action.unbookmark") : t("action.bookmark")
                          }
                          hitSlop={8}
                          style={styles.metaBtn}
                        >
                          {m.bookmarked ? (
                            <BookmarkCheck size={13} color={colors.amber} />
                          ) : (
                            <Bookmark size={13} color={colors.textFaint} />
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => void handleRate(m.id, 1)}
                          accessibilityLabel={t("action.helpful")}
                          hitSlop={8}
                          style={styles.metaBtn}
                        >
                          <ThumbsUp
                            size={13}
                            color={m.rating === 1 ? colors.brand : colors.textFaint}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => void handleRate(m.id, -1)}
                          accessibilityLabel={t("action.notHelpful")}
                          hitSlop={8}
                          style={styles.metaBtn}
                        >
                          <ThumbsDown
                            size={13}
                            color={m.rating === -1 ? colors.danger : colors.textFaint}
                          />
                        </Pressable>
                      </>
                    ) : null}
                  </View>

                  {/* LaTeX / PDF / Word / Excel — assistant replies only */}
                  {!mine && assistantBody.trim() && !isStreamingThis ? (
                    <View style={styles.exportRow}>
                      <Pressable
                        onPress={() => void handleCopyLatex(m.content)}
                        style={({ pressed }) => [
                          styles.exportPill,
                          darkMode && styles.exportPillDark,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Braces size={12} color={darkMode ? colors.gray400 : colors.gray500} />
                        <Text variant="micro" weight="semibold" color={darkMode ? colors.gray400 : colors.gray500}>
                          {t("chat.exportLatex")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleSharePdf(m.content)}
                        style={({ pressed }) => [
                          styles.exportPill,
                          darkMode && styles.exportPillDark,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <FileText size={12} color={darkMode ? colors.gray400 : colors.gray500} />
                        <Text variant="micro" weight="semibold" color={darkMode ? colors.gray400 : colors.gray500}>
                          {t("chat.exportPdf")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleShareWord(m.content)}
                        style={({ pressed }) => [
                          styles.exportPill,
                          darkMode && styles.exportPillDark,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <FileType size={12} color={darkMode ? colors.gray400 : colors.gray500} />
                        <Text variant="micro" weight="semibold" color={darkMode ? colors.gray400 : colors.gray500}>
                          {t("chat.exportWord")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleShareExcel(m.content)}
                        style={({ pressed }) => [
                          styles.exportPill,
                          styles.exportPillExcel,
                          darkMode && styles.exportPillDark,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Table2 size={12} color={colors.brand} />
                        <Text variant="micro" weight="semibold" color={colors.brand}>
                          {t("chat.exportExcel")}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                {mine ? <UserAvatar name={firstName} size={34} /> : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Sheet
        visible={listOpen}
        onClose={() => setListOpen(false)}
        title={listTab === "bookmarks" ? t("sidebar.bookmarks") : t("chat.history")}
        subtitle={
          listTab === "bookmarks"
            ? `${bookmarks.length} ${t("sidebar.bookmarks").toLowerCase()}`
            : `${conversations.length} ${t("welcome.conversations")}`
        }
        footer={
          listTab === "history" ? (
            <SheetAction
              label={t("chat.newChat")}
              icon={<Plus size={18} color={colors.brandDark} />}
              onPress={startNewChat}
            />
          ) : undefined
        }
      >
        <View style={styles.listTabs}>
          <Pressable
            onPress={() => setListTab("history")}
            style={[styles.listTab, listTab === "history" && styles.listTabActive]}
          >
            <History size={14} color={listTab === "history" ? colors.brandDeep : colors.textMuted} />
            <Text
              variant="micro"
              weight="semibold"
              color={listTab === "history" ? colors.brandDeep : colors.textMuted}
            >
              {t("sidebar.history")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setListTab("bookmarks")}
            style={[styles.listTab, listTab === "bookmarks" && styles.listTabActiveBookmark]}
          >
            <Bookmark size={14} color={listTab === "bookmarks" ? colors.amber : colors.textMuted} />
            <Text
              variant="micro"
              weight="semibold"
              color={listTab === "bookmarks" ? colors.amber : colors.textMuted}
            >
              {t("sidebar.bookmarks")}
            </Text>
          </Pressable>
        </View>

        {listTab === "history" ? (
          conversations.length === 0 ? (
            <Text variant="caption" color={colors.textMuted} center>
              {t("chat.noConversations")}
            </Text>
          ) : (
            conversations.map((c) => (
              <View key={c.id} style={styles.historyRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SheetAction
                    label={c.title}
                    hint={`${c.grade ? `${t("app.primary")} ${c.grade} · ` : ""}${new Date(c.updated_at).toLocaleString(locale)}`}
                    icon={<Sparkles size={18} color={colors.brandDark} />}
                    onPress={() => {
                      setActiveId(c.id);
                      if (c.grade) {
                        const g = String(c.grade).replace(/\D/g, "") || c.grade;
                        if ((grades as readonly string[]).includes(g)) pickGrade(g);
                      }
                      setListOpen(false);
                    }}
                  />
                </View>
                {c.id === activeId ? <Badge label={t("status.active")} tone="brand" /> : null}
                <IconButton
                  accessibilityLabel={t("common.delete")}
                  size={34}
                  tone="danger"
                  onPress={() =>
                    confirmDelete(c.title, async () => {
                      try {
                        await deleteConversation(c.id);
                        if (activeId === c.id) {
                          setActiveId(null);
                          setMessages([]);
                        }
                        await reloadConversations();
                      } catch (e) {
                        showError(t("chat.deleteFailed"), e);
                      }
                    })
                  }
                >
                  <Trash2 size={16} color={colors.dangerText} />
                </IconButton>
              </View>
            ))
          )
        ) : bookmarksLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginVertical: space.xl }} />
        ) : bookmarks.length === 0 ? (
          <View style={styles.bookmarkEmpty}>
            <Bookmark size={36} color={colors.textFaint} />
            <Text variant="caption" weight="semibold" color={colors.textMuted} center>
              {t("sidebar.noBookmarks")}
            </Text>
            <Text variant="micro" color={colors.textFaint} center>
              {t("sidebar.bookmarkHint")}
            </Text>
          </View>
        ) : (
          bookmarks.map((bm) => (
            <View key={bm.id} style={styles.bookmarkCard}>
              <Pressable
                onPress={() => {
                  setActiveId(bm.conversation_id);
                  setListOpen(false);
                }}
                style={{ flex: 1, minWidth: 0 }}
              >
                <View style={styles.bookmarkCardHeader}>
                  <BookmarkCheck size={14} color={colors.amber} />
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                    {bm.conversation_title}
                  </Text>
                </View>
                <Text variant="caption" color={colors.text} numberOfLines={3}>
                  {bm.content.slice(0, 200)}
                  {bm.content.length > 200 ? "…" : ""}
                </Text>
                <Text variant="micro" color={colors.textFaint} style={{ marginTop: 6 }}>
                  {new Date(bm.created_at).toLocaleDateString(locale)}
                </Text>
              </Pressable>
              <View style={styles.bookmarkCardActions}>
                <IconButton
                  accessibilityLabel={t("action.copy")}
                  size={34}
                  onPress={async () => {
                    await Clipboard.setStringAsync(bm.content);
                    showSuccess(t("action.copied"), t("chat.messageCopied"));
                  }}
                >
                  <Copy size={15} color={colors.textMuted} />
                </IconButton>
                <IconButton
                  accessibilityLabel={t("action.unbookmark")}
                  size={34}
                  tone="danger"
                  onPress={async () => {
                    try {
                      await toggleMessageBookmark(bm.id, false);
                      setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));
                      setMessages((prev) =>
                        prev.map((m) => (m.id === bm.id ? { ...m, bookmarked: false } : m)),
                      );
                      showSuccess(t("status.unbookmarked"), "");
                    } catch (e) {
                      showError(t("status.error"), e);
                    }
                  }}
                >
                  <X size={15} color={colors.dangerText} />
                </IconButton>
              </View>
            </View>
          ))
        )}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thread: {
    paddingHorizontal: space.md,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  welcome: {
    alignItems: "center",
    paddingTop: space.lg,
    paddingBottom: space.xl,
  },
  welcomeLogoWrap: {
    width: 140,
    height: 140,
    marginBottom: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeLogo: { width: 140, height: 140, resizeMode: "contain" },
  welcomeIntro: { marginTop: 6, marginBottom: 10, maxWidth: 340, lineHeight: 20 },
  sectionLabel: { marginTop: space.lg, marginBottom: space.sm, alignSelf: "center" },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
    maxWidth: 420,
    justifyContent: "center",
  },
  topicPress: { width: "47%", minWidth: 140, flexGrow: 1, maxWidth: 200 },
  topicCard: {
    borderRadius: radius.xl,
    padding: space.md,
    minHeight: 96,
    overflow: "hidden",
  },
  topicOrb: {
    position: "absolute",
    right: -16,
    bottom: -16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  promptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    maxWidth: 420,
  },
  promptPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  promptPillDark: {
    backgroundColor: colors.gray800,
    borderColor: colors.gray700,
  },
  bubbleRow: { flexDirection: "row", marginBottom: space.md, gap: 8, maxWidth: "100%" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubbleCol: { flexShrink: 1, maxWidth: "78%" },
  bubble: { borderRadius: radius.xl, overflow: "hidden" },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: {
    borderBottomLeftRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  bubbleMineFill: { padding: space.md },
  bubbleText: { lineHeight: 20 },
  bubbleImage: {
    width: "100%",
    height: 140,
    borderRadius: radius.md,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  metaRowMine: { justifyContent: "flex-end" },
  metaBtn: { padding: 4 },
  exportRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  exportPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  exportPillDark: {
    backgroundColor: colors.gray800,
    borderColor: colors.gray700,
  },
  exportPillExcel: {
    borderColor: colors.brandMute,
  },
  mamaAvatar: { overflow: "hidden", backgroundColor: colors.brandSoft },
  userAvatar: { alignItems: "center", justifyContent: "center" },
  typingBubble: { paddingVertical: 12, minWidth: 88 },
  caret: {
    width: 7,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.brand,
    marginTop: 8,
  },
  dotsRow: { flexDirection: "row", gap: 5, alignItems: "center", height: 16 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  composerWrap: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  followScroll: { marginBottom: 8, maxHeight: 40 },
  followRow: { gap: 8, paddingRight: space.md },
  followChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  followChipDark: {
    backgroundColor: colors.gray800,
    borderColor: colors.gray700,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
  },
  pendingThumb: { width: 48, height: 48, borderRadius: radius.md },
  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    backgroundColor: colors.brand,
    borderRadius: radius.xxl,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 52,
  },
  composerBarDisabled: { opacity: 0.85 },
  composerIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 36,
    paddingVertical: 8,
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  sendBtnActive: { opacity: 1 },
  sendBtnIdle: { opacity: 0.85 },
  footerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  langBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.gray100,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  listTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: space.md,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSunken,
  },
  listTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  listTabActive: {
    backgroundColor: colors.surface,
    ...shadow.xs,
  },
  listTabActiveBookmark: {
    backgroundColor: colors.surface,
    ...shadow.xs,
  },
  bookmarkEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  bookmarkCard: {
    flexDirection: "row",
    gap: 8,
    padding: space.md,
    marginBottom: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bookmarkCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  bookmarkCardActions: {
    justifyContent: "flex-start",
    gap: 2,
  },
});
