Feature: SPA API Configuration
  The SPA bundle must be built with a real API URL pointing at the Lambda,
  not the CloudFront origin. If VITE_API_URL is missing the SPA sends API
  calls to itself and gets HTML back instead of JSON.

  Scenario: SPA bundle does not contain empty VITE_API_URL placeholder
    When I fetch the SPA JS bundle
    Then the bundle should not contain the string "VITE_API_URL"

  Scenario: SPA bundle contains a real API Gateway URL
    When I fetch the SPA JS bundle
    Then the bundle should contain the string "execute-api"

  Scenario: API health check is reachable from the SPA origin
    When I request the admin API health endpoint
    Then the response status should be 200 or 401
    And the response body should be valid JSON
    And the response body should not contain "<!doctype html"
