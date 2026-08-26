"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const CONTACT_API_URL = process.env.NEXT_PUBLIC_CONTACT_API_URL ?? "";
const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "";
const HCAPTCHA_SCRIPT = "https://js.hcaptcha.com/1/api.js";

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
    if (!CONTACT_API_URL || !HCAPTCHA_SITE_KEY || document.querySelector(`script[src="${HCAPTCHA_SCRIPT}"]`)) return;
    const script = document.createElement("script");
    script.src = HCAPTCHA_SCRIPT;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  if (!CONTACT_API_URL || !HCAPTCHA_SITE_KEY) return null;

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
      const response = await fetch(CONTACT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          captchaToken,
        }),
      });
      const result = (await response.json()) as { sent?: boolean; error?: string };
      if (!response.ok || !result.sent) throw new Error(result.error || "Submission failed");
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

      <div className="h-captcha" data-sitekey={HCAPTCHA_SITE_KEY} data-theme="light" />

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
