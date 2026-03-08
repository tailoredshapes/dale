Feature: Admin API Authentication
  The Admin API requires a valid Cognito JWT

  Scenario: Request without token returns 401
    When I send a GET request to "/api/tenant" without auth
    Then the response status should be 401

  Scenario: Request with invalid token returns 401
    When I send a GET request to "/api/tenant" with token "invalid-token"
    Then the response status should be 401

  @auth
  Scenario: Authenticated request with no tenant returns 404
    When I send an authenticated GET request to "/api/tenant"
    Then the response status should be 404
