# VibeDiet Production Infrastructure & Deployment Runbook
### Cloudflare Edge · Railway Multi-Stage Docker · Supabase PostgreSQL · Google OAuth · 5-Gate CI/CD

---

## 1. Architecture Overview & Security Perimeter

VibeDiet operates on a 4-tier zero-trust production topology designed for high availability, zero cold-start latency, multi-tenant isolation, and strict API cost protection:

```
[ Client Browser / PWA ]
           │
           ▼ (HTTPS / TLS 1.3 Strict)
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Edge Shield (Anycast DNS)                       │
│  - Full (Strict) SSL/TLS Encryption                         │
│  - HSTS (15.7M seconds, Subdomains, Preload)                │
│  - Bot Fight Mode & Browser Integrity Check                 │
│  - WAF Custom Rate Limiter: 15 req/15m on POST /v1/drafts*  │
│  - WAF Standard Limiter: 120 req/15m on /v1/*               │
└──────────────────────────┬──────────────────────────────────┘
                           │ (Encrypted Origin Tunnel)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Railway Production Container Engine                        │
│  - Base: node:20-alpine Multi-Stage Dockerfile              │
│  - Non-Root 'node' User Execution (UID 1000)                │
│  - Zero-Downtime Rolling Rollouts (30s overlap)             │
│  - Container Healthcheck: GET /health (every 30s)           │
│  - In-Memory Secret Scanning Guard at Build Time            │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│  Supabase Cloud (PaaS)       │ │  Google Gemini Pool         │
│  - PostgreSQL 15 Pooler      │ │  - 50-Key Round-Robin Swarm │
│  - Google OAuth 2.0 (PKCE)   │ │  - Atwater Energy Fallback  │
│  - Signed Session Cookies    │ │  - Ephemeral Photo Purge    │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Private GitHub Repository & 5-Gate CI Pipeline Setup

Railway deploys code directly from GitHub. To ensure broken or insecure code is never deployed to production, commits are validated through a mandatory 5-gate pipeline.

### Step 2.1: Initialize & Publish Private GitHub Repository
Run these commands from the repository root:
```bash
# 1. Verify working tree status
git status

# 2. Add and commit all production infrastructure files
git add Dockerfile .dockerignore railway.json .github/workflows/ci.yml DEPLOYMENT.md
git commit -m "feat(infra): hardened multi-stage Dockerfile, railway manifest, 5-gate CI & deployment runbook"

# 3. Create private GitHub repository using GitHub CLI (or manually via github.com/new)
gh repo create vibediet-prod --private --source=. --remote=origin --push
```

### Step 2.2: Configure GitHub Branch Protection Rules
1. Navigate to **GitHub Repository** → **Settings** → **Branches**.
2. Click **Add branch protection rule**.
3. Set **Branch name pattern** to `main`.
4. Enable the following controls:
   - **Require a pull request before merging**: Require at least 1 approval.
   - **Require status checks to pass before merging**:
     - Check: `5-Gate CI Quality & Security Verification`.
     - Check: `Require branches to be up to date before merging`.
   - **Do not allow bypassing the above settings**: Enforce rules for administrators.
5. Click **Save Changes**.

### Step 2.3: The 5 Quality & Security Gates Explained
The workflow in `.github/workflows/ci.yml` enforces:
1. **Gate 1 (`npm ci`)**: Deterministic package resolution against `package-lock.json`.
2. **Gate 2 (`npm run typecheck`)**: Strict TypeScript AST validation (`tsc --noEmit`) with zero type errors.
3. **Gate 3 (`npm test`)**: Comprehensive Vitest suite testing the 4-tier evidence hierarchy, Atwater energy physics, multi-tenant isolation, and billing webhooks.
4. **Gate 4 (`npm run build`)**: Vite bundler compilation generating client assets and single-file standalone distribution bundles.
5. **Gate 5 (`npm run scan`)**: Automated security scanner inspecting `dist/` for Google API keys (`AIzaSy...`), private keys (`-----BEGIN PRIVATE KEY-----`), and Firebase credentials. Aborts build if any match is detected.
6. **Browser Journey Verification (`npx playwright test`)**: Headless Chromium running all end-to-end user journeys (Diary, Photo Scanner, Metabolism Coach, Admin Cockpit route isolation).

---

## 3. Supabase Setup: PostgreSQL Database & Google OAuth

### Step 3.1: Provision Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a **New Project**.
2. Name the project `vibediet-prod` and select the region geographically closest to your Railway container region (e.g. `us-east-1` / `East US`).
3. Generate and securely store a 32-character database password in your password manager.

### Step 3.2: Obtain Postgres Connection URI (`DATABASE_URL`)
1. In the Supabase Dashboard, navigate to **Project Settings** → **Database**.
2. Scroll to **Connection string** → **URI**.
3. Select **Transaction Pooler** (Port `6543`) or **Session Pooler** (Port `5432`). For serverless and auto-scaling Node.js containers, **Transaction Mode (Port 6543)** is recommended.
4. Copy the connection string and replace `[YOUR-PASSWORD]` with your database password:
   ```env
   DATABASE_URL="postgres://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"
   ```
   > **Note**: VibeDiet's `postgresRepository.ts` automatically initializes table schemas (`vibe_users`, `vibe_meals`, `vibe_days`, `vibe_drafts`, `vibe_weights`, `vibe_repeat_meals`, `vibe_biometrics`, `vibe_portion_calibrations`, `vibe_support_tickets`) and composite indexes on the first successful connection.

### Step 3.3: Configure Google OAuth 2.0 Credentials
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your Google Cloud Project (or create `VibeDiet-Production`).
3. Navigate to **APIs & Services** → **Credentials**.
4. Click **Create Credentials** → **OAuth Client ID**.
5. Set Application type to **Web application**.
6. Name: `VibeDiet Web Client`.
7. Under **Authorized JavaScript origins**, add:
   - `https://yourdomain.com`
   - `https://www.yourdomain.com`
   - `https://[PROJECT-REF].supabase.co`
8. Under **Authorized redirect URIs**, add:
   - `https://[PROJECT-REF].supabase.co/auth/v1/callback`
9. Click **Create**. Copy the generated **Client ID** and **Client Secret**.

### Step 3.4: Enable Google Provider in Supabase Auth
1. In Supabase Dashboard, navigate to **Authentication** → **Providers** → **Google**.
2. Toggle Google to **Enabled**.
3. Paste the **Client ID** and **Client Secret** obtained from Google Cloud Console.
4. Click **Save**.
5. In **Authentication** → **URL Configuration**:
   - Set **Site URL** to: `https://yourdomain.com`
   - Under **Redirect URLs**, add: `https://yourdomain.com/**` and `https://www.yourdomain.com/**`.

### Step 3.5: Retrieve Supabase API Keys
1. In Supabase Dashboard, navigate to **Project Settings** → **API**.
2. Note the **Project URL**: `https://[PROJECT-REF].supabase.co` (use for `SUPABASE_URL`).
3. Note the **anon / public** key: `eyJ...` (use for `SUPABASE_ANON_KEY`).
4. Scroll to **JWT Settings** → **JWT Secret**: copy the 64-character secret (use for `SUPABASE_JWT_SECRET`).

---

## 4. Railway Production Service Setup & Encrypted Secrets

### Step 4.1: Deploy Project on Railway
1. Open [Railway](https://railway.com) and click **New Project**.
2. Select **Deploy from GitHub repo**.
3. Select your private `vibediet-prod` repository.
4. Click **Deploy Now**. Railway reads `railway.json` and begins building with `Dockerfile`.

### Step 4.2: Configure Environment Variables (Encrypted Vault)
In Railway Dashboard, click your service → **Variables** tab → **Raw Editor**, and paste the production secrets:

```env
# Node & Port Settings
NODE_ENV=production
PORT=8080

# Allowed CORS Origins (Whitelisted domains)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# PostgreSQL Connection (Supabase Transaction Pooler)
DATABASE_URL=postgres://postgres.[PROJECT-REF]:[DB-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require

# Supabase Auth & JWT
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...[YOUR_ANON_KEY]
SUPABASE_JWT_SECRET=[YOUR_64_CHAR_SUPABASE_JWT_SECRET]

# Google Gemini Multi-Key Swarm Pool (Comma-separated keys for failover & quota rotation)
GEMINI_API_KEYS=AIzaSyA1...Key1,AIzaSyB2...Key2,AIzaSyC3...Key3
GEMINI_KEY_POOL_COUNT=50

# Administrative Cockpit Security
ADMIN_SECRET=vibe_adm_live_9f83b271d44081c7209e8631bce7a9d042f1
ADMIN_UIDS=admin-master-uid,avi-architect-uid

# Nutrition Reference Databases
USDA_FDC_API_KEY=[YOUR_LIVE_USDA_API_KEY]
OPEN_FOOD_FACTS_USER_AGENT=VibeDietSaaS/3.0 (support@yourdomain.com)

# Optional Firebase Admin SDK (if syncing to Cloud Firestore in parallel)
FIREBASE_PROJECT_ID=vibediet-prod-saas
```

### Step 4.3: Verify Zero-Downtime Rollout Settings
In **Settings** → **Deploy**:
- **Healthcheck Path**: `/health`
- **Healthcheck Timeout**: `100` seconds
- **Restart Policy**: `ON_FAILURE` (Max retries: 10)
- **Overlap Seconds**: `30` (Ensures older container runs while new container warms up)
- **Draining Seconds**: `15` (Graceful active connection drain)

### Step 4.4: Connect Railway Custom Domain
1. In Railway Dashboard, go to **Settings** → **Networking** → **Custom Domain**.
2. Enter your subdomain or root: `app.yourdomain.com` (or `yourdomain.com`).
3. Railway generates a CNAME target: `[service-name].up.railway.app`. Keep this for Cloudflare DNS configuration.

---

## 5. Cloudflare DNS, SSL/TLS Full (Strict) & WAF Rate Limiting

Cloudflare sits at the edge, providing DDoS mitigation, Web Application Firewall (WAF) rate limiting to protect Gemini API quotas, and SSL termination.

### Step 5.1: Cloudflare DNS Configuration
1. Open the [Cloudflare Dashboard](https://dash.cloudflare.com) and select your domain.
2. Navigate to **DNS** → **Records**.
3. Add a CNAME record:
   - **Type**: `CNAME`
   - **Name**: `@` (or `app`)
   - **Target**: `[service-name].up.railway.app`
   - **Proxy status**: **Proxied (Orange Cloud ON)**
   - **TTL**: `Auto`
4. Click **Save**.

### Step 5.2: SSL/TLS Full (Strict) Encryption
1. In Cloudflare, navigate to **SSL/TLS** → **Overview**.
2. Select **Full (Strict)** encryption mode.
   > **Crucial**: Full (Strict) validates that Railway presents a valid TLS certificate signed by a recognized Certificate Authority, preventing Man-in-the-Middle attacks between Cloudflare and Railway.
3. In **SSL/TLS** → **Edge Certificates**:
   - **Always Use HTTPS**: Toggle **ON**.
   - **Minimum TLS Version**: Select **TLS 1.3**.
   - **Opportunistic Encryption**: Toggle **ON**.
   - **TLS 1.3**: Toggle **ON**.
   - **Automatic HTTPS Rewrites**: Toggle **ON**.
   - **HTTP Strict Transport Security (HSTS)**: Click **Change settings**:
     - Enable HSTS: **Checked**
     - Max-Age: `6 months (15768000 seconds)`
     - Include subdomains: **Checked**
     - Preload: **Checked**

### Step 5.3: WAF Custom Rate Limiting Rule — Vision Photo Drafts (`/v1/drafts*`)
To prevent abuse of Gemini Pro vision inference models and protect your monthly API quota:

1. In Cloudflare, navigate to **Security** → **WAF** → **Rate limiting rules**.
2. Click **Create rule**.
3. **Rule name**: `VibeDiet Vision Drafts Quota Guard`.
4. **If incoming requests match**: Select **Custom filter expression** and enter:
   ```text
   (http.request.uri.path eq "/v1/drafts" or starts_with(http.request.uri.path, "/v1/drafts/")) and http.request.method eq "POST"
   ```
5. **Rate limiting configuration**:
   - **Requests**: `15` requests
   - **Period**: `15 minutes` (900 seconds)
   - **Counting characteristics**: Select **IP (`ip.src`)**
6. **Action**:
   - Choose **Managed Challenge** (or **Block** with custom JSON response):
   - Custom Response Code: `429`
   - Response Type: `application/json`
   - Response Body:
     ```json
     {
       "error": "Gemini vision scan quota exceeded (maximum 15 scans per 15 minutes per IP)",
       "code": "DRAFTS_QUOTA_EXCEEDED"
     }
     ```
7. Click **Deploy**.

### Step 5.4: WAF Custom Rate Limiting Rule — Standard API Protection (`/v1/*`)
1. In **Security** → **WAF** → **Rate limiting rules**, click **Create rule**.
2. **Rule name**: `VibeDiet General API Rate Limit`.
3. **Filter expression**:
   ```text
   starts_with(http.request.uri.path, "/v1/") and not starts_with(http.request.uri.path, "/v1/drafts")
   ```
4. **Rate limiting configuration**:
   - **Requests**: `120` requests
   - **Period**: `15 minutes`
   - **Characteristics**: **IP (`ip.src`)**
5. **Action**: **Managed Challenge**.
6. Click **Deploy**.

### Step 5.5: Cloudflare Bot Management & Security Headers
1. In **Security** → **Bots**:
   - Enable **Bot Fight Mode**.
2. In **Security** → **Settings**:
   - Set **Security Level** to `Medium`.
   - Toggle **Browser Integrity Check** to `ON`.

---

## 6. Verification, Health Smoke Testing & Disaster Recovery

### Step 6.1: Smoke Test Live Endpoints
Run these curl checks against your live production domain:

```bash
# 1. System Healthcheck (Railway / Docker container health)
curl -s -i https://yourdomain.com/health
# Expected Output: HTTP 200 OK
# {"status":"ok","service":"vibediet-backend","timestamp":"..."}

# 2. Database & Readiness Diagnostic
curl -s https://yourdomain.com/ready
# Expected Output: HTTP 200 OK
# {"status":"ready","database":"connected","persistence":"postgres","uptimeSeconds":...}

# 3. Application Version & Model Swarm Config
curl -s https://yourdomain.com/version
# Expected Output: HTTP 200 OK
# {"version":"2.0.0","tag":"phase-production-ready",...}

# 4. Strict CORS Protection Check
curl -s -i -H "Origin: https://malicious-site.com" https://yourdomain.com/v1/health
# Expected Output: HTTP 403 Forbidden ("CORS origin not allowed by VibeDiet security shield")
```

### Step 6.2: WAF Rate Limiting Smoke Test
Verify that Cloudflare blocks excess requests to `/v1/drafts`:
```bash
# Rapidly fire 16 requests to /v1/drafts
for i in {1..16}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://yourdomain.com/v1/drafts \
    -H "Content-Type: application/json" \
    -d '{"image":"data:image/jpeg;base64,dGVzdA==","mode":"fast"}'
done
# Verification: Requests 1-15 return 200/400 (application level); Request 16 returns HTTP 429
```

### Step 6.3: Disaster Recovery & Rollback Procedure
If an issue occurs in production:
1. **Instant Rollback via Railway Dashboard**:
   - Navigate to Railway → Service → **Deployments**.
   - Locate the previous healthy deployment and click **Rollback to this deployment**.
   - Traffic transitions seamlessly within seconds with zero downtime.
2. **Database Failover**:
   - `postgresRepository.ts` maintains an atomic fallback store. If PostgreSQL network connectivity is disrupted, operations fall back gracefully without unhandled crashes.
3. **Gemini Swarm Self-Healing**:
   - If an API key in `GEMINI_API_KEYS` is exhausted or revoked, the pool router automatically marks it unhealthy, rotates to the next available key in milliseconds, and logs the incident to the Admin Cockpit (`/#admin`).
