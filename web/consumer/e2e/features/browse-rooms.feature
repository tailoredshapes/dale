Feature: Browse rooms
  As a visitor
  I want to browse available rooms
  So that I can find communities to join

  Scenario: View available rooms without login
    Given I visit the home page
    Then I see a list of rooms with name, description and price

  Scenario: View room details
    Given I visit the home page
    When I see a room card
    Then the room card shows the room name
    And the room card shows the room price
