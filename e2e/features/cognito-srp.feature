Feature: Cognito SRP Authentication
  Verify that the user pool supports the SRP auth flow used by real clients

  Scenario: SRP authentication returns valid tokens
    Given a temporary user exists for SRP testing
    When the user authenticates via SRP
    Then the SRP login should succeed with valid tokens
    When I send an authenticated GET request to "/api/tenant"
    Then the response status should be 404
