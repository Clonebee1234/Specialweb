CelebrateThem — Digital Surprise Experience Platform
Project Overview
Build a production-level web application called "CelebrateThem" — a platform where users (creators) fill a guided form with personal details, photos, messages, and fun content. The system generates a unique, passcode-protected link that the creator shares with their special person (recipient). The recipient opens the link, enters the passcode, and experiences a cinematic, scroll-driven, interactive surprise tailored to them. The platform supports multiple simultaneous users, each with isolated private experiences.

There are two distinct flows:

Birthday Celebration — Fun, energetic, game-filled, celebratory (target: 15+ minutes of engagement)
Soft Expression / Confession — Intimate, slow-burn, emotional, cinematic (target: 7-8 minutes)
This is NOT a greeting card. It is an emotional journey. The recipient should feel like something is happening TO them, not like they are browsing a website.

Tech Stack (Mandatory)
Layer	Technology	Reason
Framework	Next.js 14+ (App Router)	SSR, API routes as backend, file-based routing
Styling	Tailwind CSS	Utility-first, responsive, fast
Scroll Animations	GSAP + ScrollTrigger	Industry-standard scroll-driven animations
Component Animations	Framer Motion	React-native transitions, mount/unmount
Confetti/Particles	canvas-confetti + tsparticles	Lightweight celebration effects
Database	Supabase (PostgreSQL)	Free tier: 500MB DB, managed, easy
File Storage	Supabase Storage	Image uploads, CDN delivery, 1GB free
Hosting	Vercel	Free tier, edge network, auto-deploy from Git
Audio	Native HTML5 Audio API	No external dependency for music playback
Image Generation	HTML Canvas API (client-side)	For expression reply downloadable image
No paid APIs required. No external auth services. No third-party notification systems.

URL Structure
/                        → Public landing page (what is this platform, create one CTA)
/create                  → Multi-step creator form
/c/[shortCode]           → Recipient experience (passcode-gated)
/admin                   → Admin panel (password-protected via env variable)
Core Architecture
How Multiple Users Work
Each celebration gets a unique shortCode (6-8 alphanumeric, unguessable)
Each celebration has a 4-digit passcode set by the creator
Creator shares link (yourdomain.com/c/xK9mP2) + passcode to recipient via WhatsApp/Insta/etc.
Recipient opens link → sees passcode screen → enters code → experience begins
No user accounts needed. No login. No signup. Just form → link → share.
Time Window System
Creator sets an activation time during form fill (default: immediate)
Celebration is active for 21 hours from activation time (11 PM to 8 PM next day as default suggestion, but creator picks exact time)
After 21 hours: celebration becomes inactive (NOT deleted)
Inactive celebrations show: "This celebration has ended. The memories live on 💫. Screen record next time!"
Admin can reactivate, extend, or permanently delete from admin panel
Data is NEVER auto-deleted. Only admin manually deletes.
Image Handling
Creator uploads photos during form fill (max 7 photos for birthday, max 4 for expression)
Client-side compression before upload (max 1MB per image)
Stored in Supabase Storage: celebrations/{shortCode}/photo_1.jpg etc.
Public URLs stored in database JSON array
Admin can delete storage files when permanently deleting a celebration
Music Handling
Creator uploads an audio file (MP3/M4A, max 5MB) during form fill as optional
Stored in Supabase Storage: celebrations/{shortCode}/music.mp3
On recipient page: small volume/mute button fixed at bottom-left corner
Music auto-plays softly when experience begins (with browser autoplay handling — show play button if blocked)
Recipient controls: mute, unmute, volume slider (minimal UI, not distracting)
Database Schema
CREATE TABLE celebrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code VARCHAR(8) UNIQUE NOT NULL,
  passcode VARCHAR(4) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('birthday', 'expression')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  
  -- Common fields
  theme VARCHAR(50) NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  creator_name VARCHAR(100) NOT NULL,
  relationship VARCHAR(50) NOT NULL,
  song_url TEXT,
  photos JSONB DEFAULT '[]',
  
  -- Birthday specific
  hero_text TEXT,
  reasons JSONB DEFAULT '[]',
  quiz_questions JSONB DEFAULT '[]',
  final_message TEXT,
  
  -- Expression specific
  confession_message TEXT,
  things_i_notice JSONB DEFAULT '[]',
  closing_line TEXT,
  
  -- Expression reply
  expression_reply TEXT,
  expression_reply_downloaded BOOLEAN DEFAULT FALSE,
  
  -- Timing
  activate_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Admin tracking
  times_reactivated INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0
);

CREATE INDEX idx_celebrations_short_code ON celebrations(short_code);
CREATE INDEX idx_celebrations_status ON celebrations(status);
CREATE INDEX idx_celebrations_expires_at ON celebrations(expires_at);
SIDE A: Creator Form (Multi-Step Wizard)
Design Principles
One question/section per screen (never a wall of fields)
Animated transitions between steps (slide or fade)
Progress indicator at top (visual, like a gift being wrapped or stars filling up)
Encouraging micro-copy at each step ("This is going to be beautiful 💛", "Almost there...")
Mobile-first design (most creators will use phone)
On desktop: split layout — form left, live mini-preview right
Validation at each step before allowing next
"Back" button always available, state preserved
Form Steps
Step 1: Choose Occasion

Two large visual cards: "🎂 Birthday Celebration" / "💌 Express My Feelings"
Brief description under each explaining the vibe
Tapping selects and auto-advances
Step 2: The Basics

Recipient's first name (required, this appears throughout their experience)
Your name/nickname (required, how you sign off)
Relationship dropdown: Partner, Crush, Best Friend, Sibling, Spouse, Other
Micro-copy: "We'll use these to personalize everything"
Step 3: Choose a Theme

Visual theme cards with preview thumbnails (not just text labels)
Birthday themes: "Confetti Burst" (vibrant, colorful) / "Golden Glow" (warm, elegant) / "Neon Night" (dark, electric) / "Starry Dream" (cosmic, magical)
Expression themes: "Midnight Letters" (dark, intimate) / "Soft Bloom" (pink, gentle) / "Warm Sunset" (amber, nostalgic)
Each card shows a color palette + sample animation style
Step 4: Content (differs by type)

Birthday:

Hero text: One-liner about them ("The one who lights up every room") — max 150 chars
Photos: Upload 3-7 photos + write a caption for each (max 100 chars per caption)
Reasons: 5-10 "reasons you're amazing" (min 5 required, each max 150 chars)
Quiz: 5 questions about you/your relationship. Each question has 4 options, creator marks correct answer. (Required — this is a core game)
Final message: The birthday wish letter (textarea, max 800 chars)
Music: Upload audio file (optional, MP3/M4A, max 5MB)
Expression:

Confession message: The core message/feelings (textarea, max 1500 chars, required)
Things I notice: 3-5 observations about them ("The way you laugh when nervous") — each max 150 chars
Photos: Upload 2-4 photos + captions
Closing line: Preset options ("Will you be mine?", "I just wanted you to know", "What do you think?", "I've been meaning to tell you...") + Custom option
Music: Upload audio file (optional)
Step 5: Security & Timing

Set 4-digit passcode (required, with confirm field)
Set activation time: Date + Time picker (default: now)
Auto-calculated: "Will be active until [date+time, 21 hours later]"
Micro-copy: "Tell them to screen record the experience! It's available for 21 hours."
Step 6: Preview & Generate

Full scrollable preview of the recipient experience (functional, with animations)
"Everything look good?" confirmation
"Generate My Link" button
On generate: shows the link + passcode prominently
Copy buttons for link and passcode separately
Suggested share message: "Hey [Name]! Open this link and enter code [XXXX] 💛 [link]"
Reminder: "Share the link and passcode with [Name]. They have 21 hours from [time] to enjoy it!"
SIDE B: Recipient Experience — Birthday Flow (15+ Minutes Total)
Navigation
A minimal, elegant progress indicator at the top of the screen (thin line or dots)
Shows which "chapter" they're on without being distracting
No back button needed (it's a forward-only journey — like watching a movie)
If they refresh: resume from the beginning (it's meant to be experienced fresh each time)
Smooth scroll-driven progression — they scroll to advance, no clicking "next" buttons
Passcode Entry Screen
Dark, elegant background with subtle floating particles (theme-colored)
Text: "[Name], someone made something special for you..."
Large, friendly 4-digit input (individual boxes, auto-focus next on input)
Wrong code: gentle shake animation + "That's not quite right. Try again 💛"
Correct code: entire screen dissolves/fades into the experience with a magical transition
No "submit" button — auto-submits when 4 digits entered
Chapter 1: The Grand Unwrapping (~1.5 min)
Concept: The recipient doesn't just "land" on a page. They unwrap their gift.

Screen is dark. A single spotlight illuminates a beautifully wrapped 3D gift box (CSS perspective + transforms, subtle floating animation)
A gift tag hangs from the ribbon with their name in handwriting font
Below the box: "Tap to unwrap your surprise" (pulses gently)
On tap/click:
Ribbon unties with a smooth animation
Box lid lifts and tilts back
A burst of theme-colored particles explodes outward (canvas-confetti)
The box fades away as the background transitions to the theme colors
Optional: subtle "pop" sound effect (respecting mute state)
Transition: Particles settle, background solidifies into theme gradient, scroll indicator appears at bottom ("Scroll to begin ↓")

Chapter 2: The Cinematic Reveal (~45 sec)
As they scroll, their name appears letter by letter (GSAP SplitText stagger animation)
Large, elegant, theme-appropriate font
Below their name (fades in after name completes): "Happy Birthday! 🎂"
Below that (fades in after): "From [Creator], with all my heart"
Background: gentle particle system (fireflies for Golden Glow, stars for Starry Dream, confetti bits for Confetti Burst, neon streaks for Neon Night)
Music begins fading in here (if provided)
This section is pinned — stays on screen while text animates, then unpins to allow scroll
Chapter 3: The Story Scroll (~3 min)
Concept: A cinematic photo journey. Not a grid. Not a slideshow. A scroll-driven film.

The creator's hero text appears first with a typewriter/reveal animation: "[hero_text]"
Then photos begin:
Each photo takes up most of the viewport
Photos alternate: slide in from left, then right, then left...
Each has a slight parallax depth effect (photo moves slower than caption)
Caption appears below/beside with a fade-in, in a handwriting or elegant font
Between photos: subtle visual separators (a thin animated line drawing itself, or floating particles)
Photos have a soft vignette or theme-appropriate border treatment (not raw rectangles)
Pacing: each photo gets its own "moment" — user scrolls past one to reveal the next
After last photo: a gentle transition (fade to soft background) leading to next chapter
Chapter 4: The Reasons Constellation (~2.5 min)
Concept: NOT a boring list of cards. A constellation of reasons that lights up as they scroll.

Dark background with faint stars/dots
Title fades in: "Here's why you make everything better, [Name]..."
As they scroll, each reason appears as a "star" that lights up and reveals its text
Reasons are positioned in a scattered, organic layout (not a grid)
Each reason: glows into existence with a soft pulse, text appears beside it
A faint line connects each reason to the next (like connecting stars into a constellation)
After all reasons light up: the full constellation is visible, and a final message appears: "...and a universe more 💛"
Alternative simpler approach if constellation is too complex: Cards that float up from the bottom one by one, each with a gentle rotation and glow, settling into a mosaic pattern
Chapter 5: Interactive Games (~8 min total)
Important design note: Games should feel like natural "chapters" of the experience, not like a separate app. Transitions between games should be smooth and themed.

Game 1: "The Birthday Quiz" 🧠 (~3-4 min)
Transition text: "Let's see how well you know [Creator]... 😏"
Full-screen, one question at a time
Question appears with a slide-in animation
4 option buttons, styled as elegant cards (not boring radio buttons)
On correct answer:
Button glows green
Confetti micro-burst
Sweet message: "You know me so well! 💛" / "Exactly right!" / "We're definitely soulmates"
Auto-advances to next question after 2 seconds
On wrong answer:
Button shakes gently, turns soft red
Correct answer highlights in green
Playful message: "Not quite! But I still love you 😂" / "Hmm, we need more dates!"
Auto-advances after 3 seconds
After all 5 questions: Score reveal screen
Score appears dramatically (number counting up)
5/5: "You know me better than I know myself. That's love. 💛"
4/5: "So close to perfect — just like you 😏"
3/5: "Not bad! We clearly need more late-night conversations"
2/5: "Okay, I'm planning a 'get to know me' date night 😂"
1/5: "Well... at least you're cute? 😂💛"
0/5: "I think you were just guessing! But that's okay, we have time 💛"
Game 2: "Unwrap the Wishes" 🎁 (~2 min)
Concept: A grid of small wrapped gift boxes (6-8 boxes). Each contains a hidden message (pulled from the reasons array + some auto-generated sweet messages). Recipient taps each box to unwrap it and reveal the message inside.

Screen shows 6-8 small colorful gift boxes arranged in a playful scattered layout
Text: "You have [X] wishes waiting for you. Tap to unwrap each one!"
On tap: box does an unwrap animation (lid pops, ribbon flies off) → message card rises out
Message displays in a beautiful card with theme styling
Each unwrapped box stays open (visual progress)
After all unwrapped: "You've opened all your wishes! Carry them with you today 🎉"
Messages sourced from: reasons array (shuffled) + 2-3 auto-generated birthday wishes like "May this year bring you everything you deserve" / "The world is better because you're in it"
Game 3: "The Celebration Wheel" 🎡 (~2 min)
Concept: A spin-the-wheel game. The wheel has segments with fun birthday "dares" or sweet prompts. Recipient spins, lands on a segment, reads the fun prompt.

A colorful wheel appears (CSS/SVG animated)
Segments contain fun prompts like:
"Do a happy dance right now! 💃"
"Call [Creator] and say 'I love you' without context 😂"
"Screenshot this and post it — you're officially celebrated! 📸"
"Make a wish out loud. The universe is listening ✨"
"Send [Creator] the ugliest selfie you can make 😂"
"Take a deep breath. You are loved. That's it. 💛"
"Spin again! Double the fun!"
"Text [Creator]: 'You're the best thing that happened to me'"
"Tap to spin!" button
Wheel spins with realistic deceleration (easing)
Lands on a segment → segment highlights → prompt appears in a modal/card
Can spin 3 times total (counter shown)
After 3 spins: "That was fun! But the best part is still coming..."
Chapter 6: The Final Letter (~2 min)
Full screen, soft gradient background (theme-appropriate)
A "letter" visual: slightly off-white card with subtle paper texture, soft shadow
Text appears with typewriter effect (not too slow — about 30 chars/second)
The creator's final birthday message, in a handwriting-style font (Google Fonts: Caveat, Dancing Script, or Kalam)
Line breaks respected, text wraps naturally
After message completes: creator's name appears with a signature flourish
Below signature: a small animated heart or star that pulses once
Hold this screen. Let it breathe. No rush to scroll.
Chapter 7: Grand Finale (~30 sec)
Scroll past the letter triggers the finale
Massive celebration: multi-burst confetti from multiple angles (canvas-confetti with multiple shots)
Large text: "Happy Birthday, [Name]! 🎂🎉"
Below: "Now go celebrate — you deserve every bit of happiness in this world"
Subtle tip: "💡 Screen record and keep this forever"
Footer section:
"Made with love on CelebrateThem"
"Want to surprise someone you love? → Create one"
The confetti continues gently falling for as long as they stay on this screen
SIDE B: Recipient Experience — Expression Flow (~7-8 Minutes)
Passcode Entry Screen
Same mechanic as birthday but different tone
Dark, intimate background. Minimal particles (just a few floating light dots)
Text: "Someone has something to tell you..."
Same 4-digit input, same auto-submit behavior
On correct: slow, gentle fade to black (not a burst — this is intimate)
Chapter 1: The Envelope (~45 sec)
Pure black screen. Silence (or very soft ambient music if provided).
A single envelope fades into view, center screen. Cream/white colored, sealed with a heart-shaped wax seal.
It breathes — very subtle scale animation (1.0 to 1.02 and back, slow)
Below: "Tap to open" (fades in after 2 seconds)
On tap:
Wax seal cracks with a subtle animation
Envelope flap lifts slowly
A folded letter rises out of the envelope (CSS transform, slow and graceful)
Letter unfolds
Envelope fades away, letter remains and transitions into the next screen
Chapter 2: The Slow Build (~1 min)
Black/dark background. Just text. Nothing else.
"[Name]..." — appears, holds for 2 full seconds
Then fades slightly, and new text: "I've been thinking about how to say this..."
Holds 2 seconds
"So I made this for you."
Holds 2 seconds
"Scroll when you're ready."
No creator name revealed yet. Mystery. Anticipation.
Pacing is everything here. Do NOT rush. The pauses ARE the design.
Chapter 3: The Noticing (~2.5 min)
Concept: The most intimate section. Just words. No photos yet. Each observation appears alone, centered, given its full moment.

Soft transition: background shifts to a very dark version of the theme color
First text: "I notice things about you that maybe you don't notice yourself..."
Then, as they scroll, each "thing I notice" appears:
Centered on screen
Fades in softly (opacity 0 to 1, slight upward drift)
Stays visible for the scroll distance of roughly one viewport height
Then fades as the next one begins appearing
Each one is alone on screen. No overlap. Full attention.
Typography: elegant serif or clean sans-serif, medium-large size
After all observations: a pause, then "...and I notice more every day."
This section should feel like someone whispering truths to you. Slow. Intentional. Personal.
Chapter 4: The Moments (~1.5 min)
Photos appear one at a time, full-width (or large centered with soft rounded corners)
Each photo has a slow Ken Burns effect (very gentle zoom over 5 seconds)
Caption appears below in italic/handwriting font, fades in after photo is fully visible
Transition between photos: soft crossfade (not hard cuts)
2-4 photos total. Each gets its own full viewport moment.
No rush. This is a gallery of intimacy, not a slideshow.
Chapter 5: The Confession (~2 min)
Concept: The heart of everything. The creator's actual words. This is why the whole thing exists.

Background warms up (subtle gradient shift — slightly lighter, warmer)
The confession message appears with a typewriter effect
Speed: moderate (not frustratingly slow, not rushed — about 25 chars/second)
If the message is long, it scrolls naturally as it types
Font: slightly larger than other text, warm color (cream/gold on dark, or dark on warm light)
After the full message appears: a pause (3 seconds of just the complete message on screen)
Then: "— [Creator's name]" fades in below, like a letter signature
Then: the closing line appears (slightly different styling — bolder or in a different color)
"Will you be mine?"
or "I just wanted you to know"
or whatever they chose/wrote
A single animation accompanies the closing: soft particles forming a heart shape, or petals drifting down gently
Chapter 6: The Reply (~1 min)
Concept: Give the recipient a chance to respond. Their reply becomes a beautiful downloadable image.

Soft transition. Text: "If you'd like to say something back..."

A text input area appears (styled beautifully — not a raw textarea)

Placeholder: "Type your heart here..."

Character limit: 200 characters (shown as counter)

Below input: "Send your reply" button

On submit:

Their text is rendered into a beautiful styled image (Canvas API, client-side):
Theme-matching background (gradient or solid)
Their reply text in elegant typography, centered
Decorative border or subtle ornamental elements
Small text at bottom: "[Name]'s reply" + date
Dimensions: roughly square or 4:5 ratio (Instagram-friendly)
The image is displayed on screen as preview
Two options:
"Download this image" — saves PNG to their device
"I'd like [Creator] to receive this" — stores the reply text in database (admin can see it and generate/download the image from admin panel to share with creator)
If they choose "I'd like [Creator] to receive this": show confirmation "Your reply has been saved. They'll receive it soon 💛"
If they skip (optional "Skip" link below input): move to ending
Admin side: Admin panel shows expression replies. Admin can:

View the reply text
Generate the styled image (same Canvas rendering)
Download the image
Share with creator (manually, via WhatsApp/email — no in-app notification needed)
Chapter 7: Soft Ending (~30 sec)
No confetti. No fireworks. That would break the mood.
Gentle animation: soft light particles or petals drifting
Text: "Take your time with this. No rush. 💛"
Below: "Some things don't need a response. Just know that you're thought of."
Very bottom (subtle): "Made with CelebrateThem" + "Create one for someone →"
Music fades out gently if playing
Admin Panel
Access & Security
Route: /admin
Protected by a single password stored as environment variable ADMIN_PASSWORD
Simple login: password input → if matches env var, set HTTP-only session cookie (24hr expiry)
No user accounts, no OAuth, no complexity. Just you.
Dashboard View
Stats cards at top:
Total active celebrations
Total inactive (expired but not deleted)
Total created (all-time counter)
Celebrations expiring in next 2 hours
Recent activity feed:
Latest created celebrations
Recently expired ones
Recent expression replies received
Celebrations List View
Table with columns: Short Code, Type (🎂/💌), Recipient, Creator, Status, Created, Expires, Views, Actions
Filters: All / Active / Inactive / Birthday / Expression
Search: By recipient name, creator name, or short code
Sort: By created date, expiry date, view count
Per-Celebration Detail & Actions
View/Preview: See exactly what the recipient sees (full experience)
Toggle Active/Inactive: Single toggle switch to activate or deactivate
Extend Time: Button to add hours (input: how many hours to extend)
Edit Details: Edit any text field (recipient name, messages, reasons, quiz questions, etc.)
Manage Photos: View uploaded photos, delete individual ones, see storage usage
View Reply (Expression only): See reply text, generate downloadable image, download it
Copy Link + Passcode: Quick copy buttons
Delete Permanently: Red button, requires confirmation ("Are you sure? This deletes all data and photos permanently.")
View Stats: View count, last viewed timestamp, times reactivated
Settings Page
Change admin password (updates env variable guidance — or store hashed in DB)
Default expiry duration (default: 21 hours, adjustable)
Site maintenance mode toggle (shows "We'll be back soon" to all visitors)
Storage usage overview (total MB used in Supabase Storage)
Expiry Handling (Cron Job)
A Vercel Cron Job runs every hour (or use Supabase scheduled functions)
Checks for celebrations where expires_at < NOW() AND status = 'active'
Sets their status to 'inactive'
Does NOT delete data or files
Only admin can permanently delete
Design & Animation Guidelines
General Principles
Mobile-first (80%+ recipients will open on phone)
Dark themes by default (more cinematic, better for photos)
Typography is king — use beautiful Google Fonts (Playfair Display for headings, Inter for body, Caveat for handwritten feel)
Animations should feel organic, not mechanical (use ease-out, spring physics)
Every animation serves the emotion — never animate just because you can
Performance: lazy-load images, use will-change for animated elements, keep bundle small
Accessibility: respect prefers-reduced-motion, ensure text contrast, keyboard navigable
Scroll Animation Patterns to Use
Fade + drift up: Elements fade in while moving up 20-30px (most common, most elegant)
Stagger reveal: Multiple elements appear one after another with slight delay
Pin + progress: Section stays fixed while internal content progresses
Parallax depth: Background moves at 0.5x scroll speed, foreground at 1x
Text character stagger: Letters appear one by one (for names, important text)
Scale reveal: Element starts at 0.8 scale, grows to 1.0 as it enters viewport
Draw-on: SVG paths draw themselves as user scrolls (for decorative lines, borders)
Color Themes
Birthday — Confetti Burst:

Background: Deep navy (#0a0a1a) to vibrant purple gradient
Accents: Hot pink, electric blue, gold, lime green
Particles: Multi-colored confetti bits
Birthday — Golden Glow:

Background: Warm dark brown (#1a1008) to deep amber
Accents: Gold, cream, warm white, soft orange
Particles: Golden fireflies, warm bokeh
Birthday — Neon Night:

Background: Pure black (#000) to dark purple
Accents: Neon pink, cyan, electric purple, white
Particles: Neon streaks, glowing dots
Birthday — Starry Dream:

Background: Deep space blue (#050520) to midnight
Accents: Silver, soft blue, white, pale purple
Particles: Stars, shooting stars, nebula wisps
Expression — Midnight Letters:

Background: Near-black (#0a0a0f) to very dark blue
Accents: Soft gold, cream, muted warm white
Particles: Minimal — just a few floating light dots
Expression — Soft Bloom:

Background: Very dark rose (#1a0a10) to deep plum
Accents: Blush pink, soft mauve, cream, rose gold
Particles: Soft petals, gentle bokeh
Expression — Warm Sunset:

Background: Dark warm brown (#1a0f08) to deep terracotta
Accents: Amber, peach, warm cream, soft coral
Particles: Warm light particles, gentle lens flares
Landing Page (/)
Hero section: Large headline "Make Someone's Day Unforgettable"
Subtitle: "Create a personalized surprise experience in minutes. Share a link. Watch them smile."
Two CTA cards: "Birthday Surprise 🎂" / "Express Your Feelings 💌"
Brief "How it works" section (3 steps: Fill form → Share link → They experience magic)
Sample screenshots/previews of what the experience looks like
Footer: minimal, clean
Technical Implementation Notes
File Structure (suggested)
src/
  app/
    page.tsx                    (landing page)
    create/
      page.tsx                  (creator form)
    c/
      [shortCode]/
        page.tsx                (recipient experience)
    admin/
      page.tsx                  (admin dashboard)
      celebrations/
        [id]/page.tsx           (celebration detail)
    api/
      celebrations/
        route.ts                (CRUD operations)
        [id]/route.ts           (single celebration ops)
        [id]/reply/route.ts     (expression reply)
      upload/
        route.ts                (image/audio upload)
      admin/
        login/route.ts          (admin auth)
        stats/route.ts          (dashboard stats)
      cron/
        expire/route.ts         (expiry cron endpoint)
  components/
    form/                       (all form step components)
    experience/
      birthday/                 (birthday chapter components)
      expression/               (expression chapter components)
      shared/                   (passcode screen, audio player, progress bar)
    admin/                      (admin panel components)
    ui/                         (reusable UI: buttons, inputs, cards, modals)
    animations/                 (reusable animation components)
  lib/
    supabase.ts                 (Supabase client config)
    utils.ts                    (helpers: generate short code, hash passcode, etc.)
    canvas-image.ts             (reply image generation logic)
  hooks/                        (custom React hooks)
  styles/                       (global styles, fonts)