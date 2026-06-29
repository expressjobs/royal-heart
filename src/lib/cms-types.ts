// Shared CMS content shapes used by the public homepage and the admin CMS.

export interface HeroContent {
  badge: string;
  titleLead: string;
  titleHighlight: string;
  titleTail: string;
  subtitle: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  note: string;
  imagePath: string | null;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsContent {
  items: StatItem[];
}

export interface AboutContent {
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  imagePath: string | null;
}

export interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  isEnabled: boolean;
}

export interface FeaturesContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: FeatureCard[];
}

export interface Testimonial {
  id: string;
  name: string;
  country: string | null;
  quote: string;
  rating: number;
  photoPath: string | null;
}

export interface SuccessStory {
  id: string;
  title: string;
  coupleNames: string | null;
  body: string;
  imagePath: string | null;
}

export interface HeroSlide {
  id: string;
  imagePath: string | null;
  headline: string | null;
  subheadline: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
}

export interface CmsLink {
  label: string;
  href: string;
  isEnabled?: boolean;
  order?: number;
}

export interface HeaderAnnouncement {
  enabled: boolean;
  text: string;
  href: string;
  linkLabel: string;
}

export interface HeaderContent {
  isVisible: boolean;
  logoText: string;
  logoImagePath: string | null;
  links: CmsLink[];
  mobileLinks: CmsLink[];
  loginLabel: string;
  loginHref: string;
  joinLabel: string;
  joinHref: string;
  announcement: HeaderAnnouncement;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterContent {
  description: string;
  installNote: string;
  columns: FooterColumn[];
  copyright: string;
  tagline: string;
  socialLinks?: CmsLink[];
}

export interface SeoContent {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImagePath: string | null;
  ogImageUrl: string;
}

export interface ContactInfoContent {
  supportEmail: string;
  safetyEmail: string;
  pressEmail: string;
  phone: string;
  address: string;
}

export interface BrandAssetsContent {
  siteName: string;
  logoText: string;
  logoImagePath: string | null;
  faviconPath: string;
  favicon32Path: string;
  favicon16Path: string;
  appleTouchIconPath: string;
  icon192Path: string;
  icon512Path: string;
}

export interface SiteSettingsContent {
  seo: SeoContent;
  socialLinks: CmsLink[];
  contact: ContactInfoContent;
  brand: BrandAssetsContent;
}

export interface InfoPageSection {
  title: string;
  body: string;
  bullets: string[];
}

export interface ContactChannel {
  title: string;
  description: string;
  contact: string;
}

export interface ReportAbuseContent {
  safetyEmail: string;
  formIntro: string;
  emergencyNote: string;
}

export interface InfoPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoPageSection[];
  contactChannels?: ContactChannel[];
  reportAbuse?: ReportAbuseContent;
}

export interface HomepageContent {
  siteSettings: SiteSettingsContent;
  hero: HeroContent;
  slides: HeroSlide[];
  stats: StatsContent;
  about: AboutContent;
  features: FeaturesContent;
  testimonials: Testimonial[];
  stories: SuccessStory[];
  /** Resolved signed image URLs keyed by storage path. */
  media: Record<string, string>;
}
