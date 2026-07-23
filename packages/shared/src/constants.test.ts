import { describe, expect, it } from "vitest";
import {
  APP_NAME,
  DEFAULT_CORRIDOR_ALARM_METERS,
  DEFAULT_CORRIDOR_WARNING_METERS,
  DEFAULT_OFF_ROUTE_DELAY_SECONDS,
  MAX_GPS_ACCURACY_FOR_ALARM_METERS,
  isTripStatus,
  isUserRole,
} from "./constants";

describe("constants", () => {
  it("uses the spec defaults for corridor monitoring", () => {
    expect(DEFAULT_CORRIDOR_WARNING_METERS).toBe(50);
    expect(DEFAULT_CORRIDOR_ALARM_METERS).toBe(100);
    expect(DEFAULT_OFF_ROUTE_DELAY_SECONDS).toBe(8);
    expect(MAX_GPS_ACCURACY_FOR_ALARM_METERS).toBe(50);
  });

  it("names the app", () => {
    expect(APP_NAME).toBe("HaulPilot");
  });
});

describe("isUserRole", () => {
  it("accepts known roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("dispatcher")).toBe(true);
    expect(isUserRole("driver")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isUserRole("superuser")).toBe(false);
    expect(isUserRole(null)).toBe(false);
    expect(isUserRole(42)).toBe(false);
  });
});

describe("isTripStatus", () => {
  it("accepts known statuses", () => {
    expect(isTripStatus("draft")).toBe(true);
    expect(isTripStatus("in_progress")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isTripStatus("paused")).toBe(false);
    expect(isTripStatus(undefined)).toBe(false);
  });
});
