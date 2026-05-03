import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

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

function toCanvasOrigin(domain: string | null): string | null {
  if (!domain) return null;
  const trimmed = domain.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function absolutizeCanvasUrls(html: string, domain: string | null): string {
  const baseOrigin = toCanvasOrigin(domain);
  if (!html || !baseOrigin || typeof window === "undefined") return html;

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[src], [href]"))) {
    for (const attr of ["src", "href"] as const) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      if (value.startsWith("#") || value.startsWith("data:") || value.startsWith("mailto:") || value.startsWith("tel:")) {
        continue;
      }
      try {
        el.setAttribute(attr, new URL(value, baseOrigin).toString());
      } catch {
        // Keep original URL if parsing fails.
      }
    }
  }

  return doc.body.innerHTML;
}

async function inlineCanvasImages(html: string): Promise<string> {
  if (!html || typeof window === "undefined") return html;

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>("img[src]"));
  if (images.length === 0) return html;

  const cache = new Map<string, string>();
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      if (!cache.has(src)) {
        try {
          cache.set(src, await api.canvasAssetDataUrl(src));
        } catch {
          return;
        }
      }
      const inlined = cache.get(src);
      if (inlined) img.setAttribute("src", inlined);
    }),
  );

  return doc.body.innerHTML;
}

export function CanvasHtml({
  html,
  className,
  onLinkClick,
}: {
  html: string | null | undefined;
  className?: string;
  /** Return true if the link was handled in-app; return false to fall back to openUrl. */
  onLinkClick?: (href: string) => boolean | Promise<boolean>;
}) {
  const domain = useAuthStore((s) => s.domain);
  const [renderHtml, setRenderHtml] = useState("");
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const sanitized = sanitizeHtml(html);
      const normalized = absolutizeCanvasUrls(sanitized, domain);
      const inlined = await inlineCanvasImages(normalized);
      if (!cancelled) setRenderHtml(inlined);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [domain, html]);

  // Intercept all link clicks inside the rendered HTML.
  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      e.preventDefault();
      e.stopPropagation();

      void (async () => {
        if (onLinkClick) {
          const handled = await onLinkClick(href);
          if (handled) return;
        }
        await openUrl(href);
      })();
    };

    div.addEventListener("click", handleClick);
    return () => div.removeEventListener("click", handleClick);
  }, [onLinkClick]);

  return (
    <div
      ref={divRef}
      className={className ?? "canvas-html max-w-none"}
      dangerouslySetInnerHTML={{ __html: renderHtml }}
    />
  );
}
