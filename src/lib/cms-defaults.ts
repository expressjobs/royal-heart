import type {
  AboutContent,
  FeaturesContent,
  FooterContent,
  HeroContent,
  InfoPageContent,
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

export const DEFAULT_FEATURES: FeaturesContent = {
  eyebrow: "",
  title: "Built for real connection",
  subtitle: "Everything you need to meet the right person - and nothing that gets in the way.",
  items: [
    {
      icon: "search",
      title: "Discover with intention",
      description:
        "Browse and search profiles by age, location, and shared interests - built for real compatibility, not endless swiping.",
      isEnabled: true,
    },
    {
      icon: "heart",
      title: "Mutual matches",
      description:
        "Like the people who catch your eye. When the feeling is mutual, it's a match - and the conversation can begin.",
      isEnabled: true,
    },
    {
      icon: "messages",
      title: "Real-time chat",
      description:
        "Message your matches instantly with live, private conversations and read receipts on Platinum.",
      isEnabled: true,
    },
    {
      icon: "badge",
      title: "Verified profiles",
      description:
        "Profile verification badges help you know you're talking to real, genuine people.",
      isEnabled: true,
    },
    {
      icon: "shield",
      title: "Safety first",
      description: "Block, report, and privacy controls keep you in charge of who can reach you.",
      isEnabled: true,
    },
    {
      icon: "sparkles",
      title: "Membership perks",
      description:
        "Unlock unlimited likes, see who liked you, advanced filters, and featured placement.",
      isEnabled: true,
    },
  ],
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

export const DEFAULT_FOOTER: FooterContent = {
  description:
    "A modern dating platform built for serious relationships - bringing genuine people together across the globe.",
  installNote: "Install from browser using Add to Home Screen.",
  columns: [
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Blog", href: "/blog" },
        { label: "Contact Us", href: "/contact" },
      ],
    },
    {
      title: "Trust & Safety",
      links: [
        { label: "Safety Center", href: "/safety" },
        { label: "Report Abuse", href: "/report-abuse" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ],
  copyright: "HeartConnect. Made for meaningful connection.",
  tagline: "Dating, with intention.",
};

export const DEFAULT_INFO_PAGES: Record<string, InfoPageContent> = {
  about: {
    eyebrow: "About Us",
    title: "We're building a place for real connection",
    intro:
      "HeartConnect exists for people who are ready for something genuine - across continents, cultures, and time zones.",
    sections: [
      {
        title: "Our mission",
        body: "HeartConnect was created to help people find meaningful, lasting relationships - not endless swiping. We believe that great relationships start with shared values, honesty, and genuine intention, and we design every feature around that belief.",
        bullets: [],
      },
      {
        title: "A global, inclusive community",
        body: "Our members come from more than 50 countries across Africa, Europe, Asia, the Americas, the Middle East, and Oceania. We're proud to be a platform where people of every background, culture, and identity can show up as their authentic selves and feel welcome.",
        bullets: [],
      },
      {
        title: "Safety at our core",
        body: "Verified profiles, robust blocking and reporting tools, and privacy-first design keep our community safe. Trust isn't a feature we added - it's the foundation everything else is built on.",
        bullets: [],
      },
      {
        title: "What we value",
        body: "",
        bullets: [
          "Authenticity over vanity metrics",
          "Inclusion and respect for every member",
          "Privacy and safety as non-negotiables",
          "Meaningful connection over fleeting matches",
        ],
      },
    ],
  },
  safety: {
    eyebrow: "Safety Center",
    title: "Your safety comes first",
    intro: "Practical guidance and built-in tools to help you date with confidence.",
    sections: [
      {
        title: "Protecting your information",
        body: "",
        bullets: [
          "Keep conversations on HeartConnect until you fully trust someone.",
          "Never share financial information, passwords, or one-time codes.",
          "Be cautious of anyone who asks for money - it's the most common scam.",
        ],
      },
      {
        title: "Meeting in person",
        body: "",
        bullets: [
          "Meet in a public place for the first few dates.",
          "Tell a friend or family member where you're going and when.",
          "Arrange your own transportation to and from the date.",
          "Stay sober enough to keep your judgement sharp.",
        ],
      },
      {
        title: "Profile verification",
        body: "Verified members display a verification badge so you know you're talking to a real person. Look for the badge, and consider verifying your own profile to build trust with your matches.",
        bullets: [],
      },
      {
        title: "Scam and fake-profile warning signs",
        body: "",
        bullets: [
          "New matches who quickly ask to move off-platform or request money.",
          "Profiles with inconsistent photos, vague answers, or pressure to rush commitment.",
          "Messages that ask for codes, banking details, gift cards, crypto, or travel fees.",
        ],
      },
      {
        title: "Conversation warnings",
        body: "Slow down if a conversation becomes threatening, manipulative, sexually coercive, or financially urgent. Use Report and Block from the profile or chat, and keep screenshots if you need to share evidence with support or local authorities.",
        bullets: [],
      },
      {
        title: "Tools that keep you in control",
        body: "",
        bullets: [
          "Block anyone instantly - they'll no longer be able to reach you.",
          "Report suspicious or abusive behaviour to our moderation team.",
          "Privacy controls let you decide who can see and contact you.",
        ],
      },
      {
        title: "Need help now?",
        body: "If you ever feel unsafe, trust your instincts and remove yourself from the situation. For urgent danger, contact your local emergency services. To report a member, visit our Report Abuse page.",
        bullets: [],
      },
    ],
  },
  "report-abuse": {
    eyebrow: "Report Abuse",
    title: "Help us keep HeartConnect safe",
    intro:
      "Report fake profiles, harassment, scams, or anything that makes you feel unsafe. Every report is reviewed by our Trust & Safety team.",
    sections: [],
    reportAbuse: {
      safetyEmail: "safety@heartconnect.app",
      formIntro:
        "If you're signed in, the fastest way to report someone is from their profile - open the menu and choose Report. You can also submit a report below and it will be sent to our safety team.",
      emergencyNote:
        "This opens your email app addressed to safety@heartconnect.app. In an emergency, contact your local emergency services.",
    },
  },
  privacy: {
    eyebrow: "Privacy Policy",
    title: "Your privacy, respected",
    intro:
      "This page is maintained by HeartConnect to explain, in plain language, how we handle your data.",
    sections: [
      {
        title: "Information we collect",
        body: "We collect the information you provide when you create a profile - such as your name, age, gender, location, interests, bio, and photos - along with the messages and likes you send on the platform and basic technical data needed to run the service.",
        bullets: [],
      },
      {
        title: "How we use your information",
        body: "",
        bullets: [
          "To create and display your profile to other members.",
          "To power matching, discovery, and messaging.",
          "To keep the community safe through moderation and abuse prevention.",
          "To improve and maintain the service.",
        ],
      },
      {
        title: "What we don't do",
        body: "We don't sell your personal information. Your photos are stored privately and served only to members who are permitted to see them.",
        bullets: [],
      },
      {
        title: "Your choices",
        body: "",
        bullets: [
          "Edit or remove your profile information at any time from Settings.",
          "Control who can see and contact you with privacy and blocking tools.",
          "Delete your account, which removes your profile and associated data.",
        ],
      },
      {
        title: "Contact",
        body: "Questions about your privacy? Reach us through our Contact Us page.",
        bullets: [],
      },
    ],
  },
  terms: {
    eyebrow: "Terms of Service",
    title: "The rules of the road",
    intro: "By using HeartConnect, you agree to these terms. Please read them carefully.",
    sections: [
      {
        title: "Eligibility",
        body: "You must be at least 18 years old to create an account and use HeartConnect. By signing up, you confirm that the information you provide is accurate and that you are using the platform on your own behalf.",
        bullets: [],
      },
      {
        title: "Your account",
        body: "You're responsible for keeping your login credentials secure and for all activity on your account. One person, one account - impersonation and fake profiles are not allowed.",
        bullets: [],
      },
      {
        title: "Acceptable conduct",
        body: "",
        bullets: [
          "Treat other members with respect.",
          "No harassment, hate speech, threats, or abusive behaviour.",
          "No spam, solicitation, or fraudulent activity.",
          "No sharing of explicit, illegal, or harmful content.",
        ],
      },
      {
        title: "Memberships",
        body: "HeartConnect offers Free, Gold, and Platinum membership tiers with different features. Details of each tier are shown on the Membership page within the app.",
        bullets: [],
      },
      {
        title: "Enforcement",
        body: "We may suspend or remove accounts that violate these terms or put the community at risk. We aim to be fair, but safety always takes priority.",
        bullets: [],
      },
      {
        title: "Changes to these terms",
        body: "We may update these terms from time to time. We'll let you know about significant changes, and continued use of HeartConnect means you accept the updated terms.",
        bullets: [],
      },
    ],
  },
  contact: {
    eyebrow: "Contact Us",
    title: "We'd love to hear from you",
    intro: "Whether you need a hand or just want to say hello, here's how to reach us.",
    sections: [
      {
        title: "Response times",
        body: "Our team typically responds within 1-2 business days. For urgent safety matters, please also use the in-app reporting tools so we can act as quickly as possible.",
        bullets: [],
      },
    ],
    contactChannels: [
      {
        title: "General support",
        description: "Account help, billing questions, and anything else.",
        contact: "support@heartconnect.app",
      },
      {
        title: "Trust & safety",
        description: "Report a member or raise a safety concern.",
        contact: "safety@heartconnect.app",
      },
      {
        title: "Press & partnerships",
        description: "Media enquiries and collaboration opportunities.",
        contact: "hello@heartconnect.app",
      },
    ],
  },
};
