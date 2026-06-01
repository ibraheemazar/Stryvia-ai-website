import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stryvia",
    short_name: "Stryvia",
    description: "The intelligence you build with.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0B0A",
    theme_color: "#0A0B0A",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
