import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next guess the wrong workspace
  // root, which breaks output tracing. Pin it to this project.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),

  // content/style-guide.md is read at runtime with fs, so the tracer cannot see
  // it from the import graph. Without this it is missing in the Vercel bundle.
  outputFileTracingIncludes: {
    "/api/generate": ["./content/**/*"],
    "/api/generate/manual": ["./content/**/*"],
    "/api/generate/sos": ["./content/**/*"],
  },
};

export default nextConfig;
