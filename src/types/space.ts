export type OrganizationType = 'GOV_AGENCY' | 'COMMERCIAL_ARM' | 'PRIVATE_STARTUP';
export type VehicleStatus = 'OPERATIONAL' | 'DEVELOPMENT' | 'RETIRED';
export type MissionStatus = 'UPCOMING' | 'SUCCESS' | 'FAILURE' | 'IN_PROGRESS';

export interface PayloadItem {
  id: string;
  mission_id: string;
  organization_id: string;
  name: string;
  mass_kg: number;
  purpose: string;
  country_of_origin: string;
}

export interface MissionItem {
  id: string;
  organization_id: string;
  organization_name: string | null;
  organization_type: OrganizationType | null;
  vehicle_id: string | null;
  vehicle_name: string | null;
  mission_code: string;
  title: string;
  program: string;
  launch_date: string;
  launch_site: string;
  orbit_type: string;
  status: MissionStatus;
  remarks: string;
  payloads: PayloadItem[];
}

export interface LaunchVehicleItem {
  id: string;
  organization_id: string;
  organization_name: string | null;
  organization_type: OrganizationType | null;
  name: string;
  stages: number;
  leo_payload_kg: number;
  gto_payload_kg: number;
  propulsion_type: string;
  status: VehicleStatus;
}

export interface StartupOrganization {
  id: string;
  name: string;
  type: OrganizationType;
  hq_city: string;
  founded_year: number;
  focus_area: string;
  in_space_authorized: boolean;
  website_url: string;
  description: string;
}

export interface IsroCentreItem {
  id: string;
  name: string;
  acronym: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  primary_role: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  last_synced_at: string;
  server_time_utc?: string;
  cache_hit: boolean;
}

export interface NextMissionResponse {
  mission: MissionItem;
  server_time_utc: string;
  last_synced_at: string;
}

export interface SyncJobResponse {
  job_id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  source?: string;
  records_upserted?: number;
  error_message?: string | null;
  poll_url?: string;
}

export interface ProblemError {
  status: number;
  title: string;
  detail: string;
}
