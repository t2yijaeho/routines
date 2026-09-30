import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1) ?? "";
const isUserOrOrganizationSite = repositoryName.endsWith(".github.io");
const inferredPagesBasePath =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName &&
  !isUserOrOrganizationSite
    ? `/${repositoryName}`
    : "";
const basePath = process.env.PAGES_BASE_PATH ?? inferredPagesBasePath;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
