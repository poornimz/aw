import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/config.dart';
import '../models/mission.dart';
import '../providers/space_providers.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/error_banner.dart';
import '../widgets/shimmer_cards.dart';
import '../widgets/sync_freshness_badge.dart';

class MissionsPayloadsScreen extends ConsumerWidget {
  const MissionsPayloadsScreen({super.key});

  static const _programs = [
    'All',
    'Gaganyaan',
    'Chandrayaan',
    'Earth Observation',
    'Navigation',
    'Commercial',
  ];

  static const _statuses = ['ALL', 'UPCOMING', 'SUCCESS', 'FAILURE'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final program = ref.watch(missionProgramFilterProvider);
    final status = ref.watch(missionStatusFilterProvider);
    final missionsAsync = ref.watch(missionsProvider);

    void resetFilters() {
      ref.read(missionSearchQueryProvider.notifier).state = '';
      ref.read(missionProgramFilterProvider.notifier).state = 'All';
      ref.read(missionStatusFilterProvider.notifier).state = 'ALL';
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 8,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Missions & Payloads',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Searchable orbital timeline with payload manifests and orbit parameters',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
              ],
            ),
            missionsAsync.maybeWhen(
              data: (res) => SyncFreshnessBadge(
                lastSyncedAt: res.lastSyncedAt,
                cacheHit: res.cacheHit,
              ),
              orElse: () => const SyncFreshnessBadge(),
            ),
          ],
        ),
        const SizedBox(height: 16),
        TextField(
          style: const TextStyle(color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'Search mission code, satellite, orbit, or remarks...',
            hintStyle: const TextStyle(color: AppColors.textMuted),
            prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
            filled: true,
            fillColor: AppColors.panelSurface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.hairlineBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.hairlineBorder),
            ),
          ),
          onChanged: (val) =>
              ref.read(missionSearchQueryProvider.notifier).state = val,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 8,
          children: [
            DropdownButton<String>(
              value: program,
              dropdownColor: AppColors.panelSurface,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              items: _programs
                  .map((p) => DropdownMenuItem(value: p, child: Text('Program: $p')))
                  .toList(),
              onChanged: (val) {
                if (val != null) {
                  ref.read(missionProgramFilterProvider.notifier).state = val;
                }
              },
            ),
            DropdownButton<String>(
              value: status,
              dropdownColor: AppColors.panelSurface,
              style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
              items: _statuses
                  .map((s) => DropdownMenuItem(value: s, child: Text('Status: $s')))
                  .toList(),
              onChanged: (val) {
                if (val != null) {
                  ref.read(missionStatusFilterProvider.notifier).state = val;
                }
              },
            ),
          ],
        ),
        const SizedBox(height: 18),
        missionsAsync.when(
          loading: () => const ShimmerCardList(count: 5, height: 120),
          error: (err, _) => ErrorRetryBanner(
            error: err,
            onRetry: () => ref.invalidate(missionsProvider),
          ),
          data: (res) {
            if (res.items.isEmpty) {
              return EmptyStateView(
                title: 'No missions found',
                subtitle: 'No orbital missions matched your active search or program filters.',
                onResetFilters: resetFilters,
              );
            }
            return Column(
              children: res.items
                  .map((m) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ExpandableMissionCard(mission: m),
                      ))
                  .toList(),
            );
          },
        ),
      ],
    );
  }
}

class _ExpandableMissionCard extends StatelessWidget {
  final MissionModel mission;

  const _ExpandableMissionCard({required this.mission});

  @override
  Widget build(BuildContext context) {
    final totalMass =
        mission.payloads.fold<double>(0.0, (acc, p) => acc + p.massKg);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.panelSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairlineBorder),
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        iconColor: AppColors.cyanAccent,
        collapsedIconColor: AppColors.textMuted,
        title: Text(
          mission.title,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            '${mission.missionCode}  ·  ${mission.program}  ·  ${DateFormat('dd MMM yyyy').format(mission.launchDate.toUtc())}  ·  ${mission.status}',
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
        ),
        children: [
          const Divider(color: AppColors.hairlineBorder),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Vehicle: ${mission.vehicleName ?? 'TBD'}  ·  Site: ${mission.launchSite}  ·  Orbit: ${mission.orbitType}',
              style: const TextStyle(color: AppColors.cyanAccent, fontSize: 12),
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              mission.remarks,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.5),
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Payload Manifest (${mission.payloads.length} items · ${totalMass.toStringAsFixed(1)} kg total)',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (mission.payloads.isEmpty)
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'No discrete payload manifest published yet.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            )
          else
            ...mission.payloads.map(
              (p) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.obsidianCanvas,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.hairlineBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            p.name,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        Text(
                          '${p.massKg.toStringAsFixed(1)} kg  ·  ${p.countryOfOrigin}',
                          style: const TextStyle(
                            color: AppColors.amberAccent,
                            fontSize: 12,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      p.purpose,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
