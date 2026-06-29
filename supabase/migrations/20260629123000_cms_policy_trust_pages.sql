-- Seed CMS-managed policy/trust pages and footer links.
-- Additive/idempotent:
-- - inserts missing page:<slug> site_content rows only
-- - appends missing footer groups/links without replacing existing admin-edited footer text
-- - does not change auth, payments, subscriptions, discovery, messaging, photos, Paystack, or RLS

INSERT INTO public.site_content (section, data)
VALUES
  (
    'page:community-guidelines',
    '{
      "eyebrow": "Community Guidelines",
      "title": "A respectful community for serious connection",
      "intro": "These guidelines explain the conduct we expect from every HeartConnect member so the community stays safe, honest, and welcoming.",
      "sections": [
        {
          "title": "Be honest about who you are",
          "body": "Use your real age, current photos, and accurate profile information. Do not impersonate another person, create fake profiles, or misrepresent your identity, relationship status, location, intentions, or background.",
          "bullets": []
        },
        {
          "title": "Treat people with respect",
          "body": "",
          "bullets": [
            "No harassment, threats, intimidation, hate speech, or degrading comments.",
            "No sexual pressure, coercion, unwanted explicit content, or repeated contact after someone says no.",
            "Respect personal boundaries, privacy, and cultural differences."
          ]
        },
        {
          "title": "Keep the platform genuine",
          "body": "",
          "bullets": [
            "Do not spam, advertise, solicit, or use HeartConnect for commercial promotion.",
            "Do not ask members for money, gifts, investments, passwords, codes, banking details, or travel fees.",
            "Do not use automation, scraping, or deceptive tactics to contact members."
          ]
        },
        {
          "title": "Enforcement",
          "body": "Reports are reviewed by our moderation team. Depending on the concern, we may warn, limit, suspend, or remove accounts. Safety concerns may be prioritized over normal review timelines.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:cookie-policy',
    '{
      "eyebrow": "Cookie Policy",
      "title": "How HeartConnect uses cookies and similar technologies",
      "intro": "This policy explains how cookies and related technologies help us operate, secure, and improve HeartConnect.",
      "sections": [
        {
          "title": "What cookies are",
          "body": "Cookies are small files stored on your device. Similar technologies, such as local storage and pixels, can also help a website remember settings, keep sessions working, or understand how the service is used.",
          "bullets": []
        },
        {
          "title": "How we use them",
          "body": "",
          "bullets": [
            "Essential cookies and storage keep login sessions, security checks, and core site features working.",
            "Preference technologies remember settings such as theme or interface choices.",
            "Analytics technologies may help us understand performance and improve the service."
          ]
        },
        {
          "title": "Your choices",
          "body": "You can control cookies through your browser settings. Blocking essential cookies may prevent parts of HeartConnect from working correctly.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:refund-policy',
    '{
      "eyebrow": "Refund Policy",
      "title": "Refunds are reviewed fairly and carefully",
      "intro": "This policy explains how HeartConnect handles refund requests for paid memberships and related charges.",
      "sections": [
        {
          "title": "General approach",
          "body": "Refund eligibility depends on the type of purchase, local consumer rules, payment provider requirements, account status, and whether the paid service has already been used. We review requests in good faith and aim to be clear about the outcome.",
          "bullets": []
        },
        {
          "title": "When refunds may be available",
          "body": "",
          "bullets": [
            "Duplicate charges or clear billing errors.",
            "Technical issues that prevent access to a paid feature after reasonable troubleshooting.",
            "Other situations required by applicable law or payment provider rules."
          ]
        },
        {
          "title": "How to request a refund",
          "body": "Contact support with the email address on your account, the charge date, the amount, and a short explanation. If your purchase was made through a third-party app store or payment provider, that provider may require you to request the refund directly with them.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:subscription-billing-policy',
    '{
      "eyebrow": "Subscription & Billing Policy",
      "title": "Clear billing for paid HeartConnect memberships",
      "intro": "This policy explains how paid memberships, renewals, cancellations, and billing support work on HeartConnect.",
      "sections": [
        {
          "title": "Membership plans",
          "body": "HeartConnect may offer free and paid membership tiers. Paid tiers can include features such as expanded discovery, additional likes, visibility tools, or other benefits shown at checkout or inside the app.",
          "bullets": []
        },
        {
          "title": "Renewals and charges",
          "body": "Unless a plan is described as one-time or non-renewing, subscriptions may renew automatically at the end of each billing period until cancelled. Pricing, billing period, currency, and included features are shown before purchase.",
          "bullets": []
        },
        {
          "title": "Cancelling a subscription",
          "body": "You can cancel future renewals through the billing controls provided in your account or through the payment provider used for the purchase. Cancelling stops future renewal charges but does not automatically refund the current billing period.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:help',
    '{
      "eyebrow": "Help Center / FAQ",
      "title": "Help when you need it",
      "intro": "Find quick answers about accounts, safety, verification, memberships, and getting support from HeartConnect.",
      "sections": [
        {
          "title": "Getting started",
          "body": "",
          "bullets": [
            "Create one account using accurate information and your own current photos.",
            "Complete your profile with honest details so matching works better.",
            "Review the Safety Center before meeting someone in person."
          ]
        },
        {
          "title": "Verification",
          "body": "Verification helps members understand when a profile has completed available checks. It is not a guarantee of someone''s intentions, so continue to use good judgement and report concerns.",
          "bullets": []
        },
        {
          "title": "Billing support",
          "body": "For subscription, payment, or refund questions, contact support with your account email and payment reference if available. Do not share card numbers or passwords in support messages.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:verification-policy',
    '{
      "eyebrow": "Verification Policy",
      "title": "How verification helps build trust",
      "intro": "Verification is one layer of safety that helps members identify profiles that have completed available checks.",
      "sections": [
        {
          "title": "What verification means",
          "body": "A verification badge means a member completed the verification steps available at the time of review. It does not guarantee compatibility, conduct, background, relationship status, or future behaviour.",
          "bullets": []
        },
        {
          "title": "What we may review",
          "body": "",
          "bullets": [
            "Whether submitted photos or checks appear consistent with the account.",
            "Whether the profile follows basic authenticity and safety rules.",
            "Whether there are signals of impersonation, fraud, or duplicate accounts."
          ]
        },
        {
          "title": "Verification can change",
          "body": "A badge may be removed or a profile may be asked to verify again if account details change, suspicious activity appears, or a safety report raises concerns.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:data-deletion',
    '{
      "eyebrow": "Data Deletion / Account Deletion",
      "title": "Your choices for deleting your account and data",
      "intro": "This page explains how members can request account deletion and how HeartConnect handles related data.",
      "sections": [
        {
          "title": "Deleting your account",
          "body": "You can request account deletion from your account settings or by contacting support from the email address linked to your account. We may need to verify the request before acting on it.",
          "bullets": []
        },
        {
          "title": "What deletion generally removes",
          "body": "",
          "bullets": [
            "Your public dating profile and profile details.",
            "Your profile visibility in discovery and matching surfaces.",
            "Personal content that is no longer needed to provide the service, subject to retention rules."
          ]
        },
        {
          "title": "What may be retained",
          "body": "Some records may be retained where needed for security, fraud prevention, legal compliance, dispute handling, financial records, or enforcement of our policies. Retained records are limited to what is reasonably necessary.",
          "bullets": []
        }
      ]
    }'::jsonb
  ),
  (
    'page:blocking-reporting',
    '{
      "eyebrow": "Blocking & Reporting Policy",
      "title": "Tools that help you stay in control",
      "intro": "Blocking and reporting help members manage unwanted contact and alert HeartConnect to safety concerns.",
      "sections": [
        {
          "title": "Blocking someone",
          "body": "Blocking is designed to stop another member from contacting you through HeartConnect. It may also limit how you appear to each other in app surfaces, depending on the feature.",
          "bullets": []
        },
        {
          "title": "When to report",
          "body": "",
          "bullets": [
            "Harassment, threats, hate speech, or unwanted sexual content.",
            "Fake profiles, impersonation, scams, or requests for money.",
            "Underage users, illegal activity, or anything that creates a safety concern."
          ]
        },
        {
          "title": "What happens after a report",
          "body": "Reports are reviewed by the Trust & Safety team. We may review account details, related content, and prior reports where permitted. Actions can include warnings, limits, suspension, removal, or no action if the report is not supported.",
          "bullets": []
        }
      ]
    }'::jsonb
  )
ON CONFLICT (section) DO NOTHING;

INSERT INTO public.site_content (section, data)
VALUES
  (
    'footer',
    '{
      "description": "A modern dating platform built for serious relationships - bringing genuine people together across the globe.",
      "installNote": "Install from browser using Add to Home Screen.",
      "columns": [
        {
          "title": "Company",
          "links": [
            { "label": "About Us", "href": "/about" },
            { "label": "Contact Us", "href": "/contact" },
            { "label": "Blog", "href": "/blog" },
            { "label": "Help Center / FAQ", "href": "/help" }
          ]
        },
        {
          "title": "Trust & Safety",
          "links": [
            { "label": "Safety Center", "href": "/safety" },
            { "label": "Community Guidelines", "href": "/community-guidelines" },
            { "label": "Verification Policy", "href": "/verification-policy" },
            { "label": "Blocking & Reporting", "href": "/blocking-reporting" },
            { "label": "Report Abuse", "href": "/report-abuse" }
          ]
        },
        {
          "title": "Legal",
          "links": [
            { "label": "Privacy Policy", "href": "/privacy" },
            { "label": "Terms of Service", "href": "/terms" },
            { "label": "Cookie Policy", "href": "/cookie-policy" },
            { "label": "Refund Policy", "href": "/refund-policy" },
            { "label": "Subscription & Billing Policy", "href": "/subscription-billing-policy" },
            { "label": "Data Deletion / Account Deletion", "href": "/data-deletion" }
          ]
        }
      ],
      "copyright": "HeartConnect. Made for meaningful connection.",
      "tagline": "Dating, with intention."
    }'::jsonb
  )
ON CONFLICT (section) DO NOTHING;

DO $$
DECLARE
  footer_data jsonb;
  columns_data jsonb;
  target record;
  target_index integer;
  existing_links jsonb;
  target_link jsonb;
BEGIN
  SELECT data INTO footer_data
  FROM public.site_content
  WHERE section = 'footer'
  FOR UPDATE;

  IF footer_data IS NULL THEN
    RETURN;
  END IF;

  columns_data := footer_data->'columns';
  IF jsonb_typeof(columns_data) IS DISTINCT FROM 'array' THEN
    columns_data := '[]'::jsonb;
  END IF;

  FOR target IN
    SELECT *
    FROM jsonb_to_recordset(
      '[
        {
          "title": "Company",
          "links": [
            { "label": "About Us", "href": "/about" },
            { "label": "Contact Us", "href": "/contact" },
            { "label": "Blog", "href": "/blog" },
            { "label": "Help Center / FAQ", "href": "/help" }
          ]
        },
        {
          "title": "Trust & Safety",
          "links": [
            { "label": "Safety Center", "href": "/safety" },
            { "label": "Community Guidelines", "href": "/community-guidelines" },
            { "label": "Verification Policy", "href": "/verification-policy" },
            { "label": "Blocking & Reporting", "href": "/blocking-reporting" },
            { "label": "Report Abuse", "href": "/report-abuse" }
          ]
        },
        {
          "title": "Legal",
          "links": [
            { "label": "Privacy Policy", "href": "/privacy" },
            { "label": "Terms of Service", "href": "/terms" },
            { "label": "Cookie Policy", "href": "/cookie-policy" },
            { "label": "Refund Policy", "href": "/refund-policy" },
            { "label": "Subscription & Billing Policy", "href": "/subscription-billing-policy" },
            { "label": "Data Deletion / Account Deletion", "href": "/data-deletion" }
          ]
        }
      ]'::jsonb
    ) AS x(title text, links jsonb)
  LOOP
    SELECT (ordinality - 1)::integer INTO target_index
    FROM jsonb_array_elements(columns_data) WITH ORDINALITY AS col(value, ordinality)
    WHERE lower(col.value->>'title') = lower(target.title)
    LIMIT 1;

    IF target_index IS NULL THEN
      columns_data := columns_data || jsonb_build_array(
        jsonb_build_object('title', target.title, 'links', target.links)
      );
    ELSE
      existing_links := columns_data->target_index->'links';
      IF jsonb_typeof(existing_links) IS DISTINCT FROM 'array' THEN
        existing_links := '[]'::jsonb;
      END IF;

      FOR target_link IN SELECT value FROM jsonb_array_elements(target.links)
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(existing_links) AS existing(value)
          WHERE existing.value->>'href' = target_link->>'href'
        ) THEN
          existing_links := existing_links || jsonb_build_array(target_link);
        END IF;
      END LOOP;

      columns_data := jsonb_set(columns_data, ARRAY[target_index::text, 'links'], existing_links);
    END IF;

    target_index := NULL;
  END LOOP;

  UPDATE public.site_content
  SET data = jsonb_set(footer_data, '{columns}', columns_data),
      updated_at = now()
  WHERE section = 'footer';
END $$;
