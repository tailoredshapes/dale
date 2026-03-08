Feature: Admin Tenant Management — Exhaustive
  Full tenant lifecycle, validation, and edge cases

  @auth
  Scenario: Newly onboarded tenant has expected fields
    When I onboard a new tenant with display name "Full Fields Tenant"
    Then the response status should be 201
    And the response body should have field "tenantId"
    And the response body should have field "webhookRegistered"

  @auth
  Scenario: Onboard tenant without display name returns 400
    When I send an authenticated POST request to "/api/tenant/onboard" with body:
      """
      {"telegramBotToken": "fake-token"}
      """
    Then the response status should be 400

  Scenario: Onboard tenant unauthenticated returns 401
    When I send a POST request to "/api/tenant/onboard" without auth with body:
      """
      {"displayName": "Unauth Tenant", "telegramBotToken": "fake"}
      """
    Then the response status should be 401

  @auth
  Scenario: Get tenant returns current tenant details
    Given I have onboarded a tenant with display name "Get Tenant Details"
    When I send an authenticated GET request to "/api/tenant"
    Then the response status should be 200
    And the response body should have field "tenantId"
    And the response body should have field "displayName" with value "Get Tenant Details"

  @auth
  Scenario: Update tenant display name persists
    Given I have onboarded a tenant with display name "Before Update"
    When I send an authenticated PUT request to "/api/tenant" with body:
      """
      {"displayName": "After Update"}
      """
    Then the response status should be 200
    When I send an authenticated GET request to "/api/tenant"
    Then the response body should have field "displayName" with value "After Update"

  @auth
  Scenario: Tenant gets its own unique webhook secret
    Given I have onboarded a tenant with display name "Unique Secret Tenant A"
    And I have retrieved the webhook secret as "secret_a"
    And I have onboarded a tenant with display name "Unique Secret Tenant B"
    And I have retrieved the webhook secret as "secret_b"
    Then "secret_a" should not equal "secret_b"

  @auth
  Scenario: Each onboard call creates a distinct tenant
    Given I have onboarded a tenant with display name "Distinct Tenant 1"
    And I store the tenantId as "id_1"
    When I onboard a new tenant with display name "Distinct Tenant 2"
    And I store the tenantId as "id_2"
    Then "id_1" should not equal "id_2"

  @auth
  Scenario: Get tenant before onboarding returns 404
    When I send an authenticated GET request to "/api/tenant" without prior onboarding
    Then the response status should be 404 or 400

  @auth
  Scenario: CORS headers present on admin API responses
    When I send an OPTIONS request to "/api/tenant"
    Then the response should include CORS headers
