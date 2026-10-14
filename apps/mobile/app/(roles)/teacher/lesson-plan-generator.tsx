import { useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  FileDown,
  Globe,
  GraduationCap,
  Lightbulb,
  Presentation,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import {
  formatCurriculumForPrompt,
  formatSelectedTopicForPrompt,
  getClassLevelsForCountry,
  getCurriculumContent,
  getCurriculumContentAsync,
  getDefaultClassLevel,
  getTopicsForClassLevel,
  type CurriculumContent,
  type TopicItem,
} from "../../../src/data/curriculumContent";
import { shareTextFile } from "../../../src/native/exportText";
import { savedFileHint } from "../../../src/native/saveFile";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { supabase } from "../../../src/lib/supabase";
import {
  formatAIResponseAsMarkdown,
  generateLessonPlan as generateLessonPlanService,
  generateLessonStructure,
  type LessonCountry,
} from "../../../src/services/lessonPlan";
import {
  exportLessonPlanPdf,
  exportLessonPlanPptx,
} from "../../../src/services/lessonPlanExport";
import { generateLessonPlanPdfImages } from "../../../src/services/imageGeneration";
import { colors, fonts, shadow, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  IconTile,
  Input,
  RichText,
  Select,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

type Phase = 0 | 1 | 2 | 3 | 4;

interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
  time: string;
  teacherActivities: string;
  learnerActivities: string;
}

const mamaMathLogo = require("../../../assets/mama-math.png");

const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "french", label: "French" },
  { value: "pidgin", label: "English Pidgin" },
  { value: "hausa", label: "Hausa" },
  { value: "yoruba", label: "Yoruba" },
] as const;

const DEFAULT_SECTIONS: LessonSection[] = [
  {
    id: "1",
    title: "INTRODUCTION",
    keyPoints: "Lesson objectives, write a brief hook to engage students, link to prior knowledge.",
    time: "",
    teacherActivities: "",
    learnerActivities: "",
  },
  {
    id: "2",
    title: "PRESENTATION",
    keyPoints:
      "generate a detailed lesson plan for this topic. Step-by-step explanation of the new concept, examples to use, materials needed.",
    time: "",
    teacherActivities: "",
    learnerActivities: "",
  },
  {
    id: "3",
    title: "EVALUATION",
    keyPoints:
      "generate a detailed lesson plan for this topic. Classroom exercises, questions to ask, worksheet activities.",
    time: "",
    teacherActivities: "",
    learnerActivities: "",
  },
  {
    id: "4",
    title: "STUDENT EXERCISES",
    keyPoints:
      "generate a detailed lesson plan for this topic. Practice problems, application exercises, differentiated tasks for various skill levels.",
    time: "",
    teacherActivities: "",
    learnerActivities: "",
  },
  {
    id: "5",
    title: "CONCLUSION",
    keyPoints:
      "generate a detailed lesson plan for this topic. Summary of key takeaways, assignment for homework.",
    time: "",
    teacherActivities: "",
    learnerActivities: "",
  },
];

const PHASE_LABELS = ["Country", "Topic", "Structure", "Review", "Generate"] as const;

export default function LessonPlanGeneratorScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [phase, setPhase] = useState<Phase>(0);
  const [country, setCountry] = useState<LessonCountry | "">("");
  const [curriculum, setCurriculum] = useState<CurriculumContent | null>(null);
  const [level, setLevel] = useState("");
  const [language, setLanguage] = useState("english");
  const [topic, setTopic] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [availableTopics, setAvailableTopics] = useState<TopicItem[]>([]);
  const [selectedTopicData, setSelectedTopicData] = useState<TopicItem | null>(null);
  const [sections, setSections] = useState<LessonSection[]>([...DEFAULT_SECTIONS]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [rawJsonContent, setRawJsonContent] = useState("");
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "generating" | "complete">("idle");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [previewImages, setPreviewImages] = useState<Record<string, string | null>>({});
  const [imageStatus, setImageStatus] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const levelOptions = useMemo(
    () =>
      country
        ? getClassLevelsForCountry(country).map((l) => ({ value: l, label: l }))
        : [],
    [country],
  );

  const topicOptions = useMemo(() => {
    const grouped = availableTopics.reduce<Record<string, TopicItem[]>>((acc, item) => {
      (acc[item.strand] = acc[item.strand] || []).push(item);
      return acc;
    }, {});
    const options: { value: string; label: string }[] = [];
    Object.entries(grouped).forEach(([strand, items]) => {
      items.forEach((item) => {
        options.push({ value: item.id, label: `${strand}: ${item.title}` });
      });
    });
    return options;
  }, [availableTopics]);

  const resetToCountry = () => {
    setPhase(0);
    setCountry("");
    setCurriculum(null);
    setLevel("");
    setTopic("");
    setSelectedTopicId("");
    setSelectedTopicData(null);
    setAvailableTopics([]);
    setSections([...DEFAULT_SECTIONS]);
    setGeneratedContent("");
    setEditedContent("");
    setRawJsonContent("");
    setPreviewImages({});
    setImageStatus("");
    setGenerationStep("idle");
    setFormError(null);
  };

  const handleCountrySelect = async (selected: LessonCountry) => {
    setCountry(selected);
    const defaultLevel = getDefaultClassLevel(selected);
    setLevel(defaultLevel);
    setAvailableTopics(getTopicsForClassLevel(selected, defaultLevel));
    setSelectedTopicId("");
    setSelectedTopicData(null);
    setTopic("");
    setFormError(null);
    try {
      setCurriculum(await getCurriculumContentAsync(selected));
    } catch {
      setCurriculum(getCurriculumContent(selected));
    }
    setPhase(1);
  };

  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    if (!country) return;
    setAvailableTopics(getTopicsForClassLevel(country, newLevel));
    setSelectedTopicId("");
    setSelectedTopicData(null);
    setTopic("");
  };

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopicId(topicId);
    const found = availableTopics.find((item) => item.id === topicId) ?? null;
    setSelectedTopicData(found);
    setTopic(found?.title ?? "");
    setFormError(null);
  };

  const handleTopicSubmit = async () => {
    if (!topic || !level || !selectedTopicId || !country) {
      setFormError("Please select a class level and curriculum topic.");
      return;
    }
    setIsGenerating(true);
    setPhase(2);
    try {
      const topicCurriculumContext = selectedTopicData
        ? formatSelectedTopicForPrompt(selectedTopicData, level, country)
        : curriculum
          ? formatCurriculumForPrompt(curriculum)
          : "";
      const nextSections = await generateLessonStructure({
        topic,
        level,
        country,
        language,
        topicCurriculumContext,
      });
      setSections(nextSections);
      setEditingId(null);
    } catch (e) {
      showError("Structure generation failed", e);
      setPhase(1);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSection = (id: string, patch: Partial<LessonSection>) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSection = () => {
    const id = Date.now().toString();
    setSections((prev) => [
      ...prev,
      {
        id,
        title: "NEW SECTION",
        keyPoints: "Add key points here...",
        time: "",
        teacherActivities: "",
        learnerActivities: "",
      },
    ]);
    setEditingId(id);
  };

  const deleteSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const runFinalGenerate = async () => {
    if (!topic.trim() || !level.trim() || !country) {
      showError("Missing information", "Topic and class level are required.");
      return;
    }
    setPhase(4);
    setIsGenerating(true);
    setGenerationStep("generating");
    setGeneratedContent("");
    setEditedContent("");
    setRawJsonContent("");
    setPreviewImages({});
    setImageStatus("");

    try {
      const sectionsForService = sections.map((s) => ({
        id: s.id,
        title: s.title,
        keyPoints:
          s.keyPoints +
          (s.time ? `\nTime Allocation: ${s.time}` : "") +
          (s.teacherActivities ? `\nTeacher Activities: ${s.teacherActivities}` : "") +
          (s.learnerActivities ? `\nLearner Activities: ${s.learnerActivities}` : ""),
      }));

      const topicCurriculumContext =
        selectedTopicData && country
          ? formatSelectedTopicForPrompt(selectedTopicData, level, country)
          : "";
      const generalCurriculumContext = curriculum ? formatCurriculumForPrompt(curriculum) : "";
      const fullCurriculumContext = topicCurriculumContext || generalCurriculumContext || undefined;

      const response = await generateLessonPlanService(
        topic,
        level,
        sectionsForService,
        fullCurriculumContext,
        country,
        language,
      );

      if (!response?.jsonString) throw new Error("The AI returned an empty response.");

      setRawJsonContent(response.jsonString);
      const markdown = formatAIResponseAsMarkdown(response.jsonString);
      setGeneratedContent(markdown);
      setEditedContent(markdown);
      setGenerationStep("complete");
      setIsEditingContent(false);

      if (user) {
        try {
          const { error } = await supabase.from("lesson_plans").insert({
            title: topic || "Untitled Lesson Plan",
            level,
            content: JSON.parse(response.jsonString),
            created_at: new Date().toISOString(),
            user_id: user.id,
          });
          if (error) throw error;
          showSuccess("Lesson plan saved", "Generated and saved to your library.");
        } catch {
          showSuccess("Lesson plan ready", "Generated successfully. You can save it manually.");
        }
      } else {
        showSuccess("Lesson plan ready", "Generated successfully.");
      }

      setImageStatus("Drawing classroom illustrations…");
      try {
        const imgs = await generateLessonPlanPdfImages(topic, level, setImageStatus);
        setPreviewImages(imgs);
      } catch {
        setPreviewImages({});
      } finally {
        setImageStatus("");
      }
    } catch (e) {
      showError("Generation failed", e);
      setGenerationStep("idle");
      setPhase(3);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveManual = async () => {
    if (!user || !rawJsonContent) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("lesson_plans").insert({
        title: topic || "Untitled Lesson Plan",
        level,
        content: JSON.parse(rawJsonContent),
        created_at: new Date().toISOString(),
        user_id: user.id,
      });
      if (error) throw error;
      showSuccess("Saved", "Lesson plan saved to your library.");
      router.push("/(roles)/teacher/lesson-plans");
    } catch (e) {
      showError("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    const body = isEditingContent ? editedContent : generatedContent;
    if (!rawJsonContent && !body.trim()) return;
    setExporting(true);
    setExportProgress("Preparing your lesson plan…");
    try {
      const fileName = await exportLessonPlanPdf(
        rawJsonContent,
        topic,
        level,
        body,
        setExportProgress,
        previewImages,
      );
      showSuccess("PDF saved to your phone", savedFileHint(fileName));
    } catch (e) {
      showError("PDF export failed", e);
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const exportPptx = async () => {
    const body = isEditingContent ? editedContent : generatedContent;
    if (!rawJsonContent && !body.trim()) return;
    setExporting(true);
    setExportProgress("Preparing your presentation…");
    try {
      const fileName = await exportLessonPlanPptx(rawJsonContent, topic, level, body, setExportProgress);
      showSuccess("PowerPoint saved to your phone", savedFileHint(fileName));
    } catch (e) {
      showError("PowerPoint export failed", e);
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const footer = (() => {
    if (phase === 1) {
      return (
        <Button
          label="Generate Lesson Structure"
          onPress={handleTopicSubmit}
          loading={isGenerating}
          icon={<Wand2 size={18} color={colors.white} />}
        />
      );
    }
    if (phase === 2) {
      return (
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Button label="Back" variant="outline" onPress={() => setPhase(1)} icon={<ArrowLeft size={16} color={colors.brandDark} />} />
          </View>
          <View style={{ flex: 1.4 }}>
            <Button
              label="Review Structure"
              onPress={() => setPhase(3)}
              iconRight={<ArrowRight size={16} color={colors.white} />}
            />
          </View>
        </View>
      );
    }
    if (phase === 3) {
      return (
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Button label="Back" variant="outline" onPress={() => setPhase(2)} icon={<ArrowLeft size={16} color={colors.brandDark} />} />
          </View>
          <View style={{ flex: 1.6 }}>
            <Button
              label="Generate Detailed Plan"
              onPress={runFinalGenerate}
              loading={isGenerating}
              icon={<Sparkles size={16} color={colors.white} />}
            />
          </View>
        </View>
      );
    }
    if (phase === 4 && generationStep === "complete") {
      return (
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Button
              label="Save"
              onPress={saveManual}
              loading={saving}
              disabled={exporting}
              icon={<Save size={16} color={colors.white} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="PDF"
              variant="outline"
              onPress={exportPdf}
              loading={exporting}
              icon={<FileDown size={16} color={colors.brandDark} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="PPT"
              variant="outline"
              onPress={exportPptx}
              loading={exporting}
              icon={<Presentation size={16} color={colors.brandDark} />}
            />
          </View>
        </View>
      );
    }
    return null;
  })();

  return (
    <DashboardShell
      title={t("sidebar.lessonPlans")}
      subtitle={
        phase === 0
          ? "Choose your curriculum country"
          : `${PHASE_LABELS[phase]} · ${country === "nigeria" ? "Nigeria" : "Cameroon"}`
      }
      footer={footer}
    >
      {phase > 0 ? (
        <View style={styles.stepper}>
          {PHASE_LABELS.slice(1).map((label, i) => {
            const step = (i + 1) as Phase;
            const active = phase === step;
            const done = phase > step;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, (active || done) && styles.stepDotOn]}>
                  {done ? (
                    <Check size={12} color={colors.white} />
                  ) : (
                    <Text variant="micro" weight="bold" color={active || done ? colors.white : colors.textMuted}>
                      {step}
                    </Text>
                  )}
                </View>
                <Text
                  variant="micro"
                  weight={active ? "bold" : "medium"}
                  color={active ? colors.brandDeep : colors.textMuted}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {phase === 0 ? (
        <View style={styles.phase0}>
          <LinearGradient
            colors={["#D1FAE5", "#ECFDF5", "#F0FDFA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroOrbTop} pointerEvents="none" />
            <View style={styles.heroOrbBottom} pointerEvents="none" />
            <View style={styles.heroLogoWrap}>
              <Image source={mamaMathLogo} style={styles.heroLogo} resizeMode="cover" />
            </View>
            <Text variant="h2" weight="extrabold" center style={styles.heroTitle}>
              Welcome to{" "}
              <Text variant="h2" weight="extrabold" color={colors.brand}>
                Mama Math
              </Text>
            </Text>
            <Text variant="bodySm" color={colors.textSecondary} center style={styles.heroSubtitle}>
              Choose your country to unlock curriculum-aligned, AI-generated mathematics lesson
              plans for primary school teachers.
            </Text>
          </LinearGradient>

          <Text
            variant="micro"
            weight="bold"
            color={colors.textMuted}
            uppercase
            center
            style={styles.selectLabel}
          >
            Select Your Country
          </Text>

          <Pressable
            onPress={() => handleCountrySelect("cameroon")}
            style={({ pressed }) => [styles.countryCard, pressed && styles.countryCardPressed]}
          >
            <LinearGradient
              colors={["#16A34A", "#EF4444", "#FACC15"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.flagBar}
            />
            <View style={styles.countryInner}>
              <View style={styles.countryTop}>
                <Text style={styles.flagEmoji}>🇨🇲</Text>
                <View style={styles.arrowCircle}>
                  <ArrowRight size={16} color={colors.textMuted} />
                </View>
              </View>
              <Text variant="title" weight="bold">
                Cameroon
              </Text>
              <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: 2 }}>
                Primary School Mathematics
              </Text>
              <View style={styles.countryFooter}>
                <GraduationCap size={14} color={colors.textMuted} />
                <Text variant="micro" color={colors.textMuted}>
                  Primary 1 – Primary 6
                </Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => handleCountrySelect("nigeria")}
            style={({ pressed }) => [styles.countryCard, pressed && styles.countryCardPressed]}
          >
            <LinearGradient
              colors={["#008751", "#E8F5EF", "#008751"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.flagBar}
            />
            <View style={styles.countryInner}>
              <View style={styles.countryTop}>
                <Text style={styles.flagEmoji}>🇳🇬</Text>
                <View style={styles.arrowCircle}>
                  <ArrowRight size={16} color={colors.textMuted} />
                </View>
              </View>
              <Text variant="title" weight="bold">
                Nigeria
              </Text>
              <Text variant="bodySm" color={colors.textMuted} style={{ marginTop: 2 }}>
                Primary School Mathematics
              </Text>
              <View style={styles.countryFooter}>
                <GraduationCap size={14} color={colors.textMuted} />
                <Text variant="micro" color={colors.textMuted}>
                  Primary 1 – Primary 3
                </Text>
              </View>
            </View>
          </Pressable>

          <View style={styles.phase0Foot}>
            <Globe size={13} color={colors.textMuted} />
            <Text variant="micro" color={colors.textMuted} style={{ flex: 1 }}>
              Lesson plans align with your selected country’s national curriculum standards.
            </Text>
          </View>
        </View>
      ) : null}

      {phase === 1 ? (
        <View style={{ gap: space.md }}>
          <Button
            label="View Your Lesson Plans"
            variant="outline"
            onPress={() => router.push("/(roles)/teacher/lesson-plans")}
            icon={<BookOpen size={16} color={colors.brandDark} />}
          />

          <Card>
            <CardHeader
              title="Set up your lesson"
              subtitle="Pick the class level, official curriculum topic, and language."
              icon={
                <IconTile size={40}>
                  <Globe size={19} color={colors.brandDeep} />
                </IconTile>
              }
            />
            <View style={{ gap: space.md, marginTop: space.md }}>
              <Select
                label="1. Class level"
                value={level}
                options={levelOptions}
                onChange={handleLevelChange}
                required
              />
              <Select
                label="2. Curriculum topic"
                value={selectedTopicId}
                options={topicOptions}
                onChange={handleTopicSelect}
                placeholder={
                  availableTopics.length
                    ? "Select a topic…"
                    : "No topics yet for this class (try Primary 1–2)"
                }
                required
                error={formError}
              />
              <Select
                label="3. Lesson language"
                value={language}
                options={[...LANGUAGES]}
                onChange={setLanguage}
                required
              />
            </View>
          </Card>

          {selectedTopicData ? (
            <Card accent={colors.brand}>
              <Text variant="caption" weight="bold" color={colors.brandDeep} uppercase>
                {selectedTopicData.strand}
              </Text>
              <Text variant="h3" weight="bold" style={{ marginTop: 4 }}>
                {selectedTopicData.title}
              </Text>
              {selectedTopicData.objectives.slice(0, 3).map((obj) => (
                <Text key={obj} variant="bodySm" color={colors.textSecondary} style={{ marginTop: 6 }}>
                  • {obj}
                </Text>
              ))}
              {selectedTopicData.suggestedMaterials?.length ? (
                <View style={styles.chipRow}>
                  {selectedTopicData.suggestedMaterials.slice(0, 4).map((m) => (
                    <Badge key={m} label={m} tone="outline" />
                  ))}
                </View>
              ) : null}
            </Card>
          ) : null}

          <Button label="Change Country" variant="ghost" onPress={resetToCountry} />
        </View>
      ) : null}

      {phase === 2 ? (
        <View style={{ gap: space.md }}>
          {isGenerating ? (
            <Card>
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.brand} size="large" />
                <Text variant="bodySm" weight="semibold" center style={{ marginTop: space.md }}>
                  Building your lesson structure…
                </Text>
              </View>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={topic}
                  subtitle={`${level} · edit sections before generating the full plan`}
                  icon={
                    <IconTile size={40}>
                      <Lightbulb size={19} color={colors.brandDeep} />
                    </IconTile>
                  }
                />
              </Card>

              {sections.map((section, index) => {
                const editing = editingId === section.id;
                return (
                  <Card key={section.id}>
                    <View style={styles.sectionHead}>
                      <Badge label={`Section ${index + 1}`} tone="brand" />
                      <View style={styles.sectionActions}>
                        <Pressable onPress={() => setEditingId(editing ? null : section.id)} hitSlop={8}>
                          <Text variant="micro" weight="bold" color={colors.brandDark}>
                            {editing ? "Done" : "Edit"}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => deleteSection(section.id)} hitSlop={8}>
                          <Trash2 size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                    {editing ? (
                      <View style={{ gap: space.sm, marginTop: space.sm }}>
                        <Input
                          label="Title"
                          value={section.title}
                          onChangeText={(v) => updateSection(section.id, { title: v })}
                        />
                        <Input
                          label="Key points"
                          value={section.keyPoints}
                          onChangeText={(v) => updateSection(section.id, { keyPoints: v })}
                          multiline
                        />
                        <Input
                          label="Time allocation (optional)"
                          value={section.time}
                          onChangeText={(v) => updateSection(section.id, { time: v })}
                          placeholder="e.g. 10 minutes"
                        />
                        <Input
                          label="Teacher activities (optional)"
                          value={section.teacherActivities}
                          onChangeText={(v) => updateSection(section.id, { teacherActivities: v })}
                          multiline
                        />
                        <Input
                          label="Learner activities (optional)"
                          value={section.learnerActivities}
                          onChangeText={(v) => updateSection(section.id, { learnerActivities: v })}
                          multiline
                        />
                      </View>
                    ) : (
                      <View style={{ marginTop: space.sm }}>
                        <Text variant="bodySm" weight="bold">
                          {section.title}
                        </Text>
                        <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>
                          {section.keyPoints}
                        </Text>
                      </View>
                    )}
                  </Card>
                );
              })}

              <Button
                label="Add section"
                variant="outline"
                onPress={addSection}
                icon={<Plus size={16} color={colors.brandDark} />}
              />
            </>
          )}
        </View>
      ) : null}

      {phase === 3 ? (
        <View style={{ gap: space.md }}>
          <Card>
            <CardHeader
              title="Review structure"
              subtitle="Confirm the outline, then generate the detailed Cameroon/Nigeria-format lesson plan."
            />
          </Card>
          {sections.map((section, index) => (
            <Card key={section.id}>
              <Text variant="micro" weight="bold" color={colors.brandDeep}>
                SECTION {index + 1}
              </Text>
              <Text variant="bodySm" weight="bold" style={{ marginTop: 4 }}>
                {section.title}
              </Text>
              <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 4 }}>
                {section.keyPoints}
              </Text>
              {section.time ? (
                <Text variant="micro" color={colors.textMuted} style={{ marginTop: 6 }}>
                  Time: {section.time}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {phase === 4 ? (
        <View style={{ gap: space.md }}>
          {generationStep === "generating" ? (
            <Card>
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.brand} size="large" />
                <Text variant="h3" weight="bold" center style={{ marginTop: space.lg }}>
                  Generating your lesson plan…
                </Text>
                <Text variant="caption" color={colors.textMuted} center style={{ marginTop: space.sm }}>
                  Aligning to the {country === "nigeria" ? "Nigerian" : "Cameroonian"} curriculum format.
                </Text>
              </View>
            </Card>
          ) : null}

          {generationStep === "complete" ? (
            <>
              {exporting && exportProgress ? (
                <Card>
                  <View style={styles.loadingBlock}>
                    <ActivityIndicator color={colors.brand} />
                    <Text variant="bodySm" weight="semibold" center style={{ marginTop: space.md }}>
                      {exportProgress}
                    </Text>
                  </View>
                </Card>
              ) : null}

              {imageStatus ? (
                <Card>
                  <View style={styles.loadingBlock}>
                    <ActivityIndicator color={colors.brand} />
                    <Text variant="bodySm" weight="semibold" center style={{ marginTop: space.md }}>
                      {imageStatus}
                    </Text>
                  </View>
                </Card>
              ) : null}

              {previewImages.hero || previewImages.presentation || previewImages.evaluation ? (
                <Card>
                  <CardHeader
                    title="Lesson illustrations"
                    subtitle="These AI images are included in the PDF and PowerPoint."
                  />
                  {previewImages.hero ? (
                    <Image
                      source={{ uri: previewImages.hero }}
                      style={styles.heroArt}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={styles.artRow}>
                    {previewImages.presentation ? (
                      <Image
                        source={{ uri: previewImages.presentation }}
                        style={styles.sideArt}
                        resizeMode="cover"
                      />
                    ) : null}
                    {previewImages.evaluation ? (
                      <Image
                        source={{ uri: previewImages.evaluation }}
                        style={styles.sideArt}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                </Card>
              ) : null}

              <Card>
                <View style={styles.resultActions}>
                  <Button
                    label={isEditingContent ? "Preview" : "Edit"}
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    onPress={() => setIsEditingContent((v) => !v)}
                  />
                  <Button
                    label="Copy"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={async () => {
                      await Clipboard.setStringAsync(isEditingContent ? editedContent : generatedContent);
                      showSuccess("Copied", "Lesson plan copied to clipboard.");
                    }}
                    icon={<Copy size={14} color={colors.brandDark} />}
                  />
                  <Button
                    label="Download"
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={async () => {
                      try {
                        await shareTextFile(
                          `${topic || "lesson"}_plan.md`,
                          isEditingContent ? editedContent : generatedContent,
                        );
                        showSuccess("Saved to your phone", savedFileHint(`${topic || "lesson"}_plan.md`));
                      } catch (e) {
                        showError("Download failed", e);
                      }
                    }}
                  />
                  <Button
                    label="PDF"
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    loading={exporting}
                    onPress={exportPdf}
                    icon={<FileDown size={14} color={colors.brandDark} />}
                  />
                  <Button
                    label="PPT"
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    loading={exporting}
                    onPress={exportPptx}
                    icon={<Presentation size={14} color={colors.brandDark} />}
                  />
                </View>
              </Card>

              <Card>
                {isEditingContent ? (
                  <TextInput
                    value={editedContent}
                    onChangeText={setEditedContent}
                    multiline
                    style={styles.editor}
                    textAlignVertical="top"
                  />
                ) : (
                  <RichText source={generatedContent} />
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Next steps"
                  subtitle="Save to your library, export a PDF, or open View Lesson Plans."
                />
                <Button
                  label="Open lesson library"
                  variant="outline"
                  onPress={() => router.push("/(roles)/teacher/lesson-plans")}
                />
                <Button
                  label="Start another plan"
                  variant="ghost"
                  onPress={resetToCountry}
                  style={{ marginTop: space.sm }}
                />
              </Card>
            </>
          ) : null}
        </View>
      ) : null}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.md,
    gap: 4,
  },
  stepItem: { flex: 1, alignItems: "center", gap: 4 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotOn: { backgroundColor: colors.brand },
  phase0: {
    gap: space.md,
    paddingBottom: space.lg,
  },
  hero: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandMute,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    alignItems: "center",
    overflow: "hidden",
  },
  heroOrbTop: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(0,158,63,0.12)",
  },
  heroOrbBottom: {
    position: "absolute",
    bottom: -36,
    left: -28,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(20,184,166,0.12)",
  },
  heroLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.brand,
    marginBottom: space.md,
    ...shadow.xs,
  },
  heroLogo: {
    width: "100%",
    height: "100%",
  },
  heroTitle: {
    marginBottom: 8,
  },
  heroSubtitle: {
    maxWidth: 320,
    lineHeight: 20,
  },
  selectLabel: {
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  countryCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.card,
  },
  countryCardPressed: {
    borderColor: colors.brandMute,
    transform: [{ scale: 0.985 }],
  },
  flagBar: {
    height: 6,
    width: "100%",
  },
  countryInner: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  countryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  flagEmoji: {
    fontSize: 42,
    lineHeight: 48,
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  countryFooter: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  phase0Foot: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: space.sm,
    marginTop: 4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionActions: { flexDirection: "row", alignItems: "center", gap: space.md },
  loadingBlock: { paddingVertical: space.xxl, alignItems: "center" },
  footerRow: { flexDirection: "row", gap: space.sm },
  resultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  heroArt: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    marginBottom: space.sm,
  },
  artRow: { flexDirection: "row", gap: space.sm },
  sideArt: {
    flex: 1,
    height: 110,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  editor: {
    minHeight: 320,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
});
