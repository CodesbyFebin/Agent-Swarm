import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgentSwarm.in",
    short_name: "AgentSwarm",
    description: "The control plane for AI workforces.",
    start_url: "/",
    display: "standalone",
    background_color: "#06060a",
    theme_color: "#06060a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
