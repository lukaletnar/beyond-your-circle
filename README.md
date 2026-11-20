# Beyond Your Circle — Classroom prototype

Keep the existing Vercel project and its production URL: https://beyond-your-circle-algebra.vercel.app . Do not create a new Vercel project. The submitted QR code uses this address.

## 1. Set up the database (Supabase)
1. Sign in at https://supabase.com/dashboard and create a dedicated project for the classroom demo.
2. Open SQL Editor > New query. Paste all of `setup.sql` (this file is beside the website folder), then Run. This creates a private table, restricted server-only access, and an atomic join function with a 60-profile limit.
3. Copy the Project URL (Integrations > Data API or Connect) and a **secret** API key (Settings > API Keys; `sb_secret_…`, or legacy service_role). Do not put either secret key in GitHub, browser JavaScript, screenshots, or chat messages.

## 2. Configure the existing Vercel project
Open your existing Beyond Your Circle project > Settings > Environment Variables. Add the following for Production:

| Name | Value |
|---|---|
| SUPABASE_URL | Your project's https://…supabase.co URL |
| SUPABASE_SECRET_KEY | Secret API key copied from Supabase |
| DEMO_CODE | Your own hard-to-guess classroom code, at least 8 characters (share only with class) |
| HOST_TOKEN | A different random private token of at least 16 characters (never share or project) |
| DEMO_EXPIRES_AT | ISO timestamp for the end of the session, e.g. 2026-11-20T23:59:00+01:00 |

Use a password generator for the host token. Avoid reusing an old classroom code. Keep secrets in Vercel, not the repository. The expiration restricts reading/creating data; it does not delete records automatically.

## 3. Upload the website to GitHub
Go to your existing `beyond-your-circle` repository. Upload **the contents of the website folder**, not the folder itself, so index.html, package.json, vercel.json, api/live.mjs and assets/* are at the repository root. Replace index.html when prompted / commit the overwrite. Do not upload setup.sql or this README unless you want the setup documentation in your repository. Preserve nested folders (if GitHub web upload doesn't preserve them, use GitHub Desktop or create the folders individually). The old favicon.svg is harmless. Vercel framework preset Other; no custom build command or output directory required. Commit to the production branch (typically main). If environment variables were added after the deployment, redeploy from the Vercel Deployments page. Do not change the production domain.

## 4. Present and test
- Scan the PDF QR on a phone; the home page must load.
- On the projector, go to People > Presenter mode. Enter your secret host token and classroom code before projecting. The directory polls every 3.5 seconds. No projector login profile is required.
- On two independent phones/private windows, open the QR URL, Join live, enter the classroom code, enter nicknames and optional skills/interests, explicitly agree to display, submit. Confirm both profiles appear on the projector. Filter by skills; open a profile. Check Project > Music Magazine > Express interest; count should update. Delete one test profile and verify it disappears on both devices.
- Check an unauthorized browser cannot retrieve live records without the code. The site displays clearly fictional sample profiles outside a live session. It does not simulate real classmates.
- After testing, delete all classroom profiles using the presenter controls (People > Presenter mode; enter token if needed, then reopen Presenter mode). This should be done before the event and again immediately after it. The SQL Editor fallback is `delete from public.byc_profiles;` in this dedicated demo database. Expiration alone does not erase records.
- Share the classroom code verbally or write it on the board; QR URL itself contains no credentials. Demo participation is optional; university-wide mandatory membership is the proposed future model, not a condition of this demo. Names can be nicknames, all other profile fields are optional, no contact details/photos needed.
- Keep the PDF mockups as backup if networking or configuration fails. Homepage and fictional concept profiles work even without the live database.

## Scope and limitations
This is an early-stage classroom prototype, not a production social network. No real university accounts, direct messaging, photo uploads, actual membership enforcement, or genuine project applications. The project cards are illustrative. Access code is shared across the classroom; those who know it can see consented profiles until expiry. Do not store sensitive or private data. Participants can edit/delete their profiles using the same browser tab; sessionStorage holds the edit token. Closing that tab can lose the token, so the presenter can remove all records afterwards. A 60-profile capacity bound prevents unlimited records, but this is not a hardened public registration service; enable Vercel traffic protection if available. Keep the session short and reset all data afterwards. Google Fonts are optional; system font fallbacks are provided.
