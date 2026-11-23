import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/config.dart';
import '../providers/space_providers.dart';

class ResponsiveShell extends ConsumerWidget {
  final List<Widget> screens;

  const ResponsiveShell({super.key, required this.screens});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIndex = ref.watch(selectedNavIndexProvider);
    final width = MediaQuery.sizeOf(context).width;
    final isDesktop = width >= 840;

    const destinations = [
      (label: 'Launch Control', icon: Icons.rocket_launch_outlined, activeIcon: Icons.rocket_launch),
      (label: 'Missions & Payloads', icon: Icons.public_outlined, activeIcon: Icons.public),
      (label: 'Rockets & Startups', icon: Icons.bar_chart_outlined, activeIcon: Icons.bar_chart),
      (label: 'ISRO Centres', icon: Icons.location_on_outlined, activeIcon: Icons.location_on),
    ];

    if (isDesktop) {
      return Scaffold(
        backgroundColor: AppColors.obsidianCanvas,
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: selectedIndex,
              backgroundColor: AppColors.panelSurface,
              indicatorColor: AppColors.cyanAccent.withValues(alpha: 0.16),
              extended: width >= 1180,
              labelType: width >= 1180
                  ? NavigationRailLabelType.none
                  : NavigationRailLabelType.all,
              selectedIconTheme: const IconThemeData(color: AppColors.cyanAccent),
              unselectedIconTheme: const IconThemeData(color: AppColors.textMuted),
              selectedLabelTextStyle: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
              unselectedLabelTextStyle: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 12,
              ),
              leading: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.satellite_alt, color: AppColors.cyanAccent, size: 22),
                    if (width >= 1180) ...[
                      const SizedBox(width: 10),
                      const Text(
                        'Antariksh Watch',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              destinations: destinations
                  .map(
                    (d) => NavigationRailDestination(
                      icon: Icon(d.icon),
                      selectedIcon: Icon(d.activeIcon),
                      label: Text(d.label),
                    ),
                  )
                  .toList(),
              onDestinationSelected: (idx) =>
                  ref.read(selectedNavIndexProvider.notifier).state = idx,
            ),
            const VerticalDivider(width: 1, thickness: 1, color: AppColors.hairlineBorder),
            Expanded(child: IndexedStack(index: selectedIndex, children: screens)),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.obsidianCanvas,
      appBar: AppBar(
        backgroundColor: AppColors.panelSurface,
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.satellite_alt, color: AppColors.cyanAccent, size: 20),
            SizedBox(width: 10),
            Text(
              'Antariksh Watch',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
                fontSize: 17,
              ),
            ),
          ],
        ),
      ),
      body: IndexedStack(index: selectedIndex, children: screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        backgroundColor: AppColors.panelSurface,
        indicatorColor: AppColors.cyanAccent.withValues(alpha: 0.16),
        destinations: destinations
            .map(
              (d) => NavigationDestination(
                icon: Icon(d.icon, color: AppColors.textMuted),
                selectedIcon: Icon(d.activeIcon, color: AppColors.cyanAccent),
                label: d.label.split(' ').first,
              ),
            )
            .toList(),
        onDestinationSelected: (idx) =>
            ref.read(selectedNavIndexProvider.notifier).state = idx,
      ),
    );
  }
}
