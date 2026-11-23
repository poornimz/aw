import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../models/api_response.dart';
import '../models/centre.dart';
import '../models/mission.dart';
import '../models/organization.dart';
import '../models/vehicle.dart';

final apiClientProvider = Provider<SpaceApiClient>((ref) => SpaceApiClient());

final selectedNavIndexProvider = StateProvider<int>((ref) => 0);

// Launch Control filter
final launchControlFilterProvider = StateProvider<String>((ref) => 'All');

// Missions & Payloads filters
final missionSearchQueryProvider = StateProvider<String>((ref) => '');
final missionProgramFilterProvider = StateProvider<String>((ref) => 'All');
final missionStatusFilterProvider = StateProvider<String>((ref) => 'ALL');

// Startups filter
final startupFocusFilterProvider = StateProvider<String>((ref) => 'All');

// Centres filter
final centreStateFilterProvider = StateProvider<String>((ref) => 'All');
final centreSearchQueryProvider = StateProvider<String>((ref) => '');

final nextMissionProvider = FutureProvider<NextMissionResponse>((ref) async {
  final client = ref.watch(apiClientProvider);
  final filter = ref.watch(launchControlFilterProvider);
  final json = await client.getJson(
    '/missions/next',
    queryParameters: filter == 'All' ? null : {'program': filter},
  );
  return NextMissionResponse.fromJson(json);
});

final missionsProvider = FutureProvider<PagedResult<MissionModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final query = ref.watch(missionSearchQueryProvider);
  final program = ref.watch(missionProgramFilterProvider);
  final status = ref.watch(missionStatusFilterProvider);

  final params = <String, dynamic>{};
  if (program != 'All') params['program'] = program;
  if (status != 'ALL') params['status'] = status;
  if (query.trim().isNotEmpty) params['q'] = query.trim();

  final json = await client.getJson('/missions', queryParameters: params);
  final raw = (json['items'] as List<dynamic>? ?? const []);
  return PagedResult<MissionModel>(
    items: raw.whereType<Map<String, dynamic>>().map(MissionModel.fromJson).toList(),
    total: (json['total'] as num?)?.toInt() ?? raw.length,
    lastSyncedAt: json['last_synced_at'] != null
        ? DateTime.tryParse(json['last_synced_at'].toString())?.toUtc()
        : null,
    cacheHit: (json['cache_hit'] as bool?) ?? false,
  );
});

final launchControlMissionsProvider =
    FutureProvider<PagedResult<MissionModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final filter = ref.watch(launchControlFilterProvider);
  final params = <String, dynamic>{};
  if (filter != 'All') params['program'] = filter;
  final json = await client.getJson('/missions', queryParameters: params);
  final raw = (json['items'] as List<dynamic>? ?? const []);
  return PagedResult<MissionModel>(
    items: raw.whereType<Map<String, dynamic>>().map(MissionModel.fromJson).toList(),
    total: (json['total'] as num?)?.toInt() ?? raw.length,
    lastSyncedAt: json['last_synced_at'] != null
        ? DateTime.tryParse(json['last_synced_at'].toString())?.toUtc()
        : null,
    cacheHit: (json['cache_hit'] as bool?) ?? false,
  );
});

final vehiclesProvider =
    FutureProvider<PagedResult<LaunchVehicleModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final json = await client.getJson('/vehicles');
  final raw = (json['items'] as List<dynamic>? ?? const []);
  return PagedResult<LaunchVehicleModel>(
    items: raw
        .whereType<Map<String, dynamic>>()
        .map(LaunchVehicleModel.fromJson)
        .toList(),
    total: (json['total'] as num?)?.toInt() ?? raw.length,
    lastSyncedAt: json['last_synced_at'] != null
        ? DateTime.tryParse(json['last_synced_at'].toString())?.toUtc()
        : null,
    cacheHit: (json['cache_hit'] as bool?) ?? false,
  );
});

final startupsProvider =
    FutureProvider<PagedResult<OrganizationModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final focus = ref.watch(startupFocusFilterProvider);
  final params = <String, dynamic>{};
  if (focus != 'All') params['focus'] = focus;

  final json = await client.getJson('/startups', queryParameters: params);
  final raw = (json['items'] as List<dynamic>? ?? const []);
  return PagedResult<OrganizationModel>(
    items: raw
        .whereType<Map<String, dynamic>>()
        .map(OrganizationModel.fromJson)
        .toList(),
    total: (json['total'] as num?)?.toInt() ?? raw.length,
    lastSyncedAt: json['last_synced_at'] != null
        ? DateTime.tryParse(json['last_synced_at'].toString())?.toUtc()
        : null,
    cacheHit: (json['cache_hit'] as bool?) ?? false,
  );
});

final centresProvider =
    FutureProvider<PagedResult<IsroCentreModel>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final state = ref.watch(centreStateFilterProvider);
  final q = ref.watch(centreSearchQueryProvider);
  final params = <String, dynamic>{};
  if (state != 'All') params['state'] = state;
  if (q.trim().isNotEmpty) params['q'] = q.trim();

  final json = await client.getJson('/centres', queryParameters: params);
  final raw = (json['items'] as List<dynamic>? ?? const []);
  return PagedResult<IsroCentreModel>(
    items: raw
        .whereType<Map<String, dynamic>>()
        .map(IsroCentreModel.fromJson)
        .toList(),
    total: (json['total'] as num?)?.toInt() ?? raw.length,
    lastSyncedAt: json['last_synced_at'] != null
        ? DateTime.tryParse(json['last_synced_at'].toString())?.toUtc()
        : null,
    cacheHit: (json['cache_hit'] as bool?) ?? false,
  );
});

/// Server-drift-free ticking countdown stream synchronized against serverTimeUtc.
final countdownTickProvider =
    StreamProvider.family<Duration, ({DateTime launchDate, DateTime serverTime})>(
  (ref, args) {
    final clockOffset = args.serverTime.difference(DateTime.now().toUtc());
    Duration remaining() {
      final adjustedNow = DateTime.now().toUtc().add(clockOffset);
      final diff = args.launchDate.difference(adjustedNow);
      return diff.isNegative ? Duration.zero : diff;
    }

    return Stream<Duration>.periodic(
      const Duration(seconds: 1),
      (_) => remaining(),
    ).asBroadcastStream();
  },
);
