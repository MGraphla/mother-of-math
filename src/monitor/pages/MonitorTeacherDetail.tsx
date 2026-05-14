import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  MapPin,
  School2,
  Phone,
  Calendar,
  Mail,
  Globe2,
  Users,
  BookOpen,
  ClipboardList,
  MessagesSquare,
  Image as ImageIcon,
  UploadCloud,
  FileText,
  Bell,
  Megaphone,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, PageHeader, LoadingState, EmptyState, Badge, KpiCard, SectionTitle } from '../components/ui';
import {
  getAllTeachers,
  getAllStudents,
  getAllLessonPlans,
  getAllAssignments,
  getAllChatConversations,
  getAllConversationMessages,
  getAllImages,
  getAllStudentWorks,
  getAllAnnouncements,
  getAllResources,
} from '../services/monitorData';
import type {
  TeacherStats,
  StudentStats,
  LessonPlanStats,
  AssignmentStats,
  ChatbotStats,
  ConversationMessageStats,
  StudentWorkStats,
  AnnouncementStats,
  ResourceStats,
} from '@/types/admin';

type ImageRow = { id: string; user_id: string; prompt: string; image_url: string; created_at: string };

const MonitorTeacherDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<TeacherStats | null>(null);
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [plans, setPlans] = useState<LessonPlanStats[]>([]);
  const [assignments, setAssignments] = useState<AssignmentStats[]>([]);
  const [convos, setConvos] = useState<ChatbotStats[]>([]);
  const [messages, setMessages] = useState<ConversationMessageStats[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [works, setWorks] = useState<StudentWorkStats[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementStats[]>([]);
  const [resources, setResources] = useState<ResourceStats[]>([]);
  const [tab, setTab] = useState<'timeline' | 'students' | 'plans' | 'assignments' | 'chat' | 'images' | 'uploads' | 'resources' | 'profile'>('timeline');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [allTeachers, allStudents, allPlans, allA, allC, allM, allImgs, allW, allAnn, allRes] =
          await Promise.all([
            getAllTeachers(),
            getAllStudents(),
            getAllLessonPlans(),
            getAllAssignments(),
            getAllChatConversations(),
            getAllConversationMessages(),
            getAllImages(),
            getAllStudentWorks(),
            getAllAnnouncements(),
            getAllResources(),
          ]);

        const t = allTeachers.find((x) => x.id === id) ?? null;
        setTeacher(t);

        const convoIds = new Set(allC.filter((c) => c.user_id === id).map((c) => c.id));
        setStudents(allStudents.filter((s) => s.teacher_id === id));
        setPlans(allPlans.filter((p) => p.teacher_id === id));
        setAssignments(allA.filter((a) => a.teacher_id === id));
        setConvos(allC.filter((c) => c.user_id === id));
        setMessages(allM.filter((m) => convoIds.has(m.conversation_id)));
        setImages(allImgs.filter((img) => img.user_id === id) as unknown as ImageRow[]);
        setWorks(allW.filter((w) => w.teacher_id === id));
        setAnnouncements(allAnn.filter((a) => a.teacher_id === id));
        setResources(allRes.filter((r) => r.teacher_id === id));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* Combine into a unified per-teacher timeline */
  const timeline = useMemo(() => {
    type Entry = { ts: string; type: string; tone: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky' | 'slate'; label: string; description: string };
    const entries: Entry[] = [];

    students.forEach((s) =>
      entries.push({
        ts: s.created_at,
        type: 'student',
        tone: 'emerald',
        label: 'Created learner',
        description: s.full_name + (s.grade_level ? ` · ${s.grade_level}` : ''),
      })
    );
    plans.forEach((p) =>
      entries.push({ ts: p.created_at, type: 'plan', tone: 'violet', label: 'Lesson plan', description: p.title }),
    );
    assignments.forEach((a) =>
      entries.push({ ts: a.created_at, type: 'assignment', tone: 'amber', label: 'Assignment', description: a.title }),
    );
    convos.forEach((c) =>
      entries.push({ ts: c.created_at, type: 'convo', tone: 'sky', label: 'Chatbot session', description: c.title || 'Untitled' }),
    );
    images.forEach((img) =>
      entries.push({ ts: img.created_at, type: 'image', tone: 'rose', label: 'Image generated', description: img.prompt?.slice(0, 80) || '(no prompt)' }),
    );
    works.forEach((w) =>
      entries.push({
        ts: w.created_at,
        type: 'work',
        tone: 'cyan',
        label: 'Uploaded student work',
        description: `${w.student_name}${w.error_type ? ` · ${w.error_type}` : ''}`,
      }),
    );
    announcements.forEach((a) =>
      entries.push({ ts: a.created_at, type: 'announcement', tone: 'slate', label: 'Announcement', description: a.title }),
    );
    resources.forEach((r) =>
      entries.push({ ts: r.created_at, type: 'resource', tone: 'slate', label: 'Resource', description: r.title }),
    );

    return entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [students, plans, assignments, convos, images, works, announcements, resources]);

  if (loading) {
    return (
      <>
        <BackBar />
        <LoadingState label="Loading teacher profile…" />
      </>
    );
  }

  if (!teacher) {
    return (
      <>
        <BackBar />
        <Card><EmptyState title="Teacher not found" hint="The teacher may have been removed or the ID is incorrect." /></Card>
      </>
    );
  }

  /* AI usage approximations from messages */
  const userMessages = messages.filter((m) => m.role === 'user').length;
  const aiMessages = messages.filter((m) => m.role === 'assistant');
  const aiWords = aiMessages.reduce((sum, m) => sum + (m.content?.trim().split(/\s+/).length || 0), 0);

  return (
    <>
      <BackBar />

      <PageHeader
        title={teacher.full_name || 'Teacher profile'}
        icon={User}
        subtitle={teacher.email}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {teacher.account_status && teacher.account_status !== 'active' && (
              <Badge tone={teacher.account_status === 'paused' ? 'amber' : 'rose'}>{teacher.account_status}</Badge>
            )}
            {teacher.country && <Badge tone="cyan">{teacher.country}</Badge>}
          </div>
        }
      />

      {/* KPI overview */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Students"          value={students.length}     icon={Users}          tone="emerald" />
        <KpiCard label="Lesson plans"      value={plans.length}        icon={BookOpen}       tone="violet" />
        <KpiCard label="Assignments"       value={assignments.length}  icon={ClipboardList}  tone="amber" />
        <KpiCard label="Chatbot sessions"  value={convos.length}       icon={MessagesSquare} tone="sky" hint={`${messages.length.toLocaleString()} messages`} />
        <KpiCard label="Images generated"  value={images.length}       icon={ImageIcon}      tone="rose" />
        <KpiCard label="Student uploads"   value={works.length}        icon={UploadCloud}    tone="cyan" />
        <KpiCard label="Announcements"     value={announcements.length} icon={Megaphone}     tone="slate" />
        <KpiCard label="Resources shared"  value={resources.length}    icon={FileText}       tone="slate" />
      </div>

      {/* Chatbot stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Questions asked</div>
          <div className="mt-1 text-3xl font-semibold text-white">{userMessages.toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-500">User messages to the chatbot</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">AI replies</div>
          <div className="mt-1 text-3xl font-semibold text-white">{aiMessages.length.toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-500">Assistant responses delivered</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">AI words generated</div>
          <div className="mt-1 text-3xl font-semibold text-white">{aiWords.toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-500">Approx. total words in AI replies</div>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="mb-5 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ['timeline', `Timeline · ${timeline.length}`],
              ['students', `Students · ${students.length}`],
              ['plans', `Lesson plans · ${plans.length}`],
              ['assignments', `Assignments · ${assignments.length}`],
              ['chat', `Chatbot · ${convos.length}`],
              ['images', `Images · ${images.length}`],
              ['uploads', `Uploads · ${works.length}`],
              ['resources', `Resources · ${resources.length}`],
              ['profile', 'Profile'],
            ] as [typeof tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={[
                'rounded-md px-3 py-1.5 text-xs',
                tab === k
                  ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'timeline'    && <TimelineTab entries={timeline} />}
      {tab === 'students'    && <StudentsTab rows={students} />}
      {tab === 'plans'       && <PlansTab rows={plans} />}
      {tab === 'assignments' && <AssignmentsTab rows={assignments} />}
      {tab === 'chat'        && <ChatTab convos={convos} messages={messages} />}
      {tab === 'images'      && <ImagesTab rows={images} />}
      {tab === 'uploads'     && <UploadsTab rows={works} />}
      {tab === 'resources'   && <ResourcesTab rows={resources} announcements={announcements} />}
      {tab === 'profile'     && <ProfileTab teacher={teacher} />}
    </>
  );
};

const BackBar = () => (
  <Link
    to="/monitor/teachers"
    className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-slate-100"
  >
    <ArrowLeft className="h-3.5 w-3.5" /> Back to teachers
  </Link>
);

/* ── Tabs ─────────────────────────────────────────────────── */

const TimelineTab = ({ entries }: { entries: { ts: string; tone: 'cyan' | 'emerald' | 'violet' | 'amber' | 'rose' | 'sky' | 'slate'; label: string; description: string }[] }) => {
  if (entries.length === 0)
    return <Card><EmptyState title="No activity yet for this teacher" /></Card>;
  return (
    <Card>
      <SectionTitle title="Complete timeline" hint="Everything this teacher has done on the platform, newest first." />
      <ul className="divide-y divide-slate-800/70">
        {entries.map((e, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-3">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <Badge tone={e.tone}>{e.label}</Badge>
                <span className="text-[11px] text-slate-500">
                  {formatDistanceToNow(new Date(e.ts), { addSuffix: true })}
                </span>
              </div>
              <div className="truncate text-sm text-slate-100">{e.description}</div>
            </div>
            <div className="hidden text-right text-[11px] text-slate-500 sm:block">
              {format(new Date(e.ts), 'MMM d, HH:mm')}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const StudentsTab = ({ rows }: { rows: StudentStats[] }) => (
  <Card>
    {rows.length === 0 ? (
      <EmptyState title="No students yet" />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Name</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3 text-right">Submissions</th>
              <th className="px-4 py-3 text-right">Avg score</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/40">
                <td className="px-5 py-3 text-slate-100">{s.full_name}</td>
                <td className="px-4 py-3 text-slate-300">{s.grade_level ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-100">{s.total_submissions ?? 0}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-100">
                  {s.average_score != null ? Number(s.average_score).toFixed(1) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(s.created_at), 'MMM d, yyyy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

const PlansTab = ({ rows }: { rows: LessonPlanStats[] }) => (
  <Card>
    {rows.length === 0 ? (
      <EmptyState title="No lesson plans generated" />
    ) : (
      <ul className="divide-y divide-slate-800/70">
        {rows.map((p) => (
          <li key={p.id} className="px-5 py-3">
            <div className="flex items-center gap-2">
              <Badge tone="violet">Lesson plan</Badge>
              <span className="text-xs text-slate-500">{format(new Date(p.created_at), 'MMM d, yyyy HH:mm')}</span>
            </div>
            <div className="mt-1 text-sm text-slate-100">{p.title}</div>
            <div className="text-xs text-slate-500">
              {[p.grade_level, p.subject, p.topic].filter(Boolean).join(' · ') || '—'}
            </div>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

const AssignmentsTab = ({ rows }: { rows: AssignmentStats[] }) => (
  <Card>
    {rows.length === 0 ? (
      <EmptyState title="No assignments created" />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Title</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Submitted</th>
              <th className="px-4 py-3 text-right">Graded</th>
              <th className="px-4 py-3">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-slate-800/40">
                <td className="px-5 py-3 text-slate-100">{a.title}</td>
                <td className="px-4 py-3 text-slate-300">{a.grade_level}</td>
                <td className="px-4 py-3">
                  <Badge tone={a.status === 'active' ? 'emerald' : a.status === 'closed' ? 'slate' : 'amber'}>{a.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{a.submitted_count}/{a.total_students}</td>
                <td className="px-4 py-3 text-right tabular-nums">{a.graded_count}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

const ChatTab = ({ convos, messages }: { convos: ChatbotStats[]; messages: ConversationMessageStats[] }) => {
  const byConvo = useMemo(() => {
    const m = new Map<string, ConversationMessageStats[]>();
    messages.forEach((msg) => {
      const arr = m.get(msg.conversation_id) ?? [];
      arr.push(msg);
      m.set(msg.conversation_id, arr);
    });
    return m;
  }, [messages]);

  const [active, setActive] = useState<string | null>(convos[0]?.id ?? null);
  const activeMsgs = active ? byConvo.get(active) ?? [] : [];

  if (convos.length === 0)
    return <Card><EmptyState title="No chatbot conversations yet" /></Card>;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <SectionTitle title="Conversations" hint={`${convos.length} total`} />
        <ul className="max-h-[600px] divide-y divide-slate-800/70 overflow-y-auto">
          {convos.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActive(c.id)}
                className={[
                  'w-full px-5 py-3 text-left transition-colors',
                  active === c.id ? 'bg-cyan-500/10' : 'hover:bg-slate-800/30',
                ].join(' ')}
              >
                <div className="truncate text-sm text-slate-100">{c.title || 'Untitled'}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {format(new Date(c.created_at), 'MMM d, HH:mm')} · {c.message_count ?? 0} msgs · {c.grade || 'no grade'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:col-span-2">
        <SectionTitle
          title={convos.find((c) => c.id === active)?.title || 'Select a conversation'}
          hint="Read-only transcript"
        />
        {activeMsgs.length === 0 ? (
          <EmptyState title="No messages in this conversation" />
        ) : (
          <ul className="max-h-[600px] space-y-3 overflow-y-auto px-5 pb-5">
            {activeMsgs
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((m) => (
                <li
                  key={m.id}
                  className={[
                    'rounded-lg border p-3 text-sm',
                    m.role === 'user'
                      ? 'border-cyan-500/20 bg-cyan-500/5 text-slate-100'
                      : 'border-slate-700/70 bg-slate-900/40 text-slate-200',
                  ].join(' ')}
                >
                  <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{m.role === 'user' ? 'Teacher' : 'AI assistant'}</span>
                    <span>{format(new Date(m.created_at), 'MMM d, HH:mm')}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

const ImagesTab = ({ rows }: { rows: ImageRow[] }) => (
  <Card>
    {rows.length === 0 ? (
      <EmptyState title="No images generated" />
    ) : (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((img) => (
          <div key={img.id} className="overflow-hidden rounded-lg border border-slate-800/70 bg-slate-900/50">
            {img.image_url ? (
              <img src={img.image_url} alt={img.prompt} className="aspect-square w-full object-cover" />
            ) : (
              <div className="aspect-square w-full bg-slate-800" />
            )}
            <div className="p-2">
              <div className="line-clamp-2 text-[11px] text-slate-300">{img.prompt || '(no prompt)'}</div>
              <div className="mt-1 text-[10px] text-slate-500">{format(new Date(img.created_at), 'MMM d, yyyy')}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </Card>
);

const UploadsTab = ({ rows }: { rows: StudentWorkStats[] }) => (
  <Card>
    {rows.length === 0 ? (
      <EmptyState title="No student work uploads" />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Student</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Error type</th>
              <th className="px-4 py-3">Feedback (excerpt)</th>
              <th className="px-4 py-3">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-b border-slate-800/40">
                <td className="px-5 py-3 text-slate-100">{w.student_name}</td>
                <td className="px-4 py-3 text-slate-300">{w.subject || '—'}</td>
                <td className="px-4 py-3">
                  {w.error_type ? <Badge tone="amber">{w.error_type}</Badge> : <span className="text-slate-500">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  <div className="line-clamp-2 max-w-md">{w.feedback || '—'}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{format(new Date(w.created_at), 'MMM d, yyyy')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

const ResourcesTab = ({ rows, announcements }: { rows: ResourceStats[]; announcements: AnnouncementStats[] }) => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Card>
      <SectionTitle title="Resources shared" hint={`${rows.length} total`} />
      {rows.length === 0 ? (
        <EmptyState title="No resources shared" />
      ) : (
        <ul className="divide-y divide-slate-800/70">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-3">
              <div className="text-sm text-slate-100">{r.title}</div>
              <div className="text-xs text-slate-500">
                {[r.topic, r.grade_level, r.file_type, r.is_public ? 'Public' : 'Private'].filter(Boolean).join(' · ')}
              </div>
              <div className="text-[11px] text-slate-600">{format(new Date(r.created_at), 'MMM d, yyyy')}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>

    <Card>
      <SectionTitle title="Announcements" hint={`${announcements.length} total`} />
      {announcements.length === 0 ? (
        <EmptyState title="No announcements" />
      ) : (
        <ul className="divide-y divide-slate-800/70">
          {announcements.map((a) => (
            <li key={a.id} className="px-5 py-3">
              <div className="mb-0.5 flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-sm text-slate-100">{a.title}</span>
                {a.is_pinned && <Badge tone="amber">Pinned</Badge>}
              </div>
              <div className="line-clamp-2 text-xs text-slate-400">{a.message}</div>
              <div className="text-[11px] text-slate-600">{format(new Date(a.created_at), 'MMM d, yyyy')}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  </div>
);

const ProfileTab = ({ teacher }: { teacher: TeacherStats }) => (
  <Card className="p-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ProfileRow icon={Mail}     label="Email"            value={teacher.email} />
      <ProfileRow icon={Phone}    label="Phone"            value={teacher.phone_number || '—'} />
      <ProfileRow icon={Phone}    label="WhatsApp"         value={teacher.whatsapp_number || '—'} />
      <ProfileRow icon={School2}  label="School"           value={teacher.school_name || '—'} />
      <ProfileRow icon={MapPin}   label="Location"         value={[teacher.city, teacher.country].filter(Boolean).join(', ') || '—'} />
      <ProfileRow icon={Globe2}   label="School type"      value={teacher.school_type || '—'} />
      <ProfileRow icon={Users}    label="Students (reported)"  value={teacher.number_of_students?.toString() || '—'} />
      <ProfileRow icon={BookOpen} label="Subjects taught"  value={teacher.subjects_taught || '—'} />
      <ProfileRow icon={BookOpen} label="Grade levels"     value={teacher.grade_levels || '—'} />
      <ProfileRow icon={Calendar} label="Years experience" value={teacher.years_of_experience?.toString() || '—'} />
      <ProfileRow icon={Calendar} label="Joined"           value={format(new Date(teacher.created_at), 'MMM d, yyyy')} />
      {teacher.updated_at && (
        <ProfileRow icon={Calendar} label="Last profile update" value={format(new Date(teacher.updated_at), 'MMM d, yyyy HH:mm')} />
      )}
    </div>
    {teacher.bio && (
      <div className="mt-6 rounded-lg border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-300">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Bio</div>
        {teacher.bio}
      </div>
    )}
  </Card>
);

const ProfileRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="truncate text-sm text-slate-100">{value}</div>
    </div>
  </div>
);

export default MonitorTeacherDetail;
