import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".txt"]);

async function collectTextFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) files.push(...(await collectTextFiles(entryUrl)));
    else if (textExtensions.has(path.extname(entry.name))) files.push(entryUrl);
  }
  return files;
}

test("exports the finished Motive experience", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");
  assert.match(html, /<title>Motive[^<]*<\/title>/i);
  assert.match(html, /<h1\b/);
  assert.match(html, /aria-label="Movement library"/);
  assert.match(html, /aria-label="Routine builder"/);
  assert.match(html, /Optional browser AI/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/i);
  assert.doesNotMatch(html, /<(?:script|link|img|source|video)[^>]+(?:src|href|poster)=["'](?:https?:)?\/\//i);

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "";
  if (
    process.env.GITHUB_ACTIONS === "true" &&
    repositoryName &&
    !repositoryName.endsWith(".github.io")
  ) {
    const escapedRepositoryName = repositoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      html,
      new RegExp(`(?:src|href)=["']/${escapedRepositoryName}/_next/`),
      "project Pages exports must prefix Next.js assets with the repository name",
    );
    assert.doesNotMatch(html, /(?:src|href)=["']\/_next\//);
  }
  await access(new URL(".nojekyll", outputRoot));
});

test("every exported page uses assets present in the Pages artifact", async () => {
  const files = await collectTextFiles(outputRoot);
  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "";
  const inferredPrefix = process.env.GITHUB_ACTIONS === "true" && repositoryName && !repositoryName.endsWith(".github.io")
    ? `/${repositoryName}`
    : "";
  const prefix = process.env.PAGES_BASE_PATH ?? inferredPrefix;
  let assetCount = 0;
  for (const file of files.filter((file) => file.pathname.endsWith(".html"))) {
    const contents = await readFile(file, "utf8");
    for (const [, attribute] of contents.matchAll(/<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g)) {
      if (!attribute.startsWith("/")) continue;
      assert.ok(attribute.startsWith(`${prefix}/`), `${attribute} must honor the Pages base path`);
      const relative = attribute.slice(prefix.length + 1).split(/[?#]/, 1)[0];
      assert.ok(relative && !relative.includes(".."), `unsafe asset path: ${attribute}`);
      await access(new URL(relative, outputRoot));
      assetCount++;
    }
  }
  assert.ok(assetCount > 2, "expected local JavaScript and CSS assets");
});

test("keeps the published bundle static and credential-free", async () => {
  const files = await collectTextFiles(outputRoot);
  assert.ok(files.length > 2, "expected exported HTML, JavaScript and CSS assets");

  const forbidden = [
    /OPENAI_API_KEY/,
    /api\.openai\.com/i,
    /sk-(?:proj-)?[a-z0-9_-]{20,}/i,
    /localhost:\d+/i,
    /\/_sites-preview\b/i,
    /\.openai\/hosting\.json/i,
  ];

  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(contents, pattern, `${file.pathname} matched ${pattern}`);
    }
  }
});
