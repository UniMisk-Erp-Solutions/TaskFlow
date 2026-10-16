/// Build-time configuration, supplied with `--dart-define-from-file=env.json`.
class Env {
  static const apiUrl = String.fromEnvironment('API_URL');
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static const pageSize = 40;
  static const filesBucket = 'taskflow-files';
  static const chatBucket = 'chat-files';

  static bool get isConfigured =>
      apiUrl.isNotEmpty && supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
