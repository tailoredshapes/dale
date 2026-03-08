Feature: Creator onboarding
  As a new creator
  I want to set up my account
  So that I can start accepting subscribers

  @auth
  Scenario: New creator sets up their account
    Given I am a new creator
    When I complete onboarding with my bot token and payment keys
    Then I see my creator dashboard
