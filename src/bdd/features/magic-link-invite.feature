Feature: Magic link invitation

  Invited users receive a one-tap login link — no password to copy or type.
  The link is single-use and expires after 24 hours.

  Background:
    Given the Dale system is running
    And I have an existing tenant

  # ── Sending invitations ─────────────────────────────────────────────────────

  Scenario: Invite creates a one-time token and sends a magic link email
    Given I am an authenticated tenant admin
    When I POST to "/api/admin/invite" with body:
      | email | new@example.com |
    Then the response status is 201
    And the response contains "invited": true
    And a magic link token is stored for "new@example.com"
    And the invite email was sent to "new@example.com"
    And the email contains a URL with the token

  Scenario: Unauthenticated invite attempt is rejected
    When I POST to "/api/admin/invite" without auth with body:
      | email | new@example.com |
    Then the response status is 401

  Scenario: Invite with invalid email is rejected
    Given I am an authenticated tenant admin
    When I POST to "/api/admin/invite" with body:
      | email | not-an-email |
    Then the response status is 400
    And the response contains error "Valid email is required"

  # ── Redeeming tokens ─────────────────────────────────────────────────────────

  Scenario: Redeeming a valid token returns credentials
    Given a valid invite token exists for "new@example.com"
    When I GET "/api/invite/<token>"
    Then the response status is 200
    And the response contains "email"
    And the response contains "temporaryPassword"

  Scenario: Token can only be used once
    Given a token that has already been redeemed for "used@example.com"
    When I GET "/api/invite/<token>"
    Then the response status is 410

  Scenario: Expired token is rejected
    Given an invite token that expired 25 hours ago for "expired@example.com"
    When I GET "/api/invite/<token>"
    Then the response status is 410

  Scenario: Invalid token returns 404
    When I GET "/api/invite/not-a-real-token"
    Then the response status is 404
