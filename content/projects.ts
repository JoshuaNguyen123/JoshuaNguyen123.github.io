export interface Project {
  slug: string;
  number: string;
  title: string;
  description: string;
  reflection: string;
  discipline: string;
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

// Hardest first, judged by scope and the systems involved. The first
// FEATURED_PROJECTS get the full entry with a reflection; the rest render as
// compact cards underneath.
export const projects: Project[] = [
  {
    slug: "obsidian-research-agent",
    number: "01",
    title: "Obsidian Research Agent",
    description:
      "An Obsidian plugin that runs research missions inside a vault. It reads the vault for context, plans, uses approved tools, writes back to notes, and shows a receipt for every step. It also carries a bounded code workspace, gated Linear and GitHub integrations, and a companion service, with sandboxing, approval prompts, replay, and recovery when a step fails.",
    reflection:
      "Adding tools to an agent is the easy part. The hard part is making each one bounded and debuggable, so that when something goes wrong you can see exactly which call did it and run it again.",
    discipline: "TypeScript · Agent systems",
    href: "https://github.com/JoshuaNguyen123/Obsidian_research_agent",
    image: diagram("obsidian-research-agent"),
    problem:
      "Research that can read a vault, use real tools, and write back to notes, without hiding what the agent just did.",
    whatItDoes:
      "A desktop Obsidian plugin runs missions from a side console. It reads vault context, builds a durable plan, calls only approved tools, writes sourced notes, and keeps a receipt for every step. Code work, a local companion service, and Linear or GitHub stay behind capability gates so a research run does not get extra authority by default.",
    howItConnects:
      "A mission starts in the console, reads the vault, and becomes a plan the rest of the run has to follow. Tools execute in a sandbox after an approval gate. Successful work writes back to notes and leaves receipts that can be replayed. The companion, Linear, and GitHub sit on the side of that loop; they never become the default path.",
    whatWasHard:
      "Giving the agent more tools was easy. The work was making every tool bounded, previewable, and recoverable: sandboxing, exact approval prompts, replay after a failed step, and receipts that stay truthful when a page does not actually load.",
  },
  {
    slug: "ladybug",
    number: "02",
    title: "Ladybug",
    description:
      "A private photo and writing ritual for two people, built three ways: a deterministic product simulator that runs both phones side by side with no credentials, a Supabase-backed PWA with row-level security, private storage, and realtime state, and the original native SwiftUI and Firebase app. Verification covers the migrations, a three-account connected journey, Chromium end-to-end runs, and the iOS build handoff, all on self-hosted CI.",
    reflection:
      "Two phones, two accounts, uploads, notifications, and realtime state make even a two-person app a small distributed system. The simulator let me find the product mistakes before paying for cloud time.",
    discipline: "TypeScript · Swift · Supabase",
    href: null,
    image: diagram("ladybug"),
    problem:
      "A two-person photo and writing ritual that has to feel private, personal, and reliable on two phones at once.",
    whatItDoes:
      "Ladybug is a shared space for exactly two people: photos, short writing, and the small interactions that make a private ritual feel like a place. It was built three ways so the product could be proven before the cloud bill started: a deterministic simulator, a Supabase-backed PWA, and the original SwiftUI and Firebase app.",
    howItConnects:
      "The simulator runs both phones side by side with no credentials and is where product mistakes get found. The PWA keeps access control, private storage, and realtime state behind row-level security. The native app is the earlier host of the same ritual. Self-hosted CI checks migrations, a three-account journey, Chromium runs, and the iOS handoff.",
    whatWasHard:
      "A two-person app still has two accounts, two devices, uploads, notifications, and realtime state. The hard part was treating that as a small distributed system and using the simulator so I was not paying cloud time to discover basic product mistakes.",
  },
  {
    slug: "personal-ai-digest",
    number: "03",
    title: "Personal AI Digest",
    description:
      "A self-hosted RAG pipeline that emails me a grounded technical lesson twice a day, running since March. Ingestion and delivery are separate services that share only the knowledge store, which can be SQLite or Postgres with pgvector. A Cloudflare Worker fires each send on time, because GitHub's own scheduler drifts by hours.",
    reflection:
      "Requiring a citation for every generated sentence is what turned this from a toy into something I trust enough to study from. Keeping ingestion and delivery apart meant either side could fail without taking the other down.",
    discipline: "Python · RAG · Cloudflare Workers",
    href: null,
    image: diagram("personal-ai-digest"),
    problem:
      "A daily technical lesson I will actually study from, grounded in sources I already trust, delivered on time without a babysitter.",
    whatItDoes:
      "A self-hosted RAG pipeline emails a grounded lesson twice a day. It retrieves from a personal knowledge store, requires a citation for every generated sentence, and has been running since March. Ingestion and delivery are separate services. A Cloudflare Worker fires each send because GitHub's scheduler drifts by hours.",
    howItConnects:
      "Ingest writes into the knowledge store and stops there. Delivery reads from the same store, retrieves, generates, and sends. They share only SQLite or Postgres with pgvector. If ingest stalls, mail still goes out from what is already indexed. If delivery fails, ingest keeps collecting.",
    whatWasHard:
      "The model will invent a fluent lesson if you let it. Forcing a citation on every sentence, and splitting ingest from delivery so a failure on one side does not take the other down, is what made it something I would read.",
  },
  {
    slug: "teach-anything",
    number: "04",
    title: "Teach Anything",
    description:
      "An adaptive learning engine that plans each session from what the learner actually remembers. It combines FSRS-5 forgetting curves, Bayesian mastery estimates, and sandboxed code exercises on top of a deterministic core, so any schedule can be replayed against the learning history and checked. Every question cites its source.",
    reflection:
      "Getting a model to write a lesson takes an afternoon. Getting Tuesday's lesson to depend on what Monday showed, and being able to prove it, was the real product.",
    discipline: "TypeScript · Learning systems",
    href: null,
    image: diagram("teach-anything"),
    problem:
      "A lesson planner that remembers what Monday actually taught, instead of improvising a new syllabus every time someone opens the app.",
    whatItDoes:
      "Teach Anything plans each session from the learner's memory state. It combines FSRS-5 forgetting curves, Bayesian mastery estimates, and sandboxed code exercises. The core is deterministic: any schedule can be replayed against the learning history and checked. Every question cites its source.",
    howItConnects:
      "History updates memory. Memory drives the scheduler. The scheduler picks the next session. Generated questions and exercises have to cite a source, and code work runs in a sandbox. Because the core is deterministic, a later run with the same history has to produce the same plan.",
    whatWasHard:
      "Asking a model for a lesson is cheap. Making Tuesday depend on Monday, and proving the schedule adapted instead of improvised, meant putting the memory math and the replay harness at the center of the product.",
  },
  {
    slug: "research-agent-platform",
    number: "05",
    title: "Research Agent Platform",
    description:
      "A standalone desktop editor built around the same agent core as the plugin. Electron and CodeMirror 6, fully compatible with Obsidian vaults, with the agent's edits reviewed hunk by hunk before anything touches disk. The core is vendored at a pinned commit behind three typed seams rather than forked. It ships as a Windows installer, with Playwright journeys covering the whole loop.",
    reflection:
      "Vendoring the core instead of forking it kept one agent with two hosts. The typed seams are the whole contract, so a vendor bump that breaks one fails at compile time instead of in someone's vault.",
    discipline: "TypeScript · Electron · Desktop app",
    href: null,
    image: diagram("research-agent-platform"),
    problem:
      "The same research agent, hosted in a desktop editor that can review every edit before a vault file changes.",
    whatItDoes:
      "A standalone desktop editor runs the same agent core as the Obsidian plugin. Electron and CodeMirror 6 open ordinary vault folders. Agent edits are reviewed hunk by hunk before anything touches disk. It ships as a Windows installer, with Playwright journeys covering the whole loop.",
    howItConnects:
      "The agent core is vendored at a pinned commit and talked to through three typed seams. The editor host owns the file tree, the review UI, and the installer. A vault stays compatible with Obsidian because the host writes ordinary notes, not a private format.",
    whatWasHard:
      "Forking the core would have created two agents. Vendoring it behind typed seams keeps one agent with two hosts, and a vendor bump that breaks a seam fails at compile time instead of in someone's vault.",
  },
  {
    slug: "autonomous-repository-template",
    number: "06",
    title: "Autonomous Repository Template",
    description:
      "A repository protocol for coding agents. Project memory lives in tracked files, implementation is blocked behind a planning gate, every task carries a verification lane, and features enter only through a human request. Products are instantiated from it and can migrate to newer protocol versions without losing their own state.",
    reflection:
      "An agent with good memory and a gate it cannot skip does more useful work than a smarter agent with neither.",
    discipline: "Python · Agent workflows",
    href: null,
    image: diagram("autonomous-repository-template"),
    problem:
      "A coding agent that can keep project memory, but cannot start implementing until a human-approved plan exists.",
    whatItDoes:
      "A repository protocol for coding agents. Project memory lives in tracked files. Implementation is blocked behind a planning gate. Every task has a verification lane. Features enter only through a human request. Products instantiated from the template can migrate to newer protocol versions without losing their own state.",
    howItConnects:
      "A human request opens a plan. The plan has to pass the gate before implementation files change. Work then has to clear its verification lane. Memory is ordinary tracked files, so a later agent, or a later protocol version, can read the same state.",
    whatWasHard:
      "The useful part was not a smarter model. It was memory the agent cannot drop and a gate it cannot skip, so work only starts when the request, the plan, and the check are all in the repository.",
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
      "Ranks outdoor destinations in Montana by live conditions instead of showing a wall of gauges. It pulls forecasts, river gauges, avalanche advisories, snowpack, road status, and fire data, scores places per activity, and prepares trip bundles that work fully offline. In progress, built on the repository template above.",
    reflection:
      "The product is the ranking. The dashboard exists so you can argue with it.",
    discipline: "Python · Data pipelines",
    href: null,
    image: diagram("great-outdoors-intelligence"),
    problem:
      "Where to go outside in Montana today, ranked by live conditions, not a wall of unrelated gauges.",
    whatItDoes:
      "An in-progress pipeline pulls forecasts, river gauges, avalanche advisories, snowpack, road status, and fire data, then scores destinations per activity. It also prepares trip bundles that work fully offline. It is built on the autonomous repository template.",
    howItConnects:
      "Ingest collects condition feeds. A scoring step ranks places for an activity. The dashboard is there so a person can argue with the ranking. Offline bundles are a separate output from the same scores, so a trip does not need a signal once it has left the house.",
    whatWasHard:
      "More data is easy to display and hard to use on a trailhead. The work is turning several live feeds into one ranked recommendation, then making that recommendation something you can inspect and take offline.",
  },
  {
    slug: "local-first-meeting-transcription",
    number: "09",
    title: "Local-First Meeting Transcription",
    description:
      "A meeting recorder that never leaves the machine. Live transcription with Vosk, a refined pass with faster-whisper after the meeting, a review queue that reconciles the two, and structured notes from a local model. FastAPI backend, React frontend.",
    reflection:
      "Two transcripts of the same audio disagree constantly. The review queue that reconciles them turned out to be the product, not the models.",
    discipline: "Python · TypeScript · Speech",
    href: null,
    image: diagram("local-first-meeting-transcription"),
    problem:
      "Meeting notes that never leave the machine, and a way to deal with the fact that two local transcripts will not agree.",
    whatItDoes:
      "A local recorder captures the meeting, transcribes live with Vosk, then runs a refined pass with faster-whisper. A review queue reconciles the two transcripts. A local model turns the agreed text into structured notes. FastAPI serves the backend; React is the review UI.",
    howItConnects:
      "Audio stays on disk. The live model writes a first transcript during the meeting. Afterward a second model writes a refined transcript. The review queue is the place those two are reconciled. Only the agreed text is sent to the local notes model.",
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
