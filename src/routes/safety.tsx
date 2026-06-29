import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety Center - HeartConnect" },
      {
        name: "description",
        content:
          "HeartConnect's Safety Center: tips for dating safely, how verification works, and the tools that keep our community protected.",
      },
      { property: "og:title", content: "Safety Center - HeartConnect" },
      {
        property: "og:description",
        content:
          "HeartConnect's Safety Center: tips for dating safely, how verification works, and the tools that keep our community protected.",
      },
      { property: "og:url", content: "https://royal-heart.com/safety" },
      { name: "twitter:title", content: "Safety Center - HeartConnect" },
      {
        name: "twitter:description",
        content:
          "HeartConnect's Safety Center: tips for dating safely, how verification works, and the tools that keep our community protected.",
      },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/safety" }],
  }),

  component: Safety,
});

function Safety() {
  return (
    <InfoPage
      eyebrow="Safety Center"
      title="Your safety comes first"
      intro="Practical guidance and built-in tools to help you date with confidence."
    >
      <InfoSection title="Protecting your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Keep conversations on HeartConnect until you fully trust someone.</li>
          <li>Never share financial information, passwords, or one-time codes.</li>
          <li>Be cautious of anyone who asks for money - it's the most common scam.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Meeting in person">
        <ul className="list-disc space-y-2 pl-5">
          <li>Meet in a public place for the first few dates.</li>
          <li>Tell a friend or family member where you're going and when.</li>
          <li>Arrange your own transportation to and from the date.</li>
          <li>Stay sober enough to keep your judgement sharp.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Profile verification">
        <p>
          Verified members display a verification badge so you know you're talking to a real person.
          Look for the badge, and consider verifying your own profile to build trust with your
          matches.
        </p>
      </InfoSection>
      <InfoSection title="Scam and fake-profile warning signs">
        <ul className="list-disc space-y-2 pl-5">
          <li>New matches who quickly ask to move off-platform or request money.</li>
          <li>Profiles with inconsistent photos, vague answers, or pressure to rush commitment.</li>
          <li>Messages that ask for codes, banking details, gift cards, crypto, or travel fees.</li>
        </ul>
      </InfoSection>
      <InfoSection title="Conversation warnings">
        <p>
          Slow down if a conversation becomes threatening, manipulative, sexually coercive, or
          financially urgent. Use Report and Block from the profile or chat, and keep screenshots if
          you need to share evidence with support or local authorities.
        </p>
      </InfoSection>
      <InfoSection title="Tools that keep you in control">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Block</strong> anyone instantly - they'll no longer be able to reach you.
          </li>
          <li>
            <strong>Report</strong> suspicious or abusive behaviour to our moderation team.
          </li>
          <li>
            <strong>Privacy controls</strong> let you decide who can see and contact you.
          </li>
        </ul>
      </InfoSection>
      <InfoSection title="Need help now?">
        <p>
          If you ever feel unsafe, trust your instincts and remove yourself from the situation. For
          urgent danger, contact your local emergency services. To report a member, visit our{" "}
          <a className="font-medium text-primary underline" href="/report-abuse">
            Report Abuse
          </a>{" "}
          page.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
