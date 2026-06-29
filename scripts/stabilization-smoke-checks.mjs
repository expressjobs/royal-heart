import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const checks = [];

function check(name, run) {
  run();
  checks.push(name);
  console.log(`PASS ${name}`);
}

check("discovery eligibility uses shared gender normalization", () => {
  const profiles = read("src/lib/profiles.ts");
  const discover = read("src/lib/discover.functions.ts");
  assert.match(profiles, /genderPreferenceValue\(gender\)/);
  assert.match(discover, /genderPreferenceValue\(gender\)/);
});

check("free daily like limit is 10 and enforced before insert", () => {
  const membership = read("src/lib/membership.ts");
  const migration = read("supabase/migrations/20260627133000_free_daily_like_limit.sql");
  assert.match(membership, /FREE_DAILY_LIKE_LIMIT = 10/);
  assert.match(migration, /today_count >= 10/);
  assert.match(migration, /BEFORE INSERT ON public\.likes/);
});

check("Gold and Platinum entitlements include legacy premium mapping", () => {
  const membership = read("src/lib/membership.ts");
  assert.match(membership, /tier === "gold" \|\| tier === "premium"/);
  assert.match(membership, /unlimitedLikes: gold/);
  assert.match(membership, /verificationBadge: platinum/);
});

check("messaging gate allows Gold and Platinum and blocks Free by default", () => {
  const discover = read("src/lib/discover.functions.ts");
  const migration = read(
    "supabase/migrations/20260627123000_enforce_discover_romantic_action_membership.sql",
  );
  assert.match(discover, /"premium", "gold", "platinum"/);
  assert.match(discover, /!settings\.free_users_can_message/);
  assert.match(migration, /enforce_message_membership/);
  assert.match(migration, /'free_users_can_message', false/);
});

check("admin health check covers app_settings", () => {
  const admin = read("src/lib/admin.functions.ts");
  assert.match(admin, /runAdminHealthCheck/);
  assert.match(admin, /name: "App settings table"/);
  assert.match(admin, /\.from\("app_settings"\)/);
});

check("app_settings migration is idempotent and avoids site_content writes", () => {
  const migration = read("supabase/migrations/20260627133000_free_daily_like_limit.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.app_settings/);
  assert.match(migration, /ON CONFLICT \(key\) DO UPDATE/);
  assert.doesNotMatch(migration, /INSERT INTO public\.site_content/);
});

check("source text contains no common mojibake markers", () => {
  const roots = ["src", "supabase", "tests", "scripts"];
  const allowed = new Set([".ts", ".tsx", ".sql", ".md", ".mjs", ".js", ".css", ".html"]);
  const mojibake = /(?:\u00e2\u20ac|\u00c2[^\s]|\u00f0\u0178|\ufffd)/;
  const failures = [];

  function scan(target) {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(target)) scan(path.join(target, entry));
      return;
    }
    if (!allowed.has(path.extname(target))) return;
    const lines = fs.readFileSync(target, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (mojibake.test(line)) failures.push(`${path.relative(root, target)}:${index + 1}`);
    });
  }

  roots.forEach((entry) => scan(path.join(root, entry)));
  assert.deepEqual(failures, []);
});

check("onboarding saves serious relationship fields", () => {
  const onboarding = read("src/routes/_authenticated/onboarding.tsx");
  for (const field of [
    "marriage_intention",
    "marriage_timeline",
    "wants_children",
    "has_children",
    "faith_or_values_importance",
    "family_values",
    "relocation_openness",
    "communication_style",
    "dealbreakers",
    "long_distance_openness",
    "parenting_preferences",
    "conflict_resolution_style",
    "love_language",
    "work_life_balance",
    "education_importance",
    "faith_importance",
    "culture_background",
    "personality_type",
    "hobbies",
    "partner_expectations",
    "future_plans",
  ]) {
    assert.match(onboarding, new RegExp(`${field}(?:\\s*:|,)`));
  }
});

check("trust score uses profile depth, verification, conversations, age, and safety risk", () => {
  const migration = read(
    "supabase/migrations/20260627160000_heartconnect_v2_optional_profile_layer.sql",
  );
  assert.match(migration, /private\.profile_trust_score/);
  assert.match(migration, /profile_photos/);
  assert.match(migration, /email_verified/);
  assert.match(migration, /phone_verified/);
  assert.match(migration, /identity_verified/);
  assert.match(migration, /photo_verified/);
  assert.match(migration, /public\.messages/);
  assert.match(migration, /safety_agreement_accepted_at/);
  assert.match(migration, /public\.reports/);
  assert.match(migration, /public\.blocks/);
});

check("compatibility scoring includes explainable serious relationship factors", () => {
  const migration = read(
    "supabase/migrations/20260627160000_heartconnect_v2_optional_profile_layer.sql",
  );
  for (const factor of [
    "marriage_timeline",
    "children",
    "faith_values",
    "relocation",
    "communication",
    "dealbreakers",
    "personality",
    "lifestyle",
    "education",
    "long_distance",
    "interests",
    "activity",
  ]) {
    assert.match(migration, new RegExp(`'${factor}'`));
  }
  assert.match(migration, /'explanation'/);
});

check("Discover cards render trust, completion, online, and compatibility reasons", () => {
  const swipeCard = read("src/components/discover/SwipeCard.tsx");
  const profileCard = read("src/components/ProfileCard.tsx");
  assert.match(swipeCard, /MARRIAGE_INTENTION_OPTIONS/);
  assert.match(swipeCard, /trustLevelLabel/);
  assert.match(swipeCard, /profile_completion_score/);
  assert.match(swipeCard, /Why you match/);
  assert.match(profileCard, /MARRIAGE_INTENTION_OPTIONS/);
  assert.match(profileCard, /trustLevelLabel/);
  assert.match(profileCard, /profile_completion_score/);
});

check("admin serious relationship filters and editor are wired", () => {
  const admin = read("src/components/admin/UserManagement.tsx");
  assert.match(admin, /complete_serious/);
  assert.match(admin, /marriage_minded/);
  assert.match(admin, /low_trust/);
  assert.match(admin, /isSeriousProfileComplete/);
  assert.match(admin, /Marriage timeline/);
  assert.match(admin, /Dealbreakers/);
});

check("serious field privacy is enforced by visible profile RPC", () => {
  const migration = read(
    "supabase/migrations/20260627160000_heartconnect_v2_optional_profile_layer.sql",
  );
  const profile = read("src/routes/_authenticated/profile.index.tsx");
  assert.match(migration, /serious_profile_visibility jsonb/);
  assert.match(migration, /private\.serious_field_visible/);
  assert.match(migration, /public\.matches/);
  assert.match(profile, /SERIOUS_PRIVACY_OPTIONS/);
});

check("verification and safety center v2 surfaces exist", () => {
  const verification = read("src/components/VerificationSection.tsx");
  const safety = read("src/routes/safety.tsx");
  assert.match(verification, /Profile verification/);
  assert.match(safety, /Scam and fake-profile warning signs/);
  assert.match(safety, /Conversation warnings/);
  assert.match(safety, /Report Abuse/);
});

check("premium entitlements use Gold and Platinum labels", () => {
  const membership = read("src/lib/membership.ts");
  const premium = read("src/routes/_authenticated/premium.tsx");
  assert.match(membership, /Gold/);
  assert.match(membership, /Platinum/);
  assert.doesNotMatch(premium, />Premium</);
});

check("demo users only may be generated with v2 serious answers", () => {
  const demo = read("src/lib/demo-users.functions.ts");
  const migration = read(
    "supabase/migrations/20260627160000_heartconnect_v2_optional_profile_layer.sql",
  );
  assert.match(demo, /parenting_preferences/);
  assert.match(demo, /future_plans/);
  assert.match(migration, /WHERE is_demo_profile IS TRUE/);
});

check("marketer applications, approval, dashboard, and photo upload are wired", () => {
  const marketerRoute = read("src/routes/_authenticated/marketer.tsx");
  const marketerFns = read("src/lib/referrals.functions.ts");
  const appShell = read("src/components/AppShell.tsx");
  assert.match(marketerFns, /applyForMarketer/);
  assert.match(marketerFns, /status: "pending"/);
  assert.match(marketerFns, /updateMyMarketerProfile/);
  assert.match(marketerFns, /uploadMyMarketerPhoto/);
  assert.match(marketerRoute, /Marketer Dashboard/);
  assert.match(marketerRoute, /QR code/);
  assert.match(appShell, /to: "\/marketer"/);
});

check("referral clicks, signup attribution, and short marketer links are tracked", () => {
  const rootRoute = read("src/routes/__root.tsx");
  const authRoute = read("src/routes/auth.tsx");
  const marketerLanding = read("src/routes/m.$code.tsx");
  const marketerFns = read("src/lib/referrals.functions.ts");
  assert.match(rootRoute, /heartconnect_referral_code/);
  assert.match(rootRoute, /landingPath/);
  assert.match(authRoute, /completeRegistrationAudit/);
  assert.match(marketerLanding, /createFileRoute\("\/m\/\$code"\)/);
  assert.match(marketerFns, /marketer_clicks/);
  assert.match(marketerFns, /click_id/);
  assert.match(marketerFns, /attachReferralSignup/);
});

check("Paystack commissions remain server-side, unique, reversible, and payable", () => {
  const paystack = read("src/lib/paystack.server.ts");
  const marketerFns = read("src/lib/referrals.functions.ts");
  const migration = read(
    "supabase/migrations/20260627160932_advanced_marketer_broadcast_program.sql",
  );
  assert.match(paystack, /createCommissionForPayment/);
  assert.match(paystack, /reverseCommissionForPayment/);
  assert.match(marketerFns, /const rate = Number\(row\.marketer\?\.commission_rate \?\? 0\.15\)/);
  assert.match(marketerFns, /status: "pending"/);
  assert.match(marketerFns, /marketer_payouts/);
  assert.match(marketerFns, /payout_id/);
  assert.match(migration, /marketer_commissions_payment_unique_idx/);
});

check("admin marketer management includes approvals, payouts, exports, and promo materials", () => {
  const admin = read("src/components/admin/MarketerManagement.tsx");
  const marketerFns = read("src/lib/referrals.functions.ts");
  assert.match(admin, /pending/);
  assert.match(admin, /suspended/);
  assert.match(admin, /exportCsv/);
  assert.match(admin, /Promotional materials/);
  assert.match(admin, /WhatsApp caption/);
  assert.match(marketerFns, /saveAdminPromoMaterial/);
  assert.match(marketerFns, /listAdminPromoMaterials/);
});

check(
  "admin broadcasts are gated, audience-filtered, confirmed for all users, and delivered as notifications",
  () => {
    const adminRoute = read("src/routes/_authenticated/admin.tsx");
    const manager = read("src/components/admin/BroadcastManager.tsx");
    const fns = read("src/lib/broadcasts.functions.ts");
    assert.match(adminRoute, /value: "broadcasts"/);
    assert.match(manager, /Preview audience/);
    assert.match(manager, /Confirm this should send to all users/);
    assert.match(fns, /requireServerAdmin/);
    assert.match(fns, /Confirm all-user broadcast before sending/);
    assert.match(fns, /broadcast_deliveries/);
    assert.match(fns, /\.from\("notifications"\)/);
  },
);

check(
  "marketer and broadcast migration adds RLS, storage, explicit grants, and safe policies",
  () => {
    const migration = read(
      "supabase/migrations/20260627160932_advanced_marketer_broadcast_program.sql",
    );
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.marketer_clicks/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.promo_materials/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.broadcasts/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.broadcast_deliveries/);
    assert.match(migration, /ALTER TABLE public\.marketer_commissions ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /GRANT SELECT ON public\.marketer_commissions TO authenticated/);
    assert.match(migration, /INSERT INTO storage\.buckets/);
    assert.match(migration, /marketer-assets/);
    assert.match(migration, /Admins read broadcast deliveries/);
  },
);

console.log(`\n${checks.length} stabilization smoke checks passed.`);
