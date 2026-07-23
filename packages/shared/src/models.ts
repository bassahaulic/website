import type { LineString } from "geojson";
import type { TripStatus, UserRole } from "./constants";

/**
 * Core data model (spec §6). Timestamps are ISO 8601 strings.
 */

export interface User {
  id: string;
  organizationId: string;
  role: UserRole;
  displayName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  organizationId: string;
  unitNumber: string;
  description?: string;
  licensePlate?: string;
  vin?: string;
  isActive: boolean;
}

export interface Trip {
  id: string;
  organizationId: string;

  status: TripStatus;

  permitNumber: string;
  issuingState: string;

  originText: string;
  destinationText: string;

  validFrom: string;
  validUntil: string;

  driverId?: string;
  vehicleId?: string;

  permitFileId: string;
  routeVersionId?: string;

  corridorWarningMeters: number;
  corridorAlarmMeters: number;
  offRouteDelaySeconds: number;

  publishedAt?: string;
  startedAt?: string;
  completedAt?: string;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PermitFile {
  id: string;
  tripId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: "application/pdf";
  fileSizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface RouteVersion {
  id: string;
  tripId: string;
  versionNumber: number;

  source: "manual" | "gpx" | "kml";

  geometry: LineString;
  waypoints: RouteWaypoint[];

  totalDistanceMeters: number;

  isPublished: boolean;
  createdBy: string;
  createdAt: string;
}

export interface RouteWaypoint {
  id: string;
  sequence: number;
  latitude: number;
  longitude: number;
  label?: string;
  instruction?: string;
}

export interface GPSPoint {
  id: string;
  tripId: string;
  driverId: string;

  latitude: number;
  longitude: number;

  accuracyMeters?: number;
  altitudeMeters?: number;
  speedMetersPerSecond?: number;
  headingDegrees?: number;

  recordedAt: string;
  uploadedAt?: string;
}

export interface DeviationEvent {
  id: string;
  tripId: string;
  driverId: string;

  latitude: number;
  longitude: number;

  distanceFromRouteMeters: number;
  gpsAccuracyMeters?: number;

  severity: "warning" | "alarm";

  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;

  acknowledgmentReason?: string;
}
