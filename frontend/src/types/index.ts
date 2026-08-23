export type UserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  email_verified?: boolean;
  email_verified_at?: string;
  created_at: string;
  last_login?: string;
}

export interface NetworkInterface {
  id?: number;
  interface_name: string;
  ip_address?: string;
  mac_address?: string;
  is_primary: boolean;
}

export interface Device {
  id: number;
  ip_address: string;
  mac_address?: string;
  hostname?: string;
  vendor?: string;
  os_type?: string;
  os_version?: string;
  device_type: 'workstation' | 'server' | 'router' | 'firewall' | 'switch' | 'soc';
  status: 'ONLINE' | 'OFFLINE' | 'WARNING' | 'CRITICAL';
  is_monitored: boolean;
  first_seen: string;
  last_seen: string;
  notes?: string;
  interfaces: NetworkInterface[];
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface Alert {
  id: number;
  alert_id: string;
  title: string;
  description?: string;
  category: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  source_ip?: string;
  destination_ip?: string;
  source_port?: number;
  destination_port?: number;
  protocol?: string;
  signature?: string;
  raw_event?: string;
  is_synthetic: boolean;
  created_at: string;
  updated_at: string;
  acknowledged_by?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export interface IncidentTimeline {
  id: number;
  timestamp: string;
  actor: string;
  event_type: string;
  message: string;
}

export interface Incident {
  id: number;
  incident_id: string;
  title: string;
  description?: string;
  severity: AlertSeverity;
  status: 'OPEN' | 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';
  assigned_analyst?: string;
  created_by: string;
  affected_ips?: string;
  investigation_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  timeline_events: IncidentTimeline[];
  alert_count: number;
}

export interface SecurityEvent {
  id: number;
  event_id: string;
  timestamp: string;
  source: string;
  event_type: string;
  severity: string;
  source_ip?: string;
  destination_ip?: string;
  source_port?: number;
  destination_port?: number;
  protocol?: string;
  signature?: string;
  description?: string;
  raw_payload?: string;
  is_synthetic: boolean;
}

export interface BlockedIP {
  id: number;
  ip_address: string;
  reason: string;
  blocked_by: string;
  blocked_at: string;
  expires_at?: string;
  is_active: boolean;
  source_alert_id?: string;
}

export interface FirewallAction {
  id: number;
  action_type: string;
  ip_address?: string;
  triggered_by: string;
  timestamp: string;
  status: string;
  details?: string;
}

export interface FirewallRule {
  id: number;
  rule_name: string;
  action: 'BLOCK' | 'PASS' | 'REJECT';
  source_cidr: string;
  dest_cidr: string;
  port_range: string;
  protocol: string;
  is_enabled: boolean;
  created_at: string;
}

export interface FirewallStatus {
  provider: string;
  is_connected: boolean;
  active_blocks_count: number;
  total_actions_count: number;
  protected_ips_count: number;
  last_sync?: string;
}

export interface TrafficMetric {
  id: number;
  timestamp: string;
  bytes_in: number;
  bytes_out: number;
  packets_in: number;
  packets_out: number;
  active_flows: number;
  tcp_count: number;
  udp_count: number;
  icmp_count: number;
  other_count: number;
  top_source_ips?: string;
  top_dest_ips?: string;
}

export interface HealthMetric {
  id: number;
  host_id: string;
  hostname: string;
  os_name?: string;
  cpu_percent: number;
  ram_percent: number;
  disk_percent: number;
  network_in_bytes: number;
  network_out_bytes: number;
  uptime_seconds: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';
  recorded_at: string;
}

export interface DashboardSummary {
  total_devices: number;
  online_devices: number;
  active_alerts: number;
  critical_alerts: number;
  open_incidents: number;
  blocked_ips_count: number;
  current_bandwidth_in_kbps: number;
  current_bandwidth_out_kbps: number;
  total_events_today: number;
  suricata_status: string;
  zeek_status: string;
  firewall_status: string;
  agent_count: number;
  development_mode: boolean;
}

export interface NotificationSetting {
  id: number;
  channel_type: string;
  is_enabled: boolean;
  min_severity: string;
  config_json?: string;
}

export interface NotificationLog {
  id: number;
  timestamp: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  error_message?: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  result: string;
  source_ip?: string;
  metadata_json?: string;
}

export interface ReportMetadata {
  report_id: string;
  report_name: string;
  generated_at: string;
  file_size_bytes: number;
  download_url: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
  updated_by: string;
}
