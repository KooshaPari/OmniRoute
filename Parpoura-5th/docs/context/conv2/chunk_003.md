### **You**

Cool — Veo 3.1 is actually built for exactly this: headless, async jobs, and it supports image-to-video, up to 3 reference images, first+last frame interpolation, and native audio. Google AI for Developers
Here are the pipelines that don’t suck.

Pipeline 1: Slides → Keyframes → Veo 3.1 clips → FFmpeg “finish”
This is the “deck becomes cinematic video” path.
1) Slide → SceneSpec (structured)
For each slide, generate:

prompt (visual + motion + mood + optional dialogue/audio cues)

negativePrompt

duration (Veo is typically 8s per clip; you stitch multiples)

refs[] (up to 3 reference images)

optional: firstFrame, lastFrame

Veo 3.1 supports:

up to 3 reference images (“image-based direction”)

first/last frame (“frame-specific generation”)

“video extension” (extend Veo-generated clips)

native audio generation Google AI for Developers

2) Generate keyframes (your “nanobanana”)
If you’re using Google’s stack, the Veo doc literally shows generating the image first via gemini-2.5-flash-image then feeding it into Veo 3.1. Google AI for Developers
So your “nanobanana” stage = “generate the initial frame(s)”.
3) Veo 3.1 image-to-video
Use the keyframe as image (first frame). Optionally supply:

last\_frame for interpolation

referenceImages (up to 3) to lock in assets/style Google AI for Developers

Veo returns a long-running operation you must poll. Google AI for Developers
4) Stitch + brand polish (FFmpeg)
Do deterministic things here:

concat

transitions

lower-thirds / logo bug

captions burn-in

audio leveling / mix

export matrix (16:9 + 9:16 versions, etc.)

This is the step that makes it “ship-ready” instead of “model demo”.
5) Retention + caching (non-optional)
Veo 3.1 videos are stored server-side only 2 days; you must download + archive. Google AI for Developers
Also expect latency from ~11s to minutes. Google AI for Developers

Pipeline 2: Slides → “Ingredients” references → Veo 3.1 (stronger control, less prompt)
If you want less prompt gymnastics:

Generate or extract reference photos/assets for each slide (product shots, icons, backgrounds)

Feed those as referenceImages (up to 3) + a shorter prompt

This is basically what Google is productizing as “Ingredients to Video” in Gemini UX. Android Central

Pipeline 3: Slides → first+last frame interpolation (tight narrative control)
This is the most controllable Veo workflow.

Generate firstFrame (scene starts)

Generate lastFrame (scene ends)

Veo interpolates between them (plus your prompt)

Veo 3.1 explicitly supports first/last frame generation. Google AI for Developers
Use this when you need:

consistent character pose evolution

“arrive at this exact composition”

fewer random camera choices

Pipeline 4: Extend clips instead of regenerating (cheap iteration)
If you like a clip but need it longer:

Use Veo 3.1 video extension: extends by ~7 seconds, up to 20 times, and only works on Veo-generated input. Google AI for Developers

Good for:

padding for narration timing

smoother pacing without redoing the whole scene

The bare-minimum headless orchestration you need
You’ll regret not doing this.
Job DAG
For each slide/scene:

make\_scene\_spec

gen\_keyframe(s)

veo\_generate (async + polling)

download\_and\_store (before 2-day TTL)

qc (basic checks)

assemble\_final (FFmpeg)

Manifest everything
Store:

prompts + negative prompts

input refs (hashes)

model/version used (e.g., veo-3.1-generate-preview)

operation id

output file ids + hashes

timestamps

Because you will need reproducibility and rollback.

One straight answer on “audio”
Veo 3.1 can generate native audio, but it can also fail/block due to audio processing/safety. Google AI for Developers
So: don’t rely on Veo for final mix unless you accept flaky runs.
Best practice:

let Veo generate “ambient” audio if you want

do final narration/music/mix deterministically in FFmpeg after.

If you tell me which direction you want:

Cinematic (Veo-heavy)

Slide-faithful (render slides + light motion, Veo only for b-roll)
…I’ll give you a concrete SceneSpec schema and the exact compile steps (including how to map speaker notes → clip durations).

---

### **ChatGPT**

Walk me through building and selling a mobile application + marketing it both via traditional and non trad b2b and b2c means, agents are now capable? Assume Claude code base harness

---

