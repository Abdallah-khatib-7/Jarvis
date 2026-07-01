import { Octokit } from "@octokit/rest";
import keytar from "keytar";
import inquirer from "inquirer";
import chalk, { type ChalkInstance } from "chalk";
import { stopThinking } from "../ui/thinking.js";
import { getActiveUserId } from "../tools/memoryTools.js";
import type { ToolResult } from "../tools/fileTools.js";

// ── credential store ──────────────────────────────────────────────────────────

const SERVICE = "jarvis";
const acct = (userId: number) => `github-${userId}`;

async function getOrPromptToken(userId: number): Promise<string> {
  const stored = await keytar.getPassword(SERVICE, acct(userId));
  if (stored) return stored;

  stopThinking();
  console.log(
    chalk.yellow("\n  ◈ No GitHub token for your account.\n") +
      chalk.dim(
        "  Generate one at github.com/settings/tokens\n" +
          "  Required scopes: repo + issues\n"
      )
  );

  const { token } = await inquirer.prompt<{ token: string }>([
    {
      type: "password",
      name: "token",
      message: "Paste your GitHub personal access token:",
      mask: "*",
    },
  ]);

  const trimmed = token.trim();
  if (!trimmed) throw new Error("No token entered — GitHub tools are unavailable until one is set.");

  await keytar.setPassword(SERVICE, acct(userId), trimmed);
  console.log(chalk.green("  ✓ Token saved to your OS credential store.\n"));
  return trimmed;
}

async function getOctokit(): Promise<Octokit> {
  const userId = getActiveUserId();
  if (userId === null) throw new Error("No active user session.");
  const token = await getOrPromptToken(userId);
  return new Octokit({ auth: token });
}

async function clearStoredToken(): Promise<void> {
  const userId = getActiveUserId();
  if (userId !== null) await keytar.deletePassword(SERVICE, acct(userId));
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(d).toLocaleDateString();
}

function errMsg(err: unknown): string {
  if (err instanceof Error) {
    const s = (err as Error & { status?: number }).status;
    if (s === 401) {
      void clearStoredToken();
      return "GitHub token is invalid or expired — it has been cleared. Use any GitHub tool again to enter a new one.";
    }
    if (s === 403) return "GitHub access denied — token needs repo + issues scope";
    if (s === 404) return "Not found — check owner, repo, and number";
    return err.message;
  }
  return String(err);
}

function termWidth(): number {
  return Math.min((process.stdout.columns || 80) - 2, 92);
}

function hline(w = termWidth()): string {
  return "─".repeat(Math.max(0, w));
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function panelOpen(icon: string, label: string, subtitle: string, color: ChalkInstance): void {
  const w = termWidth();
  const tag = ` ${icon} ${label} `;
  const fill = hline(Math.max(0, w - 2 - stripAnsi(tag).length));
  process.stdout.write("\n");
  process.stdout.write(color(`╭─${tag}${fill}`) + "\n");
  process.stdout.write(color("│") + "  " + chalk.bold.white(subtitle) + "\n");
}

function panelLine(text: string, color: ChalkInstance): void {
  process.stdout.write(color("│") + "  " + chalk.white(text) + "\n");
}

function panelClose(color: ChalkInstance): void {
  process.stdout.write(color(`╰${hline(termWidth() - 1)}`) + "\n\n");
}

// ── read tools ────────────────────────────────────────────────────────────────

export async function githubGetRepoTool(owner: string, repo: string): Promise<ToolResult> {
  try {
    const octokit = await getOctokit();
    const { data: r } = await octokit.repos.get({ owner, repo });

    const lines = [
      `${r.full_name}${r.private ? " (private)" : ""}`,
      r.description ?? "(no description)",
      ``,
      `Language:  ${r.language ?? "—"}`,
      `Stars:     ${r.stargazers_count}  Forks: ${r.forks_count}`,
      `Branch:    ${r.default_branch}`,
      `Updated:   ${fmtDate(r.updated_at)}`,
      `URL:       ${r.html_url}`,
    ];

    if (r.topics?.length) lines.push(`Topics:    ${r.topics.join(", ")}`);

    return { ok: true, output: lines.join("\n") };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function githubGetFileTool(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<ToolResult> {
  try {
    const octokit = await getOctokit();
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref });

    if (Array.isArray(data)) {
      const entries = data.map((e) => `  ${e.type === "dir" ? "📁" : "📄"}  ${e.name}`);
      return { ok: true, output: `Directory: ${path}\n${entries.join("\n")}` };
    }

    if (data.type !== "file") {
      return { ok: false, output: `"${path}" is not a file (type: ${data.type}).` };
    }

    /* GitHub base64-encodes content with embedded newlines — strip before decoding */
    const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");

    /* cap at 8 KB so the AI context doesn't blow up on huge files */
    const MAX = 8000;
    const truncated = content.length > MAX;
    return {
      ok: true,
      output:
        `File: ${owner}/${repo}/${path}${ref ? ` (ref: ${ref})` : ""}\n` +
        `Size: ${data.size} bytes\n\n` +
        content.slice(0, MAX) +
        (truncated ? `\n\n... (truncated — ${content.length - MAX} more bytes)` : ""),
    };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function githubSearchTool(query: string): Promise<ToolResult> {
  try {
    const octokit = await getOctokit();
    const { data } = await octokit.search.issuesAndPullRequests({
      q: query,
      per_page: 20,
      sort: "updated",
    });

    if (data.total_count === 0) return { ok: true, output: `No results for: ${query}` };

    const lines = [`Found ${data.total_count} result(s) for "${query}":`];
    for (const item of data.items) {
      const type = item.pull_request ? "PR" : "ISSUE";
      const repo = item.repository_url.replace("https://api.github.com/repos/", "");
      lines.push(
        `[${type}] #${item.number} — ${item.title} · ${repo} · ${item.state} · updated ${fmtDate(item.updated_at)}`
      );
    }
    return { ok: true, output: lines.join("\n") };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function githubListReposTool(): Promise<ToolResult> {
  try {
    const octokit = await getOctokit();
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: 30,
    });

    const lines = [`Your ${data.length} most recently updated repos:`];
    for (const r of data) {
      lines.push(
        `  ${r.full_name} · ${r.language ?? "—"} · ${r.private ? "private" : "public"} · updated ${fmtDate(r.updated_at)}`
      );
    }
    return { ok: true, output: lines.join("\n") };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function githubGetPrTool(
  owner: string,
  repo: string,
  pull_number: number
): Promise<ToolResult> {
  try {
    const octokit = await getOctokit();
    const [{ data: pr }, { data: files }, { data: reviews }] = await Promise.all([
      octokit.pulls.get({ owner, repo, pull_number }),
      octokit.pulls.listFiles({ owner, repo, pull_number, per_page: 30 }),
      octokit.pulls.listReviews({ owner, repo, pull_number }),
    ]);

    const lines = [
      `PR #${pull_number}: ${pr.title}`,
      `State: ${pr.state}${pr.merged ? " (merged)" : ""} | Author: ${pr.user?.login ?? "?"} | ${pr.head.label} → ${pr.base.label}`,
      `Created: ${fmtDate(pr.created_at)} | Updated: ${fmtDate(pr.updated_at)}`,
      `URL: ${pr.html_url}`,
      ``,
      `Description:`,
      pr.body?.trim() || "(no description)",
      ``,
      `Changed files (${files.length}):`,
      ...files.map(
        (f) => `  ${f.status[0].toUpperCase()}  ${f.filename}  (+${f.additions} -${f.deletions})`
      ),
      ``,
      reviews.length > 0 ? `Reviews:` : `Reviews: none yet`,
      ...reviews.map(
        (r) => `  ${r.user?.login ?? "?"}: ${r.state} · ${fmtDate(r.submitted_at ?? null)}`
      ),
    ];

    return { ok: true, output: lines.join("\n") };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function githubGetIssueTool(
  owner: string,
  repo: string,
  issue_number: number
): Promise<ToolResult> {
  try {
    const octokit = await getOctokit();
    const [{ data: issue }, { data: comments }] = await Promise.all([
      octokit.issues.get({ owner, repo, issue_number }),
      octokit.issues.listComments({ owner, repo, issue_number, per_page: 10 }),
    ]);

    const labels =
      issue.labels
        .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
        .filter(Boolean)
        .join(", ") || "none";
    const assignees = issue.assignees?.map((a) => a.login).join(", ") || "none";

    const lines = [
      `Issue #${issue_number}: ${issue.title}`,
      `State: ${issue.state} | Author: ${issue.user?.login ?? "?"} | Labels: ${labels}`,
      `Assignees: ${assignees}`,
      `Created: ${fmtDate(issue.created_at)} | Updated: ${fmtDate(issue.updated_at)}`,
      `URL: ${issue.html_url}`,
      ``,
      `Description:`,
      issue.body?.trim() || "(no description)",
    ];

    if (comments.length > 0) {
      lines.push(``, `Comments (${comments.length}):`);
      for (const c of comments.slice(-5)) {
        lines.push(``, `─── ${c.user?.login ?? "?"} · ${fmtDate(c.created_at)} ───`);
        lines.push(c.body?.trim() || "");
      }
    }

    return { ok: true, output: lines.join("\n") };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

// ── write tools (preview panel + confirm) ─────────────────────────────────────

export async function githubCreateIssueTool(
  owner: string,
  repo: string,
  title: string,
  body?: string
): Promise<ToolResult> {
  stopThinking();

  const color = chalk.green;
  panelOpen("◈", "CREATE ISSUE", `${owner}/${repo}`, color);
  panelLine(`Title: ${title}`, color);
  if (body) {
    panelLine("", color);
    for (const line of body.slice(0, 400).split("\n").slice(0, 10)) {
      panelLine(line, color);
    }
  }
  panelClose(color);

  const { go } = await inquirer.prompt<{ go: boolean }>([
    { type: "confirm", name: "go", message: "Post this issue to GitHub?", default: false },
  ]);

  if (!go) return { ok: false, output: "Issue creation cancelled." };

  try {
    const octokit = await getOctokit();
    const { data } = await octokit.issues.create({ owner, repo, title, body });
    console.log(chalk.green(`\n  ✓ Issue #${data.number} created: ${data.html_url}\n`));
    return { ok: true, output: `Issue #${data.number} created: ${data.html_url}` };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

export async function githubCommentTool(
  owner: string,
  repo: string,
  issue_number: number,
  body: string
): Promise<ToolResult> {
  stopThinking();

  const color = chalk.cyan;
  panelOpen("◈", "POST COMMENT", `${owner}/${repo}#${issue_number}`, color);
  for (const line of body.slice(0, 400).split("\n").slice(0, 10)) {
    panelLine(line, color);
  }
  panelClose(color);

  const { go } = await inquirer.prompt<{ go: boolean }>([
    { type: "confirm", name: "go", message: "Post this comment?", default: false },
  ]);

  if (!go) return { ok: false, output: "Comment cancelled." };

  try {
    const octokit = await getOctokit();
    const { data } = await octokit.issues.createComment({ owner, repo, issue_number, body });
    console.log(chalk.cyan(`\n  ✓ Comment posted: ${data.html_url}\n`));
    return { ok: true, output: `Comment posted: ${data.html_url}` };
  } catch (err) {
    return { ok: false, output: errMsg(err) };
  }
}

// ── disconnect ────────────────────────────────────────────────────────────────

export async function githubDisconnectTool(): Promise<ToolResult> {
  const userId = getActiveUserId();
  if (userId === null) return { ok: false, output: "No active user session." };

  const existing = await keytar.getPassword(SERVICE, acct(userId));
  if (!existing) {
    return { ok: true, output: "No GitHub token was stored for your account — nothing to remove." };
  }

  await keytar.deletePassword(SERVICE, acct(userId));
  return {
    ok: true,
    output: "GitHub token removed from credential store. You'll be prompted for a new one next time you use a GitHub tool.",
  };
}
