import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import ChatbotService from "@/services/chatbot";
import type { ChatMessage } from "@/services/chatbot";
import {
  supabase,
  createConversation,
  getConversations,
  getMessages,
  addMessage,
  updateConversationTitle,
  deleteConversation,
  updateMessageRating,
  toggleMessageBookmark,
  getBookmarkedMessages,
} from "@/lib/supabase";
import type { Conversation, ConversationMessage } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import {
  Send, Bot, Copy, Check, RefreshCw, GraduationCap, Sigma, Percent, Ruler,
  Library, Trash2, Download, MessageSquarePlus, Sparkles, ArrowDown, Lightbulb,
  Zap, Star, CornerDownLeft, Mic, MicOff, Image as ImageIcon, X, History,
  ChevronLeft, Pencil, Search, PanelLeftClose, PanelLeft,
  ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck, Moon, Sun, Globe, FileText,
} from "lucide-react";

/*  Constants  */

const GRADES = [1, 2, 3, 4, 5, 6];

const TOPIC_KEYS = [
  { icon: Sigma, titleKey: "topic.numbers", query: "Numbers & Operations", queryFr: "Nombres et Op�rations", color: "from-blue-500 to-indigo-600" },
  { icon: Library, titleKey: "topic.geometry", query: "Geometry & Shapes", queryFr: "G�om�trie et Formes", color: "from-purple-500 to-pink-600" },
  { icon: Ruler, titleKey: "topic.measurement", query: "Measurement", queryFr: "Mesures", color: "from-emerald-500 to-teal-600" },
  { icon: Percent, titleKey: "topic.data", query: "Data & Graphs", queryFr: "Donn�es et Graphiques", color: "from-orange-500 to-red-500" },
];

const PROMPT_KEYS = [
  { icon: Lightbulb, key: "prompt.lesson" },
  { icon: Star, key: "prompt.activity" },
  { icon: GraduationCap, key: "prompt.assessment" },
  { icon: Zap, key: "prompt.mistakes" },
];

/*  Typing Indicator  */

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-1 py-1">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 rounded-full bg-green-500"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
      />
    ))}
  </div>
);

/*  Code Block Component  */

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  darkMode: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children, darkMode }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1] || "";
  const code = String(children).replace(/\n$/, "");

  if (inline || !match) {
    return (
      <code className={cn("px-1.5 py-0.5 rounded text-sm font-mono", darkMode ? "bg-gray-700 text-green-300" : "bg-gray-100 text-green-700")}>
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative rounded-xl overflow-hidden my-3 border", darkMode ? "border-gray-600" : "border-gray-200")}>
      <div className={cn("flex items-center justify-between px-4 py-2 text-xs font-mono", darkMode ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500")}>
        <span>{lang.toUpperCase()}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-green-500 transition-colors">
          {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
      <SyntaxHighlighter
        style={darkMode ? oneDark : oneLight}
        language={lang}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.85rem" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

/*  Streaming Text  */

const StreamingText: React.FC<{ text: string; darkMode: boolean }> = ({ text, darkMode }) => (
  <div className={cn(
    "prose prose-sm max-w-none text-[14px] sm:text-[15px]",
    darkMode
      ? "prose-invert prose-headings:text-green-400 prose-strong:text-gray-100 prose-a:text-green-400 prose-li:marker:text-green-400 prose-code:bg-gray-700 prose-code:text-green-300 prose-pre:bg-gray-900 prose-pre:text-gray-100"
      : "prose-headings:text-green-800 prose-headings:font-semibold prose-strong:text-gray-900 prose-a:text-green-600 prose-li:marker:text-green-600 prose-code:bg-gray-100 prose-code:text-green-700 prose-pre:bg-gray-900 prose-pre:text-gray-100"
  )}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code: (props: any) => <CodeBlock {...props} darkMode={darkMode} />,
      }}
    >
      {text}
    </ReactMarkdown>
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.5, repeat: Infinity }}
      className="inline-block w-2 h-4 bg-green-500 ml-0.5 align-middle rounded-sm"
    />
  </div>
);

/*  Message Bubble  */

interface MessageBubbleProps {
  message: ChatMessage & { rating?: number | null; bookmarked?: boolean | null; dbId?: string };
  streamingText?: string;
  isStreaming?: boolean;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
  onRate?: (rating: number) => void;
  onBookmark?: () => void;
  isLast: boolean;
  isAssistant: boolean;
  userName: string;
  darkMode: boolean;
  lang: Language;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(
  ({ message, streamingText, isStreaming, onCopy, onRegenerate, onRate, onBookmark, isLast, isAssistant, userName, darkMode, lang }) => {
    const [copied, setCopied] = useState(false);
    const displayText = isStreaming && streamingText !== undefined ? streamingText : message.content;

    const handleCopy = () => {
      onCopy(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const proseClasses = cn(
      "prose prose-sm max-w-none text-[14px] sm:text-[15px]",
      darkMode
        ? "prose-invert prose-headings:text-green-400 prose-strong:text-gray-100 prose-a:text-green-400 prose-li:marker:text-green-400 prose-code:bg-gray-700 prose-code:text-green-300 prose-pre:bg-gray-900 prose-pre:text-gray-100"
        : "prose-headings:text-green-800 prose-headings:font-semibold prose-strong:text-gray-900 prose-a:text-green-600 prose-li:marker:text-green-600 prose-code:bg-gray-100 prose-code:text-green-700 prose-pre:bg-gray-900 prose-pre:text-gray-100"
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn("flex gap-2 sm:gap-3 group", isAssistant ? "justify-start" : "justify-end")}
      >
        {isAssistant && (
          <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center shadow-md shadow-green-600/20 self-end">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        )}

        <div className="max-w-[88%] sm:max-w-[75%] relative">
          {message.image_url && (
            <div className="mb-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-w-[200px]">
              <img src={message.image_url} alt="Uploaded" className="w-full h-auto object-cover" />
            </div>
          )}

          <div className={cn(
            "rounded-2xl px-4 py-3 shadow-sm",
            isAssistant
              ? darkMode
                ? "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-md"
                : "bg-white border border-gray-100 text-gray-800 rounded-bl-md"
              : "bg-gradient-to-br from-green-600 to-green-700 text-white rounded-br-md shadow-green-600/20"
          )}>
            {isAssistant ? (
              isStreaming ? (
                <StreamingText text={displayText} darkMode={darkMode} />
              ) : (
                <div className={proseClasses}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code: (props: any) => <CodeBlock {...props} darkMode={darkMode} />,
                    }}
                  >
                    {displayText}
                  </ReactMarkdown>
                </div>
              )
            ) : (
              <p className="text-[14px] sm:text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
            )}
          </div>

          {/* Actions row */}
          <div className={cn("flex items-center gap-1.5 mt-1 px-1 flex-wrap", isAssistant ? "justify-start" : "justify-end")}>
            <span className={cn("text-[10px]", darkMode ? "text-gray-500" : "text-gray-400")}>{timeStr}</span>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Copy */}
              <button onClick={handleCopy} className={cn("p-1 rounded-md transition-colors", darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600")} title={t(lang, 'action.copy')}>
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>

              {/* Regenerate (last assistant only) */}
              {isAssistant && isLast && onRegenerate && !isStreaming && (
                <button onClick={onRegenerate} className={cn("p-1 rounded-md transition-colors", darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-600")} title={t(lang, 'action.regenerate')}>
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}

              {/* Bookmark (assistant only) */}
              {isAssistant && !isStreaming && onBookmark && (
                <button onClick={onBookmark} className={cn("p-1 rounded-md transition-colors", message.bookmarked ? "text-amber-500" : darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-amber-400" : "hover:bg-gray-100 text-gray-400 hover:text-amber-500")} title={message.bookmarked ? t(lang, 'action.unbookmark') : t(lang, 'action.bookmark')}>
                  {message.bookmarked ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                </button>
              )}

              {/* Thumbs up / down (assistant only) */}
              {isAssistant && !isStreaming && onRate && (
                <>
                  <button onClick={() => onRate(1)} className={cn("p-1 rounded-md transition-colors", message.rating === 1 ? "text-green-500" : darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-green-400" : "hover:bg-gray-100 text-gray-400 hover:text-green-500")} title={t(lang, 'action.helpful')}>
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => onRate(-1)} className={cn("p-1 rounded-md transition-colors", message.rating === -1 ? "text-red-500" : darkMode ? "hover:bg-gray-700 text-gray-500 hover:text-red-400" : "hover:bg-gray-100 text-gray-400 hover:text-red-500")} title={t(lang, 'action.notHelpful')}>
                    <ThumbsDown className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {!isAssistant && (
          <div className={cn("shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shadow-md self-end", darkMode ? "bg-gradient-to-br from-gray-600 to-gray-800" : "bg-gradient-to-br from-gray-700 to-gray-900")}>
            <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </motion.div>
    );
  }
);
MessageBubble.displayName = "MessageBubble";

/* ──────────────────── Bookmark Card ─────────────────────────── */

interface BookmarkCardProps {
  bm: ConversationMessage & { conversation_title?: string };
  darkMode: boolean;
  language: Language;
  onCopied: () => void;
  onUnbookmark: () => void;
}

const BookmarkCard: React.FC<BookmarkCardProps> = ({ bm, darkMode, language, onCopied, onUnbookmark }) => {
  const [bmCopied, setBmCopied] = useState(false);
  const handleBmCopy = () => {
    navigator.clipboard.writeText(bm.content);
    setBmCopied(true);
    onCopied();
    setTimeout(() => setBmCopied(false), 2000);
  };
  return (
    <div
      onClick={handleBmCopy}
      className={cn("px-3 py-3 rounded-xl mb-2 border transition-all cursor-pointer group/bm", darkMode ? "bg-gray-800 border-gray-700 hover:border-amber-800/50 active:bg-gray-750" : "bg-white border-gray-100 hover:border-amber-200 active:bg-amber-50")}>
      <div className="flex items-center gap-2 mb-1.5">
        <BookmarkCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span className={cn("text-[11px] font-medium truncate flex-1", darkMode ? "text-gray-400" : "text-gray-500")}>{bm.conversation_title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onUnbookmark(); }}
          className={cn("p-1 rounded-md transition-colors opacity-0 group-hover/bm:opacity-100", darkMode ? "hover:bg-red-900/40 text-gray-500 hover:text-red-400" : "hover:bg-red-50 text-gray-400 hover:text-red-500")}
          title={t(language, "action.unbookmark")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <span className={cn("flex items-center gap-1 text-[10px] font-medium transition-all",
          bmCopied ? "text-green-500" : darkMode ? "text-gray-600 group-hover/bm:text-amber-400" : "text-gray-300 group-hover/bm:text-amber-500"
        )}>
          {bmCopied ? <><Check className="w-3 h-3" /> {t(language, "action.copied")}</> : <><Copy className="w-3 h-3" /> {t(language, "action.copy")}</>}
        </span>
      </div>
      <p className={cn("text-sm line-clamp-3 leading-relaxed", darkMode ? "text-gray-300" : "text-gray-700")}>{bm.content.slice(0, 200)}{bm.content.length > 200 ? "..." : ""}</p>
      <p className={cn("text-[10px] mt-1.5", darkMode ? "text-gray-600" : "text-gray-400")}>{new Date(bm.created_at).toLocaleDateString()}</p>
    </div>
  );
};

/*  Helpers  */

const resizeImageToBase64 = (file: File, maxSize = 512): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; } }
        else { if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const groupByDate = (convos: Conversation[], lang: Language) => {
  const groups: { label: string; items: Conversation[] }[] = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const todayItems: Conversation[] = [];
  const yesterdayItems: Conversation[] = [];
  const weekItems: Conversation[] = [];
  const olderItems: Conversation[] = [];

  convos.forEach((c) => {
    const d = new Date(c.updated_at); d.setHours(0, 0, 0, 0);
    if (d.getTime() >= today.getTime()) todayItems.push(c);
    else if (d.getTime() >= yesterday.getTime()) yesterdayItems.push(c);
    else if (d.getTime() >= weekAgo.getTime()) weekItems.push(c);
    else olderItems.push(c);
  });

  if (todayItems.length) groups.push({ label: t(lang, "date.today"), items: todayItems });
  if (yesterdayItems.length) groups.push({ label: t(lang, "date.yesterday"), items: yesterdayItems });
  if (weekItems.length) groups.push({ label: t(lang, "date.lastWeek"), items: weekItems });
  if (olderItems.length) groups.push({ label: t(lang, "date.older"), items: olderItems });
  return groups;
};

/* 
     MAIN CHATBOT COMPONENT
    */

const Chatbot: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [chatbotService] = useState(() => new ChatbotService());

  /*  Preferences (persisted in localStorage)  */
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("mama-dark") === "true");
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem("mama-lang") as Language) || "en");

  useEffect(() => { localStorage.setItem("mama-dark", String(darkMode)); }, [darkMode]);
  useEffect(() => { localStorage.setItem("mama-lang", language); }, [language]);

  /*  Conversation state  */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(ChatMessage & { rating?: number | null; bookmarked?: boolean | null; dbId?: string })[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  /*  Sidebar  */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"history" | "bookmarks">("history");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [bookmarks, setBookmarks] = useState<(ConversationMessage & { conversation_title?: string })[]>([]);

  /*  Voice input  */
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  /*  Image upload  */
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  /*  Refs  */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const userName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const hasMessages = messages.length > 0;

  /*  Load conversations on mount  */
  useEffect(() => {
    if (user?.id) {
      getConversations(user.id).then(setConversations).catch(console.error);
    }
  }, [user?.id]);

  /*  Load bookmarks when tab opens  */
  useEffect(() => {
    if (sidebarTab === "bookmarks" && user?.id) {
      getBookmarkedMessages(user.id).then(setBookmarks).catch(console.error);
    }
  }, [sidebarTab, user?.id]);

  /*  Auto-scroll  */
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingText, isLoading, scrollToBottom]);

  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /*  Auto-resize textarea  */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [inputMessage]);

  /*  Focus edit input  */
  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  /*  Load conversation messages  */
  const loadConversation = useCallback(async (convo: Conversation) => {
    setActiveConvoId(convo.id);
    setSelectedGrade(convo.grade);
    setSidebarOpen(false);

    const dbMsgs = await getMessages(convo.id);
    const mapped = dbMsgs.map((m) => ({
      id: m.id,
      dbId: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      timestamp: new Date(m.created_at),
      image_url: m.image_url || undefined,
      rating: m.rating ?? null,
      bookmarked: m.bookmarked ?? false,
    }));
    setMessages(mapped);
  }, []);

  /*  New chat  */
  const handleNewChat = useCallback(() => {
    setActiveConvoId(null);
    setMessages([]);
    setInputMessage("");
    setStreamingText("");
    setIsStreamingActive(false);
    setPendingImage(null);
    setPendingImageName("");
    textareaRef.current?.focus();
  }, []);

  /*  Send message  */
  const handleSendMessage = useCallback(
    async (messageContent?: string) => {
      const content = (messageContent || inputMessage).trim();
      if (!content || isLoading) return;

      if (!selectedGrade) {
        toast({ title: t(language, "status.selectGrade"), description: t(language, "status.selectGradeDesc"), variant: "destructive" });
        return;
      }

      let convoId = activeConvoId;
      if (!convoId && user?.id) {
        const title = content.length > 50 ? content.slice(0, 50) + "..." : content;
        const newConvo = await createConversation(user.id, title, selectedGrade);
        if (!newConvo) {
          toast({ title: t(language, "status.error"), description: t(language, "status.createFailed"), variant: "destructive" });
          return;
        }
        convoId = newConvo.id;
        setActiveConvoId(convoId);
        setConversations((prev) => [newConvo, ...prev]);
      }

      const imageForMsg = pendingImage;
      const userMsg: ChatMessage & { dbId?: string } = {
        id: Date.now().toString(), role: "user", content, timestamp: new Date(),
        image_url: imageForMsg || undefined,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputMessage("");
      setPendingImage(null);
      setPendingImageName("");
      setIsLoading(true);
      setStreamingText("");
      setIsStreamingActive(true);

      if (textareaRef.current) textareaRef.current.style.height = "auto";

      // Save user message to DB
      if (convoId) {
        const saved = await addMessage(convoId, "user", content, imageForMsg);
        if (saved) setMessages((prev) => prev.map((m) => m.id === userMsg.id ? { ...m, dbId: saved.id } : m));
      }

      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

      let fullResponseText = "";

      try {
        const response = await chatbotService.sendMessageStreaming(
          content, messages, selectedGrade,
          (chunk: string) => { fullResponseText += chunk; setStreamingText(fullResponseText); },
          imageForMsg || undefined, language
        );

        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: response.message || fullResponseText } : m));

        if (convoId) {
          const savedAssistant = await addMessage(convoId, "assistant", response.message || fullResponseText);
          if (savedAssistant) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, dbId: savedAssistant.id } : m));
        }

        if (!response.success) {
          toast({ title: t(language, "status.issue"), description: response.error || t(language, "status.unexpected"), variant: "destructive" });
        }
      } catch {
        toast({ title: t(language, "status.error"), description: t(language, "status.sendFailed"), variant: "destructive" });
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
        setIsStreamingActive(false);
        setStreamingText("");
        textareaRef.current?.focus();
      }
    },
    [inputMessage, isLoading, selectedGrade, messages, chatbotService, toast, activeConvoId, user?.id, pendingImage, language]
  );

  /*  Regenerate  */
  const handleRegenerate = useCallback(async () => {
    if (isLoading || messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    setMessages((prev) => prev.slice(0, -1));
    setIsLoading(true);
    setStreamingText("");
    setIsStreamingActive(true);

    const assistantId = Date.now().toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

    let fullText = "";
    try {
      const history = messages.slice(0, -1);
      const response = await chatbotService.sendMessageStreaming(
        lastUserMsg.content, history, selectedGrade,
        (chunk) => { fullText += chunk; setStreamingText(fullText); },
        undefined, language
      );
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: response.message || fullText } : m));
      if (activeConvoId) {
        const saved = await addMessage(activeConvoId, "assistant", response.message || fullText);
        if (saved) setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, dbId: saved.id } : m));
      }
    } catch {
      toast({ title: t(language, "status.error"), description: t(language, "status.regenFailed"), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsStreamingActive(false);
      setStreamingText("");
    }
  }, [isLoading, messages, chatbotService, selectedGrade, toast, activeConvoId, language]);

  /*  PDF export  */
  const handleExportPdf = () => {
    if (!messages.length) return;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const usableW = pageW - margin * 2;
    let y = margin;

    const addPage = () => { doc.addPage(); y = margin; };
    const checkPage = (needed: number) => { if (y + needed > pageH - margin) addPage(); };

    // Header
    doc.setFillColor(22, 163, 74);
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("MAMA Math  Chat Export", margin, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${new Date().toLocaleDateString()} | Primary ${selectedGrade}`, pageW - margin, 18, { align: "right" });
    y = 36;

    doc.setDrawColor(229, 231, 235);

    messages.forEach((msg) => {
      const label = msg.role === "user" ? userName : "MAMA";
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      // Label
      checkPage(20);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(msg.role === "user" ? 55 : 22, msg.role === "user" ? 65 : 163, msg.role === "user" ? 81 : 74);
      doc.text(`${label}    ${time}`, margin, y);
      y += 5;

      // Content
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 81);
      const lines = doc.splitTextToSize(msg.content, usableW);
      for (const line of lines) {
        checkPage(6);
        doc.text(line, margin, y);
        y += 5;
      }

      // Separator
      y += 3;
      checkPage(4);
      doc.setLineWidth(0.2);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(t(language, "input.footer"), pageW / 2, pageH - 8, { align: "center" });

    doc.save(`mama-chat-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: t(language, "status.exported"), description: t(language, "status.chatDownloaded") });
  };

  /*  Delete conversation  */
  const handleDeleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvoId === id) handleNewChat();
      toast({ title: t(language, "status.deleted") });
    } catch {
      toast({ title: t(language, "status.error"), description: t(language, "status.deleteFailed"), variant: "destructive" });
    }
  };

  /*  Rename conversation  */
  const handleSaveTitle = async (id: string) => {
    if (!editTitle.trim()) { setEditingId(null); return; }
    try {
      await updateConversationTitle(id, editTitle.trim());
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, title: editTitle.trim() } : c));
      setEditingId(null);
    } catch {
      toast({ title: t(language, "status.error"), description: t(language, "status.renameFailed"), variant: "destructive" });
    }
  };

  /*  Rate message  */
  const handleRate = useCallback(async (msgId: string, dbId: string | undefined, rating: number) => {
    if (!dbId) return;
    try {
      const msg = messages.find((m) => m.id === msgId);
      const newRating = msg?.rating === rating ? null : rating;
      await updateMessageRating(dbId, newRating);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, rating: newRating } : m));
      toast({ title: t(language, "status.rated") });
    } catch {
      toast({ title: t(language, "status.error"), variant: "destructive" });
    }
  }, [messages, toast, language]);

  /*  Bookmark message  */
  const handleBookmark = useCallback(async (msgId: string, dbId: string | undefined) => {
    if (!dbId) return;
    try {
      const msg = messages.find((m) => m.id === msgId);
      const newVal = !msg?.bookmarked;
      await toggleMessageBookmark(dbId, newVal);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, bookmarked: newVal } : m));
      toast({ title: t(language, newVal ? "status.bookmarked" : "status.unbookmarked") });
    } catch {
      toast({ title: t(language, "status.error"), variant: "destructive" });
    }
  }, [messages, toast, language]);

  /*  Voice input  */
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: t(language, "status.voiceNotSupported"), description: t(language, "status.voiceNotSupportedDesc"), variant: "destructive" });
      return;
    }
    if (isListening && recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); return; }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === "fr" ? "fr-FR" : "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInputMessage((prev) => {
        const base = prev.replace(/\[listening\.\.\.\]$/, "").trim();
        return base ? base + " " + transcript : transcript;
      });
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => { setIsListening(false); toast({ title: t(language, "status.voiceError"), description: t(language, "status.voiceErrorDesc"), variant: "destructive" }); };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, toast, language]);

  /*  Image upload  */
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: t(language, "status.fileTooLarge"), description: t(language, "status.fileTooLargeDesc"), variant: "destructive" }); return; }
    if (!file.type.startsWith("image/")) { toast({ title: t(language, "status.invalidFile"), description: t(language, "status.invalidFileDesc"), variant: "destructive" }); return; }
    try {
      const base64 = await resizeImageToBase64(file, 512);
      setPendingImage(base64);
      setPendingImageName(file.name);
    } catch { toast({ title: t(language, "status.error"), description: t(language, "status.imageError"), variant: "destructive" }); }
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  /*  Keyboard  */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: t(language, "action.copied") }); };

  /*  Filtered conversations  */
  const filteredConvos = searchQuery
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;
  const groupedConvos = groupByDate(filteredConvos, language);

  const suggestKeys = ["suggest.assess", "suggest.example", "suggest.worksheet", "suggest.activity"];

  /*   JSX   */

  return (
    <div className={cn("flex h-[calc(100vh-4rem)] overflow-hidden transition-colors duration-300", darkMode ? "bg-gray-900" : "bg-gradient-to-b from-gray-50 to-white")}>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

      {/*  History / Bookmarks Sidebar  */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn("fixed lg:relative z-50 lg:z-auto w-[300px] h-full border-r flex flex-col shadow-xl lg:shadow-none", darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100")}
            >
              {/* Sidebar header */}
              <div className={cn("p-4 border-b", darkMode ? "border-gray-800" : "border-gray-100")}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-green-600" />
                    <h2 className={cn("font-bold", darkMode ? "text-gray-100" : "text-gray-900")}>{t(language, "sidebar.history")}</h2>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className={cn("p-1.5 rounded-lg transition-colors", darkMode ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-400")}>
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabs: History / Bookmarks */}
                <div className={cn("flex rounded-xl p-0.5 mb-3", darkMode ? "bg-gray-800" : "bg-gray-100")}>
                  <button
                    onClick={() => setSidebarTab("history")}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      sidebarTab === "history" ? (darkMode ? "bg-gray-700 text-green-400 shadow-sm" : "bg-white text-green-700 shadow-sm") : (darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                    )}>
                    <History className="w-3.5 h-3.5" />{t(language, "sidebar.history")}
                  </button>
                  <button
                    onClick={() => setSidebarTab("bookmarks")}
                    className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      sidebarTab === "bookmarks" ? (darkMode ? "bg-gray-700 text-amber-400 shadow-sm" : "bg-white text-amber-600 shadow-sm") : (darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                    )}>
                    <Bookmark className="w-3.5 h-3.5" />{t(language, "sidebar.bookmarks")}
                  </button>
                </div>

                {sidebarTab === "history" && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t(language, "sidebar.search")}
                      className={cn("pl-9 h-9 text-sm rounded-xl", darkMode ? "bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-500" : "border-gray-200")}
                    />
                  </div>
                )}
              </div>

              {/* New chat */}
              {sidebarTab === "history" && (
                <div className="px-3 py-2">
                  <Button onClick={() => { handleNewChat(); setSidebarOpen(false); }}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl h-10 text-sm shadow-md shadow-green-600/20">
                    <MessageSquarePlus className="w-4 h-4 mr-2" />{t(language, "sidebar.newConversation")}
                  </Button>
                </div>
              )}

              {/* Content area */}
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {sidebarTab === "history" ? (
                  <>
                    {groupedConvos.length === 0 && (
                      <div className={cn("text-center py-12 text-sm", darkMode ? "text-gray-500" : "text-gray-400")}>
                        <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p>{searchQuery ? t(language, "sidebar.noMatches") : t(language, "sidebar.noConversations")}</p>
                      </div>
                    )}
                    {groupedConvos.map((group) => (
                      <div key={group.label} className="mt-3">
                        <p className={cn("text-[11px] font-semibold uppercase tracking-wider px-2 mb-1.5", darkMode ? "text-gray-500" : "text-gray-400")}>{group.label}</p>
                        {group.items.map((convo) => (
                          <div key={convo.id} onClick={() => loadConversation(convo)}
                            className={cn("group/item flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-sm mb-0.5",
                              activeConvoId === convo.id
                                ? darkMode ? "bg-green-900/30 text-green-400 border border-green-800/50" : "bg-green-50 text-green-800 border border-green-100"
                                : darkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"
                            )}>
                            {editingId === convo.id ? (
                              <Input ref={editInputRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => handleSaveTitle(convo.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(convo.id); if (e.key === "Escape") setEditingId(null); }}
                                className="h-7 text-sm flex-1" onClick={(e) => e.stopPropagation()} />
                            ) : (
                              <>
                                <span className="flex-1 truncate">{convo.title}</span>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingId(convo.id); setEditTitle(convo.title); }}
                                    className={cn("p-1 rounded", darkMode ? "hover:bg-green-800/40 text-gray-500 hover:text-green-400" : "hover:bg-green-100 text-gray-400 hover:text-green-600")}><Pencil className="w-3 h-3" /></button>
                                  <button onClick={(e) => handleDeleteConvo(convo.id, e)}
                                    className={cn("p-1 rounded", darkMode ? "hover:bg-red-900/40 text-gray-500 hover:text-red-400" : "hover:bg-red-100 text-gray-400 hover:text-red-500")}><Trash2 className="w-3 h-3" /></button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                ) : (
                  /* Bookmarks tab */
                  <>
                    {bookmarks.length === 0 ? (
                      <div className={cn("text-center py-12 text-sm", darkMode ? "text-gray-500" : "text-gray-400")}>
                        <Bookmark className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium mb-1">{t(language, "sidebar.noBookmarks")}</p>
                        <p className="text-xs">{t(language, "sidebar.bookmarkHint")}</p>
                      </div>
                    ) : (
                      bookmarks.map((bm) => (
                        <BookmarkCard
                          key={bm.id}
                          bm={bm}
                          darkMode={darkMode}
                          language={language}
                          onCopied={() => toast({ title: t(language, "action.copied") })}
                          onUnbookmark={async () => {
                            try {
                              await toggleMessageBookmark(bm.id, false);
                              setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));
                              setMessages((prev) => prev.map((m) => m.dbId === bm.id ? { ...m, bookmarked: false } : m));
                              toast({ title: t(language, "status.unbookmarked") });
                            } catch {
                              toast({ title: t(language, "status.error"), variant: "destructive" });
                            }
                          }}
                        />
                      )))
                    }
                  </>
                )}
              </div>

              <div className={cn("p-3 border-t text-[11px] text-center", darkMode ? "border-gray-800 text-gray-600" : "border-gray-100 text-gray-400")}>
                {conversations.length} {t(language, "welcome.conversations")}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/*  Main Chat Area  */}
      <div className="flex-1 flex flex-col min-w-0">
        {/*  Top bar  */}
        <div className={cn("shrink-0 backdrop-blur-md border-b z-20", darkMode ? "bg-gray-900/90 border-gray-800" : "bg-white/90 border-gray-100")}>
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="icon" className={cn("h-9 w-9 rounded-xl shrink-0", darkMode ? "text-gray-400 hover:text-green-400 hover:bg-gray-800" : "text-gray-500 hover:text-green-600 hover:bg-green-50")}
                onClick={() => setSidebarOpen(!sidebarOpen)} title={t(language, "sidebar.history")}>
                <PanelLeft className="w-5 h-5" />
              </Button>
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 shadow-md shadow-green-600/20 shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className={cn("text-base sm:text-lg font-bold truncate leading-tight", darkMode ? "text-gray-100" : "text-gray-900")}>{t(language, "app.title")}</h1>
                <div className="flex items-center gap-1.5">
                  {selectedGrade ? (
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", darkMode ? "bg-green-900/40 text-green-400 border-green-800" : "bg-green-50 text-green-700 border-green-200")}>{t(language, "app.primary")} {selectedGrade}</Badge>
                  ) : (
                    <span className={cn("text-[11px]", darkMode ? "text-gray-500" : "text-gray-400")}>{t(language, "app.selectClass")}</span>
                  )}
                  {isStreamingActive && <span className="text-[10px] text-green-500 animate-pulse">{t(language, "app.typing")}</span>}
                </div>
              </div>
            </div>

            {/* Controls cluster */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Grade select */}
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className={cn("h-9 w-[110px] sm:w-[130px] text-sm rounded-xl focus:ring-green-500/30", darkMode ? "bg-gray-800 border-gray-700 text-gray-200" : "border-gray-200")}>
                  <SelectValue placeholder={t(language, "app.class")} />
                </SelectTrigger>
                <SelectContent className={darkMode ? "bg-gray-800 border-gray-700" : ""}>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={`${g}`} className={darkMode ? "text-gray-200 focus:bg-gray-700" : ""}>
                      <span className="flex items-center gap-2"><GraduationCap className="w-3.5 h-3.5 text-green-600" />{t(language, "app.primary")} {g}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Language toggle */}
              <Button variant="ghost" size="icon" onClick={() => setLanguage((l) => l === "en" ? "fr" : "en")}
                className={cn("h-8 w-8 rounded-xl text-xs font-bold", darkMode ? "text-gray-400 hover:text-green-400 hover:bg-gray-800" : "text-gray-400 hover:text-green-600 hover:bg-green-50")}
                title={t(language, "lang.label")}>
                <Globe className="w-4 h-4" />
              </Button>

              {/* Dark mode toggle */}
              <Button variant="ghost" size="icon" onClick={() => setDarkMode((d) => !d)}
                className={cn("h-8 w-8 rounded-xl", darkMode ? "text-amber-400 hover:text-amber-300 hover:bg-gray-800" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100")}
                title={darkMode ? t(language, "action.lightMode") : t(language, "action.darkMode")}>
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>

              {/* PDF export */}
              {hasMessages && (
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-xl", darkMode ? "text-gray-400 hover:text-green-400 hover:bg-gray-800" : "text-gray-400 hover:text-green-600 hover:bg-green-50")} onClick={handleExportPdf} title={t(language, "action.exportPdf")}>
                  <FileText className="w-4 h-4" />
                </Button>
              )}

              {/* New chat */}
              <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-xl", darkMode ? "text-gray-400 hover:text-green-400 hover:bg-gray-800" : "text-gray-400 hover:text-green-600 hover:bg-green-50")} onClick={handleNewChat} title={t(language, "action.newChat")}>
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/*  Messages area  */}
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto scroll-smooth relative">
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4">
            <AnimatePresence mode="popLayout">
              {!hasMessages ? (
                /*  Welcome Screen  */
                <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col items-center justify-center min-h-[55vh] text-center px-2">
                  <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-40 h-40 sm:w-48 sm:h-48 mb-6 flex items-center justify-center relative">
                    <img
                      src="/mama%20math.svg"
                      alt="Mama Math"
                      className="w-full h-full object-contain drop-shadow-2xl"
                    />
                  </motion.div>
                  <h2 className={cn("text-2xl sm:text-3xl font-bold mb-2 leading-tight", darkMode ? "text-gray-100" : "text-gray-900")}>{t(language, "welcome.hello")} {userName.split(" ")[0]}!</h2>
                  <p className={cn("text-sm sm:text-base max-w-md mb-8 leading-relaxed", darkMode ? "text-gray-400" : "text-gray-500")}>
                    {t(language, "welcome.intro")} <strong className="text-green-600">{t(language, "welcome.name")}</strong>{t(language, "welcome.description")}
                    {!selectedGrade && <span className="block mt-2 text-amber-500 font-medium">{t(language, "welcome.selectGrade")}</span>}
                  </p>

                  {selectedGrade && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
                      <p className={cn("text-xs font-semibold uppercase tracking-wider mb-3", darkMode ? "text-gray-500" : "text-gray-400")}>{t(language, "welcome.exploreTopic")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {TOPIC_KEYS.map((topic) => (
                          <motion.button key={topic.titleKey} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                            onClick={() => handleSendMessage(`${language === "fr" ? "Parlez-moi de" : "Tell me about"} ${language === "fr" ? topic.queryFr : topic.query} ${language === "fr" ? "pour le Primaire" : "for Primary"} ${selectedGrade}`)}
                            className="relative overflow-hidden rounded-2xl p-4 text-left text-white shadow-lg hover:shadow-xl transition-shadow">
                            <div className={cn("absolute inset-0 bg-gradient-to-br", topic.color)} />
                            <div className="relative z-10">
                              <topic.icon className="w-7 h-7 mb-2 opacity-90" />
                              <h3 className="font-semibold text-sm leading-tight">{t(language, topic.titleKey)}</h3>
                            </div>
                            <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10" />
                          </motion.button>
                        ))}
                      </div>
                      <div className="mt-6">
                        <p className={cn("text-xs font-semibold uppercase tracking-wider mb-3", darkMode ? "text-gray-500" : "text-gray-400")}>{t(language, "welcome.quickPrompts")}</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {PROMPT_KEYS.map((qp) => (
                            <motion.button key={qp.key} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                              onClick={() => handleSendMessage(`${t(language, qp.key)} ${language === "fr" ? "pour le Primaire" : "for Primary"} ${selectedGrade}`)}
                              className={cn("flex items-center gap-2 px-4 py-2 border rounded-full text-sm shadow-sm transition-all",
                                darkMode ? "bg-gray-800 border-gray-700 text-gray-300 hover:border-green-700 hover:bg-green-900/30 hover:text-green-400" : "bg-white border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                              )}>
                              <qp.icon className="w-3.5 h-3.5" />{t(language, qp.key)}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Recent conversations removed as requested */}
                </motion.div>
              ) : (
                /*  Chat Messages  */
                <div className="space-y-4 sm:space-y-5">
                  {messages.map((msg, idx) => (
                    <MessageBubble
                      key={msg.id} message={msg}
                      streamingText={isStreamingActive && msg.role === "assistant" && idx === messages.length - 1 ? streamingText : undefined}
                      isStreaming={isStreamingActive && msg.role === "assistant" && idx === messages.length - 1}
                      onCopy={handleCopy}
                      onRegenerate={msg.role === "assistant" && idx === messages.length - 1 ? handleRegenerate : undefined}
                      onRate={msg.role === "assistant" ? (rating: number) => handleRate(msg.id, msg.dbId, rating) : undefined}
                      onBookmark={msg.role === "assistant" ? () => handleBookmark(msg.id, msg.dbId) : undefined}
                      isLast={idx === messages.length - 1}
                      isAssistant={msg.role === "assistant"}
                      userName={userName}
                      darkMode={darkMode}
                      lang={language}
                    />
                  ))}

                  {isLoading && !isStreamingActive && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center shadow-md shadow-green-600/20">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className={cn("rounded-2xl rounded-bl-md px-4 py-3 shadow-sm", darkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100")}>
                        <TypingIndicator />
                        <p className={cn("text-[11px] mt-1", darkMode ? "text-gray-500" : "text-gray-400")}>{t(language, "status.thinking")}</p>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} className="h-1" />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Scroll FAB */}
          <AnimatePresence>
            {showScrollBtn && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => scrollToBottom()}
                className={cn("fixed bottom-32 right-4 sm:right-8 z-30 w-10 h-10 rounded-full border shadow-lg flex items-center justify-center transition-colors",
                  darkMode ? "bg-gray-800 border-gray-700 text-gray-400 hover:text-green-400 hover:border-green-700" : "bg-white border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-200"
                )}>
                <ArrowDown className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/*  Suggested follow-ups  */}
        {hasMessages && !isLoading && selectedGrade && (
          <div className={cn("shrink-0 backdrop-blur-sm border-t", darkMode ? "bg-gray-900/60 border-gray-800" : "bg-white/60 border-gray-50")}>
            <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2 overflow-x-auto scrollbar-none">
              <div className="flex gap-2">
                {suggestKeys.map((key) => (
                  <button key={key} onClick={() => handleSendMessage(t(language, key))}
                    className={cn("shrink-0 px-3 py-1.5 border rounded-full text-xs sm:text-sm transition-all whitespace-nowrap",
                      darkMode ? "bg-gray-800 border-gray-700 text-gray-400 hover:border-green-700 hover:bg-green-900/30 hover:text-green-400" : "bg-gray-50 hover:bg-green-50 border-gray-200 hover:border-green-300 text-gray-600 hover:text-green-700"
                    )}>{t(language, key)}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/*  Input Area  */}
        <div className={cn("shrink-0 border-t shadow-[0_-4px_20px_rgba(0,0,0,0.03)]", darkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100")}>
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
            {/* Pending image preview */}
            {pendingImage && (
              <div className={cn("mb-2 flex items-center gap-3 border rounded-xl px-3 py-2", darkMode ? "bg-green-900/20 border-green-800/50" : "bg-green-50 border-green-200")}>
                <img src={pendingImage} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-green-300" />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", darkMode ? "text-green-300" : "text-green-800")}>{pendingImageName}</p>
                  <p className={cn("text-[11px]", darkMode ? "text-green-500" : "text-green-600")}>{t(language, "status.imageAttached")}</p>
                </div>
                <button onClick={() => { setPendingImage(null); setPendingImageName(""); }} className={cn("p-1.5 rounded-lg", darkMode ? "hover:bg-green-800/40 text-green-500" : "hover:bg-green-100 text-green-600")}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className={cn("relative flex items-end gap-2 rounded-2xl border transition-all px-3 sm:px-4 py-2",
              darkMode ? "bg-gray-800 border-gray-700 focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-900/50" : "bg-gray-50 border-gray-200 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100"
            )}>
              {/* Image upload */}
              <button onClick={() => imageInputRef.current?.click()} disabled={!selectedGrade || isLoading}
                className={cn("shrink-0 p-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed", darkMode ? "text-gray-500 hover:text-green-400 hover:bg-gray-700" : "text-gray-400 hover:text-green-600 hover:bg-green-50")}
                title={language === "fr" ? "T�l�charger une image" : "Upload image"}>
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Textarea */}
              <textarea ref={textareaRef} value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={selectedGrade ? t(language, "input.placeholder") : t(language, "input.selectFirst")}
                disabled={!selectedGrade || isLoading} rows={1}
                className={cn("flex-1 bg-transparent resize-none border-none outline-none text-sm sm:text-base max-h-40 py-1.5 leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-gray-400",
                  darkMode ? "text-gray-100 placeholder:text-gray-500" : "text-gray-800"
                )} />

              <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                {/* Voice */}
                <button onClick={toggleVoice} disabled={!selectedGrade || isLoading}
                  className={cn("p-2 rounded-xl transition-all",
                    isListening ? "bg-red-100 text-red-600 animate-pulse" : cn("disabled:opacity-40 disabled:cursor-not-allowed", darkMode ? "text-gray-500 hover:text-green-400 hover:bg-gray-700" : "text-gray-400 hover:text-green-600 hover:bg-green-50")
                  )} title={isListening ? "Stop" : "Voice"}>
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Send */}
                <Button onClick={() => handleSendMessage()} disabled={(!inputMessage.trim() && !pendingImage) || isLoading || !selectedGrade}
                  size="icon"
                  className={cn("h-9 w-9 rounded-xl transition-all duration-200 shadow-md",
                    (inputMessage.trim() || pendingImage) && selectedGrade && !isLoading
                      ? "bg-gradient-to-br from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 shadow-green-600/30 scale-100"
                      : darkMode ? "bg-gray-700 text-gray-500 shadow-none scale-95" : "bg-gray-200 text-gray-400 shadow-none scale-95"
                  )}>
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className={cn("text-[10px] sm:text-xs", darkMode ? "text-gray-600" : "text-gray-400")}>{t(language, "input.footer")}</p>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", darkMode ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400")}>{language === "fr" ? "FR" : "EN"}</span>
                <p className={cn("text-[10px] hidden sm:flex items-center gap-1", darkMode ? "text-gray-600" : "text-gray-300")}><CornerDownLeft className="w-3 h-3" /> {t(language, "input.toSend")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;