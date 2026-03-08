Feature: Telegram Webhook
  The Telegram webhook endpoint handles incoming updates with proper auth

  Scenario: POST with no tenant returns 400
    When I send a POST to the Telegram webhook without a tenant
    Then the response status should be 400

  Scenario: POST with no secret returns 401
    When I send a POST to the Telegram webhook without a secret
    Then the response status should be 401

  @auth
  Scenario: POST with unknown secret returns 401
    Given I have onboarded a tenant with display name "Webhook Test"
    When I send a POST to the Telegram webhook with an invalid secret
    Then the response status should be 401
