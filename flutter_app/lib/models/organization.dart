class OrganizationModel {
  final String id;
  final String name;
  final String type;
  final String hqCity;
  final int foundedYear;
  final String focusArea;
  final bool inSpaceAuthorized;
  final String websiteUrl;
  final String description;

  const OrganizationModel({
    required this.id,
    required this.name,
    required this.type,
    required this.hqCity,
    required this.foundedYear,
    required this.focusArea,
    required this.inSpaceAuthorized,
    required this.websiteUrl,
    required this.description,
  });

  factory OrganizationModel.fromJson(Map<String, dynamic> json) {
    return OrganizationModel(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      type: (json['type'] ?? 'PRIVATE_STARTUP').toString(),
      hqCity: (json['hq_city'] ?? '').toString(),
      foundedYear: (json['founded_year'] as num?)?.toInt() ?? 2020,
      focusArea: (json['focus_area'] ?? '').toString(),
      inSpaceAuthorized: (json['in_space_authorized'] as bool?) ?? false,
      websiteUrl: (json['website_url'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
    );
  }
}
