import { createFileRoute } from "@tanstack/react-router";
import { CmsInfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us - HeartConnect" },
      {
        name: "description",
        content:
          "Get in touch with the HeartConnect team for support, partnerships, press, or general questions.",
      },
      { property: "og:title", content: "Contact Us - HeartConnect" },
      {
        property: "og:description",
        content:
          "Get in touch with the HeartConnect team for support, partnerships, press, or general questions.",
      },
      { property: "og:url", content: "https://royal-heart.com/contact" },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/contact" }],
  }),
  component: () => <CmsInfoPage slug="contact" />,
});
