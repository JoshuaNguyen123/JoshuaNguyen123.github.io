import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import { FlyFishingScene } from "./FlyFishingScene";
import styles from "./PersonalIntro.module.css";

export function PersonalIntro() {
  return (
    <section className={styles.section} aria-labelledby="profile-title">
      <FlyFishingScene />
      <h2 id="profile-title">Trace an idea to its source.</h2>
      <ol className={styles.trace} aria-label="How the research graph connects ideas">
        <li>Research note</li>
        <li>Connected idea</li>
        <li>Source excerpt</li>
      </ol>
      <Link href="/work/research-agent-platform/">Research Agent Platform <ArrowUpRight aria-hidden="true" /></Link>
    </section>
  );
}
