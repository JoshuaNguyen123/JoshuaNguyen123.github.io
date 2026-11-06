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
      "A desktop research workspace built around the same agent core as the Obsidian plugin. Electron and CodeMirror 6, working directly on ordinary Obsidian-compatible vaults. The core is vendored at a pinned commit behind three typed seams rather than forked, and only a separate agent-host process ever reads or writes the vault. In review mode, the agent's edits arrive as inline hunks to accept or reject before they are written. It runs as a packaged Windows app with local engines for dictation, OCR, completion, and code sandboxes, and hundreds of Playwright journeys cover the loop.",
    reflection:
      "Vendoring the core instead of forking it kept one agent with two hosts. The typed seams are the whole contract, so a vendor bump that breaks one fails at compile time instead of in someone's vault.",
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
      "The same research agent, hosted in a desktop workspace that can hold every edit for review before a vault file changes.",
    whatItDoes:
      "A desktop workspace that opens ordinary vault folders. Its knowledge graph links notes, concepts, sources, and agent runs, with Map, Atlas, and Code lenses and an inspector that shows why each node matters and which passages it came from. The same agent core as the Obsidian plugin runs inside the app, and a permission mode decides how its edits land: read only, review, where each change appears as an inline hunk to accept or reject, or auto-apply.",
    howItConnects:
      "A sandboxed renderer draws the editor, review, and graph, and reaches everything else through typed IPC. The main process owns the windows and sealed API keys and forwards requests to an agent-host process, the only part of the app that reads or writes the vault. The host runs missions through the vendored core across three typed seams and sends prompts only to the model provider you choose. The vault stays plain Markdown, so Obsidian can open the same folder.",
    whatWasHard:
      "Forking the core would have created two agents. Vendoring it behind typed seams keeps one agent with two hosts, and a vendor bump that breaks a seam fails at compile time instead of in someone's vault.",
  },
  {
    slug: "obsidian-research-agent",
    number: "02",
    title: "Obsidian Research Agent",
    description:
      "An Obsidian plugin that runs research missions inside a vault. It reads the vault for context, follows a durable plan, passes every action through a prepared-action gate, writes sourced notes back, and keeps a receipt for every step. Code work runs in a sandbox, Linear and GitHub stay behind capability gates, and an optional local companion service can finish jobs that were already authorized. An interrupted run resumes from its plan without redoing finished steps.",
    reflection:
      "Adding tools to an agent is the easy part. The hard part is making each one bounded and debuggable, so that when something goes wrong you can see exactly which call did it and pick up from there.",
    discipline: "TypeScript · Agent systems",
    tagline: "Research missions inside an Obsidian vault, with a receipt for every step",
    feature: {
      summary:
        "An Obsidian plugin that runs research missions inside a vault. It reads the vault for context, commits to a plan, passes every action through an approval gate, and writes sourced notes back with a receipt for every step.",
      highlights: [
        "Exact approval prompts and a receipt for every step",
        "An interrupted run resumes without redoing finished steps",
        "Linear, GitHub, and code work stay behind capability gates",
      ],
    },
    href: "https://github.com/JoshuaNguyen123/Obsidian_research_agent",
    preview: {
      src: "/projects/obsidian-research-demo.jpg",
      alt: "Obsidian research demo: a sourced note beside the mission console and its write receipt",
      width: 1280, height: 720, caption: "Research mission · Demo vault",
    },
    image: diagram("obsidian-research-agent"),
    problem:
      "Research that can read a vault, use real tools, and write back to notes, without hiding what the agent just did.",
    whatItDoes:
      "A desktop Obsidian plugin runs missions from a side console. It reads vault context, builds a durable plan, sends prompts to the model you configure, and passes every action through a prepared-action gate before writing sourced notes with a receipt for every step. Code work, a local companion service, and Linear or GitHub stay behind capability gates so a research run does not get extra authority by default.",
    howItConnects:
      "A mission starts in the console and becomes a plan the rest of the run has to follow. The agent loop proposes each action; the plugin prepares it, checks its grant or asks for an exact approval, runs it, and reads the result back before recording a receipt. Only code runs in a sandbox. Sourced notes write back to the vault, and an interrupted run resumes from the durable plan without redoing finished steps. The companion, Linear, and GitHub sit behind the gate; they never become the default path.",
    whatWasHard:
      "Giving the agent more tools was easy. The work was making every tool bounded, previewable, and recoverable: exact approval prompts, a sandbox for code, resuming after a failed step, and receipts that stay truthful when a page does not actually load.",
  },
  {
    slug: "ladybug",
    number: "03",
    title: "Ladybug",
    description:
      "A private photo and writing space for two people. One React app runs two ways: a deterministic simulator that shows both phones side by side with no credentials, and a connected PWA backed by Supabase, with row-level security, private storage, and realtime state. It began as a native SwiftUI and Firebase app, and the simulator and that app's backend share one package of product rules. Verification covers the migrations, a three-account connected journey, WebKit and Chromium end-to-end runs, and the iOS handoff, all on self-hosted CI.",
    reflection:
      "Two phones, two accounts, uploads, notifications, and realtime state make even a two-person app a small distributed system. The simulator let me find the product mistakes before paying for cloud time.",
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
      "A two-person photo and writing space that has to feel private, personal, and reliable on two phones at once.",
    whatItDoes:
      "Ladybug is a shared space for exactly two people: photos, short writing, daily prompts, and the small interactions that make that space feel like a place. One React app runs in two modes, a deterministic simulator and a connected Supabase PWA, so the product could be proven before the cloud bill started. The original SwiftUI and Firebase app was its first host.",
    howItConnects:
      "The simulator runs both phones side by side with no credentials and is where product mistakes get found. The connected PWA queues writes offline and sends them through Supabase RPCs, the only write path, into Postgres behind row-level security. Photos are redrawn in the browser before they reach private storage, and Realtime only hints that something changed. Self-hosted CI checks migrations, a three-account journey, WebKit and Chromium runs, and the iOS handoff.",
    whatWasHard:
      "A two-person app still has two accounts, two devices, uploads, notifications, and realtime state. The hard part was treating that as a small distributed system and using the simulator so I was not paying cloud time to discover basic product mistakes.",
  },
  {
    slug: "personal-ai-digest",
    number: "04",
    title: "Personal AI Digest",
    description:
      "A retrieval pipeline that emailed me grounded technical lessons twice a day from March to September 2026. A Cloudflare Worker fired each send on time, because GitHub's own scheduler drifts by hours, and a GitHub Actions job retrieved evidence from the knowledge store, SQLite or Postgres with pgvector, for a model to draft from. A quality gate dropped any lesson whose factual paragraphs did not cite that evidence. Ingestion runs as a separate job, so a stalled ingest never stopped the mail.",
    reflection:
      "Requiring every factual paragraph to cite its evidence is what turned this from a toy into something I trusted enough to study from. Keeping ingestion and delivery apart meant either side could fail without taking the other down.",
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
      "The model will invent a fluent lesson if you let it. Forcing every factual paragraph to cite quoted evidence, rejecting numbers the evidence does not contain, and splitting ingest from delivery so a failure on one side does not take the other down, is what made it something I would read.",
  },
  {
    slug: "teach-anything",
    number: "05",
    title: "Teach Anything",
    description:
      "An adaptive learning engine that plans each session from what the learner actually remembers. It combines FSRS-6 forgetting curves, Bayesian mastery estimates, and sandboxed code exercises on top of a pure, seeded core, so the same learning state always produces the same plan, and every mastery update is kept in an append-only event log. Every question has to cite its source.",
    reflection:
      "Getting a model to write a lesson takes an afternoon. Getting Tuesday's lesson to depend on what Monday showed, and being able to prove it, was the real product.",
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
      "Asking a model for a lesson is cheap. Making Tuesday depend on Monday, and proving the schedule adapted instead of improvised, meant putting the memory math in a pure, deterministic core and checking it in a simulation harness.",
  },
  {
    slug: "autonomous-repository-template",
    number: "06",
    title: "Autonomous Repository Template",
    description:
      "A plan-first repository protocol for coding agents: built, used, and retired. Project memory lived in tracked files, implementation sat behind a planning gate, and every task carried a verification lane. In 29 days it was instantiated into six products, and one reached completion with all 82 of its acceptance commands passing. It also cost more than it saved, so I retired it on September 30, 2026, keeping its lightest profile: one human-approved milestone, then the agent, then review.",
    reflection:
      "A plan the agent cannot skip is worth having. Paying for the machinery around it on every commit was not, so the plan-first contract survived and the rest did not.",
    discipline: "Python · Agent workflows",
    tagline: "A plan-first protocol for coding agents, built, used, and retired",
    href: null,
    image: diagram("autonomous-repository-template"),
    problem:
      "A coding agent that can keep project memory, but cannot start implementing until a human-approved plan exists.",
    whatItDoes:
      "A repository protocol for coding agents, used in six products over a month and retired on September 30, 2026. In its full profile, project memory lived in tracked files, a planning gate check held implementation until a plan passed, every task carried a verification lane of commands, and features entered only through a human request. Products could migrate to newer protocol versions without losing their own state. The default is now a supervised profile of nine files: one approved milestone, the project's own checks, and a handoff for review.",
    howItConnects:
      "Setup scripts instantiate a product or adopt an existing repository. A human request becomes a plan with one approved milestone. A coding agent such as Claude Code, Codex, or Cursor implements it, runs the checks the plan lists, and hands back local commits and notes for review. The opt-in profiles add the gate check, verification cycles that decide whether to continue, replan, or escalate, and the tracked state those cycles read.",
    whatWasHard:
      "The useful part was not a smarter model. It was memory the agent cannot drop and a plan it cannot skip. The machinery around them is what did not pay: in the products built on it, 37 to 69 percent of commits touched only protocol records, and a verification cycle averaged about seven minutes. Its postmortem kept the plan-first contract and dropped the rest.",
  },
  {
    slug: "engineering-activity-portfolio",
    number: "07",
    title: "Engineering Activity Portfolio",
    description:
      "This site. A privacy-safe collector reads local activity from the tools I work in, publishes daily counts to a live feed, and renders them as the yearly heatmaps above. Nothing about the code or the projects leaves the machine.",
    reflection:
      "Provenance and privacy work better as visible features than as a footnote.",
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
      "The tempting dashboard is a feed of what I was working on. The honest one is a calendar of observed days plus a public explanation of how each count is made. Privacy had to be the product, not a disclaimer under a more revealing chart.",
  },
  {
    slug: "great-outdoors-intelligence",
    number: "08",
    title: "Great Outdoors Intelligence",
    description:
      "Ranks Montana river reaches for fly fishing by live conditions instead of showing a wall of gauges. It pulls river gauges, FWP closures, NWS forecasts, SNOTEL snowpack, fire perimeters, and avalanche zones into one local bundle, scores reaches with deterministic rules that show their reasons, and archives FWP closures daily, because FWP keeps no history. More activities and offline trip bundles were designed but never built. It was the first product built on the repository template above, and its defect reports shaped the template's fixes.",
    reflection:
      "The product is the ranking. The dashboard exists so you can argue with it.",
    discipline: "Python · Data pipelines",
    tagline: "Montana rivers ranked for fly fishing by live conditions",
    href: null,
    image: diagram("great-outdoors-intelligence"),
    problem:
      "Where to go outside in Montana today, ranked by live conditions, not a wall of unrelated gauges.",
    whatItDoes:
      "A local pipeline collects river gauges, FWP closures, NWS forecasts, SNOTEL snowpack, fire perimeters, and avalanche zones into one versioned local bundle. A rule engine scores river reaches for fly fishing from flow, water temperature, and published restrictions, and every score carries its reasons and a confidence level. Snowpack, fire, and avalanche data show as map layers. More activities and offline trip bundles were designed but never built.",
    howItConnects:
      "A scheduled task or the Refresh button runs the collectors, each cache-aware and isolated so one failing source cannot sink the rest. They write a single SQLite bundle, and the rule engine writes its assessments back into it. A local Flask API reads only that bundle, never a source, and serves the React UI, which is there so a person can argue with the ranking. A separate daily script archives FWP closures.",
    whatWasHard:
      "More data is easy to display and hard to use on a trailhead. The work is turning several live feeds into one ranked recommendation you can inspect, and binding each reach to the right gauge, because a score read from the wrong gauge is worse than no score.",
  },
  {
    slug: "local-first-meeting-transcription",
    number: "09",
    title: "Local-First Meeting Transcription",
    description:
      "A meeting recorder that keeps the audio on the machine and transcribes it locally. Live transcription with Vosk, a refined pass with faster-whisper after the meeting, a review queue that reconciles the two, and structured notes written from the agreed transcript by whichever Ollama-compatible model you configure. FastAPI backend, React frontend.",
    reflection:
      "Two transcripts of the same audio disagree constantly. The review queue that reconciles them turned out to be the product, not the models.",
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
      "The models were the obvious part. Two transcripts of the same audio disagree constantly, and the product became the review queue that makes a person resolve that, not another model that pretends the conflict is gone.",
  },
];

export function getProjects(): Project[] {
  return projects;
}

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}
