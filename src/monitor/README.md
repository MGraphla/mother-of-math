# Mother of Math — Partner Monitor

A **read-only** monitoring dashboard that you share with implementing partners
(NGO, funder, government agency, M&E team) so they can see exactly how teachers
are using the platform — without ever being able to create, edit or delete a
record.

## URLs

- Login: `https://<your-domain>/monitor/login`
- Dashboard: `https://<your-domain>/monitor/overview`

## Configuration

Set this in `.env`:

```
VITE_MONITOR_PASSWORD=<long-shared-access-code>
VITE_OPENROUTER_API_KEY=sk-or-...   # already used by the main app
```

Rotate `VITE_MONITOR_PASSWORD` before sharing the URL with a new partner.
Sessions expire automatically after 12 hours.

## What partners can see

| Page              | Real-data source (Supabase)                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| Overview          | `get_admin_counts` RPC + `get_activity_trends` + `get_comparison_metrics`     |
| Activity log      | Recent rows from `profiles`, `students`, `lesson_plans`, `assignments`, `assignment_submissions` |
| Teachers          | `get_all_teachers` + per-teacher counts                                       |
| Teacher detail    | Joined timeline across every teacher-owned table                              |
| Chatbot           | `conversations` + `conversation_messages` aggregated by hour and grade        |
| Lesson plans      | `lesson_plans` aggregated by teacher and grade                                |
| Student uploads   | `student_works` rows with image preview + AI feedback                         |
| Error analysis    | `student_works.error_type` aggregated by subject and grade                    |
| Image generation  | `generated_images` rows with prompt + favourites                              |
| Assignments       | `assignments` + `assignment_submissions` with AI vs human grading split       |
| Schools & geo     | `get_all_schools` + `get_teachers_by_country`                                 |
| AI insights       | OpenRouter analysis of the aggregate summary (counts only, no PII)            |

## What partners cannot do

- No create/update/delete endpoints are imported by this module.
- The sidebar contains zero mutation actions.
- Supabase RLS still blocks anon writes; the monitor only reads via
  `SECURITY DEFINER` RPC functions that already exist in
  `supabase-admin-functions.sql`.

## Data that is **not** currently captured in Supabase

The monitor surfaces every event that is persisted. The following signals are
**not currently logged** by the application — only proxies are shown:

1. **Explicit login / logout events.** Supabase auth records
   `auth.users.last_sign_in_at` but this column is not exposed to anon
   clients. The monitor uses `profiles.updated_at` as a proxy for "active in
   the last 24h / 7d / 30d".
2. **Per-page view / per-click telemetry.** No `page_views` or
   `feature_clicks` table exists. The dashboard infers feature usage from the
   rows each feature creates.
3. **OpenRouter token / cost ledger.** Token usage and cost per request are
   not stored anywhere. Only message counts and word counts (computed from
   `conversation_messages.content`) are visible.
4. **Image generation prompts that failed.** Only successfully saved images
   in `generated_images` are visible.
5. **Time spent in app / session length.** Not recorded.

If the implementing partner needs any of these signals, the next step is to
add a thin event-logging table (e.g. `app_events(user_id, event_name, payload,
created_at)`) and emit from the relevant React handlers. The monitor can then
be extended to read from it without changing the partner-facing UX.

## Architecture notes

- Module lives entirely under `src/monitor/` and is lazy-loaded from
  `App.tsx` at `/monitor/*`.
- Data access is centralised in `src/monitor/services/monitorData.ts` which
  **only re-exports getters** from the existing `adminService`. No mutation
  helper is exported, by design.
- Auth is a shared-password gate in `src/monitor/auth/monitorAuth.ts`
  (sessionStorage, 12-hour expiry).
- AI Insights uses the existing `VITE_OPENROUTER_API_KEY` and sends only
  aggregate counts — never PII — to the model.
