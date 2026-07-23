export const APP_NAME = "HaulPilot";

export const USER_ROLES = ["admin", "dispatcher", "driver"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export const TRIP_STATUSES = [
  "draft",
  "published",
  "downloaded",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export function isTripStatus(value: unknown): value is TripStatus {
  return typeof value === "string" && (TRIP_STATUSES as readonly string[]).includes(value);
}

/**
 * Corridor defaults (spec §7). Dispatchers can override these per trip
 * before publishing.
 */
export const DEFAULT_CORRIDOR_WARNING_METERS = 50;
export const DEFAULT_CORRIDOR_ALARM_METERS = 100;
export const DEFAULT_OFF_ROUTE_DELAY_SECONDS = 8;

/**
 * GPS accuracy worse than this must never confirm an off-route alarm (spec §8).
 */
export const MAX_GPS_ACCURACY_FOR_ALARM_METERS = 50;
