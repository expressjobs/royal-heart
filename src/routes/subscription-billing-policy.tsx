import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "HeartConnect's subscription and billing policy covering paid memberships, renewals, cancellation, and billing support.";
const URL = "https://royal-heart.com/subscription-billing-policy";

export const Route = createFileRoute("/subscription-billing-policy")({
  head: () => ({
    meta: [
      { title: "Subscription & Billing Policy - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Subscription & Billing Policy - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="subscription-billing-policy" />,
});
