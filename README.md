# BrightHope Foundation — Charity Website

A lightweight charity website. **No database** — content is files in Git, published as
a static site by [Eleventy (11ty)](https://www.11ty.dev/) (Nunjucks + plain CSS/JS),
with tiny Vercel serverless functions for payments and the browser admin tool.
Deploy free on Vercel; payouts handled by Razorpay.

---

## Tech at a glance

| Need | How it is handled |
|---|---|
| Hosting | Vercel (static output + tiny serverless functions for payments & admin) |
| Donations | Secure **inline Razorpay Checkout** — amount picked on the site, payment modal opens, acknowledgement shown on our thank-you page |
| Admin | Full content manager at `/admin` — add/edit/delete news posts, programs & gallery images; changes commit to GitHub and the site rebuilds automatically |
| Contact | `mailto:` form — opens the visitor's email app |
| Storage | Your GitHub repo (committed via API) — git is the source of truth, no database |
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

There is no database. The admin page at **`/admin`** lets you manage all content from
the browser — it commits changes to your GitHub repo and Vercel **auto-rebuilds** the
site within about a minute.

What you can do at `/admin` after signing in:

| Tab | Capabilities |
|---|---|
| **News posts** | Create, edit, delete posts (title, date, excerpt, Markdown body) |
| **Programs** | Create, edit, delete program pages (title, tag, order, excerpt, image, body) |
| **Gallery** | Upload photos (auto-resized to 1600px JPEG), delete photos, edit captions |

You can still edit files directly (`src/posts/`, `src/_programs/`,
`src/images/gallery/`) and push — everything follows the same markdown format
the admin tool writes.

The admin manager needs three Vercel env vars on top of the payment keys:

```
GITHUB_REPO            # e.g. yourname/charity-website
GITHUB_TOKEN           # Personal Access Token with repo contents read/write
ADMIN_PASSWORD_HASH    # run: node tools/hash.js <your-password>
```

### Create a GitHub Personal Access Token
1. github.com → **Settings → Developer settings → Personal access tokens → Tokens (classic)** → **Generate new token (classic)**
2. Scope: tick **`repo`** (full control of private repositories) — or for a public repo, a
   fine-grained token with **Contents: Read and write** on just this repository.
3. Copy the token (shown once) into Vercel as `GITHUB_TOKEN`.

### Set the admin password
1. `node tools/hash.js <your-new-password>` → prints the SHA-256 hash
2. Paste it into Vercel as `ADMIN_PASSWORD_HASH`
3. Redeploy. The password itself is never stored — only its hash, and it stays in
   Vercel (it is no longer shipped in the site files).

> The `/admin` "hidden" URL plus the password gate protect the UI, but anyone who can
> reach your admin API with the correct token hash can make changes. Keep your password
> strong and your GitHub token limited to this repo.

---

## One-off content editing (still available)

### Add a news post by hand
Any file in `src/posts/` is a post:

```yaml
---
layout: post.njk
title: My post title
date: 2026-09-01
excerpt: One or two sentences shown on the news card.
---
Your post body in **Markdown** here.
```

### Add a program by hand
Any file in `src/_programs/` becomes a program card (ordered by `order:`):

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

### Replace hero / home photos
- `src/images/hero.jpg` → homepage banner (1600×900 recommended)
- `src/images/community.jpg` → home & about images

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
- Donation amounts, labels, limits
- Contact email, phone, address, hours
- Footer about text + social links

(Admin password hash and GitHub token live in Vercel env vars, not in this file.)

---

## Deploying

### Vercel (recommended — required for donations & admin)
The `vercel.json` already sets the build command and output directory, so it's a
two-step process: import the repo, add your env vars, deploy. Required env vars:

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — payments
- `GITHUB_REPO`, `GITHUB_TOKEN`, `ADMIN_PASSWORD_HASH` — admin content manager

See the [Wiring up Razorpay](#wiring-up-razorpay-donations-inline-checkout) and
[Editing content](#editing-content-the-admin-workflow) sections.

```bash
npm i -g vercel
vercel            # first deploy (follow the prompts)
vercel --prod     # production deploy
```

> **Why Vercel?** Both the payment flow and the admin manager use small serverless
> functions (`api/*.js`). Plain static-only hosts (e.g. GitHub Pages) can still
> preview/serve the site, but donations and admin editing would not work.

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
│   ├── _lib.js                # shared: GitHub API + admin-token auth helpers
│   ├── create-order.js        # Vercel function: create Razorpay order (Key Secret lives in env)
│   ├── verify-payment.js      # Vercel function: verify Razorpay payment signature
│   ├── content.js             # Vercel function: CRUD for posts & programs (commits to GitHub)
│   └── media.js               # Vercel function: gallery upload/delete/captions (commits to GitHub)
├── tools/hash.js             # generate an admin password hash
└── src/
    ├── _data/
    │   ├── site.json         # ALL site settings (edit this)
    │   └── gallery.js        # auto-lists gallery images + captions
    ├── _includes/            # base template, header, footer
    ├── _layouts/             # page + post layouts
    ├── _programs/            # program pages (one .md each)
    ├── admin/                # hidden admin page (content manager UI)
    ├── assets/css/styles.css # warm orange responsive theme
    ├── assets/js/            # main.js (nav/lightbox), admin.js (content manager), donate.js (payments)
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

- **"Live" editing from a browser?** Yes — `/admin` edits commit to GitHub and Vercel
  auto-redeploys. Allow ~1 minute after a change for the new build to go live. Use a
  `?</param>` to force-refresh if you don't see it.
- **Admin says "Could not reach the admin backend"?** `GITHUB_REPO`, `GITHUB_TOKEN` or
  `ADMIN_PASSWORD_HASH` are missing/wrong in Vercel, or the repo/branch string is off.
  Use the format `owner/name` and the default branch.
- **Uploaded images failing / too big?** Photos are auto-resized to 1600px JPEG in the
  browser before upload to stay under Vercel's function body limit. Huge photos may
  still need shrinking first.
- **GitHub rejects the write ("Not Found" / 404)?** The token must have `repo` scope, or
  (fine-grained) `Contents: Read and write` on that exact repository.
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