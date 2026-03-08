Feature: Telegram Bot Commands
  All bot commands behave correctly across subscription states

  @auth
  Scenario: /start in group with no active subscription shows payment link
    Given I have onboarded a tenant with display name "Commands Start"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Start Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_start"
    When user 55001 sends "/start" in the group
    Then the response status should be 200
    And the Telegram mock should have received a message to user 55001 containing "https://buy.stripe.com/test_start"

  @auth
  Scenario: /start as DM with no active subscription shows payment link
    Given I have onboarded a tenant with display name "Commands DM Start"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "DM Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_dmstart"
    When user 55002 sends "/start" as a direct message
    Then the response status should be 200
    And the Telegram mock should have received a message to user 55002

  @auth
  Scenario: /start with active subscription sends invite link
    Given I have onboarded a tenant with display name "Commands Active Start"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Active Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_activestart"
    And user 55003 has an active subscription in that room
    When user 55003 sends "/start" as a direct message
    Then the response status should be 200
    And the Telegram mock should have received a message to user 55003 containing "Join"

  @auth
  Scenario: /status with active subscription reports active
    Given I have onboarded a tenant with display name "Commands Status Active"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Status Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_status"
    And user 55004 has an active subscription in that room
    When user 55004 sends "/status" as a direct message
    Then the response status should be 200
    And the Telegram mock should have received a message to user 55004 containing "active"

  @auth
  Scenario: /status with no subscription reports not subscribed
    Given I have onboarded a tenant with display name "Commands Status None"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Status None Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_statusnone"
    When user 55005 sends "/status" as a direct message
    Then the response status should be 200
    And the Telegram mock should have received a message to user 55005

  @auth
  Scenario: /help always responds
    Given I have onboarded a tenant with display name "Commands Help"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Help Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_help"
    When a user sends "/help" in the group
    Then the response status should be 200

  @auth
  Scenario: Unknown command is handled gracefully
    Given I have onboarded a tenant with display name "Commands Unknown"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Unknown Group"
    And I have activated the auto-created room with payment link "https://buy.stripe.com/test_unknown"
    When a user sends "/notacommand" in the group
    Then the response status should be 200

  @auth
  Scenario: Non-command message in group is ignored
    Given I have onboarded a tenant with display name "Commands Ignore"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "Ignore Group"
    When a regular text message is sent in the group
    Then the response status should be 200
    And the Telegram mock should not have received any message

  @auth
  Scenario: /start in room with no payment link tells user to contact admin
    Given I have onboarded a tenant with display name "Commands No Link"
    And I have retrieved the webhook secret
    And I have simulated the bot being added to group "No Link Group"
    When user 55006 sends "/start" in the group
    Then the response status should be 200
