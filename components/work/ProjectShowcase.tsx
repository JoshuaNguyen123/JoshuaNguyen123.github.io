"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import type { Project } from "@/content/projects";
import styles from "./ProjectShowcase.module.css";

const walkthroughs = {
  "obsidian-research-agent": {
    tab: "Research",
    headline: "From a question to a sourced note.",
    introduction: "An Obsidian research agent that turns vault context into a plan, runs approved tools, and leaves a record of its work.",
    steps: [
      { label: "Plan", title: "Start with the context.", description: "The agent reads relevant vault notes and creates a durable plan before running the mission.", input: "Research question + vault notes", output: "A plan with bounded steps" },
      { label: "Approve", title: "Keep the tools accountable.", description: "Capability gates and a sandbox constrain tool use. Approvals keep sensitive actions under the user's control.", input: "Planned tool calls", output: "Approved, bounded execution" },
      { label: "Trace", title: "Leave work you can follow.", description: "Sourced notes and tool receipts make the result inspectable. A failed step can be replayed without starting over.", input: "Sources + execution receipts", output: "Sourced notes in Obsidian" },
    ],
  },
  ladybug: {
    tab: "Ladybug",
    headline: "A private space, built for two.",
    introduction: "A shared home for photos and writing, with a simulator that exercises both phones before changes reach the connected app.",
    steps: [
      { label: "Simulate", title: "See both sides together.", description: "A deterministic simulator runs the two-person experience side by side, without needing credentials or cloud services.", input: "Two people's actions", output: "A repeatable shared journey" },
      { label: "Connect", title: "Give the pair a shared home.", description: "The connected web app uses Supabase for shared state, private photo storage, and realtime updates.", input: "Photos + writing", output: "Updates across both devices" },
      { label: "Protect", title: "Keep the space private.", description: "Row-level policies and private storage restrict access. A three-account test checks the boundary around the pair.", input: "The pair + an outside account", output: "A tested privacy boundary" },
    ],
  },
  "personal-ai-digest": {
    tab: "AI digest",
    headline: "Turn a reading backlog into lessons.",
    introduction: "A self-hosted learning pipeline that retrieves source material, generates grounded lessons, and delivers them on a schedule.",
    steps: [
      { label: "Ingest", title: "Build the knowledge base.", description: "Source material enters a shared knowledge store. Ingestion runs separately from the lesson-delivery process.", input: "Technical source material", output: "A searchable knowledge base" },
      { label: "Ground", title: "Make every sentence traceable.", description: "Retrieval provides the material for each lesson. Generation attaches citations to every generated sentence.", input: "Retrieved source passages", output: "A lesson with citations" },
      { label: "Deliver", title: "Make learning a routine.", description: "A Cloudflare Worker schedules delivery twice a day. The separate pipeline keeps delivery isolated from ingestion failures.", input: "A source-grounded lesson", output: "A scheduled email digest" },
    ],
  },
};

export function ProjectShowcase({ projects }: { projects: Pick<Project, "slug" | "number" | "title" | "discipline">[] }) {
  const [selected, setSelected] = useState(0);
  const [steps, setSteps] = useState<Record<string, number>>({});
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % projects.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + projects.length) % projects.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = projects.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.showcase}>
      <div className={styles.tabs} role="tablist" aria-label="Selected projects">
        {projects.map((project, index) => (
          <button key={project.slug} ref={(node) => { tabs.current[index] = node; }} type="button" role="tab" id={`tab-${project.slug}`} aria-controls={`panel-${project.slug}`} aria-selected={index === selected} tabIndex={index === selected ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => onTabKeyDown(event, index)}>
            <span className={styles.tabNumber} aria-hidden="true">{project.number}</span>
            {walkthroughs[project.slug as keyof typeof walkthroughs].tab}
          </button>
        ))}
      </div>

      {projects.map((project, index) => {
        const walkthrough = walkthroughs[project.slug as keyof typeof walkthroughs];
        const stepIndex = steps[project.slug] ?? 0;
        const step = walkthrough.steps[stepIndex];
        const selectStep = (next: number) => setSteps((current) => ({ ...current, [project.slug]: next }));

        return (
          <div key={project.slug} id={`panel-${project.slug}`} role="tabpanel" aria-labelledby={`tab-${project.slug}`} hidden={selected !== index} className={styles.projectPanel} tabIndex={0}>
            <div className={styles.story}>
              <span className={styles.discipline}>{project.discipline}</span>
              <h3>{project.title}</h3>
              <p>{walkthrough.introduction}</p>
              <a className={styles.caseLink} href={`/work/${project.slug}/`}>Read the case study<ArrowRightIcon size={20} aria-hidden="true" /></a>
            </div>

            <section className={styles.walkthrough} aria-label={`${project.title} interactive walkthrough`}>
              <div className={styles.walkthroughHeader}><span>Interactive walkthrough</span><span aria-hidden="true">{String(stepIndex + 1).padStart(2, "0")} / 03</span></div>
              <p className={styles.walkthroughTitle}>{walkthrough.headline}</p>
              <div className={styles.steps} role="group" aria-label="Walkthrough steps">
                {walkthrough.steps.map((item, itemIndex) => (
                  <button key={item.label} type="button" aria-pressed={itemIndex === stepIndex} onClick={() => selectStep(itemIndex)}>
                    <span aria-hidden="true">{String(itemIndex + 1).padStart(2, "0")}</span>{item.label}
                  </button>
                ))}
              </div>
              <div className={styles.stepContent} aria-live="polite" aria-atomic="true">
                <div key={stepIndex} className={styles.stepDetail}>
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                  <dl className={styles.transformation}>
                    <div><dt>From</dt><dd>{step.input}</dd></div>
                    <ArrowRightIcon size={20} aria-hidden="true" />
                    <div><dt>To</dt><dd>{step.output}</dd></div>
                  </dl>
                </div>
              </div>
              <button className={styles.nextStep} type="button" onClick={() => selectStep((stepIndex + 1) % walkthrough.steps.length)}>{stepIndex === walkthrough.steps.length - 1 ? "Back to the start" : `Next: ${walkthrough.steps[stepIndex + 1].label}`}<ArrowRightIcon size={20} aria-hidden="true" /></button>
            </section>
          </div>
        );
      })}
    </div>
  );
}
