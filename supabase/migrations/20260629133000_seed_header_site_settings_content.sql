-- Seed CMS-managed header and site settings.
-- Additive/idempotent: inserts missing site_content rows only and never
-- overwrites content already edited by a super admin.

INSERT INTO public.site_content (section, data)
VALUES
  (
    'header',
    '{
      "isVisible": true,
      "logoText": "HeartConnect",
      "logoImagePath": null,
      "links": [
        { "label": "About", "href": "/about", "isEnabled": true, "order": 1 },
        { "label": "Safety", "href": "/safety", "isEnabled": true, "order": 2 },
        { "label": "Blog", "href": "/blog", "isEnabled": true, "order": 3 },
        { "label": "Help", "href": "/help", "isEnabled": true, "order": 4 }
      ],
      "mobileLinks": [
        { "label": "About Us", "href": "/about", "isEnabled": true, "order": 1 },
        { "label": "Safety Center", "href": "/safety", "isEnabled": true, "order": 2 },
        {
          "label": "Community Guidelines",
          "href": "/community-guidelines",
          "isEnabled": true,
          "order": 3
        },
        { "label": "Help Center / FAQ", "href": "/help", "isEnabled": true, "order": 4 },
        { "label": "Blog", "href": "/blog", "isEnabled": true, "order": 5 },
        { "label": "Contact Us", "href": "/contact", "isEnabled": true, "order": 6 }
      ],
      "loginLabel": "Log in",
      "loginHref": "/auth",
      "joinLabel": "Join free",
      "joinHref": "/auth?mode=signup",
      "announcement": {
        "enabled": false,
        "text": "New safety tools are live for HeartConnect members.",
        "href": "/safety",
        "linkLabel": "Learn more"
      }
    }'::jsonb
  ),
  (
    'site_settings',
    '{
      "seo": {
        "title": "HeartConnect - Dating for Serious Relationships",
        "description": "HeartConnect is a modern dating platform for people seeking meaningful, lasting relationships. Create your profile, discover verified matches, and connect safely.",
        "canonicalUrl": "https://royal-heart.com",
        "ogTitle": "HeartConnect - Dating for Serious Relationships",
        "ogDescription": "Meet genuine, verified people looking for real connection. Smart matching, real-time chat, and safety-first design.",
        "ogImagePath": null,
        "ogImageUrl": "https://royal-heart.com/og-image.png"
      },
      "socialLinks": [
        {
          "label": "X / Twitter",
          "href": "https://twitter.com/HeartConnect",
          "isEnabled": true,
          "order": 1
        }
      ],
      "contact": {
        "supportEmail": "support@heartconnect.app",
        "safetyEmail": "safety@heartconnect.app",
        "pressEmail": "hello@heartconnect.app",
        "phone": "",
        "address": ""
      },
      "brand": {
        "siteName": "HeartConnect",
        "logoText": "HeartConnect",
        "logoImagePath": null,
        "faviconPath": "/favicon.ico",
        "favicon32Path": "/favicon-32.png",
        "favicon16Path": "/favicon-16.png",
        "appleTouchIconPath": "/apple-touch-icon.png",
        "icon192Path": "/icon-192.png",
        "icon512Path": "/icon-512.png"
      }
    }'::jsonb
  )
ON CONFLICT (section) DO NOTHING;
