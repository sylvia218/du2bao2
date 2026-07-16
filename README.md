# DU2BAO2 — Pre-Owned Luxury Marketplace

A responsive front-end marketplace prototype for authenticated secondhand luxury products. It is designed to run directly on GitHub Pages without a build step.

## Included

- Responsive luxury marketplace homepage
- Category browsing, search and price sorting
- Wishlist saved in the browser with `localStorage`
- Seller listing form
- Login interface
- Authentication, buyer protection and verification messaging
- Mobile-friendly layout

## Run locally

Open `index.html` directly, or run a small local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Put it on GitHub Pages

1. Create a new GitHub repository, such as `du2bao2-marketplace`.
2. Upload `index.html`, `styles.css`, `script.js`, and `README.md` to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root`, then save.

## Connect a custom domain

After purchasing `du2bao2.com`:

1. In GitHub Pages settings, enter `du2bao2.com` under **Custom domain**.
2. Add the DNS records instructed by GitHub at your domain registrar.
3. Enable **Enforce HTTPS** after DNS finishes updating.

## Before accepting real transactions

This prototype does not yet include a production backend. Add the following before launch:

- User registration and identity verification
- Seller profiles and ratings
- Database for listings, offers, orders and messages
- Secure image upload and moderation
- Payment gateway with escrow-like payout flow
- Item-authentication workflow
- Shipping labels and tracking
- Refund, return and dispute handling
- Admin dashboard and fraud monitoring
- Malaysia privacy policy, marketplace terms and tax/accounting review

## Suggested production stack

- Frontend: Next.js + TypeScript
- Database/auth/storage: Supabase
- Hosting: Vercel
- Payments: a Malaysia-supported payment provider
- Search: Algolia or Meilisearch
- Images: Supabase Storage or Cloudinary
- Email: Resend or Postmark

## Suggested database tables

- `users`
- `seller_profiles`
- `listings`
- `listing_images`
- `favorites`
- `offers`
- `orders`
- `payments`
- `shipments`
- `authenticity_checks`
- `messages`
- `reviews`
- `disputes`

## Brand note

Before launch, run trademark and business-name checks for “DU2BAO2” in your target countries. Domain availability and trademark availability are separate matters.
