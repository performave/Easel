import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "hr", "strong", "em", "u", "s", "del", "ins", "sub", "sup",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "pre", "code", "kbd",
    "a", "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td", "caption",
    "div", "span",
    "iframe", "video", "audio", "source",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "target", "rel",
    "class", "style", "id",
    "width", "height", "controls", "allow", "allowfullscreen", "frameborder",
    "colspan", "rowspan", "scope",
  ],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as unknown as string;
}

export function CanvasHtml({ html, className }: { html: string | null | undefined; className?: string }) {
  return (
    <div
      className={className ?? "prose prose-sm dark:prose-invert max-w-none"}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}
