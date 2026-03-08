Feature: Multi-Tenant Isolation
  Tenants are completely isolated — data, webhooks, and users never cross boundaries

  @auth
  Scenario: Tenant A cannot see Tenant B's rooms
    Given I have onboarded a tenant with display name "Tenant Alpha"
    And I have created a room named "Alpha Room"
    And I have onboarded a second tenant with display name "Tenant Beta"
    When I list rooms as Tenant Beta
    Then the response status should be 200
    And the response body should be an array of length 0

  @auth
  Scenario: Tenant A cannot see Tenant B's subscribers
    Given I have onboarded a tenant with display name "Tenant Iso A"
    And I have created a room named "Iso Room"
    And a Stripe subscriber has been added to that room for user 77001
    And I have onboarded a second tenant with display name "Tenant Iso B"
    When I list all subscribers as Tenant Beta
    Then no subscribers from Tenant Alpha are visible

  @auth
  Scenario: Webhook for Tenant A is rejected by Tenant B's endpoint
    Given I have onboarded a tenant with display name "Tenant WH A"
    And I have retrieved the webhook secret for Tenant A
    And I have onboarded a second tenant with display name "Tenant WH B"
    When I send a Telegram update signed with Tenant A's secret to Tenant B's endpoint
    Then the response status should be 403 or 401

  @auth
  Scenario: Stripe event with Tenant A customer ID is ignored by Tenant B
    Given I have onboarded a tenant with display name "Stripe Tenant A"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "A's Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_ta"
    And user 77002 has an active subscription in that room under Tenant A
    And I have onboarded a second tenant with display name "Stripe Tenant B"
    When Tenant B receives a Stripe subscription.deleted event for user 77002's Stripe customer
    Then user 77002's subscription under Tenant A should still be active

  @auth
  Scenario: Two tenants can have rooms with the same name independently
    Given I have onboarded a tenant with display name "Same Name Alpha"
    And I have created a room named "VIP Room"
    And I have onboarded a second tenant with display name "Same Name Beta"
    And I have created a room named "VIP Room" as Tenant Beta
    When I list rooms as Tenant Alpha
    Then there should be 1 room with name "VIP Room"
    When I list rooms as Tenant Beta
    Then there should be 1 room with name "VIP Room"

  @auth
  Scenario: Deleting a tenant's room does not affect another tenant's room
    Given I have onboarded a tenant with display name "Delete Alpha"
    And I have created a room named "Shared Name"
    And I have onboarded a second tenant with display name "Delete Beta"
    And I have created a room named "Shared Name" as Tenant Beta
    When I delete the room as Tenant Alpha
    Then Tenant Beta's room should still exist
