# Dale UAT — Human Acceptance Test Plan

**Service:** Dalegram — Telegram subscription gating bot  
**Production URL:** https://d1f1nnh0bx9ylo.cloudfront.net (dalegram.com once DNS resolves)  
**Admin API:** https://tlf5u71me7.execute-api.us-east-1.amazonaws.com  

> Run this plan top-to-bottom with a real browser, a real Telegram account, and a real Stripe test card.  
> Each section depends on the previous. Don't skip ahead.

---

## Prerequisites

- [ ] Telegram account you control (not the bot)
- [ ] Stripe test card: `4242 4242 4242 4242` exp `12/34` CVC `123`
- [ ] PayPal sandbox account (for PayPal section)
- [ ] Access to the Dale admin panel

---

## 1. Tenant Onboarding

**Goal:** A new creator can sign up and configure their bot.

1. Open https://d1f1nnh0bx9ylo.cloudfront.net
2. Click **Sign Up** — create an account with a real email
3. Confirm the verification email
4. Log in → you should land on the dashboard
5. Click **Onboard** or **Get Started**
6. Enter a display name (e.g. "UAT Test Channel")
7. Paste a Telegram Bot Token (create one via @BotFather if needed)
8. ✅ Dashboard shows your tenant with status **Active**

---

## 2. Room Setup

**Goal:** Creator can create a paid room that subscribers will be gated into.

1. From the dashboard, click **Rooms** → **Create Room**
2. Enter name: `UAT Test Room`
3. Set a price (e.g. $5.00/month)
4. ✅ Room appears in the list with status **Active**
5. Click the room → copy the **Subscribe Link**

---

## 3. Stripe Subscription — Happy Path

**Goal:** A subscriber pays and gets added to the Telegram group.

1. Open the Subscribe Link from step 2 in an incognito window
2. Click **Pay with Card**
3. Enter Stripe test card: `4242 4242 4242 4242` / `12/34` / `123`
4. Complete checkout
5. ✅ Redirect back to the confirmation page
6. In Telegram: the bot should send a message with a **join link** to the group
7. Click the join link → you join the private group
8. ✅ You can see messages in the group

---

## 4. Stripe Cancellation — Access Revocation

**Goal:** Cancelling the subscription kicks the user from the group.

1. Log into the subscriber account in Stripe test dashboard (or trigger a cancel webhook)
2. Cancel the subscription
3. ✅ Within ~60 seconds: bot kicks you from the Telegram group
4. ✅ Bot sends a message: "Your subscription has ended"
5. Attempting to use the old join link should fail

---

## 5. PayPal Subscription — Happy Path

1. Open the Subscribe Link from step 2 in an incognito window
2. Click **Pay with PayPal**
3. Log in with PayPal sandbox buyer account
4. Approve the subscription
5. ✅ Redirect back to confirmation page
6. ✅ Telegram join link sent by bot
7. Join the group → confirm access

---

## 6. PayPal Cancellation

1. Cancel the PayPal sandbox subscription
2. ✅ Bot kicks subscriber from group within ~60 seconds

---

## 7. Multi-Tenant Isolation

**Goal:** Two separate tenants cannot see each other's data.

1. Create a second tenant account (new email + new bot token)
2. Create a room under Tenant B
3. Log in as Tenant A → **cannot** see Tenant B's rooms, subscribers, or revenue
4. ✅ Admin panel only shows own data

---

## 8. Admin Panel — Subscriber Management

1. Log in as the tenant from step 1
2. Go to **Subscribers** — confirm the test subscriber from step 3 appears
3. Click **Suspend** on the subscriber
4. ✅ Bot kicks them from the group immediately
5. Click **Reinstate**
6. ✅ Bot sends a new join link to the subscriber

---

## 9. Telegram Commands

With the bot added to a group and a subscriber present:

1. Send `/start` in the group → bot responds with available groups/pricing
2. Send `/help` → bot responds with command list
3. Send `/status` as a subscriber → bot confirms active subscription
4. Send `/status` as a non-subscriber → bot prompts to subscribe

---

## 10. SPA / Page Load

1. Hard-refresh https://d1f1nnh0bx9ylo.cloudfront.net → loads without 403
2. Navigate to a deep route (e.g. `/dashboard/rooms`) → refresh → still loads
3. ✅ No white screens on direct URL access (CloudFront SPA routing working)

---

## Sign-off

| Section | Tester | Date | Pass/Fail | Notes |
|---------|--------|------|-----------|-------|
| 1. Tenant Onboarding | | | | |
| 2. Room Setup | | | | |
| 3. Stripe Happy Path | | | | |
| 4. Stripe Cancellation | | | | |
| 5. PayPal Happy Path | | | | |
| 6. PayPal Cancellation | | | | |
| 7. Multi-Tenant Isolation | | | | |
| 8. Admin Subscriber Mgmt | | | | |
| 9. Telegram Commands | | | | |
| 10. SPA Page Load | | | | |
