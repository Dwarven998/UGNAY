# UGNAY — Implementation Summary (Multi-Org, Facebook-per-Org, AI Media Tools)

This document summarizes everything implemented in this round of work, so the team can pull the branch, set up their environment, and test it. Written for people testing the app, not just reading the code.

---

## 0. Before You Start — Required Setup

Every teammate needs **three** things set up before the app will run correctly. Skipping any of these will cause the backend to crash on boot or media/AI features to silently fail.

### 0.1 Run all three SQL migrations (once per database — see note below)

These live in `backend/src/main/resources/db/` and must be run **in order** against the Supabase Postgres database, via the Supabase SQL Editor:

1. `2026-08-28_organizations_schema.sql` — creates `organizations`, `organization_memberships`, `post_directories`, `directory_contributors`.
2. `2026-08-28b_org_facebook_and_post_org.sql` — adds `fb_page_id`/`fb_access_token` to `organizations`, adds `organization_id` to `posts`.
3. `2026-08-28c_media_org_scoping_and_post_moderation.sql` — adds `organization_id` to `media_folders`, and defensively drops any old CHECK constraint on `posts.status` (needed for the two new post statuses below).

> **Important:** these only need to run **once against the shared Supabase database**, not once per teammate. If everyone points at the same Supabase project (check `spring.datasource.url` in `application.properties`), whoever runs these first has already applied them for the whole team. You only need to re-run them if you spin up a **separate** Supabase project for isolated local testing.

### 0.2 Backend secrets (`backend/src/main/resources/application-secrets.properties`, gitignored)

Each teammate needs their own copy with the shared team's actual values (get these from whoever set them up — not committed to git):
```properties
DB_PASSWORD=...
JWT_SECRET=...
FACEBOOK_APP_SECRET=...
```

### 0.3 Gemini model

`application.properties` now points at `gemini-3.5-flash-lite` (not `gemini-3.6-flash`). The newer "thinking" flash models have very low free-tier daily quotas (20 requests/day) and burn part of their output budget on hidden reasoning tokens even for image tasks. `gemini-3.5-flash-lite` is the current lite tier — much higher free-tier throughput, no thinking overhead, and confirmed working with this app's exact multimodal caption/ranking request format.

### 0.4 Frontend `.env` (Supabase Storage, gitignored)

Create `frontend/.env`:
```
VITE_SUPABASE_URL=https://hlxpwkbyledjgfoyjzcf.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon/public key from Supabase Settings → API>
VITE_SUPABASE_BUCKET=media
```
**Without this, uploads silently fall back to browser-only `blob:` URLs** that only work in the uploader's own tab — they look fine locally but are permanently broken for everyone else, and for any AI feature (captioning, recommendation) that needs the backend to fetch the image. Get the anon key from whoever set up the Supabase project; it's safe to share (it's the public client key, not the service-role secret).

**Vite only reads `.env` at server startup** — restart `npm run dev` after creating/editing it.

---

## 1. Multi-Organization Model (new feature, from scratch)

The app went from "one user = one org" (a flat string field) to a real multi-organization system, matching a join-code/approval-based membership model.

### Roles (per organization, not global)
| Role | Can do |
|---|---|
| **ADMIN** | Everything below, plus: create the org, change anyone's role, create/delete directories, connect/disconnect the org's Facebook Page |
| **OFFICER** | Approve/reject join requests, approve/reject pending member posts, create directories, connect/disconnect Facebook |
| **CONTRIBUTOR** / **MEMBER** | Join the org (pending approval by default), upload media, create/schedule posts and generate captions — but their posts require officer/admin approval before they're actually scheduled |

A single user can hold different roles in different organizations simultaneously.

### What's testable
- **Organizations page** (sidebar → Organizations): create a new org (become its ADMIN automatically), or join an existing one by its join code.
- Creating a **DEPARTMENT** or **PROGRAM** org requires you to already be admin of the parent org (fixed 2–3 tier hierarchy: University → Department → Program).
- Joining via code defaults to **pending** status unless the org creator enabled "open join" — an officer/admin must approve it from the org's **Manage** page.
- **Manage page** (click "Manage" next to any org you're admin/officer of): regenerate join code, approve/reject pending members, change member roles, create directories, grant/revoke per-directory contributor access.

---

## 2. Org Switcher (sidebar)

The sidebar org badge is now a real dropdown (top-left, under the logo). It lists "Personal Workspace" plus every org you're an **approved** member of. Whichever one is selected becomes the "active org" for the rest of the app — it drives:
- Which Facebook Page is used for posting (see §3)
- Which posts show in Post Manager (§4)
- Which folders show in Media Repository (§5)

Selection persists across reloads (localStorage) and defaults to your first org automatically.

**Test:** switch between two orgs you belong to and confirm Post Manager / Media Repository content actually changes.

---

## 3. Facebook Connection is Per-Organization

Previously one Facebook Page was tied to your user account. Now:
- Each organization can connect its **own** Facebook Page.
- **Only ADMIN/OFFICER can see and use the "Connect Facebook Page" button.** Regular members/contributors see a passive notice instead: *"Waiting for an officer or admin to connect [org]'s Facebook Page..."* — they cannot connect or disconnect it.
- When no org is active ("Personal Workspace"), the old per-user connection still works exactly as before — nothing broke for solo use.
- Posts remember which org (and therefore which Page) they belong to, so publishing always uses the right credentials.

**Test:** as an ADMIN, connect a real Facebook Page while org A is active. Switch to org B (or Personal) — the connect button should show "not connected" for that context. Log in as a MEMBER of org A — confirm the connect button doesn't appear for them at all.

---

## 4. Post Moderation Queue

Posts made by a **MEMBER/CONTRIBUTOR** (not ADMIN/OFFICER) inside an org now go into a **Pending Review** state instead of being scheduled immediately — they stay under officer/admin control before anything gets published.

- New post statuses: `PENDING_REVIEW`, `REJECTED` (alongside the existing `DRAFT`, `SCHEDULED`, `PUBLISHED`, `FAILED`).
- ADMIN/OFFICER see a **"Pending Approval"** panel above their normal post list, with **Approve**/**Reject** buttons.
- The member who created the post sees a "Submitted for officer/admin approval" notice and a "Pending Review"/"Rejected" badge on it.
- ADMIN/OFFICER posts skip this entirely — they schedule immediately, same as before.

**Test:** as a MEMBER, create a scheduled post inside an org where you're not admin/officer — confirm it shows as Pending Review and does *not* get scheduled. As the ADMIN, approve it from the Pending Approval panel — confirm it now shows as Scheduled.

---

## 5. Media Repository — Org-Scoped Directories

Media folders can now belong to an organization instead of just a personal account.

- Every new organization automatically gets a default **"General"** folder, visible to all its approved members.
- Creating **additional** folders inside an org is officer/admin only; regular members see a message instead of the folder-creation form.
- Viewing folders, uploading into them, and using AI recommendation on them is open to any approved member.
- Folder visibility is scoped to the active org — switching orgs shows that org's folders, not your personal ones (and vice versa for "Personal Workspace").

**Test:** switch to an org — confirm you see its "General" folder (and any others). As a MEMBER, confirm you can't create a new folder there but can upload into existing ones.

---

## 6. AI Image Recommendation ("Find best match")

New feature in Media Repository, matching the original CLAUDE.md spec for Caption Studio's image-selection step:

- Inside any folder, type a description (e.g. *"students smiling at the registration booth"*) and click **Find best match**.
- Backend sends up to 12 images from that folder to Gemini in a single multimodal call, gets back a 0–100 match score + one-line reason per image, and shows them ranked, score-badged, best match first.
- From a ranked result you can copy its URL or jump straight into Caption Studio.

**Test:** upload a few varied images to a folder (after `.env` is set up — see §0.4, or they'll be dead `blob:` URLs and this will fail), then try a description and confirm ranked results with plausible scores/reasons come back.

---

## 7. Bug Fixes

### 7.1 "Schedule Post" appeared to hang
The request was actually failing (e.g. Facebook not connected, or a scheduling conflict), but the error banner was rendering on the page **behind** the modal's backdrop — invisible — with no loading indicator on the button either. Fixed: errors now show inside the modal itself, and the button now shows "Scheduling…"/"Saving…" while in flight.

### 7.2 Date/time picker didn't respond to clicks
Clicking a day or time slot in the calendar popup silently did nothing (confirmed via direct testing — even a raw DOM click had zero effect, while typing a date manually worked). Root cause: the calendar was rendering inline inside the modal's DOM, and something in that nesting was swallowing click events before they reached it. Fixed by rendering the calendar through a React portal — `react-datepicker`'s own documented pattern for use inside modals.

### 7.3 Gemini quota / model issues
Caption generation and AI recommendation were failing after 5 retries with no useful message. Root cause: the previously configured model (`gemini-3.6-flash`) has a 20-requests/day free-tier cap and burns hidden "thinking" tokens even on image tasks. Fixed by switching to `gemini-3.5-flash-lite` and making the backend fail fast with a clear "quota exceeded" message instead of retrying 5 times pointlessly when that specific error occurs again in the future.

### 7.4 No way to delete a media asset
The delete-asset API existed but had no UI. Added a **Delete** button to each asset's hover overlay in Media Repository.

---

## 8. What Was *Not* Changed (still on the old model)

- **Analytics** and the legacy per-user post list (when no org is active) are unchanged.
- **Directory-level contributor grants** (the fine-grained "only these specific people can upload to this specific directory" feature) exist on the backend (`PostDirectory`/`DirectoryContributor`, managed from the org Manage page) but are **not** yet enforced on Media Repository folders — folder access there is currently just "any approved org member." Full directory-level enforcement for media is a likely next step.
- **Public-facing published posts view** (CLAUDE.md Phase 7) hasn't been built.

---

## 9. Known Test Data (needs cleanup)

Testing this session created throwaway accounts/orgs directly in the shared Supabase database (emails like `orgtest*@example.com`, `posttest*@example.com`, orgs named "Test University...", "Draft Test Org..."). These weren't deleted since that's destructive — someone with DB access should clean them up before/during team testing to avoid confusion.
