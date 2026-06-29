import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Heart,
  ShieldCheck,
  MessagesSquare,
  Sparkles,
  Search,
  BadgeCheck,
  ArrowRight,
  Globe,
  Users,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { safeHref } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSlider } from "@/components/HeroSlider";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { PromoBanner } from "@/components/PromoBanner";
import { getHomepageContent } from "@/lib/cms.functions";
import type { HomepageContent } from "@/lib/cms-types";
import heroImage from "@/assets/hero-diverse.jpg";
import member1 from "@/assets/member-1.jpg";
import member2 from "@/assets/member-2.jpg";
import member3 from "@/assets/member-3.jpg";
import member4 from "@/assets/member-4.jpg";

const homepageContentQuery = queryOptions({
  queryKey: ["homepage-content"],
  queryFn: () => getHomepageContent(),
  staleTime: 60 * 1000,
});

const SITE_URL = "https://royal-heart.com";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homepageContentQuery),
  head: () => ({
    meta: [
      { title: "HeartConnect — Dating for Serious Relationships" },
      {
        name: "description",
        content:
          "Meet genuine people from 50+ countries looking for meaningful, lasting relationships. Smart matching, real-time chat, verified profiles, and safety-first design.",
      },
      { property: "og:title", content: "HeartConnect — Find Real Connection" },
      {
        property: "og:description",
        content:
          "A modern, global dating platform built for serious relationships. Join members from over 50 countries.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: Landing,
  errorComponent: () => <Landing />,
  notFoundComponent: () => <Landing />,
});

const STAT_ICONS: LucideIcon[] = [Users, Heart, Globe, BadgeCheck];

const MEMBER_FALLBACKS = [
  { src: member1, alt: "Smiling woman from our global community", name: "Amara", place: "Lagos" },
  { src: member2, alt: "Smiling man from our global community", name: "Kenji", place: "Tokyo" },
  { src: member3, alt: "Smiling woman from our global community", name: "Sofia", place: "Madrid" },
  { src: member4, alt: "Smiling man from our global community", name: "Rohan", place: "Mumbai" },
];

const FEATURES = [
  {
    icon: Search,
    title: "Discover with intention",
    desc: "Browse and search profiles by age, location, and shared interests — built for real compatibility, not endless swiping.",
  },
  {
    icon: Heart,
    title: "Mutual matches",
    desc: "Like the people who catch your eye. When the feeling is mutual, it's a match — and the conversation can begin.",
  },
  {
    icon: MessagesSquare,
    title: "Real-time chat",
    desc: "Message your matches instantly with live, private conversations and read receipts on Platinum.",
  },
  {
    icon: BadgeCheck,
    title: "Verified profiles",
    desc: "Profile verification badges help you know you're talking to real, genuine people.",
  },
  {
    icon: ShieldCheck,
    title: "Safety first",
    desc: "Block, report, and privacy controls keep you in charge of who can reach you.",
  },
  {
    icon: Sparkles,
    title: "Membership perks",
    desc: "Unlock unlimited likes, see who liked you, advanced filters, and featured placement.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create your profile",
    desc: "Add your best photos, interests, and a bio that tells your story.",
  },
  {
    n: "02",
    title: "Discover & like",
    desc: "Explore curated profiles and like the people you'd love to meet.",
  },
  {
    n: "03",
    title: "Match & chat",
    desc: "When you both like each other, start a real conversation.",
  },
];

function resolveImg(
  path: string | null | undefined,
  media: HomepageContent["media"],
  fallback: string,
): string {
  if (path && media[path]) return media[path];
  return fallback;
}

function Landing() {
  const { data } = useSuspenseQuery(homepageContentQuery);
  const { hero, slides, stats, about, testimonials, stories, media } = data;

  return (
    <div className="min-h-dvh bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between rounded-b-2xl bg-background/70 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/50 md:bg-transparent md:backdrop-blur-none">
          <Link to="/" aria-label="HeartConnect home">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex">
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild variant="hero" className="rounded-full">
              <Link to="/auth" search={{ mode: "signup" }}>
                Join free
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-28 md:grid-cols-2 md:pb-24 md:pt-36">
          <div className="animate-float-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
              <Globe className="h-4 w-4" /> {hero.badge}
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              {hero.titleLead}
              <span className="text-gradient-primary">{hero.titleHighlight}</span>
              {hero.titleTail}
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">{hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="xl" className="rounded-full">
                <a
                  href={
                    (hero.ctaPrimaryLabel ? safeHref(hero.ctaPrimaryHref) : undefined) ??
                    "/auth?mode=signup"
                  }
                >
                  {hero.ctaPrimaryLabel} <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              {hero.ctaSecondaryLabel && safeHref(hero.ctaSecondaryHref) && (
                <Button asChild variant="outline" size="xl" className="rounded-full">
                  <a href={safeHref(hero.ctaSecondaryHref)}>{hero.ctaSecondaryLabel}</a>
                </Button>
              )}
            </div>
            {hero.note && <p className="mt-4 text-sm text-muted-foreground">{hero.note}</p>}
          </div>

          {slides.length > 0 ? (
            <HeroSlider slides={slides} media={media} fallbackImage={heroImage} />
          ) : (
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-warm blur-2xl" />
              <div className="overflow-hidden rounded-[2rem] shadow-romantic">
                <img
                  src={resolveImg(hero.imagePath, media, heroImage)}
                  alt="A diverse group of happy singles laughing together at golden hour"
                  width={1152}
                  height={1440}
                  className="aspect-[4/5] w-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <PromoBanner placement="home_top" />

      {/* Stats */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-12 md:grid-cols-4 md:py-14">
          {stats.items.map((s, i) => {
            const Icon = STAT_ICONS[i % STAT_ICONS.length];
            return (
              <div key={`${s.label}-${i}`} className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <p className="mt-4 font-display text-3xl font-semibold text-gradient-primary md:text-4xl">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* About / global community */}
      {about.enabled && (
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="relative order-last md:order-first">
              <div className="overflow-hidden rounded-[2rem] shadow-card">
                <img
                  src={resolveImg(about.imagePath, media, member1)}
                  alt={about.title}
                  loading="lazy"
                  width={900}
                  height={1000}
                  className="aspect-[4/5] w-full object-cover md:aspect-square"
                />
              </div>
            </div>
            <div>
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                {about.eyebrow}
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {about.title}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{about.description}</p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {MEMBER_FALLBACKS.slice(0, 4).map((m) => (
                  <div
                    key={m.name}
                    className="group relative overflow-hidden rounded-2xl shadow-soft"
                  >
                    <img
                      src={m.src}
                      alt={m.alt}
                      loading="lazy"
                      width={320}
                      height={400}
                      className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="flex items-center gap-1 text-sm font-semibold text-white">
                        {m.name}
                        <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5 text-white/90" />
                      </p>
                      <p className="text-xs text-white/80">{m.place}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="bg-gradient-warm py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Built for real connection
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to meet the right person — and nothing that gets in the way.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft transition-shadow hover:shadow-card"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                  <f.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">
              Loved by members
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Real people, real connections
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.id}
                className="flex flex-col rounded-3xl border border-border/60 bg-card p-6 shadow-soft"
              >
                <div className="flex gap-0.5 text-primary">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} aria-hidden="true" className="h-4 w-4" fill="currentColor" />
                  ))}
                  <span className="sr-only">{t.rating} out of 5 stars</span>
                </div>
                <blockquote className="mt-4 flex-1 text-muted-foreground">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  {t.photoPath && media[t.photoPath] ? (
                    <img
                      src={media[t.photoPath]}
                      alt={t.name}
                      loading="lazy"
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-accent font-display text-lg font-semibold text-primary">
                      {t.name.charAt(0)}
                    </span>
                  )}
                  <span>
                    <span className="block font-semibold">{t.name}</span>
                    {t.country && (
                      <span className="block text-sm text-muted-foreground">{t.country}</span>
                    )}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Success stories */}
      {stories.length > 0 && (
        <section className="bg-card/40 py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">
                Success stories
              </span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight md:text-4xl">
                Couples who found love here
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {stories.map((s) => (
                <article
                  key={s.id}
                  className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft"
                >
                  <div className="grid sm:grid-cols-[2fr_3fr]">
                    <div className="overflow-hidden">
                      <img
                        src={resolveImg(s.imagePath, media, member2)}
                        alt={s.coupleNames ?? s.title}
                        loading="lazy"
                        width={400}
                        height={400}
                        className="h-48 w-full object-cover sm:h-full"
                      />
                    </div>
                    <div className="p-6">
                      {s.coupleNames && (
                        <p className="text-sm font-semibold text-primary">{s.coupleNames}</p>
                      )}
                      <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight md:text-4xl">
          How HeartConnect works
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl border border-border/60 bg-card p-8 shadow-soft">
              <span className="font-display text-4xl font-semibold text-gradient-primary">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="overflow-hidden rounded-[2.5rem] bg-gradient-primary px-6 py-16 text-center text-primary-foreground shadow-romantic md:px-16">
          <Star aria-hidden="true" className="mx-auto h-10 w-10" fill="currentColor" />
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Your person is out there.
          </h2>
          <p className="mx-auto mt-3 max-w-md opacity-90">
            Join HeartConnect today and start meeting people who want the same things you do.
          </p>
          <Button asChild size="xl" variant="secondary" className="mt-8 rounded-full">
            <Link to="/auth" search={{ mode: "signup" }}>
              Create your free profile <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
