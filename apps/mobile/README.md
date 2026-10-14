# Mother of Math Mobile

Standalone Expo React Native app for iOS and Android with native screens mapped to the full web feature set.

## Run

1. Copy `.env.example` to `.env` and set Supabase values.
2. From repo root:
   - `npm run mobile:start`
   - `npm run mobile:android`
   - `npm run mobile:ios`

## Included parity areas

### Auth / public
- Welcome (native, EN/FR)
- Sign in / Sign up / Forgot + reset password
- Verify email OTP
- Complete profile
- Student access token + student email login
- Class enroll
- Admin login
- Partner monitor login

### Teacher
- Overview stats, students, assignments (+ submissions/grading)
- Lesson plan generator + library/export
- Chatbot (conversations + OpenRouter proxy)
- Uploads with native picker + feedback
- Announcements, resources (upload/download/share)
- Generate images, AI agent, detailed analysis
- Support tickets, settings

### Student
- Overview, assignments (submit file), progress
- Announcements, resources (native download)
- AI feedback, profile / session clear

### Parent
- Overview, submissions upload, settings

### Admin
- Overview counts, teachers, students, lesson plans
- Assignments, submissions, resources, announcements
- Schools, chatbot, uploads, analytics, activity, support

### Monitor
- Overview, activity, schools, teachers, learners
- Lesson plans, assignments, chatbot, uploads

## Native capabilities
- Expo Router screen navigation
- AsyncStorage session persistence
- Media/document permissions + share/download
- Deep-link scheme `motherofmath://`
