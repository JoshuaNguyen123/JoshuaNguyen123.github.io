/**
 * Architecture diagrams, drawn from one spec per project. The same layout
 * feeds the inline case-study diagram (components/work/ArchitectureDiagram)
 * and the static files in public/projects/ (scripts/draw-architecture-diagrams.mjs),
 * so the two never drift. Plain boxes, hairlines, and one accent path.
 */

export const CANVAS = { width: 1200, height: 900 } as const;
// Match the page's alpine tokens, including the downloadable SVG versions.
export const INK = "#192c32";
export const MUTED = "#526460";
export const RULE = "#b6c3ba";
export const PAPER = "#f7f8f5";
export const ACCENT = "#315e55";
export const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
export const MONO = "ui-monospace, Menlo, Consolas, monospace";

const TITLE_SIZE = 32;
const SUB_SIZE = 21;
const LABEL_SIZE = 19;

type Side = "l" | "r" | "t" | "b";

interface NodeSpec {
  id: string;
  cx: number;
  cy: number;
  title: string;
  sub?: string[];
  w?: number;
  h?: number;
  /** key: the node the system turns on. side: optional, off the main path. */
  variant?: "key" | "side";
}

interface EdgeSpec {
  from: string;
  to: string;
  fs?: Side;
  ts?: Side;
  /** Offset along the side, from its centre. */
  fo?: number;
  to2?: number;
  label?: string;
  /** The main path through the system. */
  main?: boolean;
  /** Optional or out-of-band connections. */
  dashed?: boolean;
}

interface BoundarySpec { x: number; y: number; w: number; h: number; label: string }
interface NoteSpec { x: number; y: number; lines: string[] }

export interface DiagramSpec {
  title: string;
  description: string;
  boundaries?: BoundarySpec[];
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  notes?: NoteSpec[];
}

export interface DrawnNode { x: number; y: number; w: number; h: number; title: string; sub: string[]; variant?: "key" | "side" }
export interface DrawnEdge {
  d: string;
  arrow: string;
  main: boolean;
  dashed: boolean;
  label?: { x: number; y: number; w: number; text: string };
}
export interface Drawing {
  title: string;
  description: string;
  boundaries: BoundarySpec[];
  nodes: DrawnNode[];
  edges: DrawnEdge[];
  notes: NoteSpec[];
}

type Point = [number, number];

function nodeBox(node: NodeSpec): DrawnNode {
  const sub = node.sub ?? [];
  const textWidth = Math.max(node.title.length * 17, ...sub.map((line) => line.length * 13));
  const w = node.w ?? Math.ceil((textWidth + 64) / 10) * 10;
  const h = node.h ?? 84 + sub.length * 30;
  return { x: node.cx - w / 2, y: node.cy - h / 2, w, h, title: node.title, sub, variant: node.variant };
}

function anchor(box: DrawnNode, side: Side, offset = 0): Point {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (side === "l") return [box.x, cy + offset];
  if (side === "r") return [box.x + box.w, cy + offset];
  if (side === "t") return [cx + offset, box.y];
  return [cx + offset, box.y + box.h];
}

const horizontal = (side: Side) => side === "l" || side === "r";

function route(p0: Point, p1: Point, fs: Side, ts: Side): Point[] {
  if (p0[0] === p1[0] || p0[1] === p1[1]) return [p0, p1];
  if (horizontal(fs) && horizontal(ts)) {
    const mx = Math.round((p0[0] + p1[0]) / 2);
    return [p0, [mx, p0[1]], [mx, p1[1]], p1];
  }
  if (!horizontal(fs) && !horizontal(ts)) {
    const my = Math.round((p0[1] + p1[1]) / 2);
    return [p0, [p0[0], my], [p1[0], my], p1];
  }
  return horizontal(fs) ? [p0, [p1[0], p0[1]], p1] : [p0, [p0[0], p1[1]], p1];
}

function arrowHead([x0, y0]: Point, [x1, y1]: Point): string {
  const length = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / length;
  const uy = (y1 - y0) / length;
  const back: Point = [x1 - ux * 14, y1 - uy * 14];
  const left: Point = [back[0] - uy * 7, back[1] + ux * 7];
  const right: Point = [back[0] + uy * 7, back[1] - ux * 7];
  return `M ${x1} ${y1} L ${left[0]} ${left[1]} L ${right[0]} ${right[1]} Z`;
}

function defaultSides(a: DrawnNode, b: DrawnNode): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ["r", "l"] : ["l", "r"];
  return dy >= 0 ? ["b", "t"] : ["t", "b"];
}

export function layoutDiagram(spec: DiagramSpec): Drawing {
  const boxes = new Map(spec.nodes.map((node) => [node.id, nodeBox(node)]));
  const edges = spec.edges.map((edge): DrawnEdge => {
    const a = boxes.get(edge.from);
    const b = boxes.get(edge.to);
    if (!a || !b) throw new Error(`Unknown node in edge ${edge.from} -> ${edge.to}`);
    const [fs, ts] = [edge.fs ?? defaultSides(a, b)[0], edge.ts ?? defaultSides(a, b)[1]];
    const points = route(anchor(a, fs, edge.fo), anchor(b, ts, edge.to2), fs, ts);
    // Stop the line where the arrowhead begins so the tip lands on the box edge.
    const end = points[points.length - 1];
    const before = points[points.length - 2];
    const d = points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
    let label: DrawnEdge["label"];
    if (edge.label) {
      let best = 0;
      for (let index = 1; index < points.length - 1; index += 1) {
        const span = (i: number) => Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
        if (span(index) > span(best)) best = index;
      }
      const [sx, sy] = points[best];
      const [ex, ey] = points[best + 1];
      label = { x: (sx + ex) / 2, y: (sy + ey) / 2, w: edge.label.length * 11.6 + 20, text: edge.label };
    }
    return { d, arrow: arrowHead(before, end), main: Boolean(edge.main), dashed: Boolean(edge.dashed), label };
  });
  return {
    title: spec.title,
    description: spec.description,
    boundaries: spec.boundaries ?? [],
    nodes: [...boxes.values()],
    edges,
    notes: spec.notes ?? [],
  };
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Text positions shared by both renderers. */
export function nodeText(node: DrawnNode) {
  return {
    title: { x: node.x + 28, y: node.y + 50 },
    sub: node.sub.map((line, index) => ({ x: node.x + 28, y: node.y + 50 + 34 + index * 30, line })),
  };
}

export const sizes = { title: TITLE_SIZE, sub: SUB_SIZE, label: LABEL_SIZE } as const;

/** The static file: same drawing, standalone, with system font stacks. */
export function drawingToSvg(drawing: Drawing, id: string): string {
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" role="img" aria-labelledby="${id}-title ${id}-desc">`);
  out.push(`  <title id="${id}-title">${escape(drawing.title)}</title>`);
  out.push(`  <desc id="${id}-desc">${escape(drawing.description)}</desc>`);
  out.push(`  <rect width="${CANVAS.width}" height="${CANVAS.height}" fill="${PAPER}"/>`);
  for (const b of drawing.boundaries) {
    out.push(`  <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${RULE}" stroke-width="2" stroke-dasharray="8 8"/>`);
    out.push(`  <text x="${b.x + 22}" y="${b.y + 36}" fill="${MUTED}" font-family="${MONO}" font-size="${LABEL_SIZE}">${escape(b.label)}</text>`);
  }
  for (const e of drawing.edges) {
    const color = e.main ? ACCENT : INK;
    out.push(`  <path d="${e.d}" fill="none" stroke="${e.dashed ? MUTED : color}" stroke-width="${e.main ? 3 : 2}"${e.dashed ? ' stroke-dasharray="6 7"' : ""}/>`);
    out.push(`  <path d="${e.arrow}" fill="${e.dashed ? MUTED : color}"/>`);
    if (e.label) {
      out.push(`  <rect x="${e.label.x - e.label.w / 2}" y="${e.label.y - 17}" width="${e.label.w}" height="34" fill="${PAPER}"/>`);
      out.push(`  <text x="${e.label.x}" y="${e.label.y + 6}" text-anchor="middle" fill="${MUTED}" font-family="${MONO}" font-size="${LABEL_SIZE}">${escape(e.label.text)}</text>`);
    }
  }
  for (const n of drawing.nodes) {
    const text = nodeText(n);
    const stroke = n.variant === "key" ? ACCENT : n.variant === "side" ? RULE : INK;
    out.push(`  <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${PAPER}" stroke="${stroke}" stroke-width="${n.variant === "key" ? 3 : 2}"${n.variant === "side" ? ' stroke-dasharray="8 6"' : ""}/>`);
    out.push(`  <text x="${text.title.x}" y="${text.title.y}" fill="${n.variant === "side" ? MUTED : INK}" font-family="${SANS}" font-size="${TITLE_SIZE}" font-weight="500">${escape(n.title)}</text>`);
    for (const s of text.sub) out.push(`  <text x="${s.x}" y="${s.y}" fill="${MUTED}" font-family="${MONO}" font-size="${SUB_SIZE}">${escape(s.line)}</text>`);
  }
  for (const note of drawing.notes) {
    note.lines.forEach((line, index) => {
      out.push(`  <text x="${note.x}" y="${note.y + index * 30}" fill="${MUTED}" font-family="${MONO}" font-size="${SUB_SIZE}">${escape(line)}</text>`);
    });
  }
  out.push("</svg>");
  return `${out.join("\n")}\n`;
}

// ---- One spec per project. Coordinates are box centres on a 1200 x 900 canvas. ----

export const diagrams: Record<string, DiagramSpec> = {
  "obsidian-research-agent": {
    title: "Obsidian Research Agent architecture",
    description: "A mission starts in the console, reads the vault, and becomes a durable plan. Tools run in a sandbox only after an approval gate, and results are written back as sourced notes with a receipt per step. The companion service, Linear, and GitHub sit behind capability gates, off the default path.",
    boundaries: [{ x: 40, y: 600, w: 1120, h: 240, label: "Capability gates · off by default" }],
    nodes: [
      { id: "console", cx: 210, cy: 170, title: "Console", sub: ["starts a mission"] },
      { id: "vault", cx: 600, cy: 170, title: "Vault", sub: ["reads context"] },
      { id: "plan", cx: 990, cy: 170, title: "Plan", sub: ["durable, followed"] },
      { id: "gate", cx: 990, cy: 420, title: "Approval gate", variant: "key", sub: ["before every tool"] },
      { id: "sandbox", cx: 600, cy: 420, title: "Sandbox", sub: ["tools execute"] },
      { id: "notes", cx: 210, cy: 420, title: "Notes", sub: ["sourced", "receipt per step"] },
      { id: "companion", cx: 230, cy: 730, title: "Companion", variant: "side", sub: ["local service"] },
      { id: "linear", cx: 600, cy: 730, title: "Linear", variant: "side", sub: ["issues"] },
      { id: "github", cx: 970, cy: 730, title: "GitHub", variant: "side", sub: ["code work"] },
    ],
    edges: [
      { from: "console", to: "vault", main: true },
      { from: "vault", to: "plan", main: true },
      { from: "plan", to: "gate", main: true },
      { from: "gate", to: "sandbox", main: true, label: "approved" },
      { from: "sandbox", to: "notes", main: true, label: "writes" },
      { from: "gate", to: "github", fs: "b", ts: "t", fo: -20, to2: 0, dashed: true, label: "opt-in" },
      { from: "sandbox", to: "linear", dashed: true },
      { from: "sandbox", to: "companion", fs: "b", ts: "t", fo: -60, dashed: true },
    ],
  },

  ladybug: {
    title: "Ladybug architecture",
    description: "One shared space for two people, built on three hosts: a deterministic dual-phone simulator, a Supabase PWA with row-level security, private storage, and realtime state, and the earlier SwiftUI and Firebase app. Self-hosted CI checks migrations, a three-account journey, Chromium runs, and the iOS handoff.",
    boundaries: [{ x: 40, y: 600, w: 1120, h: 250, label: "Self-hosted CI" }],
    nodes: [
      { id: "space", cx: 600, cy: 140, title: "Shared space", variant: "key", sub: ["exactly two people"] },
      { id: "sim", cx: 220, cy: 400, title: "Simulator", sub: ["two phones", "no credentials"] },
      { id: "pwa", cx: 600, cy: 400, title: "PWA", sub: ["Supabase · RLS", "storage · realtime"] },
      { id: "native", cx: 980, cy: 400, title: "Native app", sub: ["SwiftUI · Firebase", "earlier host"] },
      { id: "migrations", cx: 185, cy: 750, w: 250, title: "Migrations" },
      { id: "journey", cx: 455, cy: 750, w: 250, title: "3 accounts" },
      { id: "chromium", cx: 745, cy: 750, w: 250, title: "Chromium" },
      { id: "ios", cx: 1015, cy: 750, w: 250, title: "iOS handoff" },
    ],
    edges: [
      { from: "space", to: "sim", fs: "b", ts: "t", fo: -40 },
      { from: "space", to: "pwa", main: true, label: "primary host" },
      { from: "space", to: "native", fs: "b", ts: "t", fo: 40 },
      { from: "migrations", to: "pwa", fs: "t", ts: "b", fo: 40, to2: -40, dashed: true },
      { from: "journey", to: "pwa", fs: "t", ts: "b", dashed: true },
      { from: "chromium", to: "pwa", fs: "t", ts: "b", fo: -40, to2: 40, dashed: true },
      { from: "ios", to: "native", fs: "t", ts: "b", dashed: true },
    ],
  },

  "personal-ai-digest": {
    title: "Personal AI Digest architecture",
    description: "Two services that share only a knowledge store. Ingest collects sources and writes to SQLite or Postgres with pgvector. Delivery, fired by a Cloudflare Worker, retrieves from the store, generates a lesson with a citation for every sentence, and emails it twice a day. Either service can fail without stopping the other.",
    boundaries: [
      { x: 40, y: 60, w: 360, h: 470, label: "Ingest service" },
      { x: 800, y: 60, w: 360, h: 780, label: "Delivery service" },
    ],
    nodes: [
      { id: "sources", cx: 220, cy: 190, w: 300, title: "Sources", sub: ["reading, notes"] },
      { id: "ingest", cx: 220, cy: 420, w: 300, title: "Ingest", sub: ["chunk, embed"] },
      { id: "store", cx: 600, cy: 420, w: 240, title: "Knowledge", variant: "key", sub: ["SQLite or", "pgvector"] },
      { id: "worker", cx: 980, cy: 190, w: 300, title: "Worker cron", sub: ["Cloudflare"] },
      { id: "delivery", cx: 980, cy: 420, w: 300, title: "Retrieve", sub: ["from the store"] },
      { id: "generate", cx: 980, cy: 600, w: 300, title: "Generate", sub: ["cite every line"] },
      { id: "email", cx: 980, cy: 770, w: 300, h: 84, title: "Email, 2x daily" },
    ],
    edges: [
      { from: "sources", to: "ingest" },
      { from: "ingest", to: "store", main: true, label: "writes" },
      { from: "store", to: "delivery", main: true, label: "reads" },
      { from: "worker", to: "delivery", label: "fires" },
      { from: "delivery", to: "generate", main: true },
      { from: "generate", to: "email", main: true },
    ],
    notes: [{ x: 60, y: 640, lines: ["The services share only the store.", "If ingest stalls, mail still goes", "out from what is indexed."] }],
  },

  "teach-anything": {
    title: "Teach Anything architecture",
    description: "A deterministic learning loop. Learning history updates a memory model built on FSRS-5 forgetting curves and Bayesian mastery. Memory drives the scheduler, which picks the next session. Sessions ask source-cited questions and run code exercises in a sandbox, and the answers feed back into history. The same history always produces the same plan.",
    nodes: [
      { id: "history", cx: 250, cy: 170, title: "History", sub: ["every answer"] },
      { id: "memory", cx: 950, cy: 170, title: "Memory", sub: ["FSRS-5 curves", "Bayesian mastery"] },
      { id: "scheduler", cx: 950, cy: 450, title: "Scheduler", variant: "key", sub: ["deterministic"] },
      { id: "session", cx: 250, cy: 450, title: "Session", sub: ["what to study next"] },
      { id: "questions", cx: 250, cy: 730, title: "Questions", sub: ["cite a source"] },
      { id: "exercises", cx: 640, cy: 730, title: "Exercises", sub: ["run in a sandbox"] },
    ],
    edges: [
      { from: "history", to: "memory", main: true, label: "updates" },
      { from: "memory", to: "scheduler", main: true, label: "drives" },
      { from: "scheduler", to: "session", main: true, label: "picks" },
      { from: "session", to: "history", label: "answers" },
      { from: "session", to: "questions" },
      { from: "session", to: "exercises", fs: "b", ts: "t", fo: 60 },
    ],
    notes: [{ x: 850, y: 700, lines: ["Same history,", "same plan."] }],
  },

  "research-agent-platform": {
    title: "Research Agent Platform architecture",
    description: "A standalone desktop editor around the same agent core as the Obsidian plugin. The core is vendored at a pinned commit and reached through three typed seams. The Electron and CodeMirror 6 host owns the file tree, hunk-by-hunk review, and the Windows installer. Approved edits are written as ordinary notes, so Obsidian can open the same vault. Playwright journeys cover the whole loop.",
    boundaries: [
      { x: 400, y: 90, w: 400, h: 620, label: "Electron · CodeMirror 6" },
      { x: 40, y: 760, w: 1120, h: 100, label: "Playwright journeys cover the whole loop" },
    ],
    nodes: [
      { id: "core", cx: 190, cy: 420, w: 260, h: 460, title: "Agent core", sub: ["pinned commit"] },
      { id: "tree", cx: 600, cy: 220, w: 330, title: "File tree" },
      { id: "review", cx: 600, cy: 420, w: 330, title: "Hunk review", variant: "key", sub: ["before disk"] },
      { id: "installer", cx: 600, cy: 620, w: 330, title: "Installer", sub: ["Windows"] },
      { id: "vault", cx: 1010, cy: 420, w: 260, title: "Vault", sub: ["ordinary notes"] },
      { id: "obsidian", cx: 1010, cy: 620, w: 260, title: "Obsidian", variant: "side", sub: ["same files"] },
    ],
    edges: [
      { from: "core", to: "tree", fs: "r", ts: "l", fo: -200, label: "seam" },
      { from: "core", to: "review", main: true, label: "seam" },
      { from: "core", to: "installer", fs: "r", ts: "l", fo: 200, label: "seam" },
      { from: "review", to: "vault", main: true, label: "writes" },
      { from: "obsidian", to: "vault", dashed: true },
    ],
  },

  "autonomous-repository-template": {
    title: "Autonomous Repository Template architecture",
    description: "A repository protocol for coding agents. A human request opens a plan, the plan must pass a planning gate before implementation files change, and the work must clear its verification lane. Project memory is ordinary tracked files, so later agents and later protocol versions read the same state.",
    nodes: [
      { id: "request", cx: 210, cy: 170, title: "Request", sub: ["from a human"] },
      { id: "plan", cx: 600, cy: 170, title: "Plan" },
      { id: "gate", cx: 990, cy: 170, title: "Planning gate", variant: "key" },
      { id: "build", cx: 990, cy: 430, title: "Implement", sub: ["files change"] },
      { id: "verify", cx: 600, cy: 430, title: "Verify", sub: ["task's own lane"] },
      { id: "done", cx: 210, cy: 430, title: "Done" },
      { id: "memory", cx: 600, cy: 720, w: 1080, title: "Project memory", sub: ["tracked files · read by later agents and protocol versions"] },
    ],
    edges: [
      { from: "request", to: "plan", main: true },
      { from: "plan", to: "gate", main: true },
      { from: "gate", to: "build", main: true, label: "passes" },
      { from: "build", to: "verify", main: true },
      { from: "verify", to: "done", main: true, label: "clears" },
      { from: "plan", to: "memory", fs: "b", ts: "t", fo: 0, to2: 0, dashed: true },
      { from: "verify", to: "memory", fs: "b", ts: "t", fo: 60, to2: 60, dashed: true },
      { from: "done", to: "memory", fs: "b", ts: "t", to2: -390, dashed: true, label: "records" },
    ],
  },

  "engineering-activity-portfolio": {
    title: "Engineering Activity Portfolio architecture",
    description: "Collectors stay on the machine and reduce tool activity to dates and counts. A publish step writes the public snapshot. The static site reads that snapshot, draws the heatmaps, and polls the published feed for a newer day. Prompts, code, filenames, repositories, and raw IDs never leave the machine.",
    boundaries: [{ x: 40, y: 60, w: 520, h: 660, label: "This machine" }],
    nodes: [
      { id: "collect", cx: 300, cy: 200, w: 420, title: "Collectors", sub: ["Codex · Cursor", "Claude Code · GitHub"] },
      { id: "reduce", cx: 300, cy: 410, w: 420, title: "Daily counts", variant: "key", sub: ["dates and counts only"] },
      { id: "publish", cx: 300, cy: 610, w: 420, title: "Publish", sub: ["validated snapshot"] },
      { id: "snapshot", cx: 900, cy: 610, w: 380, title: "activity.json", sub: ["public feed"] },
      { id: "site", cx: 900, cy: 300, w: 380, title: "Static site", sub: ["heatmaps"] },
    ],
    edges: [
      { from: "collect", to: "reduce", main: true },
      { from: "reduce", to: "publish", main: true },
      { from: "publish", to: "snapshot", main: true, label: "publish" },
      { from: "snapshot", to: "site", fs: "t", ts: "b", fo: -80, to2: -80, label: "reads" },
      { from: "site", to: "snapshot", fs: "b", ts: "t", fo: 80, to2: 80, dashed: true, label: "polls" },
    ],
    notes: [{ x: 60, y: 790, lines: ["Never leaves the machine: prompts, code,", "filenames, repositories, raw IDs."] }],
  },

  "great-outdoors-intelligence": {
    title: "Great Outdoors Intelligence architecture",
    description: "Condition feeds (forecasts, river gauges, avalanche advisories, snowpack, road status, and fire data) are ingested and scored per activity. The scores feed a dashboard where a person can question the ranking, and separately produce trip bundles that work fully offline. Built on the autonomous repository template; in progress.",
    nodes: [
      { id: "feeds", cx: 200, cy: 420, w: 300, h: 520, title: "Feeds", sub: ["", "Forecasts", "River gauges", "Avalanche", "Snowpack", "Road status", "Fire data"] },
      { id: "ingest", cx: 520, cy: 420, w: 200, title: "Ingest" },
      { id: "score", cx: 770, cy: 420, w: 220, title: "Score", variant: "key", sub: ["per activity"] },
      { id: "dashboard", cx: 1010, cy: 260, w: 260, title: "Dashboard", sub: ["argue with it"] },
      { id: "offline", cx: 1010, cy: 580, w: 260, title: "Offline", sub: ["trip bundles"] },
    ],
    edges: [
      { from: "feeds", to: "ingest", main: true },
      { from: "ingest", to: "score", main: true },
      { from: "score", to: "dashboard", fs: "t", ts: "l", main: true },
      { from: "score", to: "offline", fs: "b", ts: "l", main: true },
    ],
    notes: [{ x: 60, y: 800, lines: ["Built on the autonomous repository template. In progress."] }],
  },

  "local-first-meeting-transcription": {
    title: "Local-First Meeting Transcription architecture",
    description: "Everything runs on the machine. The recorder keeps audio on disk. Vosk writes a live transcript during the meeting and faster-whisper writes a refined one afterward. A review queue reconciles the two, and only the agreed text goes to a local model that writes structured notes. FastAPI serves the backend and React the review UI.",
    boundaries: [{ x: 40, y: 60, w: 1120, h: 700, label: "This machine" }],
    nodes: [
      { id: "recorder", cx: 230, cy: 380, w: 300, title: "Recorder", sub: ["audio on disk"] },
      { id: "live", cx: 600, cy: 220, w: 320, title: "Live pass", sub: ["Vosk · during"] },
      { id: "refined", cx: 600, cy: 540, w: 320, title: "Refined pass", sub: ["faster-whisper", "after"] },
      { id: "review", cx: 970, cy: 380, w: 300, title: "Review", variant: "key", sub: ["reconcile both"] },
      { id: "notes", cx: 970, cy: 640, w: 300, title: "Notes", sub: ["local model"] },
    ],
    edges: [
      { from: "recorder", to: "live", fs: "r", ts: "l", fo: -30 },
      { from: "recorder", to: "refined", fs: "r", ts: "l", fo: 30 },
      { from: "live", to: "review", fs: "r", ts: "l", to2: -30, main: true },
      { from: "refined", to: "review", fs: "r", ts: "l", to2: 30, main: true },
      { from: "review", to: "notes", main: true, label: "agreed text" },
    ],
    notes: [{ x: 60, y: 820, lines: ["FastAPI backend · React review UI"] }],
  },
};
