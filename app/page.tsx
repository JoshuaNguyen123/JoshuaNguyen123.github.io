import { ActivityDashboard } from "@/components/activity/ActivityDashboard";
import { getActivityDashboard } from "@/lib/activity/service.ts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const activity = await getActivityDashboard(`${year}-01-01`, today);

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Josh B. home">
          JB<span>/</span>26
        </a>
        <nav aria-label="Primary navigation">
          <a href="#activity">Activity</a>
          <a href="#work">Work</a>
          <a href="#contact">Contact</a>
        </nav>
        <span className="header-status"><i /> Available for thoughtful work</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-index" aria-hidden="true">01</div>
        <div className="hero-copy">
          <span className="eyebrow">Josh B. · Systems engineer</span>
          <h1>Software that thinks.<br />Systems that prove it.</h1>
          <p>
            I build reliable agentic tools, private-by-default products, and the
            infrastructure that makes ambitious software accountable.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#activity">Explore build activity <span>↘</span></a>
            <span>Denver · Mountain Time</span>
          </div>
        </div>
        <div className="hero-signal" aria-label="Current focus areas">
          <span>Current signal</span>
          <strong>Agentic systems</strong>
          <strong>Product engineering</strong>
          <strong>Developer infrastructure</strong>
        </div>
      </section>

      <section className="activity-section" id="activity">
        <ActivityDashboard initialData={activity} />
      </section>

      <section className="work-section" id="work">
        <div className="section-heading">
          <span className="eyebrow">Selected systems / 03</span>
          <h2>Work built around<br />clear proof boundaries.</h2>
        </div>
        <div className="work-list">
          <article>
            <span>01</span>
            <div><h3>Agentic research systems</h3><p>Resumable workflows, bounded tool access, source receipts, and observable completion.</p></div>
            <strong>AI / Knowledge</strong>
          </article>
          <article>
            <span>02</span>
            <div><h3>Private product infrastructure</h3><p>Native-first experiences with explicit privacy contracts and testable service boundaries.</p></div>
            <strong>Product / Systems</strong>
          </article>
          <article>
            <span>03</span>
            <div><h3>Applied automation</h3><p>Operational data pipelines, intelligence digests, and dashboards designed for action.</p></div>
            <strong>Data / Automation</strong>
          </article>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <span className="eyebrow">Start a conversation / 04</span>
        <h2>Complex problem.<br />Clear next move.</h2>
        <p>Interested in reliable AI systems, applied automation, or ambitious product engineering? Let’s compare notes.</p>
        <a href="#top">Back to top <span>↑</span></a>
      </section>

      <footer>
        <span>© {new Date().getFullYear()} Josh B.</span>
        <span>Designed as an observable system.</span>
      </footer>
    </main>
  );
}
