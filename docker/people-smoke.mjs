import assert from "node:assert/strict";

// Only the disposable Compose smoke stack, never a configurable public origin.
const base = "http://127.0.0.1:18080";
let cookie;
async function request(path, method = "GET", body, status = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "x-admin-request": "1",
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  assert.equal(response.status, status, `People smoke: ${method} ${path}`);
  if (path === "/api/admin/login") cookie = response.headers.get("set-cookie")?.split(";")[0];
  return response.status === 204 ? null : response.json();
}

await request("/api/admin/login", "POST", {
  username: "smoke",
  password: process.env.SMOKE_PASSWORD
});
assert(cookie, "People smoke: authenticated cookie");
const path = (id) => `/api/admin/people/${id}`;
const create = async (name, kind) =>
  (await request("/api/admin/people", "POST", { name: { en: name }, kind }, 201)).person;
const group = await create("Smoke group", "group");
const member = await create("Smoke member", "person");
const other = await create("Smoke other", "person");
const identities = [{ provider: "spotify", externalId: "1234567890123456789012", confirmed: true }];
const members = [{ personId: member.id, role: "Guitar", startYear: 2020, endYear: null }];
await request(path(group.id), "PATCH", { aliases: ["Smoke alias"], identities, members });
let saved = (await request(path(group.id))).person;
assert.deepEqual(saved.members, members, "People smoke: real database membership mapping");
assert.deepEqual(saved.identities, identities, "People smoke: real database identity mapping");
await request(path(other.id), "PATCH", { identities }, 409);
await request(path(group.id), "PATCH", { members: [{ ...members[0], personId: group.id }] }, 400);
await request(path(member.id), "PATCH", { kind: "group" }, 400);
// Replacement writes delete/create nested rows atomically; a conflicting identity must roll back.
await request(path(other.id), "PATCH", {
  identities: [{ ...identities[0], externalId: "2234567890123456789012" }]
});
await request(
  path(group.id),
  "PATCH",
  {
    aliases: ["Do not keep"],
    identities: [{ ...identities[0], externalId: "2234567890123456789012" }],
    members: []
  },
  409
);
saved = (await request(path(group.id))).person;
assert.deepEqual(saved.aliases, ["Smoke alias"], "People smoke: failed nested update is atomic");
assert.deepEqual(saved.identities, identities);
assert.deepEqual(saved.members, members);
await request(path(member.id), "DELETE", undefined, 204);
assert.deepEqual(
  (await request(path(group.id))).person.members,
  [],
  "People smoke: member deletion cascades"
);
await request(path(group.id), "DELETE", undefined, 204);
// A deleted identity can be claimed again, proving the identity FK also cascaded.
await request(path(other.id), "PATCH", { identities });
await request(path(other.id), "DELETE", undefined, 204);
console.log("People smoke: identities, membership, uniqueness, atomic updates and cascades passed");
