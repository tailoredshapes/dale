Feature: Subscriptions
  As a subscriber
  I want to manage my subscriptions
  So that I can access and control my communities

  @auth
  Scenario: View active subscriptions
    Given I am signed in
    When I visit the dashboard
    Then I see my active subscriptions

  @auth
  Scenario: Cancel a subscription
    Given I am signed in with an active subscription
    When I click cancel on a subscription
    Then the subscription status changes to cancelling

  @auth
  Scenario: Subscribe to a room via Stripe
    Given I am signed in
    When I click Subscribe on a room
    And I choose Stripe
    Then I am redirected to the Stripe payment page

  @auth
  Scenario: Subscribe to a room via PayPal
    Given I am signed in
    When I click Subscribe on a room
    And I choose PayPal
    Then I am redirected to the PayPal payment page

  @auth
  Scenario: Receive Telegram invite after successful payment
    Given I have completed a Stripe subscription
    When payment is confirmed
    Then I see a Telegram invite link on my dashboard
