import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../providers/space_providers.dart';
import '../widgets/empty_state_view.dart';
import '../widgets/error_banner.dart';
import '../widgets/shimmer_cards.dart';
import '../widgets/sync_freshness_badge.dart';

class IsroCentresScreen extends ConsumerWidget {
  const IsroCentresScreen({super.key});

  static const _states = [
    'All',
    'Karnataka',
    'Kerala',
    'Andhra Pradesh',
    'Gujarat',
    'Tamil Nadu',
    'Telangana',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeState = ref.watch(centreStateFilterProvider);
    final centresAsync = ref.watch(centresProvider);

    void resetFilters() {
      ref.read(centreStateFilterProvider.notifier).state = 'All';
      ref.read(centreSearchQueryProvider.notifier).state = '';
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
                  'ISRO Centres',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Spaceports, propulsion complexes, satellite assembly & tracking stations across India',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
              ],
            ),
            centresAsync.maybeWhen(
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
            hintText: 'Filter by acronym (VSSC, SHAR, URSC), city, or specialization...',
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
              ref.read(centreSearchQueryProvider.notifier).state = val,
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _states.map((st) {
              final selected = activeState == st;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(st),
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
                      ref.read(centreStateFilterProvider.notifier).state = st,
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 18),
        centresAsync.when(
          loading: () => const ShimmerCardList(count: 5, height: 112),
          error: (err, _) => ErrorRetryBanner(
            error: err,
            onRetry: () => ref.invalidate(centresProvider),
          ),
          data: (res) {
            if (res.items.isEmpty) {
              return EmptyStateView(
                title: 'No ISRO centres found',
                subtitle: 'Reset state or search filters to view all national space facilities.',
                onResetFilters: resetFilters,
              );
            }
            return Column(
              children: res.items
                  .map(
                    (c) => Container(
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
                                  '${c.acronym} — ${c.name}',
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                '${c.latitude.toStringAsFixed(2)}°N, ${c.longitude.toStringAsFixed(2)}°E',
                                style: const TextStyle(
                                  color: AppColors.amberAccent,
                                  fontSize: 12,
                                  fontFeatures: [FontFeature.tabularFigures()],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${c.city}, ${c.state}',
                            style: const TextStyle(
                              color: AppColors.cyanAccent,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            c.primaryRole,
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
