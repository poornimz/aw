import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../core/config.dart';

class ShimmerCardList extends StatelessWidget {
  final int count;
  final double height;

  const ShimmerCardList({
    super.key,
    this.count = 4,
    this.height = 128,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.panelSurface,
      highlightColor: AppColors.elevatedSurface,
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: count,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, __) => Container(
          height: height,
          decoration: BoxDecoration(
            color: AppColors.panelSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.hairlineBorder),
          ),
        ),
      ),
    );
  }
}
