Feature: Streamlined creator onboarding and integration setup

  Background:
    Given the Dale system is running
    And no tenant exists for the authenticated user

  # ── Onboarding ──────────────────────────────────────────────────────────────

  Scenario: Creator onboards with display name only
    Given I am a new authenticated user
    When I POST to "/api/tenant/onboard" with:
      | displayName | My Creator Brand |
    Then the response status is 201
    And the response contains a "tenantId"
    And no Telegram webhook is registered
    And no Stripe configuration is stored
    And no PayPal configuration is stored

  Scenario: Onboard fails without display name
    Given I am a new authenticated user
    When I POST to "/api/tenant/onboard" with an empty body
    Then the response status is 400
    And the response contains error "Missing required fields"

  Scenario: Creator onboards with display name and Telegram bot
    Given I am a new authenticated user
    When I POST to "/api/tenant/onboard" with:
      | displayName        | My Creator Brand    |
      | telegramBotToken   | 123456:ABCdef       |
    Then the response status is 201
    And the Telegram webhook is registered for the new tenant
    And the response contains "webhookRegistered": true

  Scenario: Onboard with all integrations at once
    Given I am a new authenticated user
    When I POST to "/api/tenant/onboard" with:
      | displayName          | My Creator Brand  |
      | telegramBotToken     | 123456:ABCdef     |
      | stripeSecretKey      | sk_live_xxx       |
      | stripeWebhookSecret  | whsec_xxx         |
      | paypalClientId       | paypal-client-id  |
      | paypalClientSecret   | paypal-secret     |
    Then the response status is 201
    And the Telegram webhook is registered for the new tenant
    And the response contains a "stripeWebhookUrl"
    And the response contains a "paypalWebhookUrl"

  # ── Telegram integration meshlette ──────────────────────────────────────────

  Scenario: Creator configures Telegram bot after onboarding
    Given I have an existing tenant with no Telegram bot configured
    When I PUT to "/api/tenant/telegram" with:
      | telegramBotToken | 123456:ABCdef |
    Then the response status is 200
    And the Telegram webhook is registered for the tenant
    And the response contains "webhookRegistered": true

  Scenario: Creator updates an existing Telegram bot token
    Given I have an existing tenant with a Telegram bot configured
    When I PUT to "/api/tenant/telegram" with:
      | telegramBotToken | 999999:XYZnew |
    Then the response status is 200
    And the new Telegram webhook is registered
    And the old webhook is replaced

  Scenario: Telegram configuration fails if token is missing
    Given I have an existing tenant
    When I PUT to "/api/tenant/telegram" with an empty body
    Then the response status is 400
    And the response contains error "telegramBotToken is required"

  Scenario: Telegram configuration fails if webhook registration fails
    Given I have an existing tenant
    And the Telegram API is unavailable
    When I PUT to "/api/tenant/telegram" with:
      | telegramBotToken | 123456:ABCdef |
    Then the response status is 502
    And the tenant's Telegram token is not updated

  # ── Stripe integration meshlette ────────────────────────────────────────────

  Scenario: Creator configures Stripe after onboarding
    Given I have an existing tenant with no Stripe configured
    When I PUT to "/api/tenant/payment" with:
      | stripeSecretKey     | sk_live_xxx |
      | stripeWebhookSecret | whsec_xxx   |
    Then the response status is 200
    And the response contains a "stripeWebhookUrl"
    And the Stripe keys are stored for the tenant

  Scenario: Stripe configuration requires both key and webhook secret
    Given I have an existing tenant
    When I PUT to "/api/tenant/payment" with only:
      | stripeSecretKey | sk_live_xxx |
    Then the response status is 400
    And the response contains error "Both stripeSecretKey and stripeWebhookSecret are required"

  # ── PayPal integration meshlette ────────────────────────────────────────────

  Scenario: Creator configures PayPal after onboarding
    Given I have an existing tenant with no PayPal configured
    When I PUT to "/api/tenant/payment" with:
      | paypalClientId     | paypal-client-id |
      | paypalClientSecret | paypal-secret    |
    Then the response status is 200
    And the PayPal webhook is registered for the tenant
    And the response contains a "paypalWebhookUrl"

  Scenario: PayPal configuration requires both client ID and secret
    Given I have an existing tenant
    When I PUT to "/api/tenant/payment" with only:
      | paypalClientId | paypal-client-id |
    Then the response status is 400
    And the response contains error "Both paypalClientId and paypalClientSecret are required"

  Scenario: PayPal webhook registration failure rolls back storage
    Given I have an existing tenant
    And the PayPal API returns an error for webhook registration
    When I PUT to "/api/tenant/payment" with:
      | paypalClientId     | paypal-client-id |
      | paypalClientSecret | paypal-secret    |
    Then the response status is 502
    And no PayPal credentials are stored for the tenant
