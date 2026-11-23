import 'package:flutter/material.dart';

class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  static Uri get countdownWebSocketUri {
    final base = Uri.parse(apiBaseUrl);
    final wsScheme = base.scheme == 'https' ? 'wss' : 'ws';
    final cleanPath = base.path.endsWith('/')
        ? '${base.path}ws/countdown'
        : '${base.path}/ws/countdown';
    return base.replace(scheme: wsScheme, path: cleanPath);
  }
}

class AppColors {
  AppColors._();

  static const Color obsidianCanvas = Color(0xFF07090E);
  static const Color panelSurface = Color(0xFF0F141F);
  static const Color elevatedSurface = Color(0xFF151C2B);
  static const Color hairlineBorder = Color(0xFF1E293B);
  static const Color cyanAccent = Color(0xFF06B6D4);
  static const Color amberAccent = Color(0xFFF59E0B);
  static const Color emeraldStatus = Color(0xFF10B981);
  static const Color roseError = Color(0xFFF43F5E);
  static const Color textPrimary = Color(0xFFF1F5F9);
  static const Color textMuted = Color(0xFF94A3B8);
}
