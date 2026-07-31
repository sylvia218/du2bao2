# DU2BAO2 V7

DU2BAO2 is a responsive marketplace for quality pre-owned goods. This version keeps the existing GitHub Pages and Supabase architecture while adding the seller disclosure, complaint and buyer–seller contact workflows required for the next launch stage.

## Included marketplace features

- Clean quality-focused homepage and category browsing
- Search, condition filters and sorting
- Product details and related listings
- Browser wishlist
- Continue with Google
- Email registration and login
- Continue as guest for browsing and saving
- Seller dashboard with pending, approved, rejected and sold states
- Admin approval for new listings
- Up to eight listing photographs
- Privacy, Terms, Safety, Shipping, Returns, Prohibited Items, Seller Rules, Marketplace Role and Contact pages

## New in V7

### Seller disclosure and restricted records

Before listing, a seller completes:

**Displayed on approved listings**

- Seller or business name
- Individual or business seller type
- Public email
- Public telephone / WhatsApp
- Business or service address
- Website and business name, where applicable

**Restricted to the seller and authorised administrators**

- Legal name
- Private telephone number
- State and country
- Business registration number, where supplied
- Optional last four characters of an identity reference
- Seller declaration and timestamp

The normal form does not request a full MyKad or passport image. A future identity-document workflow should use a purpose-built secure verification provider or restricted private storage after legal and security review.

### Bahasa Malaysia listing disclosures

The listing form now requests the main:

- Product title
- Description
- Payment methods
- Delivery or handover estimate
- Sale terms

in Bahasa Malaysia. The seller may add an English title and description.

### Guided contact workflow

The product page provides a contact window with:

- Ask a question
- Check availability
- Make an offer

The selected option prepares a WhatsApp message with the product and listing link. The current website does not record the WhatsApp conversation or confirm that a transaction was completed.

### Listing report workflow

Every product page includes **Report this listing**. A reporter can select:

- Suspected counterfeit or authenticity concern
- Misleading information
- Prohibited or unsafe item
- Scam or payment concern
- Seller conduct
- Other

The report stores the listing snapshot, reporter contact, reason, details, optional evidence link and status. Administrators can mark reports as open, reviewing, resolved or dismissed.

### Administrator centre

Administrators have three tabs:

1. Pending listings
2. Reports
3. Restricted seller records

Database access is protected using Supabase Row Level Security. Front-end hiding alone is not treated as security.

### Record review dates

Seller private records, reports and listing audit entries receive a three-year retention review date. This is not an automatic deletion job. Establish a documented retention, preservation and secure-deletion procedure before launch.

## Important current marketplace wording

DU2BAO2 helps buyers and sellers connect, communicate and arrange transactions using the options currently available on the platform.

DU2BAO2 does not currently hold buyer funds, provide escrow services, arrange delivery or independently authenticate listed items. Supported payments, escrow, delivery, third-party authentication or buyer-protection services may be introduced later under separate applicable terms.

Do not advertise a future service as active until the technical system, provider, customer support procedure, fees and legal terms are ready.

# Upgrade an existing DU2BAO2 Supabase project

## 1. Back up first

In Supabase, review and export important production data before changing the schema.

## 2. Run the V7 migration

1. Open the Supabase Dashboard.
2. Select the DU2BAO2 project.
3. Open **SQL Editor**.
4. Open `supabase-v7-upgrade.sql` from this package.
5. Copy the entire file into a new query.
6. Select **Run**.

This adds the new profile fields, restricted seller table, listing disclosure fields, reports table, listing audit trail, indexes, triggers and Row Level Security policies.

For a completely new Supabase project, run `supabase-setup.sql` instead. It contains the original setup followed by the V7 upgrade.

## 3. Confirm the administrator account

After creating your own account, run this in Supabase SQL Editor with your real email:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'your-admin-email@example.com'
on conflict (user_id) do nothing;
```

The `ADMIN_EMAILS` setting in `config.js` is a convenience fallback. The `public.admins` database table and Row Level Security are the actual protection for restricted records.

# Preserve Google and guest login

The recommended GitHub upload ZIP excludes `config.js`. This prevents the blank example configuration from overwriting your working Supabase URL, anon key, admin email and WhatsApp number.

Your existing repository must retain a working `config.js` similar to:

```js
window.DU2BAO2_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_PROJECT_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
  ADMIN_EMAILS: ["YOUR_ADMIN_EMAIL"],
  WHATSAPP_NUMBER: "60123456789",
  SITE_URL: "https://du2bao2.com"
};
```

Never put the Supabase service-role key in `config.js`, GitHub or browser code.

For Google login, keep your production domain and local test URL in Supabase **Authentication → URL Configuration**, and keep the Supabase callback URL configured in Google Cloud.

# Upload to GitHub

1. Extract the recommended safe-upload ZIP.
2. Open your existing GitHub repository.
3. Upload all extracted files and the complete `assets` folder to the repository root.
4. Choose to replace files with the same names.
5. Do not delete or replace your working `config.js`.
6. Commit the changes.
7. Wait for GitHub Pages to redeploy.
8. Hard-refresh the website with **Command + Shift + R** on Mac or **Ctrl + Shift + R** on Windows.

Run `supabase-v7-upgrade.sql` before testing seller details, new listings, reports or the new admin tabs.

# Testing checklist

## Visitor and buyer

- Browse as guest
- Save and remove a wishlist item
- Open a product
- Open Contact seller
- Test question, availability and offer choices
- Submit a test report

## Seller

- Log in with Google or email
- Complete Seller details
- Confirm public and restricted fields are clearly separated
- Submit a listing with two to eight photos
- Confirm the listing appears as pending in Seller dashboard

## Administrator

- Confirm your user is in `public.admins`
- Open Admin centre
- Approve or reject a pending listing
- Review a submitted report and update its status
- Confirm restricted seller records are visible only to an administrator and the record owner

## Security

- Confirm an ordinary user cannot read another seller’s row in `seller_private_profiles`
- Confirm an ordinary user cannot view all reports
- Confirm an ordinary user cannot open the restricted admin data through direct Supabase requests
- Confirm the Supabase service-role key is not present anywhere in the website files

# Files

- `index.html` — homepage, authentication, listing, seller details and admin centre
- `product.html` / `product.js` — listing details, seller disclosure, WhatsApp contact and reports
- `script.js` — marketplace, account, seller, listing and administration logic
- `styles.css` — responsive visual design
- `data.js` — demonstration listings
- `supabase-v7-upgrade.sql` — migration for an existing project
- `supabase-setup.sql` — complete setup for a new project
- `config.example.js` — blank configuration example
- Legal and information HTML pages

# Before public launch

The legal pages remain pre-launch drafts. Insert the final registered entity, SSM number, service address, support contact and privacy contact. Have a qualified Malaysian professional review the actual business model, data practices, seller disclosures, complaint procedure, retention schedule and any future payment, escrow, delivery or authentication service.
