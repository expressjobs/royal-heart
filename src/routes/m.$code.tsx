import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Share2 } from "lucide-react";
import { captureReferralVisit } from "@/lib/referrals.functions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/m/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `HeartConnect invite ${params.code} - Serious Dating` },
      {
        name: "description",
        content:
          "Join HeartConnect through a marketer invite and meet people seeking serious relationships.",
      },
    ],
  }),
  component: MarketerLanding,
});

function MarketerLanding() {
  const { code } = Route.useParams();

  useEffect(() => {
    if (!code) return;
    void captureReferralVisit({
      data: {
        code,
        sourceUrl: window.location.href,
        landingPath: window.location.pathname,
      },
    }).then((result) => {
      if (!result.ok || !result.code) return;
      localStorage.setItem("heartconnect_referral_code", result.code);
      localStorage.setItem("heartconnect_referral_source", window.location.href);
      document.cookie = `heartconnect_referral_code=${encodeURIComponent(result.code)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    });
  }, [code]);

  return (
    <main className="min-h-screen bg-gradient-warm px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <Logo />
        <div className="mt-14 rounded-[2rem] border border-border bg-card p-8 shadow-card md:p-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary">
            <Share2 className="h-7 w-7" />
          </span>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            You have been invited to HeartConnect
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Join a serious relationship and marriage-focused community built for genuine profiles,
            safer conversations, and meaningful compatibility.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="xl" className="rounded-full">
              <Link to="/auth" search={{ mode: "signup" }}>
                <Heart className="h-5 w-5" fill="currentColor" /> Create free profile
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="rounded-full">
              <Link to="/">Learn more</Link>
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">Referral code: {code}</p>
        </div>
      </div>
    </main>
  );
}
