import { describe, expect, it } from "vitest";
import {
  ScenarioAuthorizationError,
  assertScenarioPermission,
  getPermissionsForRole,
  hasScenarioPermission,
} from "@/lib/scenarioAuth";

describe("scenario auth", () => {
  it("maps memberships to expected permissions", () => {
    expect(hasScenarioPermission("owner", "scenario.publish")).toBe(true);
    expect(hasScenarioPermission("admin", "scenario.delete")).toBe(true);
    expect(hasScenarioPermission("editor", "scenario.publish")).toBe(false);
    expect(hasScenarioPermission("viewer", "scenario.export")).toBe(true);
    expect(hasScenarioPermission("viewer", "scenario.create")).toBe(false);
    expect(getPermissionsForRole("editor")).toContain("scenario.edit");
  });

  it("throws an authorization error when a role lacks permission", () => {
    expect(() =>
      assertScenarioPermission(
        "viewer",
        "scenario.delete",
        "Viewer cannot delete scenarios.",
      ),
    ).toThrow(ScenarioAuthorizationError);
  });
});

