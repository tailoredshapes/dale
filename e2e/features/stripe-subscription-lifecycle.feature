Feature: Stripe Subscription Lifecycle
  The full journey: checkout → active → payment failure → cancellation → rebuy

  @auth
  Scenario: Checkout completed adds user to room and sends invite
    Given I have onboarded a tenant with display name "Stripe Lifecycle"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Stripe Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_lifecycle"
    When a Stripe checkout.session.completed event fires for user 99001 in that room
    Then the user 99001 should have an active subscription in that room
    And the Telegram mock should have received a message to user 99001 containing "You're in"

  @auth
  Scenario: Invoice paid reactivates a past_due subscription
    Given I have onboarded a tenant with display name "Stripe Invoice Paid"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Invoice Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_invoice"
    And user 99002 has a past_due subscription in that room
    When a Stripe invoice.paid event fires for user 99002
    Then the user 99002 should have an active subscription in that room
    And the Telegram mock should have received an unban call for user 99002

  @auth
  Scenario: Invoice payment failed sends warning message
    Given I have onboarded a tenant with display name "Stripe Payment Failed"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Failed Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_failed"
    And user 99003 has an active subscription in that room
    When a Stripe invoice.payment_failed event fires for user 99003
    Then the Telegram mock should have received a message to user 99003 containing "payment failed"
    And the user 99003 should still have an active subscription in that room

  @auth
  Scenario: Subscription deleted bans user and sends cancellation message
    Given I have onboarded a tenant with display name "Stripe Sub Deleted"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Deleted Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_deleted"
    And user 99004 has an active subscription in that room
    When a Stripe customer.subscription.deleted event fires for user 99004
    Then the user 99004 should have a cancelled subscription in that room
    And the Telegram mock should have received a ban call for user 99004
    And the Telegram mock should have received a message to user 99004 containing "cancelled"

  @auth
  Scenario: Subscription updated to past_due does not ban immediately
    Given I have onboarded a tenant with display name "Stripe Sub Past Due"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Past Due Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_pastdue"
    And user 99005 has an active subscription in that room
    When a Stripe customer.subscription.updated event fires with status "past_due" for user 99005
    Then the user 99005 should have a past_due subscription in that room
    And the Telegram mock should not have received a ban call for user 99005

  @auth
  Scenario: Subscription updated to cancelled bans user
    Given I have onboarded a tenant with display name "Stripe Sub Updated Cancel"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Updated Cancel Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_updcancel"
    And user 99006 has an active subscription in that room
    When a Stripe customer.subscription.updated event fires with status "canceled" for user 99006
    Then the user 99006 should have a cancelled subscription in that room
    And the Telegram mock should have received a ban call for user 99006

  @auth
  Scenario: Subscription updated to active unbans previously cancelled user
    Given I have onboarded a tenant with display name "Stripe Sub Reactivated"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Reactivate Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_reactivate"
    And user 99007 has a cancelled subscription in that room
    When a Stripe customer.subscription.updated event fires with status "active" for user 99007
    Then the user 99007 should have an active subscription in that room
    And the Telegram mock should have received an unban call for user 99007

  @auth
  Scenario: Unknown Stripe event type is ignored gracefully
    Given I have onboarded a tenant with display name "Stripe Unknown Event"
    And I have retrieved the webhook secret
    When a Stripe event of type "payment_intent.created" fires
    Then the response status should be 200

  Scenario: Stripe webhook with wrong signature returns 400
    When I send a POST to the Stripe webhook with tenant "fake-tenant" and bad signature
    Then the response status should be 400 or 500

  Scenario: Stripe webhook without tenant parameter returns 400
    When I send a POST to the Stripe webhook without a tenant parameter
    Then the response status should be 400

  @auth
  Scenario: Checkout with mismatched tenant in client_reference_id is ignored
    Given I have onboarded a tenant with display name "Stripe Mismatch"
    And I have retrieved the webhook secret
    When a Stripe checkout.session.completed event fires with tenant "wrong-tenant-id" in client_reference_id
    Then the response status should be 200
    And no user room mapping should be created
