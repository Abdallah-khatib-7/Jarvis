import type { ToolResult } from "./fileTools.js";

const ENDPOINT = "https://google.serper.dev/search";
const NEWS_ENDPOINT = "https://google.serper.dev/news";

interface OrganicResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface NewsResult {
  title: string;
  link: string;
  snippet: string;
  source: string;
  date?: string;
}

interface SerperResponse {
  answerBox?: {
    title?: string;
    answer?: string;
    snippet?: string;
  };
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
    website?: string;
    attributes?: Record<string, string>;
  };
  organic?: OrganicResult[];
  news?: NewsResult[];
  topStories?: NewsResult[];
}

function apiKey(): string | null {
  return process.env.SERPER_API_KEY ?? null;
}

async function serperPost(url: string, body: object): Promise<SerperResponse> {
  const key = apiKey();
  if (!key) throw new Error("SERPER_API_KEY is not set in .env");

  const res = await fetch(url, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Serper ${res.status}: ${text}`);
  }

  return res.json() as Promise<SerperResponse>;
}

export async function webSearchTool(query: string, num = 8): Promise<ToolResult> {
  try {
    const data = await serperPost(ENDPOINT, { q: query, num });
    const lines: string[] = [`Search: "${query}"`, ""];

    // Direct answer box (e.g. maths, definitions, quick facts)
    if (data.answerBox) {
      const a = data.answerBox.answer ?? data.answerBox.snippet;
      if (a) {
        lines.push(`Direct answer: ${a}`, "");
      }
    }

    // Knowledge graph (entities: people, places, companies)
    if (data.knowledgeGraph) {
      const kg = data.knowledgeGraph;
      const heading = [kg.title, kg.type ? `(${kg.type})` : ""]
        .filter(Boolean)
        .join(" ");
      if (heading || kg.description) {
        if (heading) lines.push(heading);
        if (kg.description) lines.push(kg.description);
        if (kg.website) lines.push(`Website: ${kg.website}`);
        if (kg.attributes) {
          for (const [k, v] of Object.entries(kg.attributes).slice(0, 4)) {
            lines.push(`${k}: ${v}`);
          }
        }
        lines.push("");
      }
    }

    // Organic results
    const organic = data.organic ?? [];
    if (organic.length === 0) {
      if (lines.length <= 2) return { ok: true, output: "No results found." };
    } else {
      lines.push("Results:");
      for (const r of organic) {
        const date = r.date ? ` · ${r.date}` : "";
        lines.push(`${r.position}. ${r.title}${date}`);
        lines.push(`   ${r.snippet}`);
        lines.push(`   ${r.link}`);
        lines.push("");
      }
    }

    return { ok: true, output: lines.join("\n").trim() };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}

export async function webNewsTool(query: string, num = 8): Promise<ToolResult> {
  try {
    const data = await serperPost(NEWS_ENDPOINT, { q: query, num });
    const items = data.news ?? data.topStories ?? [];

    if (items.length === 0) {
      return { ok: true, output: `No news found for "${query}".` };
    }

    const lines: string[] = [`News: "${query}"`, ""];
    items.forEach((r, i) => {
      const meta = [r.source, r.date].filter(Boolean).join(" · ");
      lines.push(`${i + 1}. ${r.title}`);
      if (meta) lines.push(`   ${meta}`);
      lines.push(`   ${r.snippet}`);
      lines.push(`   ${r.link}`);
      lines.push("");
    });

    return { ok: true, output: lines.join("\n").trim() };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}
