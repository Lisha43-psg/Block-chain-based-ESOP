// Central API service — all backend calls go through here
const BASE_URL = "http://localhost:5000";

// ── Auth ──────────────────────────────────────────────────
export async function loginUser(email, password, role) {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  return res.json();
}

// ── Employees ─────────────────────────────────────────────
export async function fetchEmployees() {
  const res = await fetch(`${BASE_URL}/api/employees`);
  if (!res.ok) throw new Error("Failed to fetch employees");
  return res.json();
}

export async function createEmployee(data) {
  const res = await fetch(`${BASE_URL}/api/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create employee");
  return res.json();
}

// ── Grants ────────────────────────────────────────────────
export async function fetchGrantsByWallet(walletAddress) {
  const res = await fetch(`${BASE_URL}/api/grants/${walletAddress}`);
  if (!res.ok) throw new Error("Failed to fetch grants");
  return res.json();
}

export async function createGrant(data) {
  const res = await fetch(`${BASE_URL}/api/grants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create grant");
  return res.json();
}

export async function exerciseShares(grantId, shares, walletAddress) {
  const res = await fetch(`${BASE_URL}/api/grants/${grantId}/exercise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shares, walletAddress }),
  });
  if (!res.ok) throw new Error("Failed to exercise shares");
  return res.json();
}

export async function revokeGrant(grantId) {
  const res = await fetch(`${BASE_URL}/api/grants/${grantId}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to revoke grant");
  return res.json();
}

export async function fetchPoolInfo() {
  const res = await fetch(`${BASE_URL}/api/pool`);
  if (!res.ok) throw new Error("Failed to fetch pool info");
  return res.json();
}
// Signup
export async function registerUser(data) {
  const res = await fetch(`${BASE_URL}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || "Registration failed");
  }

  return result;
}
