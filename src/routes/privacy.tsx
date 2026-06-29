import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — HeartConnect" },
      {
        name: "description",
        content:
          "How HeartConnect collects, uses, and protects your personal information, and the choices you have over your data.",
      },
      { property: "og:title", content: "Privacy Policy — HeartConnect" },
      {
        property: "og:description",
        content:
          "How HeartConnect collects, uses, and protects your personal information, and the choices you have over your data.",
      },
      { property: "og:url", content: "https://royal-heart.com/privacy" },
      { name: "twitter:title", content: "Privacy Policy — HeartConnect" },
      {
        name: "twitter:description",
        content:
          "How HeartConnect collects, uses, and protects your personal information, and the choices you have over your data.",
      },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/privacy" }],
  }),

  component: Privacy,
});

function Privacy() {
  return (
    <InfoPage
      eyebrow="Privacy Policy"
      title="Your privacy, respected"
      intro="This page is maintained by HeartConnect to explain, in plain language, how we handle your data."
    >
      <InfoSection title="Information we collect">
        <p>
          We collect the information you provide when you create a profile — such as your name, age,
          gender, location, interests, bio, and photos — along with the messages and likes you send
          on the platform and basic technical data needed to run the service.
        </p>
      </InfoSection>
      <InfoSection title="How we use your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To create and display your profile to other members.</li>
          <li>To power matching, discovery, and messaging.</li>
          <li>To keep the community safe through moderation and abuse prevention.</li>
          <li>To improve and maintain the service.</li>
        </ul>
      </InfoSection>
      <InfoSection title="What we don't do">
        <p>
          We don't sell your personal information. Your photos are stored privately and served only
          to members who are permitted to see them.
        </p>
      </InfoSection>
      <InfoSection title="Your choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>Edit or remove your profile information at any time from Settings.</li>
          <li>Control who can see and contact you with privacy and blocking tools.</li>
          <li>Delete your account, which removes your profile and associated data.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Contact">
        <p>
          Questions about your privacy? Reach us through our{" "}
          <a className="font-medium text-primary underline" href="/contact">
            Contact Us
          </a>{" "}
          page.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
