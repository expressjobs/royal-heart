import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety Center - HeartConnect" },
      {
        name: "description",
        content:
          "HeartConnect's Safety Center: tips for dating safely, how verification works, and the tools that keep our community protected.",
      },
      { property: "og:title", content: "Safety Center - HeartConnect" },
      {
        property: "og:description",
        content:
          "HeartConnect's Safety Center: tips for dating safely, how verification works, and the tools that keep our community protected.",
      },
      { property: "og:url", content: "https://royal-heart.com/safety" },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/safety" }],
  }),
  component: () => <CmsInfoPage slug="safety" />,
});
