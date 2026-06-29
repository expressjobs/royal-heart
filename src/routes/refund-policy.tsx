import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "HeartConnect's refund policy for paid memberships, billing errors, refund requests, and support review.";
const URL = "https://royal-heart.com/refund-policy";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Refund Policy - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="refund-policy" />,
});
