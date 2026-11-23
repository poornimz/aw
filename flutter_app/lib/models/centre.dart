class IsroCentreModel {
  final String id;
  final String name;
  final String acronym;
  final String city;
  final String state;
  final double latitude;
  final double longitude;
  final String primaryRole;

  const IsroCentreModel({
    required this.id,
    required this.name,
    required this.acronym,
    required this.city,
    required this.state,
    required this.latitude,
    required this.longitude,
    required this.primaryRole,
  });

  factory IsroCentreModel.fromJson(Map<String, dynamic> json) {
    return IsroCentreModel(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      acronym: (json['acronym'] ?? '').toString(),
      city: (json['city'] ?? '').toString(),
      state: (json['state'] ?? '').toString(),
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      primaryRole: (json['primary_role'] ?? '').toString(),
    );
  }
}
