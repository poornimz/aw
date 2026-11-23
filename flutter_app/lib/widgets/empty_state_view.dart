import 'package:flutter/material.dart';
import '../core/config.dart';

class EmptyStateView extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onResetFilters;

  const EmptyStateView({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onResetFilters,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: AppColors.panelSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.hairlineBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.elevatedSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.hairlineBorder),
              ),
              child: const Icon(
                Icons.satellite_alt_outlined,
                color: AppColors.cyanAccent,
                size: 28,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onResetFilters,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.cyanAccent,
                foregroundColor: AppColors.obsidianCanvas,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
              icon: const Icon(Icons.filter_alt_off_outlined, size: 18),
              label: const Text(
                'Reset Filters',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
