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

export interface HomepageContent {
  hero: HeroContent;
  slides: HeroSlide[];
  stats: StatsContent;
  about: AboutContent;
  testimonials: Testimonial[];
  stories: SuccessStory[];
  /** Resolved signed image URLs keyed by storage path. */
  media: Record<string, string>;
}
