import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/report-abuse")({
  head: () => ({
    meta: [
      { title: "Report Abuse - HeartConnect" },
      {
        name: "description",
        content:
          "Report abusive behaviour, fake profiles, or safety concerns to the HeartConnect Trust & Safety team.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: () => <CmsInfoPage slug="report-abuse" />,
});
