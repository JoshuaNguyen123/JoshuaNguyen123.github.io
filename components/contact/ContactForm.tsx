"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const CONTACT_API_URL = process.env.NEXT_PUBLIC_CONTACT_API_URL ?? "";
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "";
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
// Web3Forms' shared hCaptcha site key, used only by the direct fallback below.
const WEB3FORMS_HCAPTCHA_SITE_KEY = "50b2fe65-b00b-4b9e-ad62-3ba471098be2";
const HCAPTCHA_SCRIPT = "https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off&onload=onPortfolioCaptchaReady";

// Submissions go through the worker, which verifies the captcha server-side,
// as soon as both public values are configured. Until then the form keeps
// posting directly to Web3Forms exactly as it always has. The fallback exists
// so that migrating the backend can never take the contact form off the site:
// switching the two paths is a deployment step, not a code change.
const usesWorker = Boolean(CONTACT_API_URL && HCAPTCHA_SITE_KEY);
const siteKey = usesWorker ? HCAPTCHA_SITE_KEY : WEB3FORMS_HCAPTCHA_SITE_KEY;
const isConfigured = usesWorker || Boolean(WEB3FORMS_KEY);

type Status = "idle" | "sending" | "sent" | "error";
type CaptchaStatus = "waiting" | "loading" | "ready" | "error";
type CaptchaApi = {
  render: (container: HTMLElement, options: {
    sitekey: string; theme: string; size: string;
    callback: () => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
  getResponse: (id: string) => string;
};

declare global {
  interface Window {
    hcaptcha?: CaptchaApi;
    onPortfolioCaptchaReady?: () => void;
  }
}

let captchaApi: Promise<CaptchaApi> | null = null;

// Keep the SDK across navigations, but render a fresh widget for each mounted
// form. A rejected load is discarded so Retry can recover without a refresh.
function loadCaptchaApi() {
  if (captchaApi) return captchaApi;
  captchaApi = new Promise<CaptchaApi>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.remove();
      captchaApi = null;
      reject(new Error("Captcha could not load"));
    };
    const timeout = window.setTimeout(fail, 15_000);
    window.onPortfolioCaptchaReady = () => {
      if (settled) return;
      if (!window.hcaptcha) { fail(); return; }
      settled = true;
      window.clearTimeout(timeout);
      resolve(window.hcaptcha);
    };
    script.src = HCAPTCHA_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onerror = fail;
    document.body.appendChild(script);
  });
  return captchaApi;
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [captchaStatus, setCaptchaStatus] = useState<CaptchaStatus>("waiting");
  const formRef = useRef<HTMLFormElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const retryCaptchaRef = useRef<() => void>(() => {});
  const submissionRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const form = formRef.current;
    const container = captchaRef.current;
    if (!isConfigured || !form || !container) return;
    let disposed = false;
    let loading = false;
    const captchaError = () => {
      if (disposed || submissionRef.current) return;
      setCaptchaStatus("error");
      setStatus("error");
      setMessage("The captcha is unavailable. Try loading it again, or reach me on LinkedIn above. Your draft is still here.");
    };
    const loadCaptcha = () => {
      if (loading || widgetRef.current !== null) return;
      observer.disconnect();
      form.removeEventListener("focusin", loadCaptcha);
      loading = true;
      setCaptchaStatus("loading");
      void loadCaptchaApi().then((api) => {
        if (disposed) return;
        widgetRef.current = api.render(container, {
          sitekey: siteKey, theme: "light", size: "compact",
          callback: () => {
            if (disposed || submissionRef.current) return;
            setCaptchaStatus("ready");
            setStatus("idle");
            setMessage("");
          },
          "expired-callback": () => {
            if (disposed || submissionRef.current) return;
            setStatus("error");
            setMessage("The captcha expired. Please complete it again. Your draft is still here.");
          },
          "error-callback": captchaError,
        });
        setCaptchaStatus("ready");
      }).catch(captchaError).finally(() => { loading = false; });
    };
    retryCaptchaRef.current = () => {
      if (widgetRef.current !== null) {
        window.hcaptcha?.remove(widgetRef.current);
        widgetRef.current = null;
      }
      setStatus("idle");
      setMessage("");
      loadCaptcha();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { loadCaptcha(); observer.disconnect(); }
    }, { rootMargin: "600px" });
    observer.observe(form);
    form.addEventListener("focusin", loadCaptcha);
    return () => {
      disposed = true;
      observer.disconnect();
      form.removeEventListener("focusin", loadCaptcha);
      submissionRef.current?.abort();
      if (widgetRef.current !== null) {
        window.hcaptcha?.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isConfigured || submissionRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);

    const captchaToken = widgetRef.current === null ? "" : window.hcaptcha?.getResponse(widgetRef.current);
    if (typeof captchaToken !== "string" || !captchaToken) {
      setStatus("error");
      setMessage("Please finish the captcha first.");
      return;
    }
    if (data.get("botcheck")) return; // honeypot

    setStatus("sending");
    setMessage("");
    const controller = new AbortController();
    submissionRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      // Only the explicitly named fields are sent on either path, so the
      // honeypot and any injected control never ride along.
      const fields = { name: data.get("name"), email: data.get("email"), message: data.get("message") };
      const response = await fetch(usesWorker ? CONTACT_API_URL : "https://api.web3forms.com/submit", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(usesWorker ? { ...fields, captchaToken } : {
          access_key: WEB3FORMS_KEY,
          subject: "New message from joshuanguyen123.github.io",
          from_name: "Portfolio contact form",
          ...fields,
          "h-captcha-response": captchaToken,
        }),
      });
      const result = (await response.json()) as { sent?: boolean; success?: boolean; error?: string; message?: string };
      const delivered = usesWorker ? result.sent : result.success;
      if (!response.ok || !delivered) throw new Error(result.error || result.message || "Submission failed");
      setStatus("sent");
      setMessage("Thanks. Your note is on its way.");
      form.reset();
      if (widgetRef.current !== null) window.hcaptcha?.reset(widgetRef.current);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.name === "AbortError"
        ? "Delivery could not be confirmed. Your draft is still here. You can also reach me on LinkedIn above."
        : "Your message could not be sent. Your draft is still here; please finish the captcha and try again.");
      if (widgetRef.current !== null) window.hcaptcha?.reset(widgetRef.current);
    } finally {
      window.clearTimeout(timeout);
      submissionRef.current = null;
    }
  }

  return (
    <form className="contact-form" data-contact-configured={isConfigured} method="post" ref={formRef} onSubmit={onSubmit} aria-label="Contact Joshua" aria-busy={status === "sending"}>
      <input type="checkbox" name="botcheck" className="contact-honeypot" tabIndex={-1} aria-hidden="true" />

      <div className="contact-fields">
        <label>
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" maxLength={120} required />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" maxLength={320} required />
        </label>
      </div>
      <label>
        <span>Message</span>
        <textarea name="message" rows={5} maxLength={10_000} required />
      </label>

      {isConfigured ? <div className="h-captcha" ref={captchaRef} data-sitekey={siteKey} data-theme="light" data-size="compact" aria-busy={captchaStatus === "loading"} /> : null}
      {captchaStatus === "loading" ? <p role="status">Loading captcha…</p> : null}
      {captchaStatus === "error" ? <button type="button" onClick={() => retryCaptchaRef.current()}>Retry captcha</button> : null}
      <noscript><p>Enable JavaScript to send a message, or reach me on LinkedIn above.</p></noscript>

      <div className="contact-submit">
        <button className="primary-button" type="submit" disabled={!isConfigured || status === "sending"}>
          {status === "sending" ? "Sending" : "Send message"}
        </button>
        <p role="status" aria-live="polite" className={status === "error" ? "is-error" : undefined}>
          {isConfigured ? message : "This preview cannot send messages. You can reach me on LinkedIn above."}
        </p>
      </div>
    </form>
  );
}
