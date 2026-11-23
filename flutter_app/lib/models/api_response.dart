class PagedResult<T> {
  final List<T> items;
  final int total;
  final DateTime? lastSyncedAt;
  final bool cacheHit;

  const PagedResult({
    required this.items,
    required this.total,
    this.lastSyncedAt,
    this.cacheHit = false,
  });
}
