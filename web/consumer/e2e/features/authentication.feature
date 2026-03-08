Feature: Authentication
  As a user
  I want to sign in
  So that I can manage my subscriptions

  Scenario: Sign up with email
    Given I visit the home page
    When I click "Sign In"
    Then I am redirected to the Cognito auth page
