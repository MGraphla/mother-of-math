import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, AlertCircle, ChevronDown, ChevronUp, Star, BookOpen, Lightbulb, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStudentSession } from "@/services/studentService";
import type { Student } from "@/services/studentService";
import { getStudentWorksByToken } from "@/lib/supabase";
import type { StudentWork } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

/* ── Helpers ─────────────────────────────────────────── */

const extractGradeValue = (text: string): number | null => {
  const pctMatch = text.match(/(\d{1,3})\s*%/);
  if (pctMatch) {
    const val = parseInt(pctMatch[1]);
    if (val >= 0 && val <= 100) return val;
  }
  const fracMatch = text.match(/(\d{1,3})\s*\/\s*100/);
  if (fracMatch) {
    const val = parseInt(fracMatch[1]);
    if (val >= 0 && val <= 100) return val;
  }
  const outOfMatch = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (outOfMatch) {
    const num = parseInt(outOfMatch[1]);
    const den = parseInt(outOfMatch[2]);
    if (den > 0) return Math.round((num / den) * 100);
  }
  return null;
};

const stripMd = (text: string) =>
  text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .trim();

const parseAiFeedback = (text: string) => {
  const sections = { analysis: "", error_type: "", grade: "", remediation: "" };
  const regex = /##\s*(Analysis|Error Type|Grade|Remediation)\s*\n([\s\S]*?)(?=##\s|$)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = match[1].toLowerCase();
    const value = stripMd(match[2].trim());
    if (key === "analysis") sections.analysis = value;
    else if (key === "error type") sections.error_type = value;
    else if (key === "grade") sections.grade = value;
    else if (key === "remediation") sections.remediation = value;
  }
  return sections;
};

const scoreColor = (score: number) => {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
};

const scoreBg = (score: number) => {
  if (score >= 70) return "bg-green-50 border-green-200";
  if (score >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
};

/* ── Component ─────────────────────────────────────── */

const StudentAIFeedback = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [works, setWorks] = useState<StudentWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) {
      navigate("/student-login", { replace: true });
      return;
    }
    setStudent(s);
    loadWorks(s);
  }, []);

  const loadWorks = async (s: Student) => {
    setIsLoading(true);
    try {
      const data = await getStudentWorksByToken(s.access_token, s.full_name);
      setWorks(data);
    } catch (e) {
      console.error("Error loading AI feedback:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground font-medium">Loading your feedback…</span>
      </div>
    );
  }

  if (!student) return null;

  // Compute quick stats
  const analyzed = works.filter((w) => w.feedback);
  const scores = analyzed
    .map((w) => extractGradeValue(w.feedback!))
    .filter((v): v is number => v !== null);
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const best = scores.length > 0 ? Math.max(...scores) : null;

  return (
    <div className="container py-6 space-y-6 max-w-4xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" />
          My AI Feedback
        </h1>
        <p className="text-muted-foreground mt-1">
          See what your teacher's AI analysis found in your math work
        </p>
      </div>

      {/* Stats row */}
      {analyzed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-extrabold text-primary">{analyzed.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Works analysed</p>
            </CardContent>
          </Card>
          {avgScore !== null && (
            <Card className={cn("border", scoreBg(avgScore))}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className={cn("text-2xl font-extrabold", scoreColor(avgScore))}>{avgScore}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Average score</p>
              </CardContent>
            </Card>
          )}
          {best !== null && (
            <Card className="border-green-200 bg-green-50 hidden sm:block">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-extrabold text-green-600 flex items-center justify-center gap-1">
                  <Star className="h-5 w-5 fill-green-500 text-green-500" />
                  {best}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Best score</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* No works yet */}
      {works.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No analysed work yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Your teacher will upload and analyse your math work here
            </p>
          </CardContent>
        </Card>
      )}

      {/* Work cards */}
      <div className="space-y-4">
        {works.map((work) => {
          const score = work.feedback ? extractGradeValue(work.feedback) : null;
          const sections = work.feedback ? parseAiFeedback(work.feedback) : null;
          const isExpanded = expandedIds.has(work.id);
          const uploadDate = new Date(work.created_at);

          return (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardContent className="pt-4 pb-3">
                  {/* Card header row */}
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    {work.image_url && !work.image_url.startsWith("data:application") && (
                      <div
                        className="relative flex-shrink-0 cursor-pointer group/thumb"
                        onClick={() => setLightbox(work.image_url!)}
                      >
                        <img
                          src={work.image_url}
                          alt="student work"
                          className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                          <ZoomIn className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {/* Title + date + badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate max-w-[200px]">
                            {work.file_name || work.subject || "Math work"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {uploadDate.toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {work.subject && (
                            <Badge variant="secondary" className="text-xs">
                              {work.subject}
                            </Badge>
                          )}
                          {work.grade && (
                            <Badge variant="outline" className="text-xs">
                              {work.grade}
                            </Badge>
                          )}
                          {score !== null && (
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
                                score >= 70
                                  ? "bg-green-50 text-green-700 border-green-300"
                                  : score >= 50
                                  ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                                  : "bg-red-50 text-red-700 border-red-300"
                              )}
                            >
                              {score}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* No feedback yet */}
                      {!work.feedback && (
                        <div className="flex items-center gap-2 mt-2 text-muted-foreground text-sm">
                          <AlertCircle className="h-4 w-4" />
                          Waiting for teacher to analyse this work
                        </div>
                      )}

                      {/* Expand button */}
                      {work.feedback && (
                        <button
                          onClick={() => toggleExpand(work.id)}
                          className="flex items-center gap-1.5 mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          <Brain className="h-4 w-4" />
                          {isExpanded ? "Hide feedback" : "See AI feedback"}
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable analysis */}
                  <AnimatePresence>
                    {isExpanded && sections && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-3 border-t pt-3">
                          {score !== null && (
                            <div
                              className={cn(
                                "text-3xl font-extrabold",
                                scoreColor(score)
                              )}
                            >
                              {score}%
                            </div>
                          )}
                          {sections.analysis && (
                            <div className="rounded-lg bg-primary/5 border border-primary/15 p-3">
                              <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1.5">
                                How you did
                              </p>
                              <p className="text-sm leading-relaxed whitespace-pre-line">
                                {sections.analysis}
                              </p>
                            </div>
                          )}
                          {sections.error_type && sections.error_type !== "None Found" && (
                            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                              <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest mb-1.5">
                                Things to improve
                              </p>
                              <p className="text-sm leading-relaxed whitespace-pre-line text-amber-900">
                                {sections.error_type}
                              </p>
                            </div>
                          )}
                          {sections.remediation && (
                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                              <p className="text-[10px] font-extrabold text-blue-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3" />
                                How to get better
                              </p>
                              <p className="text-sm leading-relaxed whitespace-pre-line text-blue-900">
                                {sections.remediation}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightbox}
              alt="student work full"
              className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-light"
              onClick={() => setLightbox(null)}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentAIFeedback;
