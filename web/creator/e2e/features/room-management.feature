Feature: Room management
  As a creator
  I want to manage my rooms
  So that I can accept and organize subscribers

  @auth
  Scenario: Create a new room
    Given I am on the rooms page
    When I fill in room name, description, Telegram group ID and price
    And I click Create
    Then the new room appears in my room list

  @auth
  Scenario: Edit room details
    Given I have an existing room
    When I edit the room name
    Then the updated name appears in the room list

  @auth
  Scenario: Deactivate a room
    Given I have an active room with subscribers
    When I deactivate the room
    Then the room status shows as inactive

  @auth
  Scenario: View subscriber list
    Given I have a room with subscribers
    When I open the room detail page
    Then I see a list of subscribers with their subscription status
