import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Brain,
  ChevronDown,
  ChevronUp,
  Star,
  BookOpen,
  ZoomIn,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileText,
  ExternalLink,
  PlayCircle,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getStudentSession } from "@/services/studentService";
import type { Learner } from "@/services/studentService";
import { getStudentWorksByToken } from "@/lib/supabase";
import type { StudentWork } from "@/lib/supabase";
import {
  buildStudentWorkNarrativeParagraph,
  parseStudentWorkFeedbackSections,
} from "@/lib/studentFeedbackNarrative";
import { getResourcesForStudent, Resource } from "@/services/resourceService";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

/* ── Helpers ─────────────────────────────────────────── */

const extractGradeValue = (text: string): number | null => {
  if (!text) return null;
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

const scoreColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
};

const scoreBg = (score: number) => {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
};

/* ── Component ─────────────────────────────────────── */

const StudentAIFeedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [student, setStudent] = useState<Learner | null>(null);
  const [works, setWorks] = useState<StudentWork[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
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
    
    const init = async () => {
      setIsLoading(true);
      try {
        const [worksData, resourcesData] = await Promise.all([
          getStudentWorksByToken(s.access_token, s.full_name),
          getResourcesForStudent()
        ]);
        setWorks(worksData);
        setResources(resourcesData);
        
        // Auto-expand the most recent work if it has feedback
        if (worksData.length > 0 && worksData[0].feedback) {
          setExpandedIds(new Set([worksData[0].id]));
        }
      } catch (e) {
        console.error("Error loading data:", e);
        toast({
          title: "Error loading data",
          description: "Could not fetch your analysis and resources.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    init();
  }, [navigate]);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) return;
    const pending = works.some((w) => w.feedback_audio_status === "pending");
    if (!pending) return;
    const t = setInterval(async () => {
      try {
        const fresh = await getStudentWorksByToken(s.access_token, s.full_name);
        setWorks(fresh);
      } catch {
        /* ignore */
      }
    }, 10000);
    return () => clearInterval(t);
  }, [works]);

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
      <div className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
        <Loader2 className="h-10 w-10 shrink-0 animate-spin text-primary" />
        <p className="animate-pulse text-center text-sm font-medium text-muted-foreground sm:text-base">Analyzing your learning journey...</p>
      </div>
    );
  }

  if (!student) return null;

  // Analysis Logic
  const analyzed = works.filter((w) => w.feedback).sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const chartData = analyzed
    .map(w => ({
      date: format(new Date(w.created_at), 'MMM d'),
      fullDate: w.created_at,
      score: extractGradeValue(w.feedback || ''),
      subject: w.subject
    }))
    .filter(d => d.score !== null)
    .reverse(); // Display historically from left to right for the chart

  const scores = analyzed
    .map((w) => extractGradeValue(w.feedback!))
    .filter((v): v is number => v !== null);
  
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
    
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;
  
  // Determine trend (last 3 assignments)
  let trend: 'up' | 'down' | 'stable' | null = null;
  if (scores.length >= 2) {
    const recent = scores.slice(0, 3);
    const newest = recent[0]; 
    const oldest = recent[recent.length - 1]; 
    if (newest > oldest + 5) trend = 'up';
    else if (newest < oldest - 5) trend = 'down';
    else trend = 'stable';
  }

  const getRecommendedResources = (work: StudentWork, sections: any) => {
    if (!sections) return [];
    
    const searchTerms = [
      ...(work.subject ? [work.subject.toLowerCase()] : []),
      ...(sections.error_type ? sections.error_type.toLowerCase().split(' ').filter((w: string) => w.length > 4) : []),
      ...(sections.analysis ? [sections.analysis.toLowerCase()] : []) // broad matching
    ].join(' ');

    return resources.filter(r => {
      const topicMatch = r.topic && searchTerms.includes(r.topic.toLowerCase());
      const titleMatch = r.title && searchTerms.includes(r.title.toLowerCase());
      return topicMatch || titleMatch;
    }).slice(0, 2);
  };

  return (
    <div className="container mx-auto w-full min-w-0 max-w-5xl space-y-3 px-2 py-4 sm:space-y-6 sm:px-4 sm:py-8 pb-14 sm:pb-20">
      <div className="relative overflow-hidden rounded-xl bg-primary px-3 py-4 text-primary-foreground shadow-lg sm:rounded-2xl sm:px-6 sm:py-8">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 hidden sm:block" />
        <div className="relative z-10">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/65">AI feedback</p>
          <h1 className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight sm:gap-3 sm:text-2xl md:text-3xl leading-tight">
            <Brain className="h-6 w-6 shrink-0 text-primary-foreground/95 sm:h-8 sm:w-8" />
            <span>My performance</span>
          </h1>
          <p className="mt-1 sm:mt-2 max-w-2xl text-xs leading-relaxed text-primary-foreground/80 sm:text-sm md:text-base hidden sm:block">
            Below is a short, plain-language summary of each piece of work: what you did, what to fix, and how to improve. Your teacher’s grade is official — this page helps you learn. When your teacher saves your work, parents may get a short SMS with a link to the portal.
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      {analyzed.length > 0 && (
        <>
        <div className="lg:hidden rounded-lg border bg-muted/40 divide-x divide-border flex text-center">
          {[
            { l: "Works", v: analyzed.length },
            { l: "Avg", v: avgScore ? `${avgScore}%` : '-' },
            { l: "Best", v: bestScore ? `${bestScore}%` : '-' },
            { l: "Trend", v: trend || '—' },
          ].map((row) => (
            <div key={row.l} className="flex-1 min-w-0 py-2 px-0.5">
              <p className="text-[9px] text-muted-foreground font-medium">{row.l}</p>
              <p className={cn("text-xs font-bold tabular-nums mt-0.5 capitalize", row.l === "Avg" && avgScore && scoreColor(avgScore))}>{row.v}</p>
            </div>
          ))}
        </div>
        <div className="hidden lg:grid grid-cols-4 gap-4">
          <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-4 pt-5 sm:pt-6">
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-muted-foreground sm:text-sm">Assignments</span>
                <BookOpen className="h-4 w-4 text-primary opacity-70" />
              </div>
              <div className="text-2xl font-bold tabular-nums sm:text-3xl">{analyzed.length}</div>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Analyzed works</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 pt-5 sm:pt-6">
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-muted-foreground sm:text-sm">Average Score</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground opacity-70" />
              </div>
              <div className={cn("text-2xl font-bold tabular-nums sm:text-3xl", avgScore && scoreColor(avgScore))}>
                {avgScore ? `${avgScore}%` : '-'}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Overall performance</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 pt-5 sm:pt-6">
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-muted-foreground sm:text-sm">Best Score</span>
                <Star className="h-4 w-4 text-yellow-500 opacity-70" />
              </div>
              <div className="text-2xl font-bold tabular-nums text-green-600 sm:text-3xl">
                {bestScore ? `${bestScore}%` : '-'}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Personal best</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 pt-5 sm:pt-6">
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-muted-foreground sm:text-sm">Trend</span>
                {trend === 'up' ? (
                   <TrendingUp className="h-4 w-4 text-green-500" />
                ) : trend === 'down' ? (
                   <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                   <div className="h-4 w-4 bg-muted rounded-full" />
                )}
              </div>
              <div className="text-2xl font-bold capitalize sm:text-3xl">
                {trend || 'N/A'}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Last 3 assignments</p>
            </CardContent>
          </Card>
        </div>
        </>
      )}

      {/* Progress Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
            <CardDescription>Your scores over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[220px] w-full min-w-0 xs:h-[260px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  width={28}
                  tickLine={false} 
                  axisLine={false} 
                  domain={[0, 100]} 
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <ReferenceLine y={70} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} label={{ value: "Passing", position: "insideTopRight", fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }} 
                  activeDot={{ r: 6 }} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis List */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold tracking-tight">Recent Analysis</h2>
        
        {works.length === 0 && (
          <Card className="border-dashed bg-muted/40">
             <CardContent className="py-20 text-center">
               <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
               <p className="text-lg font-medium text-muted-foreground">No analysis available yet</p>
               <p className="text-sm text-muted-foreground/80 mt-1 max-w-sm mx-auto">
                 Once you submit assignments and your teacher reviews them, detailed AI feedback will appear here.
               </p>
             </CardContent>
          </Card>
        )}

        {analyzed.map((work) => {
          const score = work.feedback ? extractGradeValue(work.feedback) : null;
          const sections = work.feedback
            ? parseStudentWorkFeedbackSections(work.feedback)
            : null;
          const narrative = buildStudentWorkNarrativeParagraph(
            {
              ...work,
              student_name: work.student_name || student.full_name,
            },
            "student",
          );
          const isExpanded = expandedIds.has(work.id);
          const recommendations = getRecommendedResources(work, sections);
          
          return (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              layout
            >
              <Card className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                 <div className="p-0">
                    <div 
                      className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(work.id)}
                    >
                      {/* Left: Score & Thumbnail */}
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className={cn(
                          "flex flex-col items-center justify-center h-16 w-16 rounded-xl border-2 shrink-0 font-bold text-xl",
                          score !== null ? scoreBg(score) : "bg-muted border-muted-foreground/20 text-muted-foreground"
                        )}>
                          {score !== null ? (
                            <>
                              <span className={cn(scoreColor(score))}>{score}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">%</span>
                            </>
                          ) : (
                            <span className="text-sm">N/A</span>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg line-clamp-1">
                            {work.file_name || work.subject || "Math Assignment"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs font-normal">
                              {work.subject || "Math"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(work.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="sm:hidden ml-auto">
                           {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Right: Summary for desktop */}
                      <div className="hidden sm:flex flex-1 items-center justify-end gap-6 text-sm text-muted-foreground">
                         <span className="max-w-md line-clamp-2 text-left">
                           {narrative || "Open for your summary."}
                         </span>
                         {isExpanded ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && narrative && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-muted/10 border-t"
                        >
                          <div className="p-4 sm:p-6 space-y-6">
                            {(work.feedback_audio_status === "pending" ||
                              work.feedback_audio_url) && (
                              <div className="rounded-xl border bg-primary/5 border-primary/15 p-4">
                                <h4 className="flex items-center gap-2 text-sm font-semibold text-primary mb-3">
                                  <Volume2 className="h-4 w-4" />
                                  Listen to Mama Math
                                </h4>
                                {work.feedback_audio_status === "pending" &&
                                !work.feedback_audio_url ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                    Your teacher is asking Mama Math to record a voice report…
                                  </div>
                                ) : work.feedback_audio_url ? (
                                  <>
                                    <audio
                                      controls
                                      className="w-full max-w-md h-10"
                                      src={work.feedback_audio_url}
                                      preload="metadata"
                                    >
                                      Your browser does not support audio.
                                    </audio>
                                    <p className="mt-2 text-xs text-muted-foreground leading-snug">
                                      Mama Math speaks a short report for your family: she greets you
                                      by name, then explains what showed in your work and what helps
                                      at home — in plain words for parents (math symbols are read as
                                      plus, minus, percent, and so on). Your written summary below is
                                      the student version. Ask your teacher to regenerate voice
                                      feedback from Upload if you need a fresh clip.
                                    </p>
                                  </>
                                ) : null}
                              </div>
                            )}

                            <div>
                              <h4 className="flex items-center gap-2 text-sm font-semibold text-primary mb-3">
                                <Brain className="h-4 w-4" />
                                Your summary
                              </h4>
                              <p className="rounded-xl border bg-background p-4 sm:p-5 text-sm sm:text-base leading-relaxed text-foreground shadow-sm">
                                {narrative}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                This is a simpler version than what your teacher sees — same ideas, easier to read.
                              </p>
                            </div>

                            {recommendations.length > 0 && (
                              <div className="pt-2 border-t border-dashed">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                                  Recommended for you
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {recommendations.map((rec) => (
                                    <div
                                      key={rec.id}
                                      className="flex items-center gap-3 p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors group cursor-pointer"
                                      onClick={() => {
                                        if (rec.url) window.open(rec.url, "_blank");
                                        else if (rec.file_url) window.open(rec.file_url, "_blank");
                                      }}
                                    >
                                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                                        {rec.file_type === "video" ? (
                                          <PlayCircle className="h-4 w-4" />
                                        ) : rec.file_type === "link" ? (
                                          <ExternalLink className="h-4 w-4" />
                                        ) : (
                                          <FileText className="h-4 w-4" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                          {rec.title}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                          {rec.topic || "Resource"}
                                        </p>
                                      </div>
                                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  ))}
                                </div>
                                <Button
                                  variant="link"
                                  className="px-0 h-auto mt-2 text-xs text-primary"
                                  onClick={() => navigate("/student/resources")}
                                >
                                  View all resources
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {/* Image preview strip if needed, or simple view button */}
                          {work.image_url && (
                             <div className="bg-muted/30 px-6 py-3 border-t flex justify-end">
                               <Button variant="outline" size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); setLightbox(work.image_url); }}>
                                 <ZoomIn className="h-3.5 w-3.5" />
                                 View Original Work
                               </Button>
                             </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>
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
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setLightbox(null)}
          >
            <motion.img
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={lightbox}
              alt="student work full"
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white text-4xl leading-none font-light transition-colors"
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
