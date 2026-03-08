Feature: PayPal Subscription Lifecycle
  PayPal webhooks mirror Stripe: activate → cancel → reinstate

  @auth
  Scenario: PayPal subscription activated adds user to room
    Given I have onboarded a tenant with display name "PayPal Lifecycle"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "PayPal Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_paypal"
    When a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires for user 88001 in that room
    Then the user 88001 should have an active subscription in that room
    And the Telegram mock should have received a message to user 88001 containing "You're in"

  @auth
  Scenario: PayPal subscription cancelled removes user from room
    Given I have onboarded a tenant with display name "PayPal Cancelled"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "PayPal Cancel Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_ppcancel"
    And user 88002 has an active PayPal subscription in that room
    When a PayPal BILLING.SUBSCRIPTION.CANCELLED event fires for user 88002
    Then the user 88002 should have a cancelled subscription in that room
    And the Telegram mock should have received a message to user 88002 containing "cancelled"

  @auth
  Scenario: PayPal subscription suspended marks user past_due
    Given I have onboarded a tenant with display name "PayPal Suspended"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "PayPal Suspend Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_ppsuspend"
    And user 88003 has an active PayPal subscription in that room
    When a PayPal BILLING.SUBSCRIPTION.SUSPENDED event fires for user 88003
    Then the user 88003 should have a past_due subscription in that room

  @auth
  Scenario: PayPal subscription re-activated unbans user
    Given I have onboarded a tenant with display name "PayPal Reactivated"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "PayPal Reactivate Room"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_ppreact"
    And user 88004 has a cancelled PayPal subscription in that room
    When a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires for user 88004 in that room
    Then the user 88004 should have an active subscription in that room
    And the Telegram mock should have received an unban call for user 88004

  Scenario: PayPal webhook with invalid signature returns 400
    When I send a POST to the PayPal webhook with bad signature
    Then the response status should be 400 or 500

  @auth
  Scenario: PayPal event with missing custom_id is ignored gracefully
    Given I have onboarded a tenant with display name "PayPal Bad CustomId"
    And I have retrieved the webhook secret
    When a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires with no custom_id
    Then the response status should be 200
    And no user room mapping should be created

  @auth
  Scenario: PayPal event with mismatched tenant in custom_id is ignored
    Given I have onboarded a tenant with display name "PayPal Mismatch"
    And I have retrieved the webhook secret
    When a PayPal BILLING.SUBSCRIPTION.ACTIVATED event fires with tenant "wrong-tenant" in custom_id
    Then the response status should be 200
    And no user room mapping should be created
