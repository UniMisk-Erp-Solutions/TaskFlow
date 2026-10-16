import 'package:flutter/material.dart';

const kPrimary = Color(0xFF5B4BDB);

class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.success,
    required this.successSoft,
    required this.warning,
    required this.warningSoft,
    required this.danger,
    required this.dangerSoft,
    required this.info,
    required this.infoSoft,
    required this.muted,
    required this.border,
    required this.surfaceAlt,
  });

  final Color success, successSoft, warning, warningSoft, danger, dangerSoft, info, infoSoft, muted, border, surfaceAlt;

  static const light = AppColors(
    success: Color(0xFF15803D), successSoft: Color(0xFFDCF4E4),
    warning: Color(0xFFC2570C), warningSoft: Color(0xFFFDE9D9),
    danger: Color(0xFFC62828), dangerSoft: Color(0xFFFDE3E3),
    info: Color(0xFF1D4ED8), infoSoft: Color(0xFFE1EAFE),
    muted: Color(0xFF6C6A75), border: Color(0xFFE3E0D8), surfaceAlt: Color(0xFFEFEDE8),
  );

  static const dark = AppColors(
    success: Color(0xFF4ADE80), successSoft: Color(0xFF143323),
    warning: Color(0xFFFB923C), warningSoft: Color(0xFF3A2412),
    danger: Color(0xFFF87171), dangerSoft: Color(0xFF3B1818),
    info: Color(0xFF7AA2FF), infoSoft: Color(0xFF17254A),
    muted: Color(0xFF9A98A6), border: Color(0xFF2B2D38), surfaceAlt: Color(0xFF20222B),
  );

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) => this;
}

extension ThemeX on BuildContext {
  ColorScheme get cs => Theme.of(this).colorScheme;
  AppColors get app => Theme.of(this).extension<AppColors>()!;
  TextTheme get tt => Theme.of(this).textTheme;
}

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: kPrimary,
    brightness: brightness,
    primary: dark ? const Color(0xFF8576FF) : kPrimary,
    surface: dark ? const Color(0xFF17181E) : Colors.white,
  );
  final bg = dark ? const Color(0xFF0E0F13) : const Color(0xFFF6F5F2);
  final ext = dark ? AppColors.dark : AppColors.light;

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    extensions: [ext],
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: scheme.onSurface),
    ),
    cardTheme: CardThemeData(
      color: scheme.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: ext.border)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: ext.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: ext.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: scheme.primary, width: 1.6)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 48),
        padding: const EdgeInsets.symmetric(horizontal: 22),
        shape: const StadiumBorder(),
        side: BorderSide(color: ext.border),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(shape: const StadiumBorder(), textStyle: const TextStyle(fontWeight: FontWeight.w600)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      indicatorColor: scheme.primary.withValues(alpha: 0.14),
      surfaceTintColor: Colors.transparent,
      height: 66,
      labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: scheme.onSurface)),
    ),
    chipTheme: ChipThemeData(
      shape: const StadiumBorder(),
      side: BorderSide(color: ext.border),
      labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
    ),
    dividerTheme: DividerThemeData(color: ext.border, space: 1, thickness: 1),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: scheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    ),
  );
}

/// Priority accent colours shared with the web app.
Color priorityColor(String? priority) {
  switch (priority) {
    case 'high':
      return const Color(0xFFDB2777);
    case 'low':
      return const Color(0xFF2563EB);
    default:
      return const Color(0xFF16A34A);
  }
}
