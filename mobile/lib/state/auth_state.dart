import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import '../core/api.dart';
import '../core/models.dart';

class AuthController extends ChangeNotifier {
  AuthController() {
    _init();
  }

  /// Test constructor: a signed-in controller with a fixed profile and no backend.
  AuthController.test(Profile this.profile) : loading = false;

  SupabaseClient get _sb => Supabase.instance.client;
  StreamSubscription<dynamic>? _sub;

  Session? session;
  Profile? profile;
  bool loading = true;
  bool profileError = false;

  bool get isSignedIn => session != null || profile != null;
  bool get isAdmin => profile?.isAdmin ?? false;

  Future<void> _init() async {
    session = _sb.auth.currentSession;
    if (session != null) {
      Api.instance.setToken(session!.accessToken);
      await _loadProfile();
    }
    loading = false;
    notifyListeners();

    _sub = _sb.auth.onAuthStateChange.listen((event) async {
      final next = event.session;
      if (event.event == AuthChangeEvent.initialSession) return;
      session = next;
      if (next == null) {
        Api.instance.setToken(null);
        profile = null;
        notifyListeners();
        return;
      }
      Api.instance.setToken(next.accessToken);
      if (event.event == AuthChangeEvent.tokenRefreshed) return;
      if (profile == null || profile!.id != next.user.id) {
        await _loadProfile();
        notifyListeners();
      }
    });
  }

  Future<bool> _loadProfile() async {
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final data = await Api.instance.get('/auth/me');
        profile = Profile.fromJson(Map<String, dynamic>.from(data as Map));
        profileError = false;
        return true;
      } catch (_) {
        if (attempt < 2) await Future<void>.delayed(const Duration(milliseconds: 300));
      }
    }
    profileError = true;
    return false;
  }

  Future<void> _startSession(dynamic payload) async {
    final map = Map<String, dynamic>.from(payload as Map);
    final s = map['session'];
    if (s is! Map || s['access_token'] == null) throw Exception('No session was returned. Please try again.');
    Api.instance.setToken('${s['access_token']}');
    await _sb.auth.setSession('${s['refresh_token']}');
    session = _sb.auth.currentSession;
    if (!await _loadProfile()) {
      await _sb.auth.signOut();
      session = null;
      throw Exception('Signed in, but your profile could not be loaded. Check your connection and try again.');
    }
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    final data = await Api.instance.post('/auth/login', {'email': email, 'password': password});
    await _startSession(data);
  }

  Future<void> signUp(String email, String password, String fullName) async {
    final data = await Api.instance.post(
        '/auth/signup', {'email': email, 'password': password, 'fullName': fullName, 'role': 'admin'});
    await _startSession(data);
  }

  Future<void> refreshProfile() async {
    if (session == null) return;
    await _loadProfile();
    notifyListeners();
  }

  Future<void> signOut() async {
    Api.instance.setToken(null);
    profile = null;
    session = null;
    notifyListeners();
    await _sb.auth.signOut();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
