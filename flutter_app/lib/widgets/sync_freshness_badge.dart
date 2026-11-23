import 'package:flutter/material.dart';
import '../core/config.dart';

class SyncFreshnessBadge extends StatelessWidget {
  final DateTime? lastSyncedAt;
  final bool cacheHit;

  const SyncFreshnessBadge({
    super.key,
    this.lastSyncedAt,
    this.cacheHit = false,
  });

  String _formatAgo(DateTime? dt) {
    if (dt == null) return 'Synced recently';
    final diff = DateTime.now().toUtc().difference(dt.toUtc());
    if (diff.inMinutes < 1) return 'Last synced just now';
    if (diff.inMinutes < 60) return 'Last synced ${diff.inMinutes} mins ago';
    if (diff.inHours < 24) return 'Last synced ${diff.inHours} hrs ago';
    return 'Last synced ${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          cacheHit ? Icons.cached : Icons.sync,
          size: 14,
          color: AppColors.cyanAccent,
        ),
        const SizedBox(width: 6),
        Text(
          _formatAgo(lastSyncedAt),
          style: const TextStyle(
            color: AppColors.textMuted,
            fontSize: 12,
            fontFeatures: [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}
