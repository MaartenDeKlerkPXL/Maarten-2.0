import { fmt } from "./dates";
import type { Inspiration } from "./types";

export const hashtag = (t: string) => `#${t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")}`;

export function hashtagsOf(i: Inspiration): string[] {
  return [...new Set([...i.tags, ...i.technologies].map(hashtag).filter((h) => h.length > 1))];
}

/** Alle opgeslagen sites als Markdown (nieuwste eerst). "Niet mooi" komt er nooit in. */
export function inspirationMarkdown(items: Inspiration[]): string {
  const saved = items.filter((i) => i.status === "saved").sort((a, b) => b.sotd_date.localeCompare(a.sotd_date));
  const lines = [
    "# Awwwards inspiratie",
    "",
    `_Opgeslagen Sites of the Day · ${saved.length} ${saved.length === 1 ? "site" : "sites"} · bijgewerkt ${fmt(new Date(), "d MMMM yyyy")}_`,
    "",
  ];
  for (const i of saved) {
    lines.push(`## ${i.name}`, "");
    lines.push(`- **Datum:** ${fmt(i.sotd_date, "d MMMM yyyy")}`);
    if (i.url) lines.push(`- **Link:** ${i.url}`);
    if (i.awwwards_url) lines.push(`- **Awwwards:** ${i.awwwards_url}`);
    if (i.description) lines.push(`- **Onderwerp:** ${i.description}`);
    if (i.categories.length) lines.push(`- **Soort:** ${i.categories.join(", ")}`);
    const tags = hashtagsOf(i);
    if (tags.length) lines.push(`- **Hashtags:** ${tags.join(" ")}`);
    if (i.note?.trim()) lines.push(`- **Notitie:** ${i.note.trim()}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const MD_FILENAME = "awwwards-inspiratie.md";

export function downloadMarkdown(md: string) {
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = MD_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deelmenu (iPhone: opslaan in Bestanden, Notities, AirDrop …). */
export async function shareMarkdown(md: string): Promise<boolean> {
  const file = new File([md], MD_FILENAME, { type: "text/markdown" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Awwwards inspiratie" });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
