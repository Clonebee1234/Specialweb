# Requirements Document

## Introduction

CelebrateThem is a production-grade Next.js 14+ web application that enables a Creator to craft a personalized, passcode-protected surprise experience (either a Birthday Celebration or a Soft Expression / Confession) for a Recipient. The Creator completes a multi-step guided form, uploads media, sets a 4-digit passcode and an activation time (which must be at least 15 minutes in the future), and receives a unique short link of the form `/c/[shortCode]` along with an Instagram contact prompt. Every Celebration is created with `status = 'pending'` and is not viewable by the Recipient until an Admin approves it. Once approved, the Celebration becomes `active` at or after its `activate_at` time and remains active for a fixed 21-hour Activation_Window (`expires_at = activate_at + 21 hours`), after which it transitions to `inactive` (data retained). An Admin-configurable global default hours value exists only as a future-facing knob for newly-created Celebrations but the current Platform treats every Celebration's window as exactly 21 hours. The Recipient opens the link, enters the passcode, and is taken through a cinematic, scroll-driven, chapter-based experience. A password-gated Admin Panel provides approval and rejection flows, full lifecycle management, reply handling, storage visibility, and manual permanent deletion. The Platform supports many concurrent isolated celebrations with no end-user accounts, uses Supabase (Postgres + Storage) as the backend, and deploys to Vercel with a scheduled job for expiry transitions. The `celebrations` table includes the columns `approved_at TIMESTAMP WITH TIME ZONE NULL`, `approved_by VARCHAR(100) NULL`, `admin_notes TEXT NULL`, and `passcode_version INTEGER NOT NULL DEFAULT 1`; the `status` column's CHECK constraint is `status IN ('pending', 'active', 'inactive', 'deleted')` with DEFAULT `'pending'`. Because the Passcode is stored as a one-way scrypt hash, the Admin cannot recover a Passcode's plaintext after creation; the Admin may instead reset the Passcode to a new server-generated 4-digit value, which increments `passcode_version` and invalidates any outstanding Recipient unlock cookies.

## Glossary

- **Platform**: The entire CelebrateThem web application, including client UI, API routes, database, storage, and scheduled jobs.
- **Creator**: A person who fills the creator form and generates a celebration. Unauthenticated; identified only within a single form session.
- **Recipient**: The person the celebration is made for. Unauthenticated; proves access by entering the 4-digit Passcode for a given Short_Code.
- **Admin**: The operator of the Platform who authenticates into the Admin Panel using the configured Admin Password.
- **Creator_Form**: The multi-step wizard on `/create` that collects all data required to generate a Celebration.
- **Celebration**: A single record in the `celebrations` table plus its associated media in Supabase Storage. Has exactly one `type` (`birthday` or `expression`) and one `status` (`pending`, `active`, `inactive`, or `deleted`).
- **Short_Code**: A URL-safe alphanumeric identifier, 6 to 8 characters, unique across all Celebrations, used in the path `/c/[shortCode]`.
- **Passcode**: A 4-digit numeric string set by the Creator, stored as a one-way salted hash, and required to unlock the Recipient Experience.
- **Passcode_Version**: A non-negative integer stored in the `passcode_version` column of the `celebrations` table, initialized to 1 on insert and incremented by exactly 1 each time an Admin performs a Passcode Reset. The current `passcode_version` is embedded in every Recipient unlock cookie issued for the Celebration, and an incoming cookie whose embedded version does not equal the row's current `passcode_version` is rejected, forcing re-entry of the (new) Passcode.
- **Recipient_Experience**: The full chapter-based, scroll-driven journey rendered at `/c/[shortCode]` after successful Passcode entry.
- **Birthday_Experience**: The Recipient_Experience variant for `type = 'birthday'` composed of seven chapters: Unwrapping, Cinematic Reveal, Story Scroll, Reasons Constellation, Interactive Games (Quiz, Unwrap Wishes, Celebration Wheel), Final Letter, and Grand Finale.
- **Expression_Experience**: The Recipient_Experience variant for `type = 'expression'` composed of seven chapters: Envelope, Slow Build, Noticing, Moments, Confession, Reply, and Soft Ending.
- **Activation_Window**: The fixed 21-hour interval between `activate_at` and `expires_at` during which an approved Celebration is eligible to be `active`. The Platform always computes `expires_at = activate_at + 21 hours` at persistence time regardless of any Admin-configured default.
- **Expiry_Job**: A Vercel Cron-triggered API route that transitions `active` Celebrations whose `expires_at` is in the past to `inactive`. The Expiry_Job never operates on `pending`, `inactive`, or `deleted` rows.
- **Pending_Celebration**: A Celebration row with `status = 'pending'`, meaning it has been submitted by the Creator but not yet approved by an Admin. Pending_Celebrations are not accessible to Recipients regardless of the current time relative to `activate_at` or `expires_at`.
- **Approval**: The Admin action that transitions a Pending_Celebration from `status = 'pending'` to `status = 'active'`, records `approved_at = NOW()`, and sets `approved_by` to the Admin identifier (currently the literal `'admin'`).
- **Admin_Instagram_Contact**: The Instagram DM destination displayed to the Creator on the post-submission confirmation screen, configured via the environment variables `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` (the full `https://instagram.com/...` URL) and `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE` (the `@handle` text), so the Creator can message the Admin to confirm the celebration and arrange payment.
- **Theme**: A named visual preset (one of: `confetti-burst`, `golden-glow`, `neon-night`, `starry-dream`, `midnight-letters`, `soft-bloom`, `warm-sunset`) controlling colors, fonts, and particle styles.
- **Reply_Image**: A PNG image rendered client-side via HTML Canvas from the Recipient's typed reply text on an Expression Celebration.
- **Storage_Bucket**: The Supabase Storage bucket that holds per-Celebration media under the path prefix `celebrations/{shortCode}/`.
- **Admin_Session**: A server-verified session represented by an HTTP-only, Secure, SameSite=Lax cookie with a 24-hour expiry, issued upon successful Admin login.
- **Rate_Limiter**: The server-side component that caps Passcode attempts per Short_Code per client IP within a rolling time window.
- **Reduced_Motion_Mode**: The rendering mode applied when the user agent reports `prefers-reduced-motion: reduce`, which substitutes or disables non-essential motion.

## Requirements

### Requirement 1: Celebration Creation (Form Submission and Persistence)

**User Story:** As a Creator, I want to submit my completed multi-step form and receive a unique shareable link and passcode, so that I can send a ready-to-open surprise to my Recipient once an Admin approves it.

#### Acceptance Criteria

1. WHEN the Creator submits a valid completed Creator_Form, THE Platform SHALL persist one new row in the `celebrations` table with `status = 'pending'`, `approved_at = NULL`, `approved_by = NULL`, and `admin_notes = NULL`, and SHALL return the generated `shortCode` and the plain `passcode` to the client exactly once in the HTTP response.
2. WHEN the Platform generates a Short_Code, THE Platform SHALL produce a URL-safe alphanumeric string of length 6 to 8 that is unique across all existing rows in the `celebrations` table.
3. IF a generated Short_Code collides with an existing `short_code` value, THEN THE Platform SHALL regenerate and retry up to 5 times before returning HTTP 500 with error code `SHORT_CODE_GENERATION_FAILED`.
4. WHEN the Platform persists a Celebration, THE Platform SHALL store the Passcode only as a salted one-way hash in the `passcode` column and SHALL NOT log or return the plain Passcode after the initial creation response.
5. WHEN the Platform persists a Celebration, THE Platform SHALL compute `expires_at = activate_at + INTERVAL '21 hours'` as a fixed per-Celebration duration, regardless of any Admin-configured default value.
6. IF the Creator_Form submission is missing any required field defined in Requirements 3, 4, or 5, THEN THE Platform SHALL reject the submission with HTTP 400 and return a machine-readable list of invalid fields without persisting any row.
7. WHEN the Platform successfully creates a Celebration, THE Platform SHALL navigate the Creator to the post-submission confirmation screen defined in Requirement 29 and SHALL display the generated link `https://{host}/c/{shortCode}` and the 4-digit Passcode with copy buttons for each.

### Requirement 2: Occasion Selection and Theme Selection

**User Story:** As a Creator, I want to pick the occasion type and a visual theme, so that the generated experience matches the mood I want to convey.

#### Acceptance Criteria

1. WHEN the Creator is on Step 1 of the Creator_Form, THE Creator_Form SHALL present exactly two occasion choices: `birthday` and `expression`, and SHALL auto-advance to Step 2 when one is selected.
2. WHERE `type = 'birthday'`, THE Creator_Form SHALL restrict available themes to `confetti-burst`, `golden-glow`, `neon-night`, and `starry-dream`.
3. WHERE `type = 'expression'`, THE Creator_Form SHALL restrict available themes to `midnight-letters`, `soft-bloom`, and `warm-sunset`.
4. IF the Creator submits a Celebration with a Theme that is not in the allowed set for the selected `type`, THEN THE Platform SHALL reject the submission with HTTP 400 and error code `THEME_NOT_ALLOWED_FOR_TYPE`.
5. THE Platform SHALL persist exactly one `theme` value per Celebration in the `theme` column.

### Requirement 3: Birthday Content Collection and Validation

**User Story:** As a Creator building a birthday surprise, I want the form to collect and validate all birthday-specific content, so that the experience renders correctly for the Recipient.

#### Acceptance Criteria

1. WHERE `type = 'birthday'`, THE Creator_Form SHALL require: `recipient_name` (1 to 100 chars), `creator_name` (1 to 100 chars), `relationship` (from the allowed list: Partner, Crush, Best Friend, Sibling, Spouse, Other), `hero_text` (1 to 150 chars), `reasons` (array of 5 to 10 strings, each 1 to 150 chars), `quiz_questions` (exactly 5 items, each with a non-empty prompt, exactly 4 non-empty options, and one `correctIndex` in the range 0..3), `final_message` (1 to 800 chars), and `photos` (3 to 7 items).
2. THE Creator_Form SHALL allow each birthday photo to carry an optional `caption` of 0 to 100 characters.
3. IF any required birthday field is missing, empty, or exceeds its character limit, THEN THE Creator_Form SHALL block advancement from the step containing the field and display a field-specific error message identifying the field and the violated limit.
4. THE Platform SHALL persist birthday content in `hero_text`, `reasons`, `quiz_questions`, `final_message`, and `photos` columns, and SHALL leave expression-only columns (`confession_message`, `things_i_notice`, `closing_line`) NULL.

### Requirement 4: Expression Content Collection and Validation

**User Story:** As a Creator building an expression, I want the form to collect and validate expression-specific content, so that the intimate experience renders correctly.

#### Acceptance Criteria

1. WHERE `type = 'expression'`, THE Creator_Form SHALL require: `recipient_name` (1 to 100 chars), `creator_name` (1 to 100 chars), `relationship` (from the allowed list), `confession_message` (1 to 1500 chars), `things_i_notice` (array of 3 to 5 strings, each 1 to 150 chars), `closing_line` (1 to 200 chars, either a preset or a custom string), and `photos` (2 to 4 items).
2. THE Creator_Form SHALL allow each expression photo to carry an optional `caption` of 0 to 100 characters.
3. IF any required expression field is missing, empty, or exceeds its character limit, THEN THE Creator_Form SHALL block advancement from the step containing the field and display a field-specific error message identifying the field and the violated limit.
4. THE Platform SHALL persist expression content in `confession_message`, `things_i_notice`, `closing_line`, and `photos` columns, and SHALL leave birthday-only columns (`hero_text`, `reasons`, `quiz_questions`, `final_message`) NULL.

### Requirement 5: Passcode Configuration and Activation Timing

**User Story:** As a Creator, I want to set a 4-digit passcode and choose when the experience starts, so that only my Recipient can open it and at the time I intend.

#### Acceptance Criteria

1. WHEN the Creator is on the Security & Timing step, THE Creator_Form SHALL require a 4-digit Passcode entered twice in separate fields and SHALL accept the step only when both entries are identical and match the regex `^[0-9]{4}$`.
2. WHEN the Creator sets `activate_at`, THE Creator_Form SHALL accept only instants that are at least 15 minutes after the current server time, and SHALL display the computed `expires_at` in the Creator's local timezone as `activate_at + 21 hours`.
3. IF the Creator sets `activate_at` to any instant earlier than `server_now + 15 minutes` (including any time in the past), THEN THE Creator_Form and the Platform SHALL reject the value with the message "Activation time must be at least 15 minutes from now".
4. THE Platform SHALL store `activate_at` and `expires_at` as `TIMESTAMP WITH TIME ZONE` values in UTC.
5. THE Creator_Form SHALL NOT expose any control for configuring the duration of the Activation_Window; the Activation_Window is fixed at exactly 21 hours per Celebration.

### Requirement 6: Creator_Form Navigation, State Preservation, and Preview

**User Story:** As a Creator, I want to move back and forth between form steps without losing my inputs, and preview the final experience before generating the link, so that I can refine my surprise with confidence.

#### Acceptance Criteria

1. WHEN the Creator clicks "Back" on any step after Step 1, THE Creator_Form SHALL return to the previous step with all previously entered values preserved in the current browser session.
2. WHILE the Creator is filling the Creator_Form, THE Creator_Form SHALL block advancement from any step until the step's validation rules pass.
3. WHEN the Creator reaches the Preview step, THE Creator_Form SHALL render a functional preview of the Recipient_Experience using the in-memory form data, without persisting any Celebration row.
4. WHEN the Creator clicks "Generate My Link" on the Preview step, THE Platform SHALL persist the Celebration as defined in Requirement 1 and navigate to a confirmation screen showing link and Passcode.

### Requirement 7: Photo Upload, Compression, and Storage

**User Story:** As a Creator, I want to upload photos that are compressed before transfer and stored reliably, so that the experience loads fast and my media is safely saved.

#### Acceptance Criteria

1. WHEN the Creator selects a photo file, THE Creator_Form SHALL compress the file client-side to a JPEG or WebP whose serialized size is less than or equal to 1,048,576 bytes (1 MB) before upload.
2. IF a photo cannot be compressed below 1 MB after a maximum of 3 iterative quality reductions, THEN THE Creator_Form SHALL reject the file with message "This image is too large. Please choose a smaller photo."
3. WHEN the Platform uploads a photo to Supabase Storage, THE Platform SHALL place it at `celebrations/{shortCode}/photo_{index}.{ext}` where `{index}` is a 1-based position, and SHALL record an entry in the `photos` JSONB column with fields `url`, `caption`, and `order`.
4. IF any individual photo upload fails, THEN THE Platform SHALL abort the Celebration creation, delete any already-uploaded photos for the in-progress `shortCode`, and return HTTP 502 with error code `PHOTO_UPLOAD_FAILED`.
5. THE Platform SHALL reject any uploaded file whose MIME type is not `image/jpeg`, `image/png`, or `image/webp` with HTTP 415 and error code `UNSUPPORTED_PHOTO_TYPE`.
6. THE Creator_Form SHALL enforce a maximum of 7 photos for birthday Celebrations and 4 photos for expression Celebrations before allowing submission.

### Requirement 8: Optional Music Upload and Playback Controls

**User Story:** As a Creator, I want to optionally attach a song, and as a Recipient I want gentle, controllable music during the experience, so that audio enhances rather than disrupts the moment.

#### Acceptance Criteria

1. WHERE the Creator uploads an audio file on the Content step, THE Creator_Form SHALL accept only MIME types `audio/mpeg` and `audio/mp4` (covering MP3 and M4A) and SHALL reject any file larger than 5,242,880 bytes (5 MB) with message "Audio must be 5 MB or smaller".
2. WHEN the Platform persists the audio, THE Platform SHALL store it at `celebrations/{shortCode}/music.{ext}` and SHALL write the public URL into the `song_url` column.
3. WHERE `song_url` is not NULL, THE Recipient_Experience SHALL render a persistent audio control fixed to the bottom-left of the viewport with at least Play/Pause, Mute/Unmute, and a volume slider.
4. WHEN the Recipient_Experience mounts with a non-NULL `song_url`, THE Recipient_Experience SHALL attempt autoplay at initial volume less than or equal to 0.4.
5. IF the browser blocks autoplay, THEN THE Recipient_Experience SHALL display a visible "Tap to play music" affordance that starts playback on first user interaction.
6. WHERE `song_url` is NULL, THE Recipient_Experience SHALL NOT render any audio control.

### Requirement 9: Recipient Passcode Entry and Rate Limiting

**User Story:** As a Recipient, I want to enter the 4-digit passcode to unlock my surprise, and as the Platform operator I want abusive attempts throttled, so that the experience is private and protected.

#### Acceptance Criteria

1. WHEN the Recipient navigates to `/c/{shortCode}` for a Celebration with `status = 'active'`, THE Recipient_Experience SHALL render the Passcode entry screen as the only interactive content until a correct Passcode is entered.
2. WHEN the Recipient types 4 digits into the Passcode entry field, THE Recipient_Experience SHALL auto-submit the Passcode without requiring a button click.
3. WHEN the Platform receives a Passcode attempt, THE Platform SHALL compare the hash of the attempt against the stored hash using a constant-time comparison function.
4. IF the Passcode attempt is incorrect, THEN THE Recipient_Experience SHALL display a shake animation and the message "That's not quite right. Try again 💛" without revealing any Celebration content.
5. THE Rate_Limiter SHALL allow at most 10 incorrect Passcode attempts per `shortCode` per client IP per 15-minute rolling window, and upon exceeding the limit SHALL return HTTP 429 with message "Too many attempts. Please try again later."
6. WHEN a Passcode attempt is correct, THE Platform SHALL issue a short-lived HTTP-only cookie `ct_unlock_{shortCode}` signed with a server secret, valid for 24 hours, that authorizes subsequent requests for that specific Short_Code only.
7. IF the Recipient loads `/c/{shortCode}` and presents a valid `ct_unlock_{shortCode}` cookie, THEN THE Recipient_Experience SHALL skip the Passcode screen and render the experience directly.
8. THE unlock cookie SHALL embed the Celebration's current `passcode_version`; on a subsequent request, THE Platform SHALL reject the cookie if its embedded version does not equal the Celebration's current `passcode_version`, forcing a fresh Passcode entry.

### Requirement 10: Celebration Lifecycle and Status Gating

**User Story:** As a Recipient, I want the experience to open only when it has been approved and within its active window, and as an Admin I want clear status transitions, so that the product lifecycle is predictable.

#### Acceptance Criteria

1. WHEN the Recipient requests `/c/{shortCode}` and the matching Celebration has `status = 'active'` AND `NOW() >= activate_at` AND `NOW() < expires_at`, THE Recipient_Experience SHALL proceed to Passcode entry or rendering per Requirement 9.
2. IF the matching Celebration has `status = 'pending'`, THEN THE Recipient_Experience SHALL display the message "This surprise is still being prepared. Check back soon 💛" and SHALL NOT expose the Passcode entry, any Celebration content, or the `activate_at` value.
3. IF the matching Celebration has `status = 'active'` AND `NOW() < activate_at`, THEN THE Recipient_Experience SHALL display the message "This celebration will open at [activate_at in Recipient locale]. Come back then 💛" and SHALL NOT expose the Passcode entry.
4. IF the matching Celebration has `status = 'inactive'` OR (`status = 'active'` AND `NOW() >= expires_at`), THEN THE Recipient_Experience SHALL display the message "This celebration has ended. The memories live on 💫. Screen record next time!" and SHALL NOT expose the Passcode entry or media content.
5. IF no Celebration exists for the requested `shortCode` OR its `status = 'deleted'`, THEN THE Platform SHALL return HTTP 404 with a friendly not-found page.
6. THE Platform SHALL treat `status = 'deleted'` rows as non-existent for all non-admin read operations.
7. THE Platform SHALL NOT expose the Passcode entry or any Celebration content (including photos, messages, reasons, quiz questions, things_i_notice, confession_message, or song_url) to any non-admin visitor while `status = 'pending'`.

### Requirement 11: Expiry Cron Job

**User Story:** As the Platform operator, I want expired celebrations to transition to `inactive` automatically, so that lifecycle is enforced without manual intervention.

#### Acceptance Criteria

1. THE Platform SHALL expose an authenticated cron endpoint at `/api/cron/expire` callable only with a `x-cron-secret` header matching the configured `CRON_SECRET` environment variable.
2. WHEN the Expiry_Job runs, THE Expiry_Job SHALL update every row where `status = 'active'` AND `expires_at < NOW()` by setting `status = 'inactive'` in a single SQL statement, and SHALL NOT touch any row whose `status` is `pending`, `inactive`, or `deleted`.
3. THE Expiry_Job SHALL NOT delete any row and SHALL NOT delete any file in Supabase Storage.
4. IF the Expiry_Job request lacks or has an invalid `x-cron-secret`, THEN THE Platform SHALL return HTTP 401 and perform no database writes.
5. THE Platform SHALL be configured in `vercel.json` to invoke `/api/cron/expire` at least once per hour.

### Requirement 12: Birthday_Experience Chapter Sequencing and Content Rendering

**User Story:** As a Recipient opening a birthday surprise, I want a cinematic, chapter-based journey that uses my personalized content, so that the experience feels handcrafted for me.

#### Acceptance Criteria

1. WHERE `type = 'birthday'`, THE Birthday_Experience SHALL render exactly these chapters in this order: Unwrapping, Cinematic Reveal, Story Scroll, Reasons Constellation, Interactive Games (Quiz, then Unwrap Wishes, then Celebration Wheel), Final Letter, Grand Finale.
2. WHEN rendering the Cinematic Reveal, THE Birthday_Experience SHALL display the `recipient_name` letter by letter using stagger animation followed by "Happy Birthday!" and "From {creator_name}, with all my heart".
3. WHEN rendering the Story Scroll, THE Birthday_Experience SHALL display `hero_text` first, then each entry in `photos` in the stored `order`, each with its `caption` when present.
4. WHEN rendering the Reasons Constellation, THE Birthday_Experience SHALL display every entry of the `reasons` array in the stored order and SHALL NOT drop or reorder entries.
5. WHEN rendering the Quiz, THE Birthday_Experience SHALL present each of the 5 `quiz_questions` in stored order with its 4 options; on selection, SHALL highlight correctness against `correctIndex` and SHALL auto-advance to the next question after 2 seconds on correct or 3 seconds on incorrect.
6. WHEN the Quiz completes, THE Birthday_Experience SHALL display a score from 0 to 5 and the matching preset message for that score as defined in the brief.
7. WHEN rendering Unwrap Wishes, THE Birthday_Experience SHALL show between 6 and 8 gift boxes whose revealed messages are drawn from the `reasons` array (shuffled) plus 2 to 3 auto-generated birthday wishes; each box SHALL remain revealed after being tapped.
8. WHEN rendering the Celebration Wheel, THE Birthday_Experience SHALL allow exactly 3 spins, displaying a counter, and SHALL land on a prompt drawn from a predefined prompt set with the `creator_name` substituted where the prompt references the Creator.
9. WHEN rendering the Final Letter, THE Birthday_Experience SHALL render `final_message` with a typewriter effect at approximately 30 characters per second, preserving line breaks.
10. WHEN the Recipient scrolls past the Final Letter, THE Birthday_Experience SHALL trigger the Grand Finale with multi-burst confetti and a closing message and SHALL keep gentle confetti active while the Recipient remains on the finale section.

### Requirement 13: Expression_Experience Chapter Sequencing and Content Rendering

**User Story:** As a Recipient opening an expression, I want a slow, intimate chapter-based journey, so that the message lands with intention.

#### Acceptance Criteria

1. WHERE `type = 'expression'`, THE Expression_Experience SHALL render exactly these chapters in this order: Envelope, Slow Build, Noticing, Moments, Confession, Reply, Soft Ending.
2. WHEN rendering the Slow Build, THE Expression_Experience SHALL display `{recipient_name}...`, then "I've been thinking about how to say this...", then "So I made this for you.", then "Scroll when you're ready." with a minimum 2-second hold between each text before the next appears.
3. WHEN rendering the Noticing chapter, THE Expression_Experience SHALL display each entry of `things_i_notice` alone and centered on screen in stored order, each occupying at least one viewport height of scroll before being replaced.
4. WHEN rendering the Moments chapter, THE Expression_Experience SHALL display each `photos` entry in stored order with a Ken Burns effect over at least 5 seconds and render its `caption` when present.
5. WHEN rendering the Confession chapter, THE Expression_Experience SHALL render `confession_message` with a typewriter effect at approximately 25 characters per second, followed after a 3-second hold by a signature line `— {creator_name}` and then the `closing_line`.
6. THE Expression_Experience SHALL NOT trigger confetti or multi-burst particles at any point, including the Soft Ending.

### Requirement 14: Expression Reply Capture and Downloadable Image Generation

**User Story:** As a Recipient of an expression, I want to optionally reply and download a beautiful image of my words, so that I can respond meaningfully or keep my reply.

#### Acceptance Criteria

1. WHERE `type = 'expression'`, THE Expression_Experience SHALL render a reply text input on the Reply chapter with a visible character counter and a maximum length of 200 characters.
2. WHEN the Recipient submits a reply, THE Expression_Experience SHALL render a PNG Reply_Image client-side via HTML Canvas at a 4:5 aspect ratio containing the reply text, the Recipient's first name, the current date, and Theme-matching styling.
3. THE Expression_Experience SHALL offer exactly two actions after image rendering: "Download this image" and "I'd like {creator_name} to receive this".
4. WHEN the Recipient selects "Download this image", THE Expression_Experience SHALL trigger a browser download of the Reply_Image as a PNG file and SHALL NOT send the reply text to the server.
5. WHEN the Recipient selects "I'd like {creator_name} to receive this", THE Platform SHALL store the trimmed reply text into `expression_reply` and leave `expression_reply_downloaded = FALSE` until an Admin marks it downloaded.
6. IF the reply submission to the server fails, THEN THE Expression_Experience SHALL display the error "We couldn't save your reply. Please try again." and SHALL retain the typed text in the input so the Recipient can retry.
7. WHERE the Recipient selects "Skip", THE Expression_Experience SHALL advance to the Soft Ending without storing any reply.
8. THE Platform SHALL reject reply submissions to any Celebration where `type != 'expression'` or where `status != 'active'` with HTTP 400 or HTTP 410 respectively.

### Requirement 15: Admin Authentication and Session Management

**User Story:** As an Admin, I want a simple password-protected admin panel with a session that expires, so that the panel is private without complex auth infrastructure.

#### Acceptance Criteria

1. WHEN the Admin submits the Admin login form with a password, THE Platform SHALL compare the submitted password against the stored Admin password (using a hashed value if configured, otherwise the `ADMIN_PASSWORD` environment variable) using a constant-time comparison.
2. IF the submitted Admin password matches, THEN THE Platform SHALL issue an Admin_Session cookie named `ct_admin` that is HTTP-only, Secure, SameSite=Lax, and expires 24 hours after issuance.
3. IF the submitted Admin password does not match, THEN THE Platform SHALL return HTTP 401 after a fixed 400 ms delay to mitigate timing attacks and SHALL NOT set any cookie.
4. WHEN an unauthenticated request hits any route under `/admin` or any API route under `/api/admin`, THE Platform SHALL redirect to `/admin/login` for page routes or return HTTP 401 for API routes.
5. THE Platform SHALL rate-limit Admin login attempts to at most 5 failed attempts per IP per 15-minute rolling window and SHALL return HTTP 429 when exceeded.

### Requirement 16: Admin Dashboard and Listing

**User Story:** As an Admin, I want a dashboard and a searchable list of celebrations, so that I can monitor and find any celebration quickly, including those awaiting my approval.

#### Acceptance Criteria

1. WHEN an authenticated Admin loads `/admin`, THE Platform SHALL display stats cards containing exactly: count of Celebrations where `status = 'active'`, count where `status = 'pending'` labeled "Pending approval", count where `status = 'inactive'`, all-time total of rows ever created (including `deleted`), and count where `status = 'active'` AND `expires_at BETWEEN NOW() AND NOW() + INTERVAL '2 hours'` labeled "Expiring in next 2 hours".
2. WHEN an authenticated Admin loads `/admin`, THE Platform SHALL render a Recent Activity feed that includes newly-submitted `pending` Celebrations awaiting approval alongside recently created, recently expired, and recently received expression replies, sorted by most-recent event time.
3. WHEN an authenticated Admin loads the Celebrations list, THE Platform SHALL display columns for Short_Code, `type` (rendered as a 🎂/💌 icon), `recipient_name`, `creator_name`, `relationship`, `status`, `created_at`, `activate_at` (celebration activation time), `expires_at`, `approved_at`, `view_count`, and a dedicated Actions column holding per-row quick actions.
4. THE Celebrations list SHALL support filtering by any combination of `status` in `{pending, active, inactive}` and `type` in `{birthday, expression}`, and SHALL return results in at most 500 ms for up to 10,000 rows.
5. THE Celebrations list SHALL support case-insensitive substring search across `recipient_name`, `creator_name`, and `short_code`.
6. THE Celebrations list SHALL support sorting by `created_at`, `activate_at`, `expires_at`, `approved_at`, or `view_count` in ascending or descending order.
7. THE Admin Celebrations list SHALL render per-row quick actions for Copy Link, Reset Passcode, Approve (visible only when `status = 'pending'`), Status Toggle (visible only when `status IN ('active','inactive')`), Delete Permanently (with confirmation), and Open Detail, and SHALL NOT require the Admin to navigate to the detail page to invoke any of these actions.
8. WHEN the Admin clicks Copy Link on a row, THE Platform SHALL copy the string `https://{host}/c/{shortCode}` to the clipboard and SHALL display a brief confirmation toast to acknowledge the copy.

### Requirement 17: Admin Celebration Detail, Edit, Extend, Reactivate, and Delete

**User Story:** As an Admin, I want full control over any individual celebration, so that I can edit, reactivate, extend, or permanently delete it on request.

#### Acceptance Criteria

1. WHEN an authenticated Admin opens a celebration detail view, THE Platform SHALL render a functional preview of the Recipient_Experience using the stored data, bypassing the Passcode screen.
2. WHEN the Admin toggles `status`, THE Platform SHALL update the row's `status` between `active` and `inactive` only, SHALL NOT allow toggling to `deleted` via this control, and SHALL NOT allow toggling a row whose current `status = 'pending'` (approval of pending rows is handled exclusively by Requirement 28).
3. WHEN the Admin extends the Activation_Window by `h` hours where `h` is a positive integer, THE Platform SHALL set `expires_at = expires_at + INTERVAL 'h hours'` and SHALL increment `times_reactivated` by 1 if `status` transitions from `inactive` to `active` as part of this action.
4. WHEN the Admin edits a text field (e.g., `recipient_name`, `final_message`, `reasons`, `quiz_questions`, `things_i_notice`), THE Platform SHALL validate the updated value against the same limits used by the Creator_Form and SHALL persist the change only when validation passes.
5. WHEN the Admin deletes an individual photo in the detail view, THE Platform SHALL remove the corresponding file from Supabase Storage and remove its entry from the `photos` JSONB array atomically within a single API call.
6. WHEN the Admin invokes Delete Permanently on a Celebration, THE Platform SHALL require an explicit confirmation, SHALL delete all files under `celebrations/{shortCode}/` in Supabase Storage, and SHALL set `status = 'deleted'` on the row (soft-delete) while retaining the row for audit.
7. IF Storage deletion during Delete Permanently fails for any file, THEN THE Platform SHALL abort the delete operation, leave `status` unchanged, and return HTTP 502 with error code `STORAGE_DELETE_FAILED`.

### Requirement 18: Admin Reply Management for Expressions

**User Story:** As an Admin, I want to view and generate images of recipient replies, so that I can forward them to creators.

#### Acceptance Criteria

1. WHERE a Celebration has `type = 'expression'` AND `expression_reply IS NOT NULL`, THE Admin detail view SHALL display the reply text, the Theme, the `recipient_name`, and the `expression_reply_downloaded` flag.
2. WHEN the Admin clicks "Generate image", THE Admin detail view SHALL render the same Reply_Image canvas used on the Recipient side and SHALL enable a download action.
3. WHEN the Admin clicks Download for a reply image, THE Platform SHALL set `expression_reply_downloaded = TRUE` and SHALL update the displayed flag.

### Requirement 19: Admin Settings

**User Story:** As an Admin, I want a settings page for operational knobs, so that I can tune behavior without redeploying.

#### Acceptance Criteria

1. THE Admin Settings page SHALL allow the Admin to set a global `default_activation_window_hours` value in whole hours from 1 to 168. This value exists only as a future-facing default for newly-created Celebrations; the current Platform implementation SHALL continue to treat every persisted Celebration's window as a fixed 21 hours per Requirement 1.5 and Requirement 5, and SHALL NOT retroactively change `expires_at` for existing rows when this setting is modified.
2. THE Admin Settings page SHALL allow the Admin to enable or disable maintenance mode.
3. WHILE maintenance mode is enabled, THE Platform SHALL respond to all non-admin page routes with a "We'll be back soon" page and to all non-admin API routes (except `/api/cron/expire`) with HTTP 503.
4. THE Admin Settings page SHALL display total Supabase Storage usage in megabytes and a per-Celebration breakdown for the top 20 Celebrations by bytes used.
5. WHERE the Platform supports in-DB Admin password storage, THE Admin Settings page SHALL allow the Admin to change the password by submitting the current password and a new password, and SHALL persist only the new password's hash.

### Requirement 20: View Tracking

**User Story:** As an Admin, I want accurate view metrics per celebration, so that I understand engagement.

#### Acceptance Criteria

1. WHEN a Recipient successfully unlocks a Celebration via correct Passcode, THE Platform SHALL increment `view_count` by exactly 1 and set `last_viewed_at = NOW()`.
2. WHEN the same client re-enters the experience using an existing valid `ct_unlock_{shortCode}` cookie within 30 minutes of the previous unlock for the same Short_Code, THE Platform SHALL NOT increment `view_count` again.
3. THE Platform SHALL NOT increment `view_count` when an Admin previews a Celebration via the admin detail view.

### Requirement 21: Accessibility and Reduced Motion

**User Story:** As a user with motion sensitivity or assistive technology needs, I want the experience to remain usable and comfortable, so that the Platform is inclusive.

#### Acceptance Criteria

1. WHILE the user agent reports `prefers-reduced-motion: reduce`, THE Recipient_Experience SHALL replace all scroll-driven parallax, pin-and-progress, and stagger animations with instant fades or static reveals.
2. WHILE Reduced_Motion_Mode is active, THE Recipient_Experience SHALL disable auto-triggering confetti bursts and SHALL present a single static celebratory state on the Grand Finale.
3. THE Platform SHALL ensure all interactive controls (Passcode inputs, quiz options, wheel spin, reply input, audio controls, admin controls) are reachable and operable by keyboard alone.
4. THE Platform SHALL maintain a minimum WCAG AA contrast ratio of 4.5:1 for body text and 3:1 for large text across all themes.
5. THE Platform SHALL annotate decorative animated elements with `aria-hidden="true"` and SHALL provide text alternatives (via `alt` or `aria-label`) for informational images and icons.

### Requirement 22: Performance and Asset Loading

**User Story:** As a Recipient opening a celebration on a phone, I want the page to load and animate smoothly, so that the experience is immersive rather than sluggish.

#### Acceptance Criteria

1. THE Recipient_Experience SHALL lazy-load photos not in the initial viewport using native `loading="lazy"` or equivalent IntersectionObserver-based loading.
2. WHEN measured on a mid-range mobile device (e.g., Moto G Power class) over a 4G connection, THE initial Passcode screen SHALL reach First Contentful Paint in less than or equal to 2,500 ms.
3. THE Platform SHALL serve images via Supabase Storage public URLs with CDN caching headers of at least 1 hour.
4. THE Platform SHALL keep the JavaScript bundle for `/c/[shortCode]` (excluding on-demand chapter-specific bundles) at or below 250 KB gzipped in production builds.
5. THE Platform SHALL code-split chapter-specific logic such that the Games bundles for birthday and the Canvas reply logic for expression are only loaded when their `type` matches.

### Requirement 23: Concurrency, Isolation, and Scale

**User Story:** As the Platform operator, I want many simultaneous celebrations and viewers to coexist without interference, so that the Platform is safe to share widely.

#### Acceptance Criteria

1. THE Platform SHALL ensure that data for one Celebration is never visible under the Short_Code of another Celebration.
2. WHEN multiple Recipients view different Celebrations concurrently, THE Platform SHALL handle each request independently and SHALL NOT share Passcode unlock cookies across Short_Codes.
3. WHEN multiple Recipients view the same Celebration concurrently, THE Platform SHALL continue to serve each request within the performance targets of Requirement 22.
4. WHEN the Platform updates `view_count`, THE Platform SHALL use an atomic SQL increment (`UPDATE ... SET view_count = view_count + 1`) to prevent lost updates under concurrency.

### Requirement 24: API Error Handling and Observability

**User Story:** As an Admin and developer, I want consistent error shapes and server-side logs, so that I can diagnose problems quickly.

#### Acceptance Criteria

1. THE Platform SHALL return JSON error responses with the shape `{ "error": { "code": string, "message": string, "details"?: object } }` for all API routes.
2. IF an unhandled exception occurs in any API route, THEN THE Platform SHALL log the error with request id, route, and stack trace server-side and SHALL return HTTP 500 with error code `INTERNAL_ERROR` and a generic message.
3. THE Platform SHALL NOT include raw Passcode values, Reply text, or Supabase service role keys in any log.
4. THE Platform SHALL assign every request a unique `x-request-id` header (generated if absent) and SHALL echo it back in the response headers.

### Requirement 25: Security of Secrets and Inputs

**User Story:** As the Platform operator, I want secrets protected and inputs sanitized, so that the Platform resists common web attacks.

#### Acceptance Criteria

1. THE Platform SHALL read the Supabase service role key, `ADMIN_PASSWORD`, `CRON_SECRET`, and cookie signing secret exclusively from server-side environment variables and SHALL NEVER expose them to the client bundle.
2. THE Platform SHALL escape all Creator-supplied text (names, captions, reasons, messages, quiz content, closing line, etc.) when rendering into HTML, such that user input cannot execute script.
3. THE Platform SHALL validate every API request body against a server-side schema matching the limits in Requirements 3, 4, 5, 7, 8, and 14 before any database or storage write.
4. THE Platform SHALL set `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` headers on all HTML responses.
5. THE Platform SHALL serve all production traffic over HTTPS and SHALL set the `Strict-Transport-Security` header with `max-age` of at least 15,552,000 seconds.

### Requirement 26: Landing Page

**User Story:** As a prospective Creator, I want a clear landing page explaining the platform, so that I understand what to do next.

#### Acceptance Criteria

1. WHEN a visitor loads `/`, THE Platform SHALL render a hero with a headline, subtitle, and two primary calls-to-action linking to `/create` with occasion pre-selection query params `?type=birthday` and `?type=expression`.
2. WHEN the Creator arrives at `/create?type=birthday` or `/create?type=expression`, THE Creator_Form SHALL pre-select the corresponding occasion on Step 1 and present Step 2 immediately.
3. THE landing page SHALL include a "How it works" section with exactly 3 steps and a footer with a link back to `/create`.

### Requirement 27: Correctness Properties (Testable Invariants)

**User Story:** As a reviewer, I want the Platform to hold a set of precise invariants, so that behavior is verifiable through automated tests.

#### Acceptance Criteria

1. FOR ALL persisted Celebrations, THE Platform SHALL ensure `expires_at > activate_at` (temporal invariant).
2. FOR ALL persisted Celebrations, THE Platform SHALL ensure `length(short_code) BETWEEN 6 AND 8` AND `short_code` matches `^[A-Za-z0-9]+$` (format invariant).
3. FOR ALL persisted Birthday Celebrations, THE Platform SHALL ensure `length(reasons) BETWEEN 5 AND 10` AND `length(photos) BETWEEN 3 AND 7` AND `length(quiz_questions) = 5` AND every quiz question has exactly 4 options with `correctIndex` in `[0,3]` (content invariant).
4. FOR ALL persisted Expression Celebrations, THE Platform SHALL ensure `length(things_i_notice) BETWEEN 3 AND 5` AND `length(photos) BETWEEN 2 AND 4` AND `length(confession_message) BETWEEN 1 AND 1500` (content invariant).
5. FOR ALL Celebrations, parsing the stored `photos` JSONB value and re-serializing it SHALL produce the same logical array (ordered by `order`), establishing a round-trip property for the photos payload.
6. FOR ALL Celebrations, parsing the stored `quiz_questions` JSONB and re-serializing it SHALL produce the same logical array of questions (round-trip property).
7. THE Expiry_Job SHALL be idempotent: running it twice in succession SHALL produce the same final `status` for every row as running it once (idempotence property).
8. FOR ALL successful Passcode entries, incrementing `view_count` N times concurrently SHALL yield a final `view_count` equal to the initial value plus N (atomicity property).
9. FOR ALL Passcode validations, the constant-time comparison used in Requirement 9.3 SHALL produce the same boolean result as a standard equality comparison on the underlying hashes (model-based equivalence).
10. FOR ALL Reply_Images generated client-side, re-rendering from the same reply text, Theme, Recipient name, and date SHALL produce a byte-identical PNG (determinism property).
11. FOR ALL newly-persisted Celebrations, the initial `status` SHALL equal `'pending'` AND `approved_at` SHALL be NULL AND `approved_by` SHALL be NULL at the instant of persistence (initial-state invariant).
12. FOR ALL Celebrations where `status = 'active'`, `approved_at IS NOT NULL` SHALL hold (approval-before-activation invariant).
13. FOR ALL Celebrations at the instant of persistence, `activate_at >= (persistence_time + INTERVAL '15 minutes')` SHALL hold (15-minute minimum offset invariant).
14. FOR ALL Celebrations at the instant of persistence, `expires_at = activate_at + INTERVAL '21 hours'` SHALL hold exactly (fixed-window invariant).
15. FOR ALL Celebrations with current `status = 'pending'`, invoking the Admin Approval action twice in succession on the same Celebration SHALL yield the same final row state as invoking it once (approval idempotence property).
16. FOR ALL Celebrations with current `status = 'pending'`, invoking the Admin Reject action twice in succession on the same Celebration SHALL yield the same final row state as invoking it once (reject idempotence property).
17. FOR ALL Admin Passcode resets on a Celebration `C`, the post-reset `passcode_version(C)` SHALL equal the pre-reset `passcode_version(C) + 1`, AND any Recipient unlock cookie signed with the pre-reset `passcode_version(C)` SHALL be rejected on subsequent requests (passcode rotation invariant).
18. FOR ALL Admin Passcode resets, the plaintext Passcode returned in the reset response SHALL match the regex `^[0-9]{4}$` (reset format invariant).


### Requirement 28: Admin Approval Flow and Pending Lifecycle

**User Story:** As an Admin, I want to approve or reject pending celebrations from the admin panel, so that I control which submissions go live for Recipients after I confirm payment or content.

#### Acceptance Criteria

1. WHEN an authenticated Admin views a Celebration row where `status = 'pending'` in either the list view or the detail view, THE Platform SHALL render an "Approve" action and a "Reject" action for that row.
2. WHEN the Admin invokes Approve on a Celebration where `status = 'pending'` AND `expires_at > NOW()`, THE Platform SHALL set `status = 'active'`, `approved_at = NOW()`, and `approved_by = 'admin'` in a single atomic update and return HTTP 200.
3. IF the Admin invokes Approve on a Celebration where `status = 'pending'` AND `expires_at <= NOW()`, THEN THE Platform SHALL reject the action with HTTP 409, error code `APPROVAL_WINDOW_ELAPSED`, and message "This celebration's window has already passed. Extend the expiry, then approve.", and SHALL NOT modify the row.
4. WHEN the Admin invokes Approve on a Celebration where `status` is already `'active'`, THE Platform SHALL treat the action as a no-op, leave `status`, `approved_at`, and `approved_by` unchanged, and return HTTP 200 (approval idempotence).
5. WHEN the Admin invokes Reject on a Celebration where `status = 'pending'`, THE Platform SHALL set `status = 'inactive'`, SHALL optionally persist an admin-supplied free-text `admin_notes` value (0 to 2000 chars) if provided, SHALL leave `approved_at = NULL` and `approved_by = NULL`, and SHALL return HTTP 200.
6. WHEN the Admin invokes Reject on a Celebration where `status` is already `'inactive'`, THE Platform SHALL treat the action as a no-op, update `admin_notes` only if a new non-null value is supplied, and return HTTP 200 (reject idempotence).
7. IF the Admin invokes Approve or Reject on a Celebration where `status = 'deleted'`, THEN THE Platform SHALL return HTTP 404 and SHALL NOT modify the row.
8. THE Platform SHALL persist `approved_at` as `TIMESTAMP WITH TIME ZONE` NULL-able, `approved_by` as `VARCHAR(100)` NULL-able, and `admin_notes` as `TEXT` NULL-able on the `celebrations` table.
9. WHILE a Celebration has `status = 'pending'`, THE Platform SHALL exclude that Celebration from the Expiry_Job scope defined in Requirement 11.
10. WHEN an Admin opens a Celebration detail view while `status = 'pending'`, THE Platform SHALL render a visible "Pending approval" banner and SHALL display the Approve and Reject controls prominently above the standard edit controls.

### Requirement 29: Post-Submission Confirmation Screen and Instagram Contact

**User Story:** As a Creator, I want a confirmation screen after submitting that tells me my celebration is awaiting approval and gives me a clear way to contact the Admin via Instagram with a pre-filled message, so that I can complete payment and confirm the surprise.

#### Acceptance Criteria

1. WHEN the Platform successfully persists a new Celebration per Requirement 1, THE Platform SHALL navigate the Creator to a confirmation screen that displays: the shareable link `https://{host}/c/{shortCode}` with a copy-to-clipboard button, the 4-digit Passcode with a copy-to-clipboard button, and a prominent "Awaiting approval" banner whose body text explicitly includes the sentences "Please message our admin to approve your request." and "Your link will not work for the Recipient until it is approved.", and that also states the celebration will activate at the chosen `activate_at` time only after Admin approval.
2. WHEN the confirmation screen loads, THE Platform SHALL render an Admin_Instagram_Contact affordance styled as a tappable button with the label "Message us on Instagram to confirm your celebration" whose `href` is read from the `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` environment variable, and SHALL display the handle text read from `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE` adjacent to the button.
3. IF `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` is not set, THEN THE confirmation screen SHALL suppress the Instagram button and render a fallback message "Instagram contact not configured".
4. WHEN the confirmation screen loads, THE Platform SHALL render a pre-filled message template in a read-only or user-selectable text block containing exactly these elements: the Recipient's first name, the Creator's name, the chosen `activate_at` rendered in the Creator's local timezone, the Short_Code, and the sentence "Payment is being arranged."
5. THE confirmation screen SHALL render a "Copy message" button adjacent to the pre-filled template that copies the full template text to the clipboard on click.
6. THE confirmation screen SHALL NOT render any control that suggests the celebration is already live or shareable with the Recipient before approval.
7. THE Platform SHALL NOT hardcode any Instagram URL or handle in the source tree; THE Platform SHALL read them exclusively from the `NEXT_PUBLIC_ADMIN_INSTAGRAM_URL` and `NEXT_PUBLIC_ADMIN_INSTAGRAM_HANDLE` environment variables at render time.
8. THE confirmation screen SHALL clearly state that the shareable link will not function for the Recipient until an Admin approves the Celebration.
9. THE pre-filled message template rendered per Requirement 29.4 SHALL include a phrase explicitly requesting approval, such as "Please approve my celebration so I can share it."

### Requirement 30: Admin Filtering by Activation Time and Pending Approvals View

**User Story:** As an Admin, I want to filter the celebrations list by activation time range and view pending approvals in a dedicated view, so that I can quickly locate a celebration when a creator messages me saying "my celebration is scheduled for [time]".

#### Acceptance Criteria

1. THE Admin Celebrations list SHALL support filtering by an `activate_at` range using a `from` timestamp and a `to` timestamp, where supplying only `from` filters `activate_at >= from`, supplying only `to` filters `activate_at <= to`, and supplying both filters `activate_at BETWEEN from AND to`.
2. THE Admin Celebrations list SHALL accept the `activate_at` range filter combined with any of the filters defined in Requirement 16.4 and the search defined in Requirement 16.5.
3. THE Admin Dashboard SHALL include a dedicated "Pending approvals" view reachable from the dashboard that lists exactly the Celebrations where `status = 'pending'`, sorted by `activate_at ASC`, and SHALL display a count badge next to the view's entry point showing the current count of pending Celebrations.
4. THE "Pending approvals" view SHALL render the Approve and Reject actions defined in Requirement 28 inline for each row.
5. IF no Celebrations match the current filter combination, THEN THE Admin Celebrations list SHALL render the empty-state message "No celebrations match these filters".

### Requirement 31: Admin Passcode Reset

**User Story:** As an Admin, I want to reset the 4-digit Passcode of any Celebration and see the new plaintext exactly once in the response, so that I can share it with the Creator if they lost or forgot the original. Because Passcodes are stored as one-way scrypt hashes (Requirement 1.4), the original plaintext cannot be recovered, so a reset is the only supported recovery path.

#### Acceptance Criteria

1. WHEN an authenticated Admin requests a Passcode reset for a Celebration where `status IN ('pending','active','inactive')`, THE Platform SHALL generate a cryptographically random 4-digit Passcode matching `^[0-9]{4}$`, SHALL rehash it with the same scrypt parameters used at creation, SHALL update the row's `passcode` column to the new hash and set `passcode_version = passcode_version + 1`, AND SHALL return the new plaintext Passcode exactly once in the HTTP 200 response body as `{ "passcode": "NNNN", "passcode_version": N }`.
2. THE Platform SHALL NOT persist the plaintext Passcode generated by a reset anywhere (including logs, analytics events, database columns, or cached responses) beyond the single response body returned to the requesting Admin.
3. IF the Admin requests a Passcode reset for a Celebration where `status = 'deleted'`, THEN THE Platform SHALL return HTTP 404 and SHALL NOT modify the row.
4. WHEN a Passcode reset succeeds on a Celebration that has any outstanding `ct_unlock_{shortCode}` cookies issued under the pre-reset `passcode_version`, THE Platform SHALL invalidate every such cookie by virtue of the incremented `passcode_version`; on any subsequent request presenting such a cookie, THE Platform SHALL reject the cookie and require the Recipient to re-enter the new Passcode.
5. THE Admin list row action for Reset Passcode SHALL require a confirmation modal whose body text explicitly warns: "This will invalidate the current passcode and any active unlock sessions."
6. THE Platform SHALL rate-limit Admin Passcode reset actions to at most 20 successful resets per 60-minute rolling window per authenticated Admin session, and upon exceeding the limit SHALL return HTTP 429 with error code `RATE_LIMITED` and SHALL NOT modify the row.
