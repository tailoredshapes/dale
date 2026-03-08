Feature: Human Acceptance Tests
  End-to-end journeys a real person runs to sign off on production.
  These scenarios require a live environment (real Telegram bot, Stripe test mode).

  # ── 1. Tenant Onboarding ───────────────────────────────────────────────────

  @uat @real-telegram
  Scenario: New creator signs up and sees their dashboard
    Given I open the Dale web app in a browser
    When I click "Sign Up" and create an account with a valid email
    And I confirm the verification email
    And I log in with my new credentials
    Then I should land on the dashboard
    And I should see an "Onboard" or "Get Started" prompt

  @uat @real-telegram
  Scenario: Creator completes onboarding with a Telegram bot token
    Given I am logged in as a new tenant
    When I enter display name "UAT Test Channel"
    And I paste a valid Telegram bot token
    And I submit the onboarding form
    Then my tenant should appear in the dashboard with status "Active"

  # ── 2. Room Setup ──────────────────────────────────────────────────────────

  @uat
  Scenario: Creator creates a paid room
    Given I am an onboarded tenant
    When I navigate to "Rooms" and click "Create Room"
    And I enter room name "UAT Test Room" with a price of "$5.00/month"
    And I submit the room form
    Then the room "UAT Test Room" should appear in my room list with status "Active"
    And I should be able to copy a Subscribe Link for the room

  # ── 3. Stripe Subscription Happy Path ─────────────────────────────────────

  @uat @real-telegram
  Scenario: Subscriber pays with Stripe and receives a Telegram invite
    Given a room "UAT Test Room" has an active payment link
    When I open the Subscribe Link in an incognito window
    And I click "Pay with Card"
    And I enter Stripe test card "4242 4242 4242 4242" expiry "12/34" CVC "123"
    And I complete checkout
    Then I should be redirected to the confirmation page
    And the Telegram bot should send me a group invite link
    When I click the invite link in Telegram
    Then I should be a member of the private group

  # ── 4. Stripe Cancellation ─────────────────────────────────────────────────

  @uat @real-telegram
  Scenario: Cancelling a Stripe subscription removes access
    Given user 99001 has an active Stripe subscription and is in the group
    When the Stripe subscription for user 99001 is cancelled
    Then user 99001 should be kicked from the Telegram group within 60 seconds
    And the bot should send user 99001 a message containing "cancelled"
    And the original invite link should no longer grant access

  # ── 5. PayPal Subscription Happy Path ─────────────────────────────────────

  @uat @real-telegram
  Scenario: Subscriber pays with PayPal and receives a Telegram invite
    Given a room "UAT Test Room" has an active payment link
    When I open the Subscribe Link in an incognito window
    And I click "Pay with PayPal"
    And I log in with a PayPal sandbox buyer account
    And I approve the subscription
    Then I should be redirected to the confirmation page
    And the Telegram bot should send me a group invite link
    When I click the invite link in Telegram
    Then I should be a member of the private group

  # ── 6. PayPal Cancellation ─────────────────────────────────────────────────

  @uat @real-telegram
  Scenario: Cancelling a PayPal subscription removes access
    Given user 99002 has an active PayPal subscription and is in the group
    When the PayPal sandbox subscription for user 99002 is cancelled
    Then user 99002 should be kicked from the Telegram group within 60 seconds

  # ── 7. Multi-Tenant Isolation ──────────────────────────────────────────────

  @uat
  Scenario: Tenant A cannot see Tenant B's data
    Given two separate tenants "Tenant A" and "Tenant B" each have rooms and subscribers
    When I log in as "Tenant A"
    Then I should only see "Tenant A"'s rooms, subscribers, and revenue
    And I should not see any data belonging to "Tenant B"

  # ── 8. Admin Subscriber Management ────────────────────────────────────────

  @uat @real-telegram
  Scenario: Admin suspends a subscriber and they are kicked from the group
    Given user 99003 has an active subscription and is in the group
    When I log in as the tenant and navigate to "Subscribers"
    And I click "Suspend" on user 99003
    Then user 99003 should be kicked from the Telegram group immediately

  @uat @real-telegram
  Scenario: Admin reinstates a suspended subscriber and they receive a new invite
    Given user 99003 is currently suspended
    When I click "Reinstate" on user 99003
    Then the bot should send user 99003 a new invite link

  # ── 9. Telegram Commands ───────────────────────────────────────────────────

  @uat @real-telegram
  Scenario: Bot responds to /start command with available groups
    Given the bot is active in a group
    When a user sends "/start" in the group
    Then the bot should reply with available groups and pricing

  @uat @real-telegram
  Scenario: Bot responds to /help with command list
    Given the bot is active in a group
    When a user sends "/help"
    Then the bot should reply with a list of available commands

  @uat @real-telegram
  Scenario: Active subscriber gets confirmation from /status
    Given user 99004 has an active subscription
    When user 99004 sends "/status"
    Then the bot should confirm their active subscription

  @uat @real-telegram
  Scenario: Non-subscriber is prompted to subscribe via /status
    Given user 99005 has no active subscription
    When user 99005 sends "/status"
    Then the bot should prompt them to subscribe

  # ── 10. SPA Routing ────────────────────────────────────────────────────────

  @uat
  Scenario: App loads correctly on hard refresh of a deep route
    Given the Dale web app is deployed
    When I navigate directly to a deep route such as "/dashboard/rooms"
    And I hard-refresh the page
    Then the page should load without a 403 or white screen
    And the app should render correctly
