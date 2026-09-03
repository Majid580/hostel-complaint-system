import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/config/env";

/**
 * Served at /manifest.webmanifest, which `layout.tsx` already points at.
 * Generated rather than static so the installed app carries the institute's
 * own branding from the environment.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${publicEnv.appName} · ${publicEnv.instituteName}`,
    short_name: "Complaints",
    description:
      "File, track and resolve hostel maintenance complaints with photos and voice notes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#1a6a8a",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "File a complaint", url: "/student/new" },
      { name: "Track a complaint", url: "/track" },
    ],
  };
}
