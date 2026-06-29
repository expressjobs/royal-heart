import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "HeartConnect's verification policy explaining what profile verification means, what it does not guarantee, and how badges can change.";
const URL = "https://royal-heart.com/verification-policy";

export const Route = createFileRoute("/verification-policy")({
  head: () => ({
    meta: [
      { title: "Verification Policy - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Verification Policy - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="verification-policy" />,
});
