# Mobile vs Web Feature Parity Map

This file tracks every web route from `src/App.tsx` + monitor routes and the mobile screen that covers it.

## Public / Auth
| Web | Mobile |
|-----|--------|
| `/` | `app/(public)/welcome.tsx` |
| `/sign-in` | `app/(auth)/sign-in.tsx` (+ Google) |
| `/sign-up` | `app/(auth)/sign-up.tsx` |
| `/forgot-password` | `app/(auth)/forgot-password.tsx` |
| `/reset-password` | `app/(auth)/reset-password.tsx` |
| `/verify-email` | `app/(auth)/verify-email.tsx` |
| `/complete-profile` | `app/(auth)/complete-profile.tsx` |
| `/student-login` | `app/(auth)/student-login.tsx` |
| `/student-access/:token` | `app/(auth)/student-access.tsx` + `student-access/[token].tsx` |
| `/enroll/:code` | `app/(auth)/enroll.tsx` + `enroll/[code].tsx` |
| `/auth-success` | `app/(auth)/auth-success.tsx` |
| `/auth/callback` | `app/(auth)/callback.tsx` |
| `/admin/login` | `app/(auth)/admin-login.tsx` |
| `/monitor/login` | `app/(auth)/monitor-login.tsx` |

## Teacher (`/dashboard/*`)
| Web | Mobile |
|-----|--------|
| `/dashboard` | `teacher/overview.tsx` |
| `/dashboard/student-accounts` | `teacher/students.tsx` + `teacher/enrollments.tsx` |
| `/dashboard/assignments` | `teacher/assignments.tsx` |
| `/dashboard/assignments/:id` | `teacher/assignments.tsx` (detail/grading/discussion sheets) |
| `/dashboard/students/:id` | `teacher/feedback.tsx` |
| `/dashboard/lessons` / `lesson-plan` | `teacher/lesson-plan-generator.tsx` |
| `/dashboard/view-lesson-plans` | `teacher/lesson-plans.tsx` |
| `/dashboard/chatbot` | `teacher/chatbot.tsx` |
| `/dashboard/upload` | `teacher/uploads.tsx` (vision AI, roster link, tabs, guidelines — same flow as web) |
| `/dashboard/announcements` | `teacher/announcements.tsx` (templates, schedule UI, read stats, edit/duplicate) |
| `/dashboard/resources` | `teacher/resources.tsx` (list/grid, file/link/bulk upload, preview, edit) |
| `/dashboard/generate-images` | `teacher/generate-images.tsx` (real Gemini image gen, gallery, favorites, daily limit) |
| `/dashboard/agent` | `teacher/agent.tsx` |
| `/dashboard/detailed-analysis` | `teacher/detailed-analysis.tsx` |
| `/dashboard/support` | `teacher/support.tsx` |
| `/dashboard/settings` | `teacher/settings.tsx` |

## Student / Parent
| Web | Mobile |
|-----|--------|
| `/student` | `student/overview.tsx` |
| `/student/assignments` | `student/assignments.tsx` |
| `/student/progress` | `student/progress.tsx` |
| `/student/profile` | `student/profile.tsx` |
| `/student/settings` | `student/settings.tsx` |
| `/student/announcements` | `student/announcements.tsx` |
| `/student/resources` | `student/resources.tsx` |
| `/student/analysis` | `student/analysis.tsx` |
| `/parent-dashboard` | `parent/overview.tsx` |
| `/parent-dashboard/submissions` | `parent/submissions.tsx` |

## Admin (all sidebar routes)
Covered under `app/(roles)/admin/*` including comments, images, create-teacher, geographic, reports, system-health, moderation, data, ai-usage, teacher-performance, student-performance.

## Monitor
Covered under `app/(roles)/monitor/*` including error-analysis, images, teacher-detail, learners, schools, etc.
