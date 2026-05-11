# Deployment Troubleshooting Guide

## Admin Login Not Working

If you can't log into `/admin` after deployment, follow these steps:

### Step 1: Check Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Verify ALL of these are set for **Production**:

**Required:**
- `COOKIE_SIGNING_SECRET` — must be at least 32 characters (generate with the command below)
- `ADMIN_PASSWORD` — your admin password
- `SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_URL` — same as SUPABASE_URL
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase dashboard
- `NEXT_PUBLIC_APP_URL` — your Vercel deployment URL

**Recommended:**
- `UPSTASH_REDIS_REST_URL` — required for production rate limiting
- `UPSTASH_REDIS_REST_TOKEN` — required for production rate limiting

### Step 2: Generate Proper Secrets

```bash
# Generate COOKIE_SIGNING_SECRET (48 bytes)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copy the output and paste it as `COOKIE_SIGNING_SECRET` in Vercel.

### Step 3: Redeploy After Adding Variables

**CRITICAL:** Environment variable changes don't take effect until you redeploy!

1. Go to **Deployments** tab
2. Click the three dots (...) on the latest deployment
3. Click **Redeploy**
4. Wait for the deployment to complete

### Step 4: Use the Debug Endpoint

Visit: `https://your-app.vercel.app/api/admin/debug`

This will show you which environment variables are missing. Example output:

```json
{
  "environment": "production",
  "hasCookieSecret": true,
  "cookieSecretLength": 64,
  "hasAdminPassword": true,
  "hasSupabaseUrl": true,
  "supabaseUrl": "configured",
  ...
}
```

**What to look for:**
- `hasCookieSecret` should be `true` and `cookieSecretLength` should be at least 32
- `hasAdminPassword` should be `true`
- All Supabase variables should be `true`

### Step 5: Test Login API Directly

Open browser console (F12) on your login page and run:

```javascript
fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: 'YOUR_PASSWORD' })
})
.then(r => r.json())
.then(console.log)
```

**Expected responses:**

✅ **Success:**
```json
{"ok": true, "message": "Login successful"}
```

❌ **Wrong password:**
```json
{"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid password"}}
```

❌ **Missing COOKIE_SIGNING_SECRET:**
```json
{"error": {"code": "COOKIE_ERROR", "message": "Failed to generate session cookie..."}}
```

❌ **Missing ADMIN_PASSWORD:**
```json
{"error": {"code": "CONFIG_ERROR", "message": "Admin password not configured..."}}
```

### Step 6: Check Cookies Are Set

After a successful login API call:

1. Open DevTools → **Application** tab (Chrome) or **Storage** tab (Firefox)
2. Look under **Cookies** → your domain
3. You should see:
   - `ct_admin` (HttpOnly cookie)
   - `ct_csrf` (readable cookie)

If cookies are missing, check:
- Your domain is using HTTPS in production (cookies with `secure` flag won't work on HTTP)
- No browser extensions are blocking cookies

### Step 7: Check Database Connection

Visit: `https://your-app.vercel.app/api/health`

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-05-11T...",
  "environment": "production"
}
```

If it returns `"status": "unhealthy"`, your Supabase credentials are wrong.

---

## Common Error Messages

### "Server misconfigured"
**Cause:** `COOKIE_SIGNING_SECRET` is not set in Vercel environment variables.
**Fix:** Add it in Settings → Environment Variables, then redeploy.

### "Admin password not configured"
**Cause:** Neither `ADMIN_PASSWORD` nor `ADMIN_PASSWORD_HASH` is set.
**Fix:** Add `ADMIN_PASSWORD` in Vercel environment variables, then redeploy.

### "Failed to connect to database"
**Cause:** Supabase credentials are wrong or database migrations haven't been applied.
**Fix:** 
1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
2. Run `npm run db:migrate` to apply migrations

### "Too many login attempts"
**Cause:** Rate limiting kicked in (5 attempts per 15 minutes per IP).
**Fix:** Wait 15 minutes or use a different network/IP.

### Login succeeds but redirects back to login page
**Cause:** Middleware is rejecting the cookie (usually due to mismatched `COOKIE_SIGNING_SECRET`).
**Fix:** 
1. Make sure `COOKIE_SIGNING_SECRET` in Vercel matches what was used to sign the cookie
2. Clear browser cookies for your domain
3. Try logging in again

---

## Production Checklist

Before going live, verify:

- [ ] All environment variables are set in Vercel (Production environment)
- [ ] `COOKIE_SIGNING_SECRET` is at least 32 characters (preferably 48+ bytes base64url)
- [ ] `ADMIN_PASSWORD` is strong (not "letmein" or "admin")
- [ ] Supabase migrations have been applied (`npm run db:migrate`)
- [ ] Storage bucket "celebrations" exists and is set to **public**
- [ ] Upstash Redis is configured (required for production rate limiting)
- [ ] `NEXT_PUBLIC_APP_URL` matches your actual domain
- [ ] `/api/health` returns `"status": "healthy"`
- [ ] `/api/admin/debug` shows all required variables as `true`
- [ ] You can successfully log in at `/admin/login`
- [ ] Delete `/api/admin/debug` route before going live (security)

---

## Still Having Issues?

1. Check Vercel deployment logs for errors
2. Check browser console for JavaScript errors
3. Check Network tab in DevTools to see the actual API responses
4. Verify your local `.env.local` works (run `npm run dev` and test locally first)
