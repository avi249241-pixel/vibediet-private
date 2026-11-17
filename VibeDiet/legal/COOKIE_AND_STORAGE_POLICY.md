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
