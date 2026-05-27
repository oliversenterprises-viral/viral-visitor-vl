# ViralRefer — Manual Testing Checklist

Use this checklist to manually verify the core workflows after changes.

> **Note**: In addition to this manual checklist, the project has **unit tests** (run with `npm test`) covering pure helper functions.

---

## 1. Prerequisites

- [ ] App is running locally (`npm run dev`)
- [ ] You can access the public site (usually http://localhost:5173 or the preview URL)
- [ ] You know the current admin password (`VITE_ADMIN_PASSWORD` value or development default `TestAdmin2026!`)
- [ ] Browser console is open (for defensive `[ViralRefer]` logs)
- [ ] Vercel preview or production environment variables are correctly set for testing

---

## 2. Core Public Referral Flow

### 2.1 Basic Referral Link Generation
- [ ] Click **"Get my referral link"** button in the hero
- [ ] The referral input field populates with a link (e.g. `https://viralrefer.app?ref=XXXX`)
- [ ] A QR code appears and updates
- [ ] Console shows: `[ViralRefer] Generated referral link: ...`

### 2.2 NEW CODE Button
- [ ] Click **"NEW CODE"**
- [ ] A new code is generated
- [ ] The link in the input updates with the new code
- [ ] QR code updates accordingly

### 2.3 Copy Link
- [ ] Click the **COPY** button next to the referral link
- [ ] Button text changes to "COPIED!" temporarily
- [ ] Link is copied to clipboard

### 2.4 QR Code
- [ ] Click on the QR code image
- [ ] Modal opens with a larger QR and the full link
- [ ] The link in the modal matches the one in the input field

---

## 3. Sharing Buttons

- [ ] Click each share button (X, WhatsApp, LinkedIn, Facebook, Telegram, SMS, Email)
- [ ] Verify the shared text contains the referral link
- [ ] Console logs: `[ViralRefer] Sharing link via ...`

---

## 4. Custom `referral_base_url` Testing

### 4.1 Default Behavior
- [ ] With no `referral_base_url` set, links should use `https://viralrefer.app`

### 4.2 Custom Base URL
1. Open **Admin** (enter correct password) → **EDIT CONTENT**
2. Add or update key:
   - Key: `referral_base_url`
   - Value: `https://my-test-domain.com/join`
3. Save
4. Refresh the public page
5. Click **"Get my referral link"**
6. The generated link should now start with the custom base
7. Test Copy, QR, and all share buttons — they must use the new base

### 4.3 Return Visit (Stored Code)
- [ ] Generate a link with a custom base
- [ ] Refresh the page (or close and reopen)
- [ ] The pre-filled link uses the custom base
- [ ] Use `debugReferral()` in console to verify

---

## 5. Text Colors Admin Tab

### 5.1 Basic Color Changes
- [ ] Open **Admin** → **TEXT COLORS**
- [ ] Change several colors (e.g. Prize Title, Referral Link Text, Copy Button BG)
- [ ] Watch the public page behind the modal update in real time

### 5.2 Reset All Defaults
- [ ] Click **"Reset All Defaults"**
- [ ] Confirm the dialog
- [ ] All custom colors revert to design system defaults on the public page

### 5.3 Add Custom Color
- [ ] In the "Add Custom Color" section:
  - Enter a suffix (e.g. `my_footer_link`)
  - Pick a color
  - Click **Add & Save**
- [ ] Refresh the Text Colors tab
- [ ] The new custom color appears under "Custom Colors (user-added)"

### 5.4 Live Preview on Tab Open
- [ ] Close and reopen the Text Colors tab
- [ ] Colors are applied immediately to the public page

---

## 6. Debug Helper

In the browser console, run:

```js
debugReferral()
```

Expected output shows:
- `referralBaseUrl`
- `myReferralCode`
- Current value of `#ref-link`
- Current page URL

---

## 7. Edge Cases & Defensive Checks

### 7.1 Bad `referral_base_url`
- [ ] Set `referral_base_url` to an invalid value (e.g. `not-a-url`)
- [ ] Generate a new link
- [ ] It falls back gracefully and logs a warning

### 7.2 Empty `referral_base_url`
- [ ] Delete or empty the `referral_base_url` key
- [ ] App falls back to `https://viralrefer.app`

### 7.3 Referral with Query Params in Base
- [ ] Set `referral_base_url` to `https://example.com?campaign=spring2026`
- [ ] Generated link correctly becomes `https://example.com?campaign=spring2026&ref=XXXX`

---

## 8. Admin Dashboard

- [ ] Enter correct admin password to open dashboard
- [ ] All five tabs open without crashing: REFERRALS, SHARE ANALYTICS, EDIT CONTENT, PRIZE CLAIMS, TEXT COLORS
- [ ] REFERRALS tab loads data
- [ ] SHARE ANALYTICS tab loads data and renders charts
- [ ] EDIT CONTENT tab allows add/edit/delete of keys (changes visible after refresh)
- [ ] PRIZE CLAIMS tab loads claims and supports status updates via the `admin-action` Edge Function
- [ ] TEXT COLORS tab functions with live preview and reset

---

## 9. Prize Claims Flow (Stub + Edge Function)

- [ ] Open a prize claim form (if visible in UI)
- [ ] Turnstile widget appears and functions
- [ ] Submission routes through the `submit-claim` Edge Function
- [ ] Claims appear in the Admin → PRIZE CLAIMS tab

---

## 10. General Polish

- [ ] No obvious console errors on page load
- [ ] Admin password gate works with the current `VITE_ADMIN_PASSWORD` value
- [ ] Responsive on mobile (at least basic functionality)
- [ ] Realtime updates visible in leaderboard/activity when testing with multiple tabs or devices

---

**Tip**: Keep the browser console open during all tests. Most defensive logs start with `[ViralRefer]`.

Run this checklist after any significant change to the referral, color, content, or admin systems.

---

Last updated: 2026-05-26