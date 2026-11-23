import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/config.dart';
import 'screens/isro_centres_screen.dart';
import 'screens/launch_control_screen.dart';
import 'screens/missions_payloads_screen.dart';
import 'screens/rockets_startups_screen.dart';
import 'widgets/responsive_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: AntarikshWatchApp()));
}

class AntarikshWatchApp extends StatelessWidget {
  const AntarikshWatchApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Antariksh Watch',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.obsidianCanvas,
        colorScheme: const ColorScheme.dark(
          surface: AppColors.panelSurface,
          primary: AppColors.cyanAccent,
          secondary: AppColors.amberAccent,
          error: AppColors.roseError,
        ),
      ),
      home: const ResponsiveShell(
        screens: [
          LaunchControlScreen(),
          MissionsPayloadsScreen(),
          RocketsStartupsScreen(),
          IsroCentresScreen(),
        ],
      ),
    );
  }
}
