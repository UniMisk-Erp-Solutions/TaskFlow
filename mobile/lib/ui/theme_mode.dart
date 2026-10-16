import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeController extends ChangeNotifier {
  ThemeMode mode = ThemeMode.system;
  static const _key = 'taskflow.theme';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    switch (prefs.getString(_key)) {
      case 'light':
        mode = ThemeMode.light;
      case 'dark':
        mode = ThemeMode.dark;
      default:
        mode = ThemeMode.system;
    }
  }

  Future<void> set(ThemeMode next) async {
    mode = next;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, next == ThemeMode.light ? 'light' : next == ThemeMode.dark ? 'dark' : 'system');
  }
}
