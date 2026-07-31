import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canManageOnBehalf } from "@/lib/admin/auth-role";

describe("canManageOnBehalf", () => {
  it("allows operators and superadmins to manage on behalf of users", () => {
    assert.equal(canManageOnBehalf("operator"), true);
    assert.equal(canManageOnBehalf("superadmin"), true);
    assert.equal(canManageOnBehalf("viewer"), false);
    assert.equal(canManageOnBehalf(null), false);
  });
});
