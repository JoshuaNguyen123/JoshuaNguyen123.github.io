import Link from "next/link";
import styles from "./PersonalIntro.module.css";

/** Two sentences on what I build and what is on the bench, linked to that project. Set inside the opening landscape. */
export function PersonalIntro() {
  return (
    <p className={styles.lead}>
      I build AI agents and the software around them. Right now I’m building a{" "}
      <Link href="/work/research-agent-platform/">desktop research workspace</Link> where the agent’s edits can wait for review before they touch a file.
    </p>
  );
}
