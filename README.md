# BrightHope Foundation — Charity Website

A lightweight, fully static charity website. **No database, no backend, no in-site API.**
Built with [Eleventy (11ty)](https://www.11ty.dev/), Nunjucks and plain CSS/JS.
Host it anywhere for free (Netlify, Vercel, GitHub Pages, your own server).

---

## Tech at a glance

| Need | How it is handled |
|---|---|
| Hosting | Vercel recommended (static output + tiny serverless functions for payments) |
| Donations | Secure **inline Razorpay Checkout** — amount picked on the site, payment modal opens, acknowledgement shown on our thank-you page |
| Admin | Hidden `/admin` page gated by a hashed password |
| Contact | `mailto:` form — opens the visitor's email app |
| Images & content | Files on disk; drop an image in, it appears on the site |
| Design | Warm orange theme, mobile-first, responsive |

---

## Quick start

```bash
npm install
npm run serve      # dev server with live reload at http://localhost:8080
npm run build      # build the static site into _site/
```

---

## Editing content (the "admin" workflow)

There is no database, so "publishing" = editing a file and rebuilding.
The hidden admin page (`/admin`, password below) has copy-paste tools that
produce the exact Markdown blocks you need.

### 1) Add a news post
1. Go to `/admin`, sign in.
2. Use the **Add a news post** tool to generate Markdown.
3. Create `src/posts/<my-post-title>.md` with that content.
4. Run `npm run deploy` (or `npm run build` and upload).

Alternatively write it by hand — any file in `src/posts/` is a post:

```yaml
---
layout: post.njk
title: My post title
date: 2026-09-01
excerpt: One or two sentences shown on the news card.
---
Your post body in **Markdown** here.
```

### 2) Add a program
Any file in `src/_programs/` becomes a program card (ordered by `order:`).
Use the generator on `/admin`, or write:

```yaml
---
layout: page.njk
title: Program title
tag: Education
subtitle: Short line under the heading.
excerpt: Short line on the program card.
order: 4
image: /images/community.jpg
---
Full program details in Markdown.
```

### 3) Add gallery images
Copy any image (jpg/png/webp) into `src/images/gallery/` and rebuild.
It appears in the gallery automatically. Optional captions live in
`src/_data/gallery.js`.

### 4) Replace hero / home photos
- `src/images/hero.jpg` → homepage banner (1600×900 recommended)
- `src/images/community.jpg` → home & about images

---

## Setting the admin password

Default password: `charity@2026`

1. Generate a hash for your new password:
   ```bash
   node tools/hash.js MyNewStrongPassword
   ```
2. Paste the output into `src/_data/site.json` → `admin.passwordHash`
3. Rebuild & redeploy. (The password itself is never stored — only its hash.)

> Note: client-side hashing protects casual snooping but is not a substitute for a
> real login system. Since the site is static, treat `/admin` as a convenience
> content-helper, and keep the real shared password off-page.

---

## Wiring up Razorpay donations (inline checkout)

The site opens a **Razorpay Checkout modal** inside the donation page. Donors pick an
amount, pay with cards/UPI/netbanking/wallets, then land on `/thank-you/` with their
payment details as acknowledgement. Razorpay also emails a receipt.

How it works:
1. The visitor clicks **Donate now** → the page asks `/api/create-order` for an order.
2. `api/create-order.js` (a Vercel function) creates the order with Razorpay using your
   **Key Secret** (stored as an environment variable — never in the repo).
3. The Razorpay modal opens, the donor pays.
4. `api/verify-payment.js` verifies the payment signature, then the thank-you page
   shows the references.

### Set up Vercel

1. Push this folder to GitHub (init `git init`, commit, push).
2. Import the repo at [vercel.com/new](https://vercel.com/new). The build command
   (`npm run build`) and output directory (`_site`) are already in `vercel.json`.
3. In **Project → Settings → Environment Variables**, add:
   - `RAZORPAY_KEY_ID` → your key id (e.g. `rzp_test_xxxx` or `rzp_live_xxxx`)
   - `RAZORPAY_KEY_SECRET` → your key secret
4. Deploy. (Recommended: start with **test keys**, validate, then switch to live.)

### Test mode

Use test keys (`rzp_test_…`). To simulate a successful payment use card
**4111 1111 1111 1111**, any future expiry, any CVV.

### Going live

1. Complete your Razorpay KYC (2–3 business days) so live keys work.
2. In Razorpay Dashboard → Settings → API Keys, enable **Live Mode** and copy the
   live `rzp_live_…` keys.
3. Update the two Vercel environment variables with the live values and redeploy.
   No code changes needed — the site stays identical.

### Local development with the payment flow

```bash
npm i -g vercel               # once
vercel env add RAZORPAY_KEY_ID       # add your test key
vercel env add RAZORPAY_KEY_SECRET   # add your test secret
vercel dev                            # runs the static site + api functions at :3000
```

> **Security:** the `Key Secret` must only ever live in Vercel env vars. It is never
> written to any file in this repo and never exposed to the browser. The amount is
> validated server-side in `api/create-order.js` (min ₹10, max ₹1,00,000).

---

## All site settings in one file

Everything is editable in `src/_data/site.json`:

- Site name, tagline, description, nav menu
- Hero title/subtitle, impact stats
- Color theme (`theme`)
- Donation amounts, labels, links
- Contact email, phone, address, hours
- Footer about text + social links
- Admin password hash

---

## Deploying

### Vercel (recommended — required for online donations)
The `vercel.json` already sets the build command and output directory, so it's a
two-step process: import the repo, add your Razorpay env vars, deploy. See the
[Wiring up Razorpay](#wiring-up-razorpay-donations-inline-checkout) section.

```bash
npm i -g vercel
vercel            # first deploy (follow the prompts)
vercel --prod     # production deploy
```

> **Why Vercel?** The inline payment flow needs two tiny serverless functions
> (`api/create-order.js` and `api/verify-payment.js`). Plain static-only hosts
> (e.g. GitHub Pages) can still preview/serve the site, but donations would fail.

### Netlify
Works for previewing, but serverless functions are Netlify-shaped (`netlify/functions`),
so the Razorpay flow would need small porting. Prefer Vercel.

---

## Project structure

```
├── .eleventy.js              # build config, collections, passthroughs
├── package.json              # npm scripts (build / serve / deploy)
├── vercel.json               # Vercel build & static output settings
├── api/
│   ├── create-order.js       # Vercel function: create Razorpay order (Key Secret lives in env)
│   └── verify-payment.js     # Vercel function: verify Razorpay payment signature
├── tools/hash.js             # generate an admin password hash
└── src/
    ├── _data/
    │   ├── site.json         # ALL site settings (edit this)
    │   └── gallery.js        # auto-lists gallery images + captions
    ├── _includes/            # base template, header, footer
    ├── _layouts/             # page + post layouts
    ├── _programs/            # program pages (one .md each)
    ├── admin/                # hidden admin page
    ├── assets/css/styles.css # warm orange responsive theme
    ├── assets/js/            # main.js (nav/lightbox), admin.js (gate/tools)
    ├── images/               # hero.jpg, community.jpg, gallery/*
    ├── posts/                # news posts (one .md each)
    ├── index.njk             # home page
    ├── about.njk / programs.njk / gallery.njk / news.njk
    ├── donate.njk / thank-you.njk / contact.njk
    ├── favicon.svg
    └── robots.txt
```

---

## FAQ / gotchas

- **"Live" editing from a browser?** Not possible without a backend — that's the
  trade-off for a mostly-static, DB-free site. Editing is: add/edit file → rebuild.
  It's a one-command habit (`npm run deploy`).
- **Where do payments actually happen?** In the Razorpay Checkout popup, processed by
  Razorpay's PCI-DSS compliant gateway. The site only creates the order and shows the
  acknowledgement.
- **Donations fail with "not configured"?** The Vercel env vars
  (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`) are missing or the function can't read
  them. Add them and redeploy.
- **Test payments working but live payments failing?** You're still on test keys, your
  Razorpay KYC isn't approved yet, or keys were mixed. Test orders only work with test
  keys and live orders only with live keys.
- **Images not appearing after I add them?** Rebuild the site (`npm run build`).
  Gallery images are copied during the build.
- **Custom amounts?** Supported from ₹10 to ₹1,00,000 via the custom amount input;
  the server enforces the limits.