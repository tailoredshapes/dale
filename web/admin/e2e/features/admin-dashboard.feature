Feature: Admin dashboard
  As an admin
  I want to view platform statistics
  So that I can monitor platform health

  @auth
  Scenario: View platform statistics
    Given I am signed in as admin
    When I visit the dashboard
    Then I see total tenants, active subscriptions and MRR
