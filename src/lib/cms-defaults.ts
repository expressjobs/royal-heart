import type {
  AboutContent,
  FeaturesContent,
  FooterContent,
  HeaderContent,
  HeroContent,
  InfoPageContent,
  SiteSettingsContent,
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

export const DEFAULT_HEADER: HeaderContent = {
  isVisible: true,
  logoText: "HeartConnect",
  logoImagePath: null,
  links: [
    { label: "About", href: "/about", isEnabled: true, order: 1 },
    { label: "Safety", href: "/safety", isEnabled: true, order: 2 },
    { label: "Blog", href: "/blog", isEnabled: true, order: 3 },
    { label: "Help", href: "/help", isEnabled: true, order: 4 },
  ],
  mobileLinks: [
    { label: "About Us", href: "/about", isEnabled: true, order: 1 },
    { label: "Safety Center", href: "/safety", isEnabled: true, order: 2 },
    { label: "Community Guidelines", href: "/community-guidelines", isEnabled: true, order: 3 },
    { label: "Help Center / FAQ", href: "/help", isEnabled: true, order: 4 },
    { label: "Blog", href: "/blog", isEnabled: true, order: 5 },
    { label: "Contact Us", href: "/contact", isEnabled: true, order: 6 },
  ],
  loginLabel: "Log in",
  loginHref: "/auth",
  joinLabel: "Join free",
  joinHref: "/auth?mode=signup",
  announcement: {
    enabled: false,
    text: "New safety tools are live for HeartConnect members.",
    href: "/safety",
    linkLabel: "Learn more",
  },
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsContent = {
  seo: {
    title: "HeartConnect - Dating for Serious Relationships",
    description:
      "HeartConnect is a modern dating platform for people seeking meaningful, lasting relationships. Create your profile, discover verified matches, and connect safely.",
    canonicalUrl: "https://royal-heart.com",
    ogTitle: "HeartConnect - Dating for Serious Relationships",
    ogDescription:
      "Meet genuine, verified people looking for real connection. Smart matching, real-time chat, and safety-first design.",
    ogImagePath: null,
    ogImageUrl: "https://royal-heart.com/og-image.png",
  },
  socialLinks: [
    { label: "X / Twitter", href: "https://twitter.com/HeartConnect", isEnabled: true, order: 1 },
  ],
  contact: {
    supportEmail: "support@heartconnect.app",
    safetyEmail: "safety@heartconnect.app",
    pressEmail: "hello@heartconnect.app",
    phone: "",
    address: "",
  },
  brand: {
    siteName: "HeartConnect",
    logoText: "HeartConnect",
    logoImagePath: null,
    faviconPath: "/favicon.ico",
    favicon32Path: "/favicon-32.png",
    favicon16Path: "/favicon-16.png",
    appleTouchIconPath: "/apple-touch-icon.png",
    icon192Path: "/icon-192.png",
    icon512Path: "/icon-512.png",
  },
};

export const DEFAULT_FOOTER: FooterContent = {
  description:
    "A modern dating platform built for serious relationships - bringing genuine people together across the globe.",
  installNote: "Install from browser using Add to Home Screen.",
  columns: [
    {
      title: "Company",
      links: [
        { label: "About Us", href: "/about" },
        { label: "Contact Us", href: "/contact" },
        { label: "Blog", href: "/blog" },
        { label: "Help Center / FAQ", href: "/help" },
      ],
    },
    {
      title: "Trust & Safety",
      links: [
        { label: "Safety Center", href: "/safety" },
        { label: "Community Guidelines", href: "/community-guidelines" },
        { label: "Verification Policy", href: "/verification-policy" },
        { label: "Blocking & Reporting", href: "/blocking-reporting" },
        { label: "Report Abuse", href: "/report-abuse" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Cookie Policy", href: "/cookie-policy" },
        { label: "Refund Policy", href: "/refund-policy" },
        { label: "Subscription & Billing Policy", href: "/subscription-billing-policy" },
        { label: "Data Deletion / Account Deletion", href: "/data-deletion" },
      ],
    },
  ],
  copyright: "HeartConnect. Made for meaningful connection.",
  tagline: "Dating, with intention.",
  socialLinks: DEFAULT_SITE_SETTINGS.socialLinks,
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
  "community-guidelines": {
    eyebrow: "Community Guidelines",
    title: "A respectful community for serious connection",
    intro:
      "These guidelines explain the conduct we expect from every HeartConnect member so the community stays safe, honest, and welcoming.",
    sections: [
      {
        title: "Be honest about who you are",
        body: "Use your real age, current photos, and accurate profile information. Do not impersonate another person, create fake profiles, or misrepresent your identity, relationship status, location, intentions, or background.",
        bullets: [],
      },
      {
        title: "Treat people with respect",
        body: "",
        bullets: [
          "No harassment, threats, intimidation, hate speech, or degrading comments.",
          "No sexual pressure, coercion, unwanted explicit content, or repeated contact after someone says no.",
          "Respect personal boundaries, privacy, and cultural differences.",
        ],
      },
      {
        title: "Keep the platform genuine",
        body: "",
        bullets: [
          "Do not spam, advertise, solicit, or use HeartConnect for commercial promotion.",
          "Do not ask members for money, gifts, investments, passwords, codes, banking details, or travel fees.",
          "Do not use automation, scraping, or deceptive tactics to contact members.",
        ],
      },
      {
        title: "Content that is not allowed",
        body: "We may remove content or accounts that involve illegal activity, exploitation, abuse, graphic violence, scams, non-consensual intimate content, or anything that puts members at risk.",
        bullets: [],
      },
      {
        title: "Enforcement",
        body: "Reports are reviewed by our moderation team. Depending on the concern, we may warn, limit, suspend, or remove accounts. Safety concerns may be prioritized over normal review timelines.",
        bullets: [],
      },
    ],
  },
  "cookie-policy": {
    eyebrow: "Cookie Policy",
    title: "How HeartConnect uses cookies and similar technologies",
    intro:
      "This policy explains how cookies and related technologies help us operate, secure, and improve HeartConnect.",
    sections: [
      {
        title: "What cookies are",
        body: "Cookies are small files stored on your device. Similar technologies, such as local storage and pixels, can also help a website remember settings, keep sessions working, or understand how the service is used.",
        bullets: [],
      },
      {
        title: "How we use them",
        body: "",
        bullets: [
          "Essential cookies and storage keep login sessions, security checks, and core site features working.",
          "Preference technologies remember settings such as theme or interface choices.",
          "Analytics technologies may help us understand performance and improve the service.",
        ],
      },
      {
        title: "Third-party services",
        body: "Some technologies may be set by service providers that help us run the website, process security checks, measure performance, or provide embedded functionality. Their use is limited to operating and improving HeartConnect.",
        bullets: [],
      },
      {
        title: "Your choices",
        body: "You can control cookies through your browser settings. Blocking essential cookies may prevent parts of HeartConnect from working correctly.",
        bullets: [],
      },
    ],
  },
  "refund-policy": {
    eyebrow: "Refund Policy",
    title: "Refunds are reviewed fairly and carefully",
    intro:
      "This policy explains how HeartConnect handles refund requests for paid memberships and related charges.",
    sections: [
      {
        title: "General approach",
        body: "Refund eligibility depends on the type of purchase, local consumer rules, payment provider requirements, account status, and whether the paid service has already been used. We review requests in good faith and aim to be clear about the outcome.",
        bullets: [],
      },
      {
        title: "When refunds may be available",
        body: "",
        bullets: [
          "Duplicate charges or clear billing errors.",
          "Technical issues that prevent access to a paid feature after reasonable troubleshooting.",
          "Other situations required by applicable law or payment provider rules.",
        ],
      },
      {
        title: "When refunds may be declined",
        body: "",
        bullets: [
          "A subscription period has already been used or partially used.",
          "An account was suspended or removed for violating HeartConnect policies.",
          "The request is outside the applicable review or provider window.",
        ],
      },
      {
        title: "How to request a refund",
        body: "Contact support with the email address on your account, the charge date, the amount, and a short explanation. If your purchase was made through a third-party app store or payment provider, that provider may require you to request the refund directly with them.",
        bullets: [],
      },
    ],
  },
  "subscription-billing-policy": {
    eyebrow: "Subscription & Billing Policy",
    title: "Clear billing for paid HeartConnect memberships",
    intro:
      "This policy explains how paid memberships, renewals, cancellations, and billing support work on HeartConnect.",
    sections: [
      {
        title: "Membership plans",
        body: "HeartConnect may offer free and paid membership tiers. Paid tiers can include features such as expanded discovery, additional likes, visibility tools, or other benefits shown at checkout or inside the app.",
        bullets: [],
      },
      {
        title: "Renewals and charges",
        body: "Unless a plan is described as one-time or non-renewing, subscriptions may renew automatically at the end of each billing period until cancelled. Pricing, billing period, currency, and included features are shown before purchase.",
        bullets: [],
      },
      {
        title: "Cancelling a subscription",
        body: "You can cancel future renewals through the billing controls provided in your account or through the payment provider used for the purchase. Cancelling stops future renewal charges but does not automatically refund the current billing period.",
        bullets: [],
      },
      {
        title: "Billing problems",
        body: "If a payment fails, access to paid features may be paused or downgraded until billing is resolved. If you believe a charge is incorrect, contact support with the account email, charge date, amount, and payment reference if available.",
        bullets: [],
      },
    ],
  },
  help: {
    eyebrow: "Help Center / FAQ",
    title: "Help when you need it",
    intro:
      "Find quick answers about accounts, safety, verification, memberships, and getting support from HeartConnect.",
    sections: [
      {
        title: "Getting started",
        body: "",
        bullets: [
          "Create one account using accurate information and your own current photos.",
          "Complete your profile with honest details so matching works better.",
          "Review the Safety Center before meeting someone in person.",
        ],
      },
      {
        title: "Account and profile help",
        body: "You can update most profile details from your account area. Some safety-sensitive details may be limited or reviewed to protect the community.",
        bullets: [],
      },
      {
        title: "Verification",
        body: "Verification helps members understand when a profile has completed available checks. It is not a guarantee of someone's intentions, so continue to use good judgement and report concerns.",
        bullets: [],
      },
      {
        title: "Billing support",
        body: "For subscription, payment, or refund questions, contact support with your account email and payment reference if available. Do not share card numbers or passwords in support messages.",
        bullets: [],
      },
      {
        title: "Safety support",
        body: "Use the in-app report tools for member-specific safety concerns. For urgent danger, contact local emergency services first.",
        bullets: [],
      },
    ],
  },
  "verification-policy": {
    eyebrow: "Verification Policy",
    title: "How verification helps build trust",
    intro:
      "Verification is one layer of safety that helps members identify profiles that have completed available checks.",
    sections: [
      {
        title: "What verification means",
        body: "A verification badge means a member completed the verification steps available at the time of review. It does not guarantee compatibility, conduct, background, relationship status, or future behaviour.",
        bullets: [],
      },
      {
        title: "What we may review",
        body: "",
        bullets: [
          "Whether submitted photos or checks appear consistent with the account.",
          "Whether the profile follows basic authenticity and safety rules.",
          "Whether there are signals of impersonation, fraud, or duplicate accounts.",
        ],
      },
      {
        title: "Verification can change",
        body: "A badge may be removed or a profile may be asked to verify again if account details change, suspicious activity appears, or a safety report raises concerns.",
        bullets: [],
      },
      {
        title: "Use verification wisely",
        body: "Verification is helpful, but it is not a substitute for careful judgement. Keep early conversations on HeartConnect, protect personal information, and report anything suspicious.",
        bullets: [],
      },
    ],
  },
  "data-deletion": {
    eyebrow: "Data Deletion / Account Deletion",
    title: "Your choices for deleting your account and data",
    intro:
      "This page explains how members can request account deletion and how HeartConnect handles related data.",
    sections: [
      {
        title: "Deleting your account",
        body: "You can request account deletion from your account settings or by contacting support from the email address linked to your account. We may need to verify the request before acting on it.",
        bullets: [],
      },
      {
        title: "What deletion generally removes",
        body: "",
        bullets: [
          "Your public dating profile and profile details.",
          "Your profile visibility in discovery and matching surfaces.",
          "Personal content that is no longer needed to provide the service, subject to retention rules.",
        ],
      },
      {
        title: "What may be retained",
        body: "Some records may be retained where needed for security, fraud prevention, legal compliance, dispute handling, financial records, or enforcement of our policies. Retained records are limited to what is reasonably necessary.",
        bullets: [],
      },
      {
        title: "How to make a request",
        body: "Contact support with the email address on your account and the request you want us to complete. Do not send passwords, payment card numbers, or sensitive documents unless we specifically ask for them through a secure process.",
        bullets: [],
      },
    ],
  },
  "blocking-reporting": {
    eyebrow: "Blocking & Reporting Policy",
    title: "Tools that help you stay in control",
    intro:
      "Blocking and reporting help members manage unwanted contact and alert HeartConnect to safety concerns.",
    sections: [
      {
        title: "Blocking someone",
        body: "Blocking is designed to stop another member from contacting you through HeartConnect. It may also limit how you appear to each other in app surfaces, depending on the feature.",
        bullets: [],
      },
      {
        title: "When to report",
        body: "",
        bullets: [
          "Harassment, threats, hate speech, or unwanted sexual content.",
          "Fake profiles, impersonation, scams, or requests for money.",
          "Underage users, illegal activity, or anything that creates a safety concern.",
        ],
      },
      {
        title: "What happens after a report",
        body: "Reports are reviewed by the Trust & Safety team. We may review account details, related content, and prior reports where permitted. Actions can include warnings, limits, suspension, removal, or no action if the report is not supported.",
        bullets: [],
      },
      {
        title: "Emergency situations",
        body: "HeartConnect reporting is not an emergency service. If someone is in immediate danger, contact local emergency services first, then report the account when it is safe to do so.",
        bullets: [],
      },
    ],
  },
};
