import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "How HeartConnect uses cookies and similar technologies to operate, secure, personalize, and improve the service.";
const URL = "https://royal-heart.com/cookie-policy";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({
    meta: [
      { title: "Cookie Policy - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Cookie Policy - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="cookie-policy" />,
});
