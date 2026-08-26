"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const CONTACT_API_URL = process.env.NEXT_PUBLIC_CONTACT_API_URL ?? "";
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "";
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
// Web3Forms' shared hCaptcha site key, used only by the direct fallback below.
const WEB3FORMS_HCAPTCHA_SITE_KEY = "50b2fe65-b00b-4b9e-ad62-3ba471098be2";
const HCAPTCHA_SCRIPT = "https://js.hcaptcha.com/1/api.js";

// Submissions go through the worker, which verifies the captcha server-side,
// as soon as both public values are configured. Until then the form keeps
// posting directly to Web3Forms exactly as it always has. The fallback exists
// so that migrating the backend can never take the contact form off the site:
// switching the two paths is a deployment step, not a code change.
const usesWorker = Boolean(CONTACT_API_URL && HCAPTCHA_SITE_KEY);
const siteKey = usesWorker ? HCAPTCHA_SITE_KEY : WEB3FORMS_HCAPTCHA_SITE_KEY;
const isConfigured = usesWorker || Boolean(WEB3FORMS_KEY);

type Status = "idle" | "sending" | "sent" | "error";

declare global {
  interface Window {
    hcaptcha?: { reset: (id?: string) => void };
  }
}

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isConfigured || document.querySelector(`script[src="${HCAPTCHA_SCRIPT}"]`)) return;
    const script = document.createElement("script");
    script.src = HCAPTCHA_SCRIPT;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  if (!isConfigured) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const captchaToken = data.get("h-captcha-response");
    if (typeof captchaToken !== "string" || !captchaToken) {
      setStatus("error");
      setMessage("Please finish the captcha first.");
      return;
    }
    if (data.get("botcheck")) return; // honeypot

    setStatus("sending");
    setMessage("");
    try {
      // Only the explicitly named fields are sent on either path, so the
      // honeypot and any injected control never ride along.
      const fields = { name: data.get("name"), email: data.get("email"), message: data.get("message") };
      const response = await fetch(usesWorker ? CONTACT_API_URL : "https://api.web3forms.com/submit", {
        method: "POST",
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
      window.hcaptcha?.reset();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Try again in a moment.");
      window.hcaptcha?.reset();
    }
  }

  return (
    <form className="contact-form" ref={formRef} onSubmit={onSubmit} noValidate={false}>
      <input type="checkbox" name="botcheck" className="contact-honeypot" tabIndex={-1} aria-hidden="true" />

      <div className="contact-fields">
        <label>
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>
      <label>
        <span>Message</span>
        <textarea name="message" rows={5} required />
      </label>

      <div className="h-captcha" data-sitekey={siteKey} data-theme="light" />

      <div className="contact-submit">
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending" : "Send message"}
        </button>
        <p role="status" aria-live="polite" className={status === "error" ? "is-error" : undefined}>
          {message}
        </p>
      </div>
    </form>
  );
}
