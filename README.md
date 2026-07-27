# DU2BAO2

> Update: Login dialog close fix added. The × button, backdrop click and Escape key now close account dialogs reliably, and the service-worker cache version was refreshed. Marketplace — Upgraded Version

This is a responsive GitHub Pages website for buying and selling pre-owned products. It works on phones, tablets and desktop browsers from one set of source files.

## Categories included

- Luxury Bags
- Watches
- Fashion
- Technology
- Jewelry
- Accessories
- Miscellaneous

## What is included

- Professional responsive homepage
- Two-column mobile product grid and four-column desktop grid
- Search, category filtering, condition filtering and price sorting
- Individual shareable product pages
- Wishlist saved in the visitor's browser
- Supabase email registration and login
- Seller listing form with up to six photos
- Supabase Storage image uploads
- Seller profile name and WhatsApp number
- Seller dashboard with pending, approved, rejected and sold status
- Admin approval and rejection controls
- Approved-only public listings
- Loading, empty and error states
- Installable web-app manifest and service worker
- `CNAME` file for `du2bao2.com`
- Supabase database, security policy and storage setup SQL

## Files to upload to GitHub

Upload **every file in this folder** to the root of the same GitHub repository:

- `index.html`
- `product.html`
- `styles.css`
- `script.js`
- `product.js`
- `data.js`
- `config.js`
- `supabase-setup.sql`
- `manifest.webmanifest`
- `service-worker.js`
- `favicon.svg`
- `CNAME`
- `README.md`

Do not upload only `index.html`. The website needs the other files beside it.

## Part 1 — Test the design first

Before Supabase is connected, the website opens in **Setup mode** with sample products. Accounts, listing submissions and approvals are simulated in that browser using `localStorage`.

This lets you check the design immediately, but the sample-mode data is not shared between devices.

## Part 2 — Create the Supabase database

1. Open your Supabase project.
2. Choose **SQL Editor**.
3. Open `supabase-setup.sql` from this folder.
4. Copy the entire SQL file into Supabase SQL Editor.
5. Click **Run**.

The SQL creates:

- `profiles`
- `admins`
- `listings`
- `listing_images`
- `favorites`
- A public `listing-images` Storage bucket
- Row Level Security policies
- Automatic user-profile creation

## Part 3 — Connect the website to Supabase

In Supabase:

1. Open **Project Settings → API**.
2. Copy the **Project URL**.
3. Copy the **anon public key**.

Open `config.js` and replace the empty values:

```js
window.DU2BAO2_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
  ADMIN_EMAILS: ["your-real-email@example.com"],
  WHATSAPP_NUMBER: "60123456789",
  SITE_URL: "https://du2bao2.com"
};
```

Important:

- The anon public key is intended for browser use.
- Never put the Supabase **service role key** in GitHub or `config.js`.
- Use the country code in WhatsApp numbers, without `+`, spaces or dashes. Malaysian numbers normally begin with `60`.

## Part 4 — Configure Supabase authentication

In Supabase:

1. Open **Authentication → URL Configuration**.
2. Set the Site URL to:

```text
https://du2bao2.com
```

3. Add these Redirect URLs while setting up:

```text
https://du2bao2.com/**
https://sylvia218.github.io/**
http://localhost:8000/**
```

4. Under **Authentication → Providers → Email**, keep Email enabled.
5. Decide whether users must confirm their email before logging in.

## Part 5 — Make your account an admin

1. Upload and publish the website.
2. Register your own account through the website.
3. In Supabase, open **SQL Editor**.
4. Run this after replacing the email:

```sql
insert into public.admins (user_id)
select id from auth.users
where email = 'your-real-email@example.com'
on conflict (user_id) do nothing;
```

5. Put the same email inside `ADMIN_EMAILS` in `config.js`.
6. Log out and log in again.

Both steps are required:

- `config.js` displays the Admin button.
- The `admins` database table gives the account permission to approve or reject listings.

## How listing approval works

1. A registered seller submits an item.
2. The listing is saved with the status `pending`.
3. It appears immediately in the seller's dashboard.
4. It does **not** appear publicly yet.
5. An admin opens **Account → Admin approvals**.
6. The admin approves or rejects it.
7. Approved listings appear on the homepage and receive an individual product page.
8. The seller can later mark an approved listing as sold.

This is the fix for submitted products appearing to be missing: pending products stay visible to their seller while waiting for approval.

## Put the website on GitHub Pages

1. Open your GitHub repository.
2. Upload all files from this folder to the repository root.
3. Commit the changes.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select:
   - Branch: `main`
   - Folder: `/root`
7. Click **Save**.

The repository must contain `index.html` at its top level, not inside another folder.

## Connect `du2bao2.com` through Cloudflare

The included `CNAME` file already contains:

```text
du2bao2.com
```

In GitHub:

1. Open **Repository → Settings → Pages**.
2. Enter `du2bao2.com` under **Custom domain**.
3. Save it before changing DNS.

In Cloudflare DNS, create these four apex records:

| Type | Name | Content | Proxy status |
|---|---|---|---|
| A | `@` | `185.199.108.153` | DNS only initially |
| A | `@` | `185.199.109.153` | DNS only initially |
| A | `@` | `185.199.110.153` | DNS only initially |
| A | `@` | `185.199.111.153` | DNS only initially |

For the `www` version, add:

| Type | Name | Content | Proxy status |
|---|---|---|---|
| CNAME | `www` | `sylvia218.github.io` | DNS only initially |

Remove any conflicting old `A`, `AAAA` or `CNAME` records for `@` or `www` that point somewhere else. Do not add a wildcard `*` record for the GitHub Pages site.

After GitHub confirms the domain and the certificate becomes available, enable **Enforce HTTPS** in GitHub Pages settings. DNS and HTTPS changes can take time to finish.

## Local testing on a computer

From inside the folder, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

A local server is better than double-clicking `index.html`, especially when testing the service worker and Supabase.

## Important launch limitations

This version includes marketplace listings, accounts, approvals, images, dashboards and direct WhatsApp contact. Before accepting real customer payments, add and legally review:

- A Malaysia-supported payment gateway
- Payment confirmation and order records
- Delivery and tracking
- Refund and dispute procedures
- Item-authentication operations
- Seller identity checks
- Terms of service and privacy policy
- Prohibited-item rules
- Fraud monitoring
- Transactional emails
- Database backups and monitoring

Do not advertise escrow, guaranteed authentication, buyer protection or secure payment as active services until those systems are actually implemented and tested.


## Footer and legal-information upgrade

This package adds a dark multi-column footer inspired by the supplied reference image and links it to these new pages:

- `shipping.html`
- `returns.html`
- `privacy.html`
- `terms.html`
- `prohibited-items.html`
- `safety.html`
- `seller-rules.html`
- `marketplace-role.html`
- `contact.html`

The pages are written for the current Stage 1 model: buyers and sellers deal directly, while DU2BAO2 provides listings, accounts, contact, review and complaint functions.

### Complete these placeholders before public launch

Search the legal pages for square brackets and replace:

- `[DU2BAO2 LEGAL ENTITY]`
- `[ADD REGISTERED ENTITY]`
- `[ADD NUMBER WHEN REGISTERED]`
- `[ADD SUPPORT EMAIL]`
- `[ADD PRIVACY EMAIL]`
- `[ADD SUPPORT NUMBER, IF USED]`
- `[ADD SUPPORT HOURS]`
- `[ADD ADDRESS]`
- `[ADD REGISTERED OR SERVICE ADDRESS]`

These pages are practical drafts and should receive a final Malaysian legal review. Adding policy pages alone does not make the marketplace fully compliant. In particular, the uploaded prototype still needs the final seller-identity, Bahasa Malaysia disclosure, complaint-record and retention workflow to be implemented in the database and listing form before public launch.
