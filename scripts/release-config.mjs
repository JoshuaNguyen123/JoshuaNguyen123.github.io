import { pathToFileURL } from "node:url";

export function validateReleaseConfiguration(env) {
  const endpoint = env.NEXT_PUBLIC_CONTACT_API_URL?.trim();
  const captcha = env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();
  if (Boolean(endpoint) !== Boolean(captcha)) throw new Error("Set both public worker contact values, or leave both unset to use Web3Forms.");
  if (!endpoint && !env.NEXT_PUBLIC_WEB3FORMS_KEY?.trim()) throw new Error("Contact delivery is unconfigured. Supply the public worker pair or NEXT_PUBLIC_WEB3FORMS_KEY before making a release candidate.");
  for (const name of ["NEXT_PUBLIC_CONTACT_API_URL", "NEXT_PUBLIC_ACTIVITY_FEED_URL", "NEXT_PUBLIC_BLOG_ADMIN_API_URL"]) {
    if (!(name in env)) continue;
    if (!env[name] && name === "NEXT_PUBLIC_CONTACT_API_URL") continue;
    let url;
    try { url = new URL(env[name]); } catch { throw new Error(`${name} must be a public HTTPS URL.`); }
    if (url.protocol !== "https:" || url.username || url.password || /^(localhost|127\.|\[::1\])/.test(url.hostname)) throw new Error(`${name} must be a public HTTPS URL.`);
  }
  return { contactMode: endpoint ? "worker" : "web3forms", contactConfigured: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log("Release configuration passed:", validateReleaseConfiguration(process.env).contactMode); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
