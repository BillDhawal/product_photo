# Credits & Paywall Requirements

## Phase 1: Credit System (Current)

### Rules
- **8 credits per user per day** (resets at midnight UTC)
- **4 credits per generation** (each generate_product_image call)
- **Root user**: Unlimited credits (add user IDs to `ROOT_USER_IDS` in credits.py)
- **Exception**: `dgajwe@gmail.com` – unlimited credits (in `UNLIMITED_EMAILS`)

### Storage
- **Supabase** (PostgreSQL) – open source, easy integration
- Table: `user_credits`
  - `user_id` (text, PK) – Clerk user ID
  - `email` (text) – from Clerk
  - `daily_credits_used` (int, default 0)
  - `daily_reset_at` (timestamptz) – last reset date

### User Identity
- **Clerk** – user details from JWT
- Frontend: Send `Authorization: Bearer <session_token>` with requests
- Backend: Verify JWT, extract `user_id` and `email`

### Flow
1. User sends /chat with generation request
2. Backend verifies Clerk JWT → user_id, email
3. Check: root or dgajwe@gmail.com → skip credit check
4. Else: get/reset daily credits from Supabase
5. If credits_available < 4 → return 402 with message
6. Else: run generation, deduct 4 credits

---

## Phase 2: Paywall (Later)

- **Free tier**: 8 credits/day
- **Paid**: $20 for 1000 credits
- Table: `user_credits.purchased_credits`
- Payment: Stripe (or similar)

---

## Env Vars

- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – Service role key (bypasses RLS)

If not set, credits are not enforced (all users get 8/day behavior for display, no deduction).

## Supabase Setup

1. Create project at supabase.com
2. Get `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Settings → API
3. Run migration:

```sql
CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  daily_credits_used INT DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  purchased_credits INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for daily reset lookups
CREATE INDEX idx_user_credits_daily_reset ON user_credits(daily_reset_at);
```
