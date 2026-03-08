Feature: Subscription State Machine
  All valid and invalid state transitions are handled correctly

  @auth
  Scenario: none → active via Stripe checkout
    Given I have onboarded a tenant with display name "SM None to Active"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Group 1"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/sm1"
    When a Stripe checkout.session.completed event fires for user 66001 in that room
    Then the user 66001 should have an active subscription in that room

  @auth
  Scenario: active → past_due via invoice.payment_failed
    Given I have onboarded a tenant with display name "SM Active to PastDue"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Group 2"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/sm2"
    And user 66002 has an active subscription in that room
    When a Stripe invoice.payment_failed event fires for user 66002
    Then the user 66002 should still have an active subscription in that room

  @auth
  Scenario: past_due → active via invoice.paid
    Given I have onboarded a tenant with display name "SM PastDue to Active"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Group 3"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/sm3"
    And user 66003 has a past_due subscription in that room
    When a Stripe invoice.paid event fires for user 66003
    Then the user 66003 should have an active subscription in that room

  @auth
  Scenario: active → cancelled via subscription.deleted
    Given I have onboarded a tenant with display name "SM Active to Cancelled"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Group 4"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/sm4"
    And user 66004 has an active subscription in that room
    When a Stripe customer.subscription.deleted event fires for user 66004
    Then the user 66004 should have a cancelled subscription in that room

  @auth
  Scenario: cancelled → active via new checkout (resubscribe)
    Given I have onboarded a tenant with display name "SM Cancelled to Active"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Group 5"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/sm5"
    And user 66005 has a cancelled subscription in that room
    When a Stripe checkout.session.completed event fires for user 66005 in that room
    Then the user 66005 should have an active subscription in that room
    And the Telegram mock should have received a message to user 66005 containing "You're in"

  @auth
  Scenario: User with multiple room subscriptions — only one cancelled
    Given I have onboarded a tenant with display name "SM Multi Room"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Room A"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/sma"
    And I have simulated the bot being added to group "SM Room B"
    And I have activated the second room with payment link "https://buy.stripe.com/smb"
    And user 66006 has an active subscription in Room A
    And user 66006 has an active subscription in Room B
    When a Stripe customer.subscription.deleted event fires for user 66006's Room A subscription
    Then the user 66006 should have a cancelled subscription in Room A
    And the user 66006 should have an active subscription in Room B

  @auth
  Scenario: Banned user cannot rejoin after cancellation without resubscribing
    Given I have onboarded a tenant with display name "SM Ban Rejoin"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "SM Ban Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/smban"
    And user 66007 has an active subscription in that room
    When a Stripe customer.subscription.deleted event fires for user 66007
    Then the Telegram mock should have received a ban call for user 66007
    And the user 66007 should have a cancelled subscription in that room
