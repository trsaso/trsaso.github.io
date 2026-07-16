# TerraPath — Claude Code Instructions

## Product

TerraPath is a B2B web application for converting drone or mobile-phone video
into a photogrammetry-ready image set, with capture-path review, frame-quality
analysis, overlap diagnostics, and later 3D terrain reconstruction.

Primary users:
- Marble quarry managers
- Drone operators
- Surveyors
- Construction / earthworks teams

Primary workflow:
1. Create survey project.
2. Upload drone or phone video.
3. Extract video frames and thumbnails.
4. Analyze quality and remove poor/duplicate candidates.
5. Review selected frames in a timeline and map-based capture path.
6. Analyze pairwise overlap and coverage gaps.
7. Export curated frames or submit them to a future reconstruction job.
8. Later: point cloud, textured mesh, DSM/DTM, orthomosaic, contours, volume.

## MVP boundary

MVP is:
- Project management
- Video upload
- FFmpeg frame extraction
- Frame thumbnail review
- Manual select/reject
- Quality analysis architecture
- DJI SRT / GPX telemetry ingestion architecture
- Capture path map
- Pairwise overlap architecture
- Export selected frame manifest

Do not implement actual COLMAP, OpenDroneMap, NodeODM, point-cloud generation,
mesh creation, DEM/DSM, orthomosaic, or volume calculations unless explicitly asked.

## Stack

- Next.js App Router
- TypeScript with strict mode
- Tailwind CSS
- shadcn/ui
- Supabase: Auth, Postgres, Storage, RLS
- MapLibre GL for map/path view
- FFmpeg + FFprobe CLI executed only on Node runtime
- PostgreSQL migrations stored in `supabase/migrations`
- Server-only logic in route handlers, server actions, or worker packages
- React Query or SWR only if the repo already uses it; otherwise use native fetching

## Architecture rules

- Keep UI, application services, repository/data access, and processing modules separate.
- Never access Supabase service-role key from browser/client code.
- Use Supabase RLS for every tenant-owned table and storage object.
- Organization membership is the authorization boundary.
- Every API route must validate authenticated user and organization/project ownership.
- Use Zod for API input and environment validation.
- Use UUIDs for entity primary keys.
- Store timestamps in UTC as `timestamptz`.
- Persist uploaded videos and frames in Supabase Storage, never `public/uploads` in production.
- Never use `exec`, string-concatenated shell commands, or user-controlled FFmpeg arguments.
- Use `spawn("ffmpeg", args)` and fixed server-generated paths/arguments.
- Do not use TypeScript `any`.
- Avoid unnecessary dependencies.
- Do not modify unrelated code or perform broad refactors.

## Storage paths

All objects must be organization-scoped:

- `videos/{organizationId}/{projectId}/{videoId}/source.{extension}`
- `frames/{organizationId}/{projectId}/{jobId}/full/frame-000001.jpg`
- `frames/{organizationId}/{projectId}/{jobId}/thumb/frame-000001.jpg`
- `exports/{organizationId}/{projectId}/{exportId}/...`
- `reconstructions/{organizationId}/{projectId}/{jobId}/...`

## User-facing states

Every feature must account for:
- Initial / empty
- Loading
- Success
- Processing / progress
- Failure with retry
- Unauthorized / forbidden
- Mobile and tablet layout

## UI direction

- Industrial B2B dashboard; compact and desktop-first.
- Dark slate shell; zinc/white panels.
- Accent: safety orange or electric cyan.
- Green = good; amber = warning; red = poor; blue = selected; gray = rejected.
- Use Lucide icons.
- Avoid gradients, excessive card nesting, and decorative visuals.
- Use accessible labels, keyboard navigation, focus states, and sufficient contrast.

## Engineering workflow

Before editing:
1. Inspect relevant existing files and package configuration.
2. State a concise implementation plan with files to modify.
3. Identify assumptions and ask one focused question only if blocked.

During implementation:
1. Implement only the requested scope.
2. Prefer existing patterns/components in this repository.
3. Make database migrations additive and reversible where practical.
4. Add focused tests when logic is non-trivial.
5. Do not fake completed external processing in production logic.

Before finishing:
1. Run the relevant checks:
   - `npm run lint`
   - `npm run typecheck` or `npx tsc --noEmit`
   - focused tests if available
2. Fix errors introduced by the change.
3. Report:
   - changed files
   - database migrations
   - environment variables added
   - commands run and result
   - manual setup or deployment requirements
   - intentionally deferred items

## Domain behavior

Frame quality score:

quality_score =
  0.35 * sharpness_score +
  0.20 * exposure_score +
  0.25 * novelty_score +
  0.20 * overlap_score

Initial overlap thresholds:
- Good: >= 75% overlap and >= 80 visual inliers
- Warning: >= 60% overlap and >= 35 visual inliers
- Poor: otherwise

Initial frame-extraction constraints:
- Default 2 FPS
- Allowed range: 0.1 to 60 FPS
- Hard maximum: 300 extracted frames
- Supported extensions: mp4, mov, webm, mkv, avi, m4v
- Video size must be configurable via `MAX_VIDEO_UPLOAD_MB`

Accuracy:
- GPS-only outputs are approximate.
- Phone-only capture is suitable for visual/local models unless a known scale is supplied.
- Survey-grade quarry measurements require RTK/GCP control.
- Do not imply survey-grade accuracy without explicit control data.
