# ViralRefer — Manual Testing Checklist

Use this checklist to manually verify the core workflows after changes.

> **Note**: In addition to this manual checklist, the project now has **unit tests** (run with `npm test`) covering the pure helper functions (`formatError`, `computeHighRiskIPs`, `filterReferralsByDays`, etc.).

---

## 1. Prerequisites

- [ ] App is running locally (`npm run dev`)
- [ ] You can access the public site (usually http://localhost:5173)
- [ ] You can open the Admin panel (password: `TestAdmin2026!`)
- [ ] Browser console is open (for defensive logs)

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
1. Go to **Admin → Edit Content**
2. Add new key:
   - Key: `referral_base_url`
   - Value: `https://my-test-domain.com/join`
3. Save
4. Refresh the public page
5. Click **"Get my referral link"**
6. The generated link should now start with `https://my-test-domain.com/join?ref=...`
7. Test Copy, QR, and all share buttons — they should all use the new base

### 4.3 Return Visit (Stored Code)
- [ ] Generate a link with a custom base
- [ ] Refresh the page (or close and reopen)
- [ ] The pre-filled link (if you had a stored code) should use the custom base
- [ ] Use `debugReferral()` in console to verify

---

## 5. Text Colors Admin Tab

### 5.1 Basic Color Changes
- [ ] Go to **Admin → TEXT COLORS**
- [ ] Change several colors (e.g. Prize Title, Referral Link Text, Copy Button BG)
- [ ] Watch the public page behind the modal update in real time

### 5.2 Reset All Defaults
- [ ] Click **"Reset All Defaults"**
- [ ] Confirm the dialog
- [ ] All custom colors should revert to design system defaults on the public page

### 5.3 Add Custom Color
- [ ] In the "Add Custom Color" section at the bottom:
  - Enter a suffix (e.g. `my_footer_link`)
  - Pick a color
  - Click **Add & Save**
- [ ] Refresh the Text Colors tab
- [ ] The new custom color should appear under "Custom Colors (user-added)"

### 5.4 Live Preview on Tab Open
- [ ] Close and reopen the Text Colors tab
- [ ] Colors should be applied immediately to the public page

---

## 6. Debug Helper

In the browser console, run:

```js
debugReferral()
```

Expected output should show:
- `referralBaseUrl`
- `myReferralCode`
- Current value of `#ref-link`
- Current page URL

---

## 7. Edge Cases & Defensive Checks

### 7.1 Bad `referral_base_url`
- [ ] Set `referral_base_url` to an invalid value (e.g. `not-a-url`)
- [ ] Generate a new link
- [ ] It should fall back gracefully and log a warning in console

### 7.2 Empty `referral_base_url`
- [ ] Delete or empty the `referral_base_url` key
- [ ] App should fall back to `https://viralrefer.app`

### 7.3 Referral with Query Params in Base
- [ ] Set `referral_base_url` to `https://example.com?campaign=spring2026`
- [ ] Generated link should correctly become `https://example.com?campaign=spring2026&ref=XXXX`

---

## 8. Admin → Edit Content

- [ ] Add/edit/delete keys freely
- [ ] Changes to text content (e.g. `prize_title`, `hero_badge`) reflect on public site after refresh

---

## 9. General Polish

- [ ] No obvious console errors on page load
- [ ] Admin password works (`TestAdmin2026!`)
- [ ] All 5 admin tabs open without crashing
- [ ] Responsive on mobile (at least basic)

---

**Tip**: Keep the browser console open during all tests. Most defensive logs start with `[ViralRefer]`.

Run this checklist after any significant change to the referral, color, or content systems.

---

Last updated: 2026-05-22
