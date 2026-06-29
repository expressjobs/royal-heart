import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, InfoSection } from "@/components/InfoPage";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — HeartConnect" },
      {
        name: "description",
        content:
          "Learn about HeartConnect's mission to bring genuine people together for meaningful, lasting relationships across the globe.",
      },
      { property: "og:title", content: "About Us — HeartConnect" },
      {
        property: "og:description",
        content:
          "Learn about HeartConnect's mission to bring genuine people together for meaningful, lasting relationships across the globe.",
      },
      { property: "og:url", content: "https://royal-heart.com/about" },
      { name: "twitter:title", content: "About Us — HeartConnect" },
      {
        name: "twitter:description",
        content:
          "Learn about HeartConnect's mission to bring genuine people together for meaningful, lasting relationships across the globe.",
      },
    ],
    links: [{ rel: "canonical", href: "https://royal-heart.com/about" }],
  }),

  component: About,
});

function About() {
  return (
    <InfoPage
      eyebrow="About Us"
      title="We're building a place for real connection"
      intro="HeartConnect exists for people who are ready for something genuine — across continents, cultures, and time zones."
    >
      <InfoSection title="Our mission">
        <p>
          HeartConnect was created to help people find meaningful, lasting relationships — not
          endless swiping. We believe that great relationships start with shared values, honesty,
          and genuine intention, and we design every feature around that belief.
        </p>
      </InfoSection>
      <InfoSection title="A global, inclusive community">
        <p>
          Our members come from more than 50 countries across Africa, Europe, Asia, the Americas,
          the Middle East, and Oceania. We're proud to be a platform where people of every
          background, culture, and identity can show up as their authentic selves and feel welcome.
        </p>
      </InfoSection>
      <InfoSection title="Safety at our core">
        <p>
          Verified profiles, robust blocking and reporting tools, and privacy-first design keep our
          community safe. Trust isn't a feature we added — it's the foundation everything else is
          built on.
        </p>
      </InfoSection>
      <InfoSection title="What we value">
        <ul className="list-disc space-y-2 pl-5">
          <li>Authenticity over vanity metrics</li>
          <li>Inclusion and respect for every member</li>
          <li>Privacy and safety as non-negotiables</li>
          <li>Meaningful connection over fleeting matches</li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}
