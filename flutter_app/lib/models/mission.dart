class PayloadModel {
  final String id;
  final String missionId;
  final String organizationId;
  final String name;
  final double massKg;
  final String purpose;
  final String countryOfOrigin;

  const PayloadModel({
    required this.id,
    required this.missionId,
    required this.organizationId,
    required this.name,
    required this.massKg,
    required this.purpose,
    required this.countryOfOrigin,
  });

  factory PayloadModel.fromJson(Map<String, dynamic> json) {
    return PayloadModel(
      id: (json['id'] ?? '').toString(),
      missionId: (json['mission_id'] ?? '').toString(),
      organizationId: (json['organization_id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      massKg: (json['mass_kg'] as num?)?.toDouble() ?? 0.0,
      purpose: (json['purpose'] ?? '').toString(),
      countryOfOrigin: (json['country_of_origin'] ?? 'India').toString(),
    );
  }
}

class MissionModel {
  final String id;
  final String organizationId;
  final String? organizationName;
  final String? organizationType;
  final String? vehicleId;
  final String? vehicleName;
  final String missionCode;
  final String title;
  final String program;
  final DateTime launchDate;
  final String launchSite;
  final String orbitType;
  final String status;
  final String remarks;
  final List<PayloadModel> payloads;

  const MissionModel({
    required this.id,
    required this.organizationId,
    this.organizationName,
    this.organizationType,
    this.vehicleId,
    this.vehicleName,
    required this.missionCode,
    required this.title,
    required this.program,
    required this.launchDate,
    required this.launchSite,
    required this.orbitType,
    required this.status,
    required this.remarks,
    required this.payloads,
  });

  factory MissionModel.fromJson(Map<String, dynamic> json) {
    final rawPayloads = json['payloads'] as List<dynamic>? ?? const [];
    return MissionModel(
      id: (json['id'] ?? '').toString(),
      organizationId: (json['organization_id'] ?? '').toString(),
      organizationName: json['organization_name']?.toString(),
      organizationType: json['organization_type']?.toString(),
      vehicleId: json['vehicle_id']?.toString(),
      vehicleName: json['vehicle_name']?.toString(),
      missionCode: (json['mission_code'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      program: (json['program'] ?? '').toString(),
      launchDate: DateTime.tryParse((json['launch_date'] ?? '').toString())?.toUtc() ??
          DateTime.now().toUtc(),
      launchSite: (json['launch_site'] ?? '').toString(),
      orbitType: (json['orbit_type'] ?? '').toString(),
      status: (json['status'] ?? 'UPCOMING').toString(),
      remarks: (json['remarks'] ?? '').toString(),
      payloads: rawPayloads
          .whereType<Map<String, dynamic>>()
          .map(PayloadModel.fromJson)
          .toList(),
    );
  }
}

class NextMissionResponse {
  final MissionModel mission;
  final DateTime serverTimeUtc;
  final DateTime? lastSyncedAt;

  const NextMissionResponse({
    required this.mission,
    required this.serverTimeUtc,
    this.lastSyncedAt,
  });

  factory NextMissionResponse.fromJson(Map<String, dynamic> json) {
    return NextMissionResponse(
      mission: MissionModel.fromJson(
        (json['mission'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      ),
      serverTimeUtc:
          DateTime.tryParse((json['server_time_utc'] ?? '').toString())?.toUtc() ??
              DateTime.now().toUtc(),
      lastSyncedAt: json['last_synced_at'] != null
          ? DateTime.tryParse(json['last_synced_at'].toString())?.toUtc()
          : null,
    );
  }
}
