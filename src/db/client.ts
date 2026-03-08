// meshql-rs client configuration
export const MESHQL_URL = process.env.MESHQL_URL || 'http://localhost:8080';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function graphql<T>(
  endpoint: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${MESHQL_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result: GraphQLResponse<T> = await response.json();
  if (result.errors && result.errors.length > 0) {
    throw new Error(`GraphQL error: ${result.errors[0].message}`);
  }
  return result.data as T;
}

export async function restGet<T>(endpoint: string, id: string): Promise<T | null> {
  const response = await fetch(`${MESHQL_URL}${endpoint}/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`REST GET failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function restPost<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${MESHQL_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`REST POST failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function restPut<T>(endpoint: string, id: string, data: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${MESHQL_URL}${endpoint}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`REST PUT failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function restDelete(endpoint: string, id: string): Promise<void> {
  const response = await fetch(`${MESHQL_URL}${endpoint}/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`REST DELETE failed: ${response.status} ${response.statusText}`);
  }
}
