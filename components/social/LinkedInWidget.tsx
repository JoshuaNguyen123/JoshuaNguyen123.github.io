import type { ExternalPost } from "@/content/linkedin-posts";

export function LinkedInWidget({ posts, profileUrl }: { posts: ExternalPost[]; profileUrl: string | null }) {
  if (posts.length === 0 && !profileUrl) return null;

  return (
    <section className="linkedin-widget" aria-labelledby="linkedin-widget-title">
      <div className="linkedin-widget-heading">
        <div><span className="linkedin-mark" aria-hidden="true">in</span><h3 id="linkedin-widget-title">LinkedIn pulse</h3></div>
        {profileUrl ? <a href={profileUrl}>View profile</a> : null}
      </div>
      {posts.length > 0 ? (
        <div className="linkedin-posts">
          {posts.map((post) => (
            <iframe
              key={post.postUrl}
              src={post.embedUrl}
              title={post.title ?? "Public LinkedIn post by Joshua Nguyen"}
              loading="lazy"
              allowFullScreen
            />
          ))}
        </div>
      ) : null}
      {posts.length > 0 ? <p>Public post content is served directly by LinkedIn.</p> : null}
    </section>
  );
}
