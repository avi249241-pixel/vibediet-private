# VibeDiet Complete Commercial Legal, Privacy, Cookie & Merchant Compliance Suite

# VibeDiet Terms of Service & End-User License Agreement (EULA)
**Effective Date:** October 25, 2026  
**Last Updated:** October 25, 2026  
**Governing Law:** Laws of India (Courts of Ghaziabad / Delhi NCR) & State of Delaware, USA (for international users)

## 1. Acceptance of Agreement
By accessing, browsing, creating an account, or using the VibeDiet web application, mobile progressive web app (PWA), APIs, or related services (collectively, the "Service"), you ("User", "you") agree to be bound by these Terms of Service and End-User License Agreement ("Terms"). If you do not agree to these Terms, do not use the Service.

## 2. Informational Wellness Scope & Non-Medical Nature
VibeDiet is an informational nutrition logging, macroscopic/micronutrient reconciliation, and mathematical energy expenditure estimation tool. **VibeDiet is NOT a medical device, health care provider, clinical dietitian, or licensed physician.** Nothing in the Service constitutes medical advice, clinical diagnosis, or treatment.

## 3. Warranty Disclaimer ("AS-IS" AND "AS-AVAILABLE")
TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED STRICTLY ON AN "AS-IS" AND "AS-AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY OF NUTRITIONAL ESTIMATES, OR NON-INFRINGEMENT. Visual AI food estimation inherently carries a natural caloric variance of 10% to 25% depending on hidden cooking oils, food density, and plating depth.

## 4. Limitation of Liability ($0.00 Cap / Statutory Minimum)
TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL VIBEDIET, ITS FOUNDERS, DEVELOPERS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY HEALTH OUTCOME, ALLERGIC REACTION, METABOLIC CHANGE, OR DATA LOSS ARISING OUT OF YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE SHALL NOT EXCEED THE GREATER OF **$0.00 USD** OR THE ACTUAL SUBSCRIPTION AMOUNTS PAID BY YOU TO VIBEDIET IN THE THIRTY (30) DAYS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO LIABILITY.

## 5. User Indemnification
You agree to indemnify, defend, and hold harmless VibeDiet and its founder/operators from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or connected with your misuse of the Service, violation of these Terms, or violation of any third-party right.

## 6. User-Supplied API Keys & Third-Party Integrations
VibeDiet allows optional connection to third-party APIs (Google Gemini API, USDA FoodData Central, Open Food Facts, Razorpay, Stripe, GitHub REST API, Apple HealthKit, Google Health Connect). Any personal API keys configured in your browser's Local Vault remain stored locally on your device and are governed by the respective third party's terms of service.

## 7. Dispute Resolution, Arbitration & Class-Action Waiver
Any dispute arising out of or relating to these Terms shall be resolved through confidential, binding individual arbitration. You waive any right to participate in a class action, collective action, or representative proceeding.


---

# VibeDiet Privacy Policy (India DPDP Act 2023, EU GDPR & California CCPA/CPRA)
**Effective Date:** October 25, 2026  
**Data Fiduciary / Controller:** VibeDiet SaaS Operations (`privacy@vibediet.app`)

## 1. Zero-Retention Ephemeral Food Photo Processing (Ephemeral Photo Privacy)
When you capture or upload a meal photo in VibeDiet:
- Your image is downscaled client-side in your browser's volatile RAM to a maximum dimension of **1024px** (JPEG quality 0.80) before analysis.
- Raw image bytes are **never permanently stored on our servers**, never sold to data brokers, and never used to train third-party foundational AI models.
- Immediately upon confirming your meal draft, temporary image buffers are purged from memory.

## 2. Categories of Personal & Biometric Data Processed
- **Biometric & Metabolic Parameters:** Age, biological sex, height (cm), weight history (kg), calculated Mifflin-St Jeor BMR, EWMA smoothed trend weight, and daily calorie/macro targets.
- **Nutrition & Hydration Logs:** Logged meals, gram weights, Atwater macro breakdowns, and water intake.
- **Billing Identifiers:** Processed directly by PCI-DSS Level 1 compliant gateways (**Razorpay** for INR/UPI and **Stripe** for USD/Global cards). VibeDiet never stores raw credit card numbers or UPI PINs.

## 3. Your Rights Under India DPDP Act 2023, EU GDPR & CCPA
- **Right to Access & Data Portability (GDPR Art. 20 / DPDP Sec. 11):** Export your complete nutrition, weight, and biometric history anytime in machine-readable JSON format using the **"Export JSON"** button in the Today view.
- **Right to Erasure / Right to be Forgotten (GDPR Art. 17 / DPDP Sec. 12):** Permanently wipe all local and session data in one click using the **"Erase All Data"** button in the Account screen.
- **Right to Withdraw Consent:** Modify your cookie and telemetry preferences anytime via the **Cookie Preferences** manager in the application footer.


---

# VibeDiet Cookie & LocalStorage Policy
**Effective Date:** October 25, 2026

## 1. How VibeDiet Uses Browser Storage & Cookies
To maximize privacy and offline speed, VibeDiet uses structured HTML5 `localStorage` keys alongside strictly necessary payment and security cookies.

| Storage Key / Cookie | Category | Purpose | Retention |
| :--- | :--- | :--- | :--- |
| `vibediet_cookie_consent_v3` | Strictly Necessary | Stores your cryptographic GDPR/DPDP consent receipt and timestamp | 365 Days |
| `vibediet_diary_state_v3` | Functional / Essential | Saves your logged meals, hydration, and biometric targets locally | Until user erasure |
| `vibediet_api_vault_v3` | Functional (User Opt-In) | Stores user-configured API keys locally on your device | Until cleared |
| `rzp_checkout_anon_id` | Payment Fraud Shield | Razorpay UPI/Card checkout anti-fraud verification | Session |
| `__stripe_mid` / `__stripe_sid` | Payment Fraud Shield | Stripe global checkout PCI-DSS fraud detection | 30 Min – 1 Year |


---

# VibeDiet Subscription, Refund & Cancellation Policy
**Effective Date:** October 25, 2026  
*(Merchant Compliance Document for Razorpay & Stripe Live Activation)*

## 1. Subscription Plans & Pricing Transparency
- **Free Tier:** ₹0 / $0 forever. Includes 3 AI Vision scans per day, unlimited USDA/IFCT/OpenFoodFacts manual & barcode logging, and basic expenditure tracking.
- **VibeDiet Pro Monthly:** ₹299/month (India — UPI/Cards via Razorpay) or $4.99/month (International — Cards/Apple Pay via Stripe).
- **VibeDiet Pro Annual:** ₹1,999/year (India) or $24.00/year (International).

## 2. Instant Cancellation Policy
You may cancel your VibeDiet Pro subscription at any time with one click from the **Account & Subscription** screen or by contacting `support@vibediet.app`. Upon cancellation, your Pro access remains active through the end of your current paid billing period with zero cancellation penalties.

## 3. 7-Day No-Questions-Asked Refund Guarantee
If you are unsatisfied with VibeDiet Pro for any reason within **seven (7) calendar days** of your initial purchase or annual renewal, submit a ticket under the `Billing` category in the in-app Support Desk for a 100% full refund back to your original UPI ID or payment card within 5–7 business days.


---

# Medical, Nutritional & Regulatory Non-Advice Disclaimer
**Regulatory Reference:** US FDA 21 CFR § 101.93 (DSHEA), India FSSAI Labelling & Claims Regulations, NMC Telemedicine Practice Guidelines

1. **Not Medical or Dietetic Advice:** VibeDiet provides automated mathematical calculations based on the Mifflin-St Jeor basal metabolic rate equation, Atwater 4-4-9-7 energy conversion factors, and Exponentially Weighted Moving Average ($lpha=0.12$) scale weight smoothing. These outputs are estimates for general wellness education only.
2. **Mandatory Calorie Safety Floors:** VibeDiet automatically enforces hard minimum daily caloric intake floors (**1,200 kcal/day for females** and **1,500 kcal/day for males**). The software will never prescribe Very Low Calorie Diets (VLCDs) below these clinical thresholds.
3. **Contraindications:** Do not use calorie-deficit targets in VibeDiet if you are pregnant, nursing, under 18 years of age, diagnosed with an active or historical eating disorder (such as anorexia nervosa, bulimia nervosa, or binge-eating disorder), or managing insulin-dependent diabetes or chronic kidney disease without direct physician supervision.


---

# Open-Source Software & Nutritional Database Attribution
1. **USDA FoodData Central (Foundation & SR Legacy):** U.S. Department of Agriculture, Agricultural Research Service. Licensed under Creative Commons CC0 1.0 Universal (Public Domain).
2. **Open Food Facts Global Database:** Crowd-sourced barcode and packaged food database (`world.openfoodfacts.org`). Licensed under the Open Database License (ODbL) v1.0.
3. **Indian Food Composition Tables (IFCT 2017):** National Institute of Nutrition (ICMR-NIN), Hyderabad, India. Used for reference macronutrient and dietary fiber values of traditional Indian preparations.
4. **Frontend Open-Source Libraries:** Tailwind CSS (MIT License), Chart.js v4.4.1 (MIT License), Playwright & Vitest (MIT/Apache-2.0).


---

