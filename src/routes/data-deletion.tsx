import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

const DESCRIPTION =
  "How HeartConnect members can request account deletion or data deletion, and what records may need to be retained.";
const URL = "https://royal-heart.com/data-deletion";

export const Route = createFileRoute("/data-deletion")({
  head: () => ({
    meta: [
      { title: "Data Deletion / Account Deletion - HeartConnect" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Data Deletion / Account Deletion - HeartConnect" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: () => <CmsInfoPage slug="data-deletion" />,
});
