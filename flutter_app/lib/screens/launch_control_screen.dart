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

class LaunchControlScreen extends ConsumerWidget {
  const LaunchControlScreen({super.key});

  static const _filters = ['All', 'Gaganyaan', 'Chandrayaan', 'Private Launches'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeFilter = ref.watch(launchControlFilterProvider);
    final nextAsync = ref.watch(nextMissionProvider);
    final missionsAsync = ref.watch(launchControlMissionsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(nextMissionProvider);
        ref.invalidate(launchControlMissionsProvider);
      },
      child: ListView(
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
                    'Launch Control',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Server-synchronized orbital countdown & Indian launch manifest',
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
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _filters.map((f) {
                final selected = activeFilter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f),
                    selected: selected,
                    selectedColor: AppColors.cyanAccent.withValues(alpha: 0.2),
                    backgroundColor: AppColors.panelSurface,
                    side: BorderSide(
                      color: selected
                          ? AppColors.cyanAccent
                          : AppColors.hairlineBorder,
                    ),
                    labelStyle: TextStyle(
                      color: selected
                          ? AppColors.cyanAccent
                          : AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                    onSelected: (_) {
                      ref.read(launchControlFilterProvider.notifier).state = f;
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),
          nextAsync.when(
            loading: () => const ShimmerCardList(count: 1, height: 200),
            error: (err, _) => ErrorRetryBanner(
              error: err,
              onRetry: () => ref.invalidate(nextMissionProvider),
            ),
            data: (nextRes) => _CountdownHeroCard(response: nextRes),
          ),
          const SizedBox(height: 24),
          const Text(
            'Mission Schedule',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          missionsAsync.when(
            loading: () => const ShimmerCardList(count: 4, height: 112),
            error: (err, _) => ErrorRetryBanner(
              error: err,
              onRetry: () => ref.invalidate(launchControlMissionsProvider),
            ),
            data: (res) {
              if (res.items.isEmpty) {
                return EmptyStateView(
                  title: 'No missions match "$activeFilter"',
                  subtitle: 'Reset quick filters to inspect all ISRO and NewSpace flights.',
                  onResetFilters: () =>
                      ref.read(launchControlFilterProvider.notifier).state = 'All',
                );
              }
              return Column(
                children: res.items
                    .map((m) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _MissionSummaryCard(mission: m),
                        ))
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _CountdownHeroCard extends ConsumerWidget {
  final NextMissionResponse response;

  const _CountdownHeroCard({required this.response});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final m = response.mission;
    final tickAsync = ref.watch(
      countdownTickProvider((
        launchDate: m.launchDate,
        serverTime: response.serverTimeUtc,
      )),
    );

    final remaining = tickAsync.valueOrNull ??
        m.launchDate.difference(response.serverTimeUtc);
    final safeRemaining = remaining.isNegative ? Duration.zero : remaining;
    final days = safeRemaining.inDays.toString().padLeft(2, '0');
    final hours = (safeRemaining.inHours % 24).toString().padLeft(2, '0');
    final minutes = (safeRemaining.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (safeRemaining.inSeconds % 60).toString().padLeft(2, '0');

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.panelSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cyanAccent.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${m.missionCode}  ·  ${m.program}  ·  ${m.status}',
            style: const TextStyle(
              color: AppColors.cyanAccent,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            m.title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${m.vehicleName ?? 'TBD Vehicle'}  ·  ${m.launchSite}  ·  ${m.orbitType}',
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.obsidianCanvas,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.hairlineBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'T-MINUS COUNTDOWN (SERVER SYNCED UTC)',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                    letterSpacing: 1.0,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'T- $days : $hours : $minutes : $seconds',
                  style: const TextStyle(
                    color: AppColors.amberAccent,
                    fontSize: 30,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Scheduled Liftoff: ${DateFormat('dd MMM yyyy · HH:mm').format(m.launchDate.toUtc())} UTC',
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
            m.remarks,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 13, height: 1.5),
          ),
        ],
      ),
    );
  }
}

class _MissionSummaryCard extends StatelessWidget {
  final MissionModel mission;

  const _MissionSummaryCard({required this.mission});

  @override
  Widget build(BuildContext context) {
    final isUpcoming = mission.status == 'UPCOMING';
    final statusColor = isUpcoming
        ? AppColors.amberAccent
        : (mission.status == 'SUCCESS'
            ? AppColors.emeraldStatus
            : AppColors.roseError);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.panelSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  mission.title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                mission.status,
                style: TextStyle(
                  color: statusColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${mission.missionCode}  ·  ${mission.vehicleName ?? 'Launch Vehicle'}  ·  ${DateFormat('dd MMM yyyy').format(mission.launchDate.toUtc())}',
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${mission.orbitType}  ·  ${mission.payloads.length} payload(s)',
            style: const TextStyle(color: AppColors.cyanAccent, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
