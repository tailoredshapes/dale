Feature: Admin Room Management — Exhaustive
  Full CRUD, validation, and edge cases for room management

  @auth
  Scenario: Create room with all fields
    Given I have onboarded a tenant with display name "Rooms Full Create"
    When I create a room with:
      | name             | Full Room            |
      | description      | A fully-spec'd room  |
      | paymentLink      | https://buy.stripe.com/full |
      | priceDescription | $10/month            |
    Then the response status should be 201
    And the response body should have field "roomId"
    And the response body should have field "name"

  @auth
  Scenario: Create room with minimal fields
    Given I have onboarded a tenant with display name "Rooms Minimal Create"
    When I create a room with:
      | name | Minimal Room |
    Then the response status should be 201
    And the response body should have field "roomId"

  @auth
  Scenario: Create room without authentication returns 401
    When I send a POST request to "/api/rooms" without auth with body:
      """
      {"name": "Unauth Room"}
      """
    Then the response status should be 401

  @auth
  Scenario: List rooms returns all created rooms
    Given I have onboarded a tenant with display name "Rooms List All"
    And I have created a room named "Room One"
    And I have created a room named "Room Two"
    And I have created a room named "Room Three"
    When I send an authenticated GET request to "/api/rooms"
    Then the response status should be 200
    And the response body should be an array of length 3

  @auth
  Scenario: Get room by ID returns correct room
    Given I have onboarded a tenant with display name "Rooms Get By ID"
    And I have created a room named "Specific Room"
    When I send an authenticated GET request to the created room
    Then the response status should be 200
    And the response body should have field "name" with value "Specific Room"

  @auth
  Scenario: Get non-existent room returns 404
    Given I have onboarded a tenant with display name "Rooms 404"
    When I send an authenticated GET request to "/api/rooms/nonexistent-room-id"
    Then the response status should be 404

  @auth
  Scenario: Update room name
    Given I have onboarded a tenant with display name "Rooms Update Name"
    And I have created a room named "Old Name"
    When I send an authenticated PUT request to the created room with body:
      """
      {"name": "New Name"}
      """
    Then the response status should be 200
    When I send an authenticated GET request to the created room
    Then the response body should have field "name" with value "New Name"

  @auth
  Scenario: Update room payment link activates it
    Given I have onboarded a tenant with display name "Rooms Update Link"
    And I have created a room named "Inactive Room"
    When I update the room with paymentLink "https://buy.stripe.com/activated"
    Then the response status should be 200
    When I send an authenticated GET request to the created room
    Then the room should be active

  @auth
  Scenario: Update room without authentication returns 401
    Given I have onboarded a tenant with display name "Rooms Unauth Update"
    And I have created a room named "Auth Required Room"
    When I send an unauthenticated PUT request to the created room with body:
      """
      {"name": "Hacked"}
      """
    Then the response status should be 401

  @auth
  Scenario: Delete room removes it from list
    Given I have onboarded a tenant with display name "Rooms Delete"
    And I have created a room named "Doomed Room"
    When I delete the room
    Then the response status should be 200
    When I send an authenticated GET request to "/api/rooms"
    Then the response body should be an array of length 0

  @auth
  Scenario: Room created via Telegram bot-added event appears in room list
    Given I have onboarded a tenant with display name "Rooms From Telegram"
    And I have retrieved the webhook secret
    When I simulate the bot being added to group "Auto-Created Room"
    Then the response status should be 200
    When I list rooms via the admin API
    Then the response body should be an array of length 1
    And the room should have name "Auto-Created Room"

  @auth
  Scenario: Room name comes from Telegram group title
    Given I have onboarded a tenant with display name "Rooms TG Title"
    And I have retrieved the webhook secret
    When I simulate the bot being added to group "My Community Group"
    When I list rooms via the admin API
    Then the room should have name "My Community Group"

  @auth
  Scenario: Room is active by default on creation
    Given I have onboarded a tenant with display name "Rooms Default Active"
    When I create a room with:
      | name | No Link Room |
    When I send an authenticated GET request to the created room
    Then the room should be active
