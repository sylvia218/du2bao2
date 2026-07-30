# Install Google and Guest Login

This package is based on the latest DU2BAO2 legal-footer website.

## 1. Preserve your real config.js

Do not overwrite your working `config.js` with an empty example. Keep your existing Supabase URL, publishable/anon key, admin email and site URL.

## 2. Upload the changed website files

Upload and replace these files in the GitHub repository root:

- `index.html`
- `script.js`
- `styles.css`
- `privacy.html`
- `terms.html`
- `service-worker.js`
- `README.md`

You may upload the complete folder instead, but preserve your existing `config.js`.

Suggested commit title:

```text
Add Google and guest login options
```

Suggested description:

```text
Added Continue with Google and browse-only guest mode, restricted seller features to full accounts, updated account UI and privacy wording, and refreshed the service-worker cache.
```

## 3. Run the optional profile SQL

Open Supabase -> SQL Editor and run `supabase-google-profile-upgrade.sql` once. This lets future Google users receive a better default profile display name.

## 4. Enable Google in Supabase

1. Open Supabase -> Authentication -> Sign In / Providers -> Google.
2. Copy the callback URL shown there.
3. Create a Web application OAuth client in Google Auth Platform.
4. Add `https://du2bao2.com` as an authorised JavaScript origin. Add `https://www.du2bao2.com` only if that hostname is active.
5. Add the exact Supabase callback URL as an authorised redirect URI.
6. Paste the Google Client ID and Client Secret into Supabase and enable the provider.
7. Under Supabase Authentication -> URL Configuration, keep `https://du2bao2.com` as the Site URL and include the production/local redirect URLs.

Never put the Google Client Secret in GitHub or `config.js`.

## 5. Test

- Choose Continue as guest: browsing and wishlist should work.
- While in guest mode, choose Sell an item: the full-account login screen should open.
- Choose Continue with Google: Google should redirect back to DU2BAO2 and show the account name.
- Confirm Google users can open the seller dashboard and submit a pending listing.
- Log out and verify the Account button returns to Log in.

## 6. Refresh cache

After GitHub Pages redeploys, hard-refresh:

- Mac: Command + Shift + R
- Windows: Ctrl + Shift + R

The service-worker cache is now `du2bao2-v6-premium-marketplace`.
