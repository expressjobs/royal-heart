import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service - HeartConnect" },
      {
        name: "description",
        content:
          "The terms and conditions that govern your use of HeartConnect, including eligibility, conduct, and account rules.",
      },
      { property: "og:title", content: "Terms of Service - HeartConnect" },
      {
        property: "og:description",
        content:
          "The terms and conditions that govern your use of HeartConnect, including eligibility, conduct, and account rules.",
      },
      { property: "og:url", content: "https://royal-heart.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/terms" }],
  }),
  component: () => <CmsInfoPage slug="terms" />,
});
