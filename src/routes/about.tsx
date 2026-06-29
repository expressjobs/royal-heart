import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us - HeartConnect" },
      {
        name: "description",
        content:
          "Learn about HeartConnect's mission to bring genuine people together for meaningful, lasting relationships across the globe.",
      },
      { property: "og:title", content: "About Us - HeartConnect" },
      {
        property: "og:description",
        content:
          "Learn about HeartConnect's mission to bring genuine people together for meaningful, lasting relationships across the globe.",
      },
      { property: "og:url", content: "https://royal-heart.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/about" }],
  }),
  component: () => <CmsInfoPage slug="about" />,
});
