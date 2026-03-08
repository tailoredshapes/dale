Feature: Tenant management
  As an admin
  I want to manage tenants
  So that I can onboard and control creators

  @auth
  Scenario: View all tenants
    Given I am signed in as admin
    When I visit the tenants page
    Then I see a list of all tenants

  @auth
  Scenario: Onboard a new tenant
    Given I am on the tenants page
    When I fill in the new tenant form and submit
    Then the new tenant appears in the tenant list

  @auth
  Scenario: Suspend a tenant
    Given there is an active tenant
    When I click Suspend
    Then the tenant status shows as suspended
