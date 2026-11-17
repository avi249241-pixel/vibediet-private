# VibeDiet Privacy Policy (India DPDP Act 2023, EU GDPR & California CCPA/CPRA)
**Effective Date:** October 25, 2026  
**Data Fiduciary / Controller:** VibeDiet SaaS Operations (`privacy@vibediet.app`)

## 1. Zero-Retention Ephemeral Food Photo Processing
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
