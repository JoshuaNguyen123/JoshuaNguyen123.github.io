export interface Project {
  slug: string;
  number: string;
  title: string;
  description: string;
  reflection: string;
  discipline: string;
  /** One line for the homepage index. */
  tagline: string;
  /** Featured projects only: the homepage summary and three checkable facts. */
  feature?: { summary: string; highlights: [string, string, string] };
  /** A real product capture, kept separate from the architecture diagram. */
  preview?: { src: string; alt: string; width: number; height: number; caption: string };
  href: string | null;
  /** Architecture diagram under public/, e.g. "/projects/ladybug-architecture.svg". */
  image: string;
  problem: string;
  whatItDoes: string;
  howItConnects: string;
  whatWasHard: string;
}

export const FEATURED_PROJECTS = 3;

function diagram(slug: string): string {
  return `/projects/${slug}-architecture.svg`;
}

// Lead with the desktop knowledge graph, followed by two supporting projects.
// Every claim here should match the project's code and its diagram in
// content/architecture/<slug>.mmd.
export const projects: Project[] = [
  {
    slug: "research-agent-platform",
    number: "01",
    title: "Research Agent Platform",
    description:
      "A desktop research workspace built on Electron and CodeMirror 6, working directly on ordinary Obsidian-compatible vaults. The agent core is vendored at a pinned commit behind three typed seams rather than forked, and only a separate agent-host process ever reads or writes the vault. In review mode, the agent's edits arrive as inline hunks to accept or reject before they are written. It runs as a packaged Windows app with local engines for dictation, OCR, completion, and code sandboxes, and hundreds of Playwright journeys cover the loop.",
    reflection:
      "The three typed seams ended up being the whole contract between the app and the agent core. When a vendor bump breaks one, the build fails at compile time and the change never reaches someone's vault.",
    discipline: "TypeScript · Electron · Desktop app",
    tagline: "Explore connected ideas. Trace them back to the source",
    feature: {
      summary: "A desktop workspace for research, connected notes, and agent-assisted editing.",
      highlights: [
        "A knowledge graph connects notes, concepts, sources, and agent runs",
        "An inspector shows why each node matters and where it came from",
        "Review agent edits inline before they are written",
      ],
    },
    preview: {
      src: "/projects/research-agent-graph.webp",
      alt: "Research Agent Platform in a demo vault: the knowledge graph's Map lens, linking research notes and concepts, with the selected concept's salience, source passages, and related nodes in the inspector",
      width: 1600, height: 1000, caption: "Knowledge graph · Demo vault · November 2026",
    },
    href: null,
    image: diagram("research-agent-platform"),
    problem:
      "A research agent in a desktop workspace that can hold every edit for review before a vault file changes.",
    whatItDoes:
      "A desktop workspace that opens ordinary vault folders. Its knowledge graph links notes, concepts, sources, and agent runs, with Map, Atlas, and Code lenses and an inspector that shows why each node matters and which passages it came from. The agent runs inside the app, and a permission mode decides how its edits land: read only, review, where each change appears as an inline hunk to accept or reject, or auto-apply.",
    howItConnects:
      "A sandboxed renderer draws the editor, review, and graph, and reaches everything else through typed IPC. The main process owns the windows and sealed API keys and forwards requests to an agent-host process, the only part of the app that reads or writes the vault. The host runs missions through the vendored core across three typed seams and sends prompts only to the model provider you choose. The vault stays plain Markdown, so Obsidian can open the same folder.",
    whatWasHard:
      "The agent core is developed outside the app, and forking it would have meant maintaining two agents. So the core is vendored at a pinned commit, and the app reaches it only through three typed seams.",
  },
  {
    slug: "ladybug",
    number: "02",
    title: "Ladybug",
    description:
      "A private photo and writing space for two people. One React app runs two ways: a deterministic simulator that shows both phones side by side with no credentials, and a connected PWA backed by Supabase, with row-level security, private storage, and realtime state. It began as a native SwiftUI and Firebase app, and the simulator and that app's backend share one package of product rules. Verification covers the migrations, a three-account connected journey, WebKit and Chromium end-to-end runs, and the iOS handoff, all on self-hosted CI.",
    reflection:
      "The simulator was worth building first. It runs both phones side by side with no credentials, so I found the basic product mistakes before I was paying for cloud time.",
    discipline: "TypeScript · Swift · Supabase",
    tagline: "A private photo and writing space for two people",
    feature: {
      summary:
        "A private photo and writing space for exactly two people. One React app runs as a credential-free simulator or as a connected Supabase PWA, so the product could be proven before the cloud bill started. It began as a SwiftUI app.",
      highlights: [
        "A simulator runs both phones side by side with no credentials",
        "Row-level security, checked by a three-account test",
        "Migrations, journeys, and the iOS handoff run on self-hosted CI",
      ],
    },
    href: null,
    image: diagram("ladybug"),
    problem:
      "A photo and writing space for two people that has to stay private and reliable on two phones at once.",
    whatItDoes:
      "Ladybug is a shared space for exactly two people, with photos, short writing, and daily prompts. One React app runs in two modes, a deterministic simulator and a connected Supabase PWA, so the product could be proven before the cloud bill started. The original SwiftUI and Firebase app was its first host.",
    howItConnects:
      "The simulator runs both phones side by side with no credentials and is where product mistakes get found. The connected PWA queues writes offline and sends them through Supabase RPCs, the only write path, into Postgres behind row-level security. Photos are redrawn in the browser before they reach private storage, and Realtime only hints that something changed. Self-hosted CI checks migrations, a three-account journey, WebKit and Chromium runs, and the iOS handoff.",
    whatWasHard:
      "A two-person app still has two accounts, two devices, uploads, notifications, and realtime state. I had to treat it as a small distributed system from the start, with the migrations, a three-account journey, and both browser engines checked in CI.",
  },
  {
    slug: "personal-ai-digest",
    number: "03",
    title: "Personal AI Digest",
    description:
      "A retrieval pipeline that emailed me grounded technical lessons twice a day from March to September 2026. A Cloudflare Worker fired each send on time, because GitHub's own scheduler drifts by hours, and a GitHub Actions job retrieved evidence from the knowledge store, SQLite or Postgres with pgvector, for a model to draft from. A quality gate dropped any lesson whose factual paragraphs did not cite that evidence. Ingestion runs as a separate job, so a stalled ingest never stopped the mail.",
    reflection:
      "The citation rule is why I trusted the lessons enough to study from them. Keeping ingestion and delivery apart mattered just as much, because either side could fail without stopping the other.",
    discipline: "Python · RAG · Cloudflare Workers",
    tagline: "Cited technical lessons in my inbox, twice a day from March to September",
    feature: {
      summary:
        "A retrieval pipeline that emailed me grounded technical lessons twice a day from March to September 2026. Every factual paragraph had to cite the evidence it came from.",
      highlights: [
        "Ingest and delivery meet only at the knowledge store",
        "Either side can fail without taking the other down",
        "A Cloudflare Worker sent on time where GitHub's scheduler drifted by hours",
      ],
    },
    href: null,
    image: diagram("personal-ai-digest"),
    problem:
      "A daily technical lesson I will actually study from, grounded in sources I already trust, delivered on time without a babysitter.",
    whatItDoes:
      "Twice a day, the pipeline picked three topics across algorithms, systems, and machine learning, retrieved evidence from a personal knowledge store, and emailed a short lesson for each, with a review block for spaced repetition. A model drafted each lesson from distilled evidence, and every factual paragraph had to cite it. It sent from March to September 2026.",
    howItConnects:
      "Ingest chunks, tags, and embeds sources into the knowledge store, SQLite or Postgres with pgvector, and stops there. On schedule, the Worker dispatches a GitHub Actions job that retrieves and distills evidence, asks Ollama Cloud for a draft, runs the citation gate, and sends what passes over SMTP. A send log committed to git keeps a retried run from mailing twice. If ingest stalls, mail still goes out from what is already indexed.",
    whatWasHard:
      "The model will invent a fluent lesson if you let it. The quality gate drops any lesson whose factual paragraphs do not cite quoted evidence, and it rejects numbers the evidence does not contain.",
  },
  {
    slug: "teach-anything",
    number: "04",
    title: "Teach Anything",
    description:
      "An adaptive learning engine that plans each session from what the learner actually remembers. It combines FSRS-6 forgetting curves, Bayesian mastery estimates, and sandboxed code exercises on top of a pure, seeded core, so the same learning state always produces the same plan, and every mastery update is kept in an append-only event log. Every question has to cite its source.",
    reflection:
      "Getting a model to write a lesson takes an afternoon. Getting Tuesday's lesson to depend on what Monday showed took the rest of the project.",
    discipline: "TypeScript · Learning systems",
    tagline: "A lesson planner that remembers what Monday taught",
    href: null,
    image: diagram("teach-anything"),
    problem:
      "A lesson planner that remembers what Monday actually taught, instead of improvising a new syllabus every time someone opens the app.",
    whatItDoes:
      "Teach Anything plans each session from the learner's memory state. It combines FSRS-6 forgetting curves, six Bayesian mastery estimates per concept, and code exercises that run in a sandbox. The engine is pure and seeded, with no clock and no I/O, so a plan can be derived again from the same state and checked. Every question has to cite its source, and the database refuses to serve one that does not.",
    howItConnects:
      "Pages reach stored state only through a session service, which hands the learning history to the engine and stores what comes back. FSRS decides when an item is due; a priority selector decides what goes into the session, using predicted recall, readiness, prerequisites, and deadlines. Every model call goes through one gateway to the provider the learner configures, and a course worker builds new courses behind human review gates.",
    whatWasHard:
      "The schedule had to adapt to the learner, and I had to be able to prove that it did. That meant putting the memory math in a pure, deterministic core and checking it in a simulation harness.",
  },
  {
    slug: "engineering-activity-portfolio",
    number: "05",
    title: "Engineering Activity Portfolio",
    description:
      "This site. A privacy-safe collector reads local activity from the tools I work in, publishes daily counts to a live feed, and renders them as the yearly heatmaps above. Nothing about the code or the projects leaves the machine.",
    reflection:
      "I ended up putting the privacy rules and the source of each number on the page itself, where a visitor can check them.",
    discipline: "TypeScript · Data visualization",
    tagline: "This site's privacy-safe record of when I'm building",
    href: "https://github.com/JoshuaNguyen123/JoshuaNguyen123.github.io",
    image: diagram("engineering-activity-portfolio"),
    problem:
      "A public record of when I was building that never publishes prompts, paths, or project names.",
    whatItDoes:
      "This site. Local collectors read activity from the tools I work in, reduce it to daily counts, and publish an aggregate feed. The homepage renders those counts as yearly heatmaps with a live refresh. The /activity page explains what each number counts and what it leaves out.",
    howItConnects:
      "Collectors stay on the machine and emit dates and counts only. A publish step writes the public snapshot. The static site reads that snapshot, draws the heatmaps, and can poll the published feed for a newer day. Prompts, code, filenames, repositories, and raw IDs never enter the snapshot.",
    whatWasHard:
      "The hard part was deciding what to leave out. A feed of what I was working on would have been more interesting to look at, and it would have published prompts, paths, and project names. The site shows a calendar of observed days and explains in public how each count is made.",
  },
  {
    slug: "great-outdoors-intelligence",
    number: "06",
    title: "Great Outdoors Intelligence",
    description:
      "Ranks Montana river reaches for fly fishing by live conditions instead of showing a wall of gauges. It pulls river gauges, FWP closures, NWS forecasts, SNOTEL snowpack, fire perimeters, and avalanche zones into one local bundle, scores reaches with deterministic rules that show their reasons, and archives FWP closures daily, because FWP keeps no history. More activities and offline trip bundles were designed but never built.",
    reflection:
      "The product is the ranking. The dashboard exists so you can argue with it.",
    discipline: "Python · Data pipelines",
    tagline: "Montana rivers ranked for fly fishing by live conditions",
    href: null,
    image: diagram("great-outdoors-intelligence"),
    problem:
      "Where to go outside in Montana today, ranked by live conditions.",
    whatItDoes:
      "A local pipeline collects river gauges, FWP closures, NWS forecasts, SNOTEL snowpack, fire perimeters, and avalanche zones into one versioned local bundle. A rule engine scores river reaches for fly fishing from flow, water temperature, and published restrictions, and every score carries its reasons and a confidence level. Snowpack, fire, and avalanche data show as map layers. More activities and offline trip bundles were designed but never built.",
    howItConnects:
      "A scheduled task or the Refresh button runs the collectors, each cache-aware and isolated so one failing source cannot sink the rest. They write a single SQLite bundle, and the rule engine writes its assessments back into it. A local Flask API reads only that bundle, never a source, and serves the React UI, which is there so a person can argue with the ranking. A separate daily script archives FWP closures.",
    whatWasHard:
      "Six live feeds are easy to put on a map and hard to use at a trailhead. Most of the work went into turning them into one ranked recommendation you can inspect, and into binding each river reach to the right gauge. A score read from the wrong gauge is worse than no score.",
  },
  {
    slug: "local-first-meeting-transcription",
    number: "07",
    title: "Local-First Meeting Transcription",
    description:
      "A meeting recorder that keeps the audio on the machine and transcribes it locally. Live transcription with Vosk, a refined pass with faster-whisper after the meeting, a review queue that reconciles the two, and structured notes written from the agreed transcript by whichever Ollama-compatible model you configure. FastAPI backend, React frontend.",
    reflection:
      "I expected the speech models to be most of the work. Most of it ended up in the review queue.",
    discipline: "Python · TypeScript · Speech",
    tagline: "Local meeting transcription, with a review queue for when two passes disagree",
    href: null,
    image: diagram("local-first-meeting-transcription"),
    problem:
      "Meeting audio that never leaves the machine, and a way to deal with the fact that two local transcripts will not agree.",
    whatItDoes:
      "A local recorder captures the meeting from the microphone or a shared browser tab, transcribes live with Vosk, then runs a refined pass with faster-whisper. A review queue reconciles the two transcripts. The agreed text goes to a configured Ollama-compatible model, local or hosted, which turns it into structured notes. FastAPI serves the backend; React is the review UI.",
    howItConnects:
      "Audio stays on disk, alongside the transcripts in SQLite. The live model writes a first transcript during the meeting. Afterward a second model writes a refined transcript from the saved audio. The review queue is where those two are reconciled and a person verifies them. Only the agreed transcript leaves the recorder, and only to the notes model you point it at.",
    whatWasHard:
      "Two transcripts of the same audio disagree constantly. Handing the conflict to another model would only hide it, so the disagreements go to a review queue where a person resolves them.",
  },
];

export function getProjects(): Project[] {
  return projects;
}

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
