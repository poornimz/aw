import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../models/vehicle.dart';
import '../providers/space_providers.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/error_banner.dart';
import '../widgets/shimmer_cards.dart';
import '../widgets/sync_freshness_badge.dart';

class RocketsStartupsScreen extends ConsumerWidget {
  const RocketsStartupsScreen({super.key});

  static const _focusTags = [
    'All',
    'Launch',
    'Satellites & EO',
    'Propulsion',
    'SSA/Debris',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehiclesAsync = ref.watch(vehiclesProvider);
    final startupsAsync = ref.watch(startupsProvider);
    final activeFocus = ref.watch(startupFocusFilterProvider);

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
                  'Rockets & Startups',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'LEO & GTO payload lift comparisons and IN-SPACe NewSpace directory',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
              ],
            ),
            vehiclesAsync.maybeWhen(
              data: (res) => SyncFreshnessBadge(
                lastSyncedAt: res.lastSyncedAt,
                cacheHit: res.cacheHit,
              ),
              orElse: () => const SyncFreshnessBadge(),
            ),
          ],
        ),
        const SizedBox(height: 20),
        vehiclesAsync.when(
          loading: () => const ShimmerCardList(count: 1, height: 260),
          error: (err, _) => ErrorRetryBanner(
            error: err,
            onRetry: () => ref.invalidate(vehiclesProvider),
          ),
          data: (res) {
            if (res.items.isEmpty) {
              return EmptyStateView(
                title: 'No launch vehicles loaded',
                subtitle: 'Retry loading vehicle telemetry from the backend.',
                onResetFilters: () => ref.invalidate(vehiclesProvider),
              );
            }
            return _PayloadComparisonChart(vehicles: res.items);
          },
        ),
        const SizedBox(height: 24),
        const Text(
          'Indian NewSpace Startups',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _focusTags.map((tag) {
              final selected = activeFocus == tag;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(tag),
                  selected: selected,
                  selectedColor: AppColors.cyanAccent.withValues(alpha: 0.2),
                  backgroundColor: AppColors.panelSurface,
                  side: BorderSide(
                    color: selected
                        ? AppColors.cyanAccent
                        : AppColors.hairlineBorder,
                  ),
                  labelStyle: TextStyle(
                    color: selected ? AppColors.cyanAccent : AppColors.textMuted,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                  onSelected: (_) =>
                      ref.read(startupFocusFilterProvider.notifier).state = tag,
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 14),
        startupsAsync.when(
          loading: () => const ShimmerCardList(count: 4, height: 116),
          error: (err, _) => ErrorRetryBanner(
            error: err,
            onRetry: () => ref.invalidate(startupsProvider),
          ),
          data: (res) {
            if (res.items.isEmpty) {
              return EmptyStateView(
                title: 'No startups match "$activeFocus"',
                subtitle: 'Reset focus tags to browse all registered Indian NewSpace companies.',
                onResetFilters: () =>
                    ref.read(startupFocusFilterProvider.notifier).state = 'All',
              );
            }
            return Column(
              children: res.items
                  .map(
                    (s) => Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 12),
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
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  s.name,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              if (s.inSpaceAuthorized)
                                const Text(
                                  'IN-SPACe Authorized',
                                  style: TextStyle(
                                    color: AppColors.emeraldStatus,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${s.focusArea}  ·  ${s.hqCity}  ·  Founded ${s.foundedYear}',
                            style: const TextStyle(
                              color: AppColors.cyanAccent,
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            s.description,
                            style: const TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 13,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
      ],
    );
  }
}

class _PayloadComparisonChart extends StatelessWidget {
  final List<LaunchVehicleModel> vehicles;

  const _PayloadComparisonChart({required this.vehicles});

  @override
  Widget build(BuildContext context) {
    final top = vehicles.take(6).toList();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.panelSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairlineBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Payload Capacity Comparison — LEO vs GTO (kg)',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Cyan: Low Earth Orbit (LEO kg)   ·   Amber: Geosynchronous Transfer Orbit (GTO kg)',
            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 220,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => const FlLine(
                    color: AppColors.hairlineBorder,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 44,
                      getTitlesWidget: (val, _) => Text(
                        '${(val / 1000).toStringAsFixed(0)}t',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      getTitlesWidget: (val, _) {
                        final idx = val.toInt();
                        if (idx < 0 || idx >= top.length) return const SizedBox.shrink();
                        final shortName = top[idx].name.split(' ').first;
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            shortName,
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                barGroups: List.generate(top.length, (i) {
                  final v = top[i];
                  return BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: v.leoPayloadKg.toDouble(),
                        color: AppColors.cyanAccent,
                        width: 10,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                      ),
                      BarChartRodData(
                        toY: v.gtoPayloadKg.toDouble(),
                        color: AppColors.amberAccent,
                        width: 10,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(3)),
                      ),
                    ],
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
