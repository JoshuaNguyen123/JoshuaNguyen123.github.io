"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

// Web3Forms relays submissions to the email tied to the access key. The key is
// public by design (it only identifies the inbox) and is baked in at build time.
const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
// Web3Forms' shared hCaptcha site key; the token is verified server-side by Web3Forms.
const HCAPTCHA_SITE_KEY = "50b2fe65-b00b-4b9e-ad62-3ba471098be2";
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
    if (!ACCESS_KEY || document.querySelector(`script[src="${HCAPTCHA_SCRIPT}"]`)) return;
    const script = document.createElement("script");
    script.src = HCAPTCHA_SCRIPT;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  if (!ACCESS_KEY) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    if (!data.get("h-captcha-response")) {
      setStatus("error");
      setMessage("Please finish the captcha first.");
      return;
    }
    if (data.get("botcheck")) return; // honeypot

    // hCaptcha also injects a g-recaptcha-response compatibility field; Web3Forms
    // treats reCAPTCHA as a paid feature, so only the hCaptcha token is sent.
    data.delete("g-recaptcha-response");

    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      const result = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "Submission failed");
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
      <input type="hidden" name="access_key" value={ACCESS_KEY} />
      <input type="hidden" name="subject" value="New message from joshuanguyen123.github.io" />
      <input type="hidden" name="from_name" value="Portfolio contact form" />
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
