Feature: Security
  Authentication, authorisation, and injection protection

  Scenario: Admin API requires valid bearer token
    When I send a GET request to "/api/rooms" without auth
    Then the response status should be 401

  Scenario: Admin API rejects expired token
    When I send a GET request to "/api/rooms" with an expired token
    Then the response status should be 401

  Scenario: Admin API rejects tampered token
    When I send a GET request to "/api/rooms" with a tampered JWT
    Then the response status should be 401

  Scenario: Telegram webhook requires valid secret header
    When I send a POST to the Telegram webhook without a secret header
    Then the response status should be 401 or 403

  Scenario: Telegram webhook rejects wrong secret value
    When I send a POST to the Telegram webhook with secret "wrong-secret-value"
    Then the response status should be 401 or 403

  Scenario: Stripe webhook rejects missing signature header
    When I send a POST to the Stripe webhook with tenant "any-tenant" and no signature
    Then the response status should be 400 or 500

  Scenario: PayPal webhook rejects invalid payload
    When I send a POST to the PayPal webhook with garbage body
    Then the response status should be 400 or 500

  @auth
  Scenario: Room ID in path cannot be traversed to another tenant's room
    Given I have onboarded a tenant with display name "Security Tenant A"
    And I have created a room named "Secret Room A"
    And I have onboarded a second tenant with display name "Security Tenant B"
    When Tenant B requests Tenant A's room by ID
    Then the response status should be 404

  @auth
  Scenario: Tenant cannot update another tenant's room
    Given I have onboarded a tenant with display name "Security Update A"
    And I have created a room named "Secure Room"
    And I have onboarded a second tenant with display name "Security Update B"
    When Tenant B sends a PUT to Tenant A's room with body:
      """
      {"name": "Hijacked"}
      """
    Then the response status should be 404

  @auth
  Scenario: SQL/NoSQL injection attempt in room name is stored safely
    Given I have onboarded a tenant with display name "Security Injection"
    When I create a room with:
      | name | '; DROP TABLE rooms; -- |
    Then the response status should be 201
    When I list rooms via the admin API
    Then there should be 1 room

  @auth
  Scenario: XSS payload in room description is stored safely
    Given I have onboarding a tenant with display name "Security XSS"
    When I create a room with:
      | name        | XSS Room                              |
      | description | <script>alert('xss')</script>         |
    Then the response status should be 201

  @auth
  Scenario: Very long room name is handled
    Given I have onboarded a tenant with display name "Security Long Name"
    When I create a room with a name of 500 characters
    Then the response status should be 201 or 400
