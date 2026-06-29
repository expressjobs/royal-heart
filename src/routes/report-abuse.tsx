import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "Report abusive behaviour, fake profiles, or safety concerns to the HeartConnect Trust & Safety team.";
const URL = "https://royal-heart.com/report-abuse";

export const Route = createFileRoute("/report-abuse")({
  head: () => ({
    meta: [
      { title: "Report Abuse - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Report Abuse - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="report-abuse" />,
});
