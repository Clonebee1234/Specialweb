# Quick Fix: Admin Login Not Working

## The Problem
After deployment, admin login doesn't work - either shows no error or redirects back to login page.

## The Solution (5 minutes)

### 1. Generate a proper secret
Open your terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Copy the output (should be a long random string like `1pPv0XOWUStH8l9DO-zk6iK6bTPgfnBLOcrvPjf0P_PDDIykOYtQLN0Ax3vDn1Lu`)

### 2. Add it to Vercel
1. Go to https://vercel.com/dashboard
2. Click your project
3. Click **Settings** → **Environment Variables**
4. Add these variables for **Production**:

| Variable | Value |
|----------|-------|
| `COOKIE_SIGNING_SECRET` | Paste the secret you generated above |
| `ADMIN_PASSWORD` | Your desired admin password (NOT "letmein") |
| `SUPABASE_URL` | From Supabase dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase dashboard → Settings → API → service_role key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase dashboard → Settings → API → anon public key |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL (e.g., `https://your-app.vercel.app`) |
| `UPSTASH_REDIS_REST_URL` | From Upstash dashboard (optional but recommended) |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash dashboard (optional but recommended) |

### 3. Redeploy
**CRITICAL STEP** - Environment variables don't take effect until you redeploy!

1. Go to **Deployments** tab
2. Click the **three dots (...)** on the latest deployment
3. Click **Redeploy**
4. Wait for deployment to complete (~2 minutes)

### 4. Verify it worked
Visit: `https://your-app.vercel.app/api/admin/debug`

You should see:
```json
{
  "hasCookieSecret": true,
  "cookieSecretLength": 64,
  "hasAdminPassword": true,
  "hasSupabaseUrl": true,
  ...
}
```

All values should be `true` and `cookieSecretLength` should be at least 32.

### 5. Test login
Go to: `https://your-app.vercel.app/admin/login`

Enter your `ADMIN_PASSWORD` and click Sign in.

**If it still doesn't work:**
1. Open browser console (F12)
2. Go to Network tab
3. Try logging in again
4. Click on the `login` request
5. Check the Response - it will tell you exactly what's wrong

---

## Common Issues

### "Server misconfigured"
→ `COOKIE_SIGNING_SECRET` is missing. Add it and redeploy.

### "Admin password not configured"
→ `ADMIN_PASSWORD` is missing. Add it and redeploy.

### "Failed to connect to database"
→ Supabase credentials are wrong. Double-check them in Supabase dashboard.

### Login succeeds but redirects back to login
→ Cookies aren't being set. Make sure:
- You're using HTTPS (not HTTP)
- `COOKIE_SIGNING_SECRET` is at least 32 characters
- You cleared browser cookies and tried again

---

## Still stuck?
Read the full guide: `DEPLOYMENT_TROUBLESHOOTING.md`
