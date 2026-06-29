import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy - HeartConnect" },
      {
        name: "description",
        content:
          "How HeartConnect collects, uses, and protects your personal information, and the choices you have over your data.",
      },
      { property: "og:title", content: "Privacy Policy - HeartConnect" },
      {
        property: "og:description",
        content:
          "How HeartConnect collects, uses, and protects your personal information, and the choices you have over your data.",
      },
      { property: "og:url", content: "https://royal-heart.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/privacy" }],
  }),
  component: () => <CmsInfoPage slug="privacy" />,
});
