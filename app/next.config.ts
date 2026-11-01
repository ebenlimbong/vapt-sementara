import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (static-first + cache island) dimatikan dengan sengaja:
  // aplikasi ini adalah platform internal yang hampir seluruh halamannya
  // dinamis (session + data DB per-request) — tidak ada konten yang perlu
  // di-prerender/di-cache statis, jadi model rendering dinamis standar Next.js
  // lebih cocok dan menghindari kebutuhan menandai puluhan route satu-satu.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
