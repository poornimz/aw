class LaunchVehicleModel {
  final String id;
  final String organizationId;
  final String? organizationName;
  final String? organizationType;
  final String name;
  final int stages;
  final int leoPayloadKg;
  final int gtoPayloadKg;
  final String propulsionType;
  final String status;

  const LaunchVehicleModel({
    required this.id,
    required this.organizationId,
    this.organizationName,
    this.organizationType,
    required this.name,
    required this.stages,
    required this.leoPayloadKg,
    required this.gtoPayloadKg,
    required this.propulsionType,
    required this.status,
  });

  factory LaunchVehicleModel.fromJson(Map<String, dynamic> json) {
    return LaunchVehicleModel(
      id: (json['id'] ?? '').toString(),
      organizationId: (json['organization_id'] ?? '').toString(),
      organizationName: json['organization_name']?.toString(),
      organizationType: json['organization_type']?.toString(),
      name: (json['name'] ?? '').toString(),
      stages: (json['stages'] as num?)?.toInt() ?? 0,
      leoPayloadKg: (json['leo_payload_kg'] as num?)?.toInt() ?? 0,
      gtoPayloadKg: (json['gto_payload_kg'] as num?)?.toInt() ?? 0,
      propulsionType: (json['propulsion_type'] ?? '').toString(),
      status: (json['status'] ?? 'OPERATIONAL').toString(),
    );
  }
}
