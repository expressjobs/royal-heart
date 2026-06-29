import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "HeartConnect's blocking and reporting policy, including when to report a member and how safety reviews are handled.";
const URL = "https://royal-heart.com/blocking-reporting";

export const Route = createFileRoute("/blocking-reporting")({
  head: () => ({
    meta: [
      { title: "Blocking & Reporting Policy - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Blocking & Reporting Policy - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="blocking-reporting" />,
});
