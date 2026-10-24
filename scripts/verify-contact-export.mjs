// React escapes attribute punctuation. Decode before splitting on semicolons,
// or an entity such as &#x27; gets mistaken for a CSP directive separator.
export function readContentSecurityPolicy(html) {
  const encoded = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/)?.[1] ?? "";
  const namedEntities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return encoded.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|quot|apos|lt|gt);/gi, (entity, numeric, named) => {
    if (named) return namedEntities[named.toLowerCase()];
    const hex = numeric[0].toLowerCase() === "x";
    const point = Number.parseInt(numeric.slice(hex ? 1 : 0), hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

/** Verify the shipped form, rather than inferring captcha from source/config. */
export function verifyContactExport(html, env) {
  const configured = Boolean(env.NEXT_PUBLIC_CONTACT_API_URL && env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY)
    || Boolean(env.NEXT_PUBLIC_WEB3FORMS_KEY);
  if (!configured) return;
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)]
    .map(([markup]) => markup).find((markup) => /class="[^"]*\bcontact-form\b/.test(markup));
  if (!form?.includes('data-contact-configured="true"')) throw new Error("Configured contact backend did not reach the exported form.");
  const widget = form.match(/<div\b[^>]*class="[^"]*\bh-captcha\b[^>]*>/)?.[0];
  const siteKey = widget?.match(/data-sitekey="([^"]+)"/)?.[1];
  if (!siteKey || !widget.includes('data-size="compact"')) throw new Error("Exported contact form is missing its compact captcha.");
  const expectedKey = env.NEXT_PUBLIC_CONTACT_API_URL
    ? env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY : "50b2fe65-b00b-4b9e-ad62-3ba471098be2";
  if (siteKey !== expectedKey) throw new Error("Exported captcha does not match the configured contact provider site key.");
  const policy = readContentSecurityPolicy(html);
  for (const name of ["script-src", "frame-src", "connect-src", "style-src"]) {
    const sources = policy.split(";").find((directive) => directive.trim().startsWith(name + " "))?.trim().split(/\s+/).slice(1) ?? [];
    if (!["https://hcaptcha.com", "https://*.hcaptcha.com"].every((origin) => sources.includes(origin))) throw new Error(`Exported ${name} blocks hCaptcha.`);
  }
}
