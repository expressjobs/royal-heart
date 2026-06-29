import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "HeartConnect's community guidelines for respectful conduct, authenticity, safety, and serious relationship-focused behaviour.";
const URL = "https://royal-heart.com/community-guidelines";

export const Route = createFileRoute("/community-guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Community Guidelines - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="community-guidelines" />,
});
