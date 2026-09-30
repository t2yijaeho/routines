import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml",
  ".gitignore",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "data/exercises.json",
  "out/.nojekyll",
  "out/index.html",
  "package-lock.json",
  "package.json",
];
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".vinext",
  ".wrangler",
  "node_modules",
  "out",
  "outputs",
  "work",
]);
const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".json",
  ".js",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".svg",
  ".xml",
  ".yml",
  ".yaml",
]);

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolutePath, relativePath)));
    else files.push({ absolutePath, relativePath });
  }
  return files;
}

for (const relativePath of requiredFiles) {
  assert.ok(await exists(relativePath), `missing release file: ${relativePath}`);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
assert.equal(packageJson.private, true, "package must stay private to prevent npm publication");
assert.equal(packageJson.scripts?.postinstall, undefined, "postinstall scripts are not allowed");
assert.match(packageJson.scripts?.verify ?? "", /release:check/);

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
assert.match(gitignore, /^\.env\*/m);
assert.match(gitignore, /^\.codex-dev\.\*\.log$/m);

const workflowDirectory = path.join(root, ".github", "workflows");
const workflows = (await readdir(workflowDirectory)).filter((file) => /\.ya?ml$/i.test(file));
assert.ok(workflows.length >= 2, "expected CI and Pages workflows");
for (const workflow of workflows) {
  const contents = await readFile(path.join(workflowDirectory, workflow), "utf8");
  const actionReferences = [...contents.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(?:#.*)?$/gm)];
  assert.ok(actionReferences.length > 0, `${workflow} has no action references`);
  for (const [, reference] of actionReferences) {
    assert.match(reference, /^[^@]+@[0-9a-f]{40}$/i, `${workflow} must pin ${reference}`);
  }
  assert.match(contents, /permissions:/, `${workflow} must declare permissions`);
  assert.doesNotMatch(contents, /pull_request_target:/, `${workflow} must not use pull_request_target`);
}

const sourceFiles = await collectFiles(root);
// Ignoring a file does not untrack it. Check the index as well as the working tree
// so a previously committed credential or build artifact cannot evade this gate.
const indexedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
for (const file of indexedFiles) {
  assert.doesNotMatch(
    file,
    /(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:node_modules|\.next|out|outputs|work)\/|\.(?:pem|key|p12|pfx|log|tsbuildinfo)$/i,
    `private or generated file must not be tracked: ${file}`,
  );
}
const secretPatterns = [
  { label: "OpenAI key", pattern: /sk-(?:proj-)?[a-z0-9_-]{20,}/i },
  { label: "GitHub token", pattern: /gh[oprsu]_[a-z0-9]{30,}/i },
  { label: "GitHub fine-grained token", pattern: /github_pat_[a-z0-9_]{50,}/i },
  { label: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

for (const file of sourceFiles) {
  assert.doesNotMatch(
    file.relativePath,
    /(^|[\\/])\.env(?:\.|$)|\.(?:pem|key|p12|pfx)$/i,
    `environment or private-key file must not be published: ${file.relativePath}`,
  );
  const extension = path.extname(file.relativePath).toLowerCase();
  if (!textExtensions.has(extension)) continue;
  const contents = await readFile(file.absolutePath, "utf8");
  for (const { label, pattern } of secretPatterns) {
    assert.doesNotMatch(contents, pattern, `${label} pattern found in ${file.relativePath}`);
  }
}

const exportedFiles = await collectFiles(path.join(root, "out"));
for (const file of exportedFiles) {
  const extension = path.extname(file.relativePath).toLowerCase();
  if (!textExtensions.has(extension)) continue;
  const contents = await readFile(file.absolutePath, "utf8");
  for (const { label, pattern } of secretPatterns) {
    assert.doesNotMatch(contents, pattern, `${label} pattern found in export ${file.relativePath}`);
  }
  assert.doesNotMatch(contents, /api\.openai\.com|OPENAI_API_KEY/i, `${file.relativePath} leaks API code`);
  assert.doesNotMatch(contents, /localhost:\d+/i, `${file.relativePath} contains a local runtime URL`);
  assert.doesNotMatch(contents, /<(?:script|link|img|source|video)\b[^>]+(?:src|href|poster)=["'](?:https?:)?\/\//i, `${file.relativePath} contains a remote runtime asset`);
  if (extension === ".css") {
    assert.doesNotMatch(contents, /(?:url\(\s*["']?|@import\s+["'])(?:https?:)?\/\//i, `${file.relativePath} contains a remote CSS asset`);
  }
}

console.log(
  `Release check passed: ${sourceFiles.length} source files and ${exportedFiles.length} exported files scanned.`,
);
