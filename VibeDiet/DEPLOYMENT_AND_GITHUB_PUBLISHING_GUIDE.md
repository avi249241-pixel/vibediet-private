# VibeDiet Production GitHub Publishing, API Keys & Legal Shield Guide

## 1. Push & Deploy to Your GitHub Repository in 1 Command
Because your personal GitHub account credentials live on your machine (or in your browser), you can publish this repository to GitHub in either of **two ways**:

### Option A: Push Directly from Your Browser (Zero Terminal Required)
1. Open **VibeDiet-App.html** in Canvas or your browser.
2. Scroll to the bottom footer and click **⚡ Founder & Revenue Portal →**.
3. Scroll to **🐙 Direct GitHub Repository Publisher & Automated CI/CD Deploy Studio**.
4. Enter your target repo (`your-username/vibediet-saas`) and a GitHub Personal Access Token (`ghp_...` with `repo` scope), then click **🚀 Push Production Code to GitHub Repo Now**.

### Option B: 1-Command Automated Terminal Script (Included in `VibeDiet.zip`)
Unzip `VibeDiet.zip` and run:
```bash
# macOS / Linux / Git Bash:
chmod +x scripts/push-to-github.sh
./scripts/push-to-github.sh your-username/vibediet-saas

# Windows PowerShell:
.\scripts\push-to-github.ps1 -RepoName "vibediet-saas"
```
Once pushed, the included `.github/workflows/ci-cd-production.yml` automatically runs TypeScript verification, Vitest unit tests, builds the production bundle, and deploys to **GitHub Pages**.

---

## 2. Pre-Configured & Customizable API Keys
All 6 external integrations work out-of-the-box with public/sandbox keys and can be overridden anytime in the **Founder Console → 🔑 Production API Key Vault** or in `.env`:
- `USDA_FDC_API_KEY=DEMO_KEY` (Live USDA FoodData Central REST API v1 `api.nal.usda.gov/fdc/v1`)
- `OPEN_FOOD_FACTS_API` (`world.openfoodfacts.org/api/v2/product/{barcode}.json` — ODbL v1.0 open access)
- `GEMINI_API_KEY` (50-key Round-Robin Swarm Pool + supports pasting your live `AIzaSy...` key)
- `RAZORPAY_KEY_ID` (`rzp_test_VibeDiet99210A` for India UPI / Cards)
- `STRIPE_PUBLISHABLE_KEY` (`pk_test_51VibeDietGlobal881` for Global Cards / Apple Pay)
- `FIREBASE_PROJECT_ID` (`vibediet-prod-saas`)

---

## 3. Complete Web Publishing Legal & Merchant Protection Suite (`legal/`)
All 6 statutory documents required to publish a commercial nutrition SaaS on the web and activate live Razorpay/Stripe merchant accounts are built into both the in-app **6-Tab Legal Modal (`#legal-modal`)**, the **Cookie Consent Banner (`#cookie-banner`)**, and the `legal/` folder:
1. `legal/MEDICAL_AND_FDA_FSSAI_DISCLAIMER.md` — FDA 21 CFR § 101.93 (DSHEA) & India FSSAI/NMC non-medical disclaimer + hard 1,200/1,500 kcal safety floors.
2. `legal/TERMS_OF_SERVICE_AND_EULA.md` — "AS-IS" software warranty disclaimer, **$0.00 USD aggregate liability cap**, user indemnification, and individual arbitration.
3. `legal/PRIVACY_POLICY_GDPR_DPDP_CCPA.md` — India DPDP Act 2023, EU GDPR, and California CCPA compliance; 1024px client-side ephemeral RAM photo processing; 1-click JSON export and data erasure.
4. `legal/COOKIE_AND_STORAGE_POLICY.md` — Full inventory of `localStorage` keys and payment anti-fraud cookies.
5. `legal/REFUND_AND_MERCHANT_BILLING_POLICY.md` — Mandatory merchant refund & cancellation policy for Razorpay and Stripe approval.
6. `legal/OPEN_SOURCE_AND_DATABASE_LICENSES.md` — ODbL v1.0 (Open Food Facts), CC0 1.0 (USDA), IFCT 2017 (ICMR-NIN), and MIT attributions.
