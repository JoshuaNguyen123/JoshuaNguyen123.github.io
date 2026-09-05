import Image from "next/image";

// Four marks in the same Okabe-Ito shapes the activity heatmaps use, so the
// tiles read as part of the site rather than a stock placeholder.
const marks = ["square", "circle", "diamond", "triangle"] as const;

interface ProjectTileProps {
  number: string;
  title: string;
  discipline: string;
  /** Path under public/. When set, the screenshot replaces the typographic tile. */
  image?: string;
}

/** A 4:3 tile for a project: a screenshot when one exists, a typographic card otherwise. */
export function ProjectTile({ number, title, discipline, image }: ProjectTileProps) {
  if (image) {
    return (
      <div className="project-tile project-tile--image">
        <Image src={image} alt={`Screenshot of ${title}`} width={1200} height={900} sizes="(max-width: 760px) calc(100vw - 40px), 384px" />
      </div>
    );
  }
  const mark = marks[(Number.parseInt(number, 10) - 1 + marks.length) % marks.length];
  return (
    <div className="project-tile" aria-hidden="true">
      <span className="project-tile-number">{number}</span>
      <span className={`project-tile-mark project-tile-mark--${mark}`} />
      <span className="project-tile-discipline">{discipline}</span>
    </div>
  );
}
