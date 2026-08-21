export interface ExternalPost {
  provider: "linkedin";
  postUrl: string;
  embedUrl: string;
  title?: string;
}

function defineExternalPosts(posts: ExternalPost[]): ExternalPost[] {
  for (const post of posts) {
    const postUrl = new URL(post.postUrl);
    const embedUrl = new URL(post.embedUrl);
    if (post.provider !== "linkedin" || !postUrl.hostname.endsWith("linkedin.com") || !embedUrl.hostname.endsWith("linkedin.com")) {
      throw new Error("LinkedIn posts must use official public linkedin.com URLs");
    }
  }
  return posts;
}

// Populate these values only when Joshua has public LinkedIn content to show.
// With an empty list and no profile URL, the widget renders nothing and makes
// no request to LinkedIn.
export const linkedInProfileUrl: string | null = "https://www.linkedin.com/in/joshua-nguyen-6a812a210";
export const linkedInPosts: ExternalPost[] = defineExternalPosts([]);
