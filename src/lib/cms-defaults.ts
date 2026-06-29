import type {
  AboutContent,
  HeroContent,
  StatsContent,
  SuccessStory,
  Testimonial,
} from "./cms-types";

// Production-safe defaults. Admins override these from the CMS; if a section has
// never been edited (or its content is empty), the homepage falls back to these.

export const DEFAULT_HERO: HeroContent = {
  badge: "Loved by members in 50+ countries",
  titleLead: "Find someone worth ",
  titleHighlight: "staying",
  titleTail: " for.",
  subtitle:
    "HeartConnect is where genuine people from around the world meet for meaningful, lasting relationships — smart matching, real conversations, and safety built in.",
  ctaPrimaryLabel: "Get started — it's free",
  ctaPrimaryHref: "/auth?mode=signup",
  ctaSecondaryLabel: "I already have an account",
  ctaSecondaryHref: "/auth",
  note: "Free to join · Verified members · Cancel anytime",
  imagePath: null,
};

export const DEFAULT_STATS: StatsContent = {
  items: [
    { value: "10,000+", label: "Members" },
    { value: "1,500+", label: "Matches Made" },
    { value: "50+", label: "Countries" },
    { value: "100%", label: "Profile Verification Available" },
  ],
};

export const DEFAULT_ABOUT: AboutContent = {
  enabled: true,
  eyebrow: "A global community",
  title: "Meet genuine people from every corner of the world",
  description:
    "From Lagos to Tokyo, Madrid to Mumbai — HeartConnect brings together singles of every background, culture, and story, all looking for something real.",
  imagePath: null,
};

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "default-1",
    name: "Amara & David",
    country: "Lagos · London",
    quote:
      "We matched on HeartConnect and never looked back. Two years later, we're engaged. It actually worked!",
    rating: 5,
    photoPath: null,
  },
  {
    id: "default-2",
    name: "Sofia",
    country: "Madrid",
    quote:
      "The verified profiles made me feel safe. I finally met someone genuine who wants the same things I do.",
    rating: 5,
    photoPath: null,
  },
  {
    id: "default-3",
    name: "Kenji",
    country: "Tokyo",
    quote:
      "Real conversations, no endless swiping. HeartConnect is built for people who are serious about connection.",
    rating: 5,
    photoPath: null,
  },
];

export const DEFAULT_STORIES: SuccessStory[] = [
  {
    id: "default-s1",
    title: "From a first message to forever",
    coupleNames: "Rohan & Priya",
    body: "A shared love of travel sparked a conversation that hasn't stopped since. They married last spring in Mumbai.",
    imagePath: null,
  },
  {
    id: "default-s2",
    title: "Two cities, one love story",
    coupleNames: "Elena & Marco",
    body: "Long-distance felt easy when it was the right person. They now live together in Rome with their rescue dog.",
    imagePath: null,
  },
];
