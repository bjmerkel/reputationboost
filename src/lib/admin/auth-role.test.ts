import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canManageAdminTeam,
  canManageOnBehalf,
  getGodModeEmails,
  isGodModeEmail,
} from "@/lib/admin/auth-role";

describe("god mode", () => {
  const original = process.env.ADMIN_BOOTSTRAP_EMAILS;

  it("detects bootstrap emails as god mode", () => {
    process.env.ADMIN_BOOTSTRAP_EMAILS = "owner@example.com, Admin@Company.com";
    assert.equal(isGodModeEmail("owner@example.com"), true);
    assert.equal(isGodModeEmail("admin@company.com"), true);
    assert.equal(isGodModeEmail("other@example.com"), false);
    assert.deepEqual([...getGodModeEmails()], ["owner@example.com", "admin@company.com"]);
    process.env.ADMIN_BOOTSTRAP_EMAILS = original;
  });

  it("only god mode can manage admin team", () => {
    process.env.ADMIN_BOOTSTRAP_EMAILS = "owner@example.com";
    assert.equal(canManageAdminTeam("owner@example.com"), true);
    assert.equal(canManageAdminTeam("operator@example.com"), false);
    process.env.ADMIN_BOOTSTRAP_EMAILS = original;
  });
});

describe("canManageOnBehalf", () => {
  it("allows operators and superadmins to manage on behalf of users", () => {
    assert.equal(canManageOnBehalf("operator"), true);
    assert.equal(canManageOnBehalf("superadmin"), true);
    assert.equal(canManageOnBehalf("viewer"), false);
    assert.equal(canManageOnBehalf(null), false);
  });
});
