import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "HeartConnect Help Center and FAQ for account, safety, verification, billing, and support questions.";
const URL = "https://royal-heart.com/help";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center / FAQ - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Help Center / FAQ - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="help" />,
});
