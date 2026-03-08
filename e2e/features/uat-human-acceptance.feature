Feature: Human Acceptance Tests
  End-to-end UAT journeys driven through the Dale web frontends.
  Creator flows use the creator app; subscriber flows use the consumer app.
  These scenarios require a live environment with real Telegram and Stripe test mode.

  # ── 1. Creator: Sign Up & Onboarding ──────────────────────────────────────

  @uat @real-telegram
  Scenario: New creator signs up and reaches the dashboard
    Given I open the Dale creator app in a browser
    When I click "Sign Up" and register with email "uat-creator@example.com"
    And I confirm the verification email
    And I log in with my new credentials
    Then I should be on the creator dashboard

  @uat @real-telegram
  Scenario: Creator completes onboarding with a bot token
    Given I am logged in to the creator app with no onboarding completed
    When I complete onboarding with display name "UAT Test Channel" and a valid Telegram bot token
    Then I should see my tenant dashboard showing status "Active"

  # ── 2. Creator: Room Management ────────────────────────────────────────────

  @uat
  Scenario: Creator creates a room from the rooms page
    Given I am on the rooms page in the creator app
    When I fill in room name "UAT Test Room", description, Telegram group ID, and price "$5.00"
    And I click "Create"
    Then the room "UAT Test Room" should appear in my room list

  @uat
  Scenario: Creator opens a room and copies the subscribe link
    Given I have a room "UAT Test Room" in my room list
    When I open the room detail page
    Then I should see a subscribe link I can copy

  @uat
  Scenario: Creator views subscriber list for a room
    Given I have a room with at least one subscriber
    When I open the room detail page
    Then I should see a list of subscribers with their subscription status

  # ── 3. Creator: Subscriber Management ─────────────────────────────────────

  @uat @real-telegram
  Scenario: Creator suspends a subscriber from the room detail page
    Given I have a room with an active subscriber "uat-consumer"
    When I open the room detail page
    And I click "Suspend" on subscriber "uat-consumer"
    Then "uat-consumer" should be kicked from the Telegram group
    And the subscriber status should show as "Suspended"

  @uat @real-telegram
  Scenario: Creator reinstates a suspended subscriber
    Given subscriber "uat-consumer" is suspended in my room
    When I click "Reinstate" on subscriber "uat-consumer"
    Then the bot should send "uat-consumer" a new Telegram invite link
    And the subscriber status should show as "Active"

  # ── 4. Consumer: Subscribe via Stripe ─────────────────────────────────────

  @uat @real-telegram
  Scenario: Consumer visits subscribe page and pays with Stripe
    Given I open the consumer subscribe page for "UAT Test Room"
    And I am signed in as a consumer
    When I click "Subscribe"
    And I choose Stripe
    And I enter card "4242 4242 4242 4242" expiry "12/34" CVC "123" and complete checkout
    Then I should be redirected back to the consumer app
    And I should see a Telegram invite link on my dashboard
    When I click the invite link in Telegram
    Then I should be a member of the private group

  # ── 5. Consumer: Subscribe via PayPal ─────────────────────────────────────

  @uat @real-telegram
  Scenario: Consumer pays with PayPal and receives a Telegram invite
    Given I open the consumer subscribe page for "UAT Test Room"
    And I am signed in as a consumer
    When I click "Subscribe"
    And I choose PayPal
    And I log in with a PayPal sandbox account and approve the subscription
    Then I should be redirected back to the consumer app
    And I should see a Telegram invite link on my dashboard
    When I click the invite link in Telegram
    Then I should be a member of the private group

  # ── 6. Consumer: View & Cancel Subscription ────────────────────────────────

  @uat
  Scenario: Consumer sees their active subscription on the dashboard
    Given I am signed in as a consumer with an active subscription
    When I visit the consumer dashboard
    Then I should see my active subscription to "UAT Test Room"

  @uat @real-telegram
  Scenario: Consumer cancels their subscription
    Given I am signed in as a consumer with an active subscription to "UAT Test Room"
    When I click "Cancel" on that subscription
    Then the subscription status should change to "Cancelling"
    And within 60 seconds I should be kicked from the Telegram group

  # ── 7. Multi-Tenant Isolation ──────────────────────────────────────────────

  @uat
  Scenario: Creator A cannot see Creator B's rooms or subscribers
    Given two creators "Creator A" and "Creator B" are both onboarded with rooms and subscribers
    When I log in to the creator app as "Creator A"
    Then I should only see "Creator A"'s rooms and subscribers
    And I should not see any data belonging to "Creator B"

  # ── 8. SPA Routing ─────────────────────────────────────────────────────────

  @uat
  Scenario: Creator app loads on direct navigation to a deep route
    Given the Dale creator app is deployed
    When I navigate directly to the rooms page URL and hard-refresh
    Then the page should load without a 403 or blank screen

  @uat
  Scenario: Consumer app loads on direct navigation to a deep route
    Given the Dale consumer app is deployed
    When I navigate directly to the dashboard URL and hard-refresh
    Then the page should load without a 403 or blank screen
