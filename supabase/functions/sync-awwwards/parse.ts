// Leest de nieuwste Awwwards "Site of the Day" uit de HTML van awwwards.com.

export interface Sotd {
  date: string; // YYYY-MM-DD
  name: string;
  slug: string;
  url: string | null;
  awwwards_url: string;
  image_url: string | null;
  description: string | null;
  categories: string[];
  tags: string[];
  technologies: string[];
}

const CATEGORIES = new Set([
  "architecture", "business & corporate", "culture & education", "design agencies", "e-commerce", "events",
  "fashion", "food & drink", "games & entertainment", "health & beauty", "institutions",
  "magazine / newspaper / blog", "mobile & apps", "music & sound", "photography", "portfolio", "real estate",
  "restaurant & hotel", "sports", "technology", "travel", "other", "web & interactive", "art & illustration",
  "startups", "finance", "cryptocurrency", "film & tv", "blockchain", "science", "social", "non-profit",
]);

const TECHNOLOGIES = new Set([
  "webflow", "javascript", "figma", "gsap", "three.js", "webgl", "react", "next.js", "vue.js", "nuxt", "nuxt.js",
  "wordpress", "framer", "framer motion", "shopify", "svelte", "sveltekit", "sanity", "contentful", "blender",
  "after effects", "photoshop", "illustrator", "html5", "css", "css3", "php", "lottie", "barba.js",
  "locomotive scroll", "lenis", "spline", "cinema 4d", "houdini", "astro", "gatsby", "prismic", "storyblok",
  "tailwind", "tailwind css", "node.js", "laravel", "squarespace", "wix", "rive", "swup", "pixi.js",
  "matter.js", "paper.js", "canvas", "svg", "adobe xd", "sketch", "readymag", "cargo", "craft cms", "strapi",
  "directus", "typescript", "vite", "unicorn studio", "ogl", "p5.js", "babylon.js", "r3f", "react three fiber",
  "headless cms", "kirby", "statamic", "hubspot", "jquery", "angular", "remix", "vercel", "netlify",
]);

export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

export function classify(all: string[]) {
  const categories: string[] = [];
  const tags: string[] = [];
  const technologies: string[] = [];
  for (const t of all) {
    const k = t.trim().toLowerCase();
    if (!k) continue;
    if (CATEGORIES.has(k)) categories.push(t.trim());
    else if (TECHNOLOGIES.has(k)) technologies.push(t.trim());
    else tags.push(t.trim());
  }
  return { categories, tags, technologies };
}

/** Eerste (= nieuwste) kaart op /websites/sites_of_the_day/. */
export function parseList(html: string): Omit<Sotd, "description"> | null {
  const start = html.search(/<li[^>]*js-collectable[^>]*data-collectable-model-value="/);
  if (start < 0) return null;
  const next = html.indexOf("data-collectable-model-value=", html.indexOf("data-collectable-model-value=", start) + 30);
  const block = html.slice(start, next > 0 ? next : start + 20000);
  const raw = block.match(/data-collectable-model-value="([^"]+)"/)?.[1];
  if (!raw) return null;
  const model = JSON.parse(decodeEntities(raw));
  const slug: string = model.slug;
  const name: string = decodeEntities(model.title ?? model.collectableTitle ?? slug);
  const created = Number(model.createdAt);
  const date = Number.isFinite(created) && created > 0
    ? new Date(created * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const url = block.match(/class="figure-rollover__bt"\s+href="(https?:\/\/[^"]+)"/)?.[1] ??
    [...block.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]).find((u) => !u.includes("awwwards.com")) ?? null;
  const img = model.images?.thumbnail ?? model.collectableImage;
  const { categories, tags, technologies } = classify((model.tags ?? []).map((t: string) => decodeEntities(t)));
  return {
    date, name, slug,
    url: url ? decodeEntities(url) : null,
    awwwards_url: `https://www.awwwards.com/sites/${slug}`,
    image_url: img ? `https://assets.awwwards.com/awards/media/cache/thumb_880_660/${img}` : null,
    categories, tags, technologies,
  };
}

/** Omschrijving (en grotere afbeelding) van de detailpagina. */
export function parseDetail(html: string): { description: string | null; image: string | null } {
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+property="${p}"[^>]+content="([^"]*)"`))?.[1];
  const d = meta("og:description");
  return { description: d ? decodeEntities(d).trim() : null, image: meta("og:image") ?? null };
}
