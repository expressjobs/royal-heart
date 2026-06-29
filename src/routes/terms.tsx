import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — HeartConnect" },
      {
        name: "description",
        content:
          "The terms and conditions that govern your use of HeartConnect, including eligibility, conduct, and account rules.",
      },
      { property: "og:title", content: "Terms of Service — HeartConnect" },
      {
        property: "og:description",
        content:
          "The terms and conditions that govern your use of HeartConnect, including eligibility, conduct, and account rules.",
      },
      { property: "og:url", content: "https://royal-heart.com/terms" },
      { name: "twitter:title", content: "Terms of Service — HeartConnect" },
      {
        name: "twitter:description",
        content:
          "The terms and conditions that govern your use of HeartConnect, including eligibility, conduct, and account rules.",
      },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/terms" }],
  }),

  component: Terms,
});

function Terms() {
  return (
    <InfoPage
      eyebrow="Terms of Service"
      title="The rules of the road"
      intro="By using HeartConnect, you agree to these terms. Please read them carefully."
    >
      <InfoSection title="Eligibility">
        <p>
          You must be at least 18 years old to create an account and use HeartConnect. By signing
          up, you confirm that the information you provide is accurate and that you are using the
          platform on your own behalf.
        </p>
      </InfoSection>
      <InfoSection title="Your account">
        <p>
          You're responsible for keeping your login credentials secure and for all activity on your
          account. One person, one account — impersonation and fake profiles are not allowed.
        </p>
      </InfoSection>
      <InfoSection title="Acceptable conduct">
        <ul className="list-disc space-y-2 pl-5">
          <li>Treat other members with respect.</li>
          <li>No harassment, hate speech, threats, or abusive behaviour.</li>
          <li>No spam, solicitation, or fraudulent activity.</li>
          <li>No sharing of explicit, illegal, or harmful content.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Memberships">
        <p>
          HeartConnect offers Free, Gold, and Platinum membership tiers with different features.
          Details of each tier are shown on the Membership page within the app.
        </p>
      </InfoSection>
      <InfoSection title="Enforcement">
        <p>
          We may suspend or remove accounts that violate these terms or put the community at risk.
          We aim to be fair, but safety always takes priority.
        </p>
      </InfoSection>
      <InfoSection title="Changes to these terms">
        <p>
          We may update these terms from time to time. We'll let you know about significant changes,
          and continued use of HeartConnect means you accept the updated terms.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
