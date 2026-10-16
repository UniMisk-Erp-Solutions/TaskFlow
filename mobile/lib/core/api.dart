import 'package:dio/dio.dart';
import 'env.dart';

/// Thin REST client for the TaskFlow Edge API. The bearer token is set by [AuthState].
class Api {
  Api._();
  static final Api instance = Api._();

  String? _token;
  late final Dio dio = _build();

  void setToken(String? token) => _token = token;
  String? get token => _token;

  Dio _build() {
    final d = Dio(BaseOptions(
      baseUrl: Env.apiUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 60),
      sendTimeout: const Duration(seconds: 60),
      validateStatus: (code) => code != null && code >= 200 && code < 300,
    ));
    d.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      if (_token != null && !options.headers.containsKey('Authorization')) {
        options.headers['Authorization'] = 'Bearer $_token';
      }
      handler.next(options);
    }));
    return d;
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      (await dio.get(path, queryParameters: query)).data;
  Future<dynamic> post(String path, [Object? body]) async => (await dio.post(path, data: body)).data;
  Future<dynamic> patch(String path, [Object? body]) async => (await dio.patch(path, data: body)).data;
  Future<dynamic> delete(String path) async => (await dio.delete(path)).data;
}

/// Turns anything thrown into a message that is safe to show to a person.
String errorText(Object error, [String fallback = 'Something went wrong. Please try again.']) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && (data['error'] ?? data['message']) != null) {
      return '${data['error'] ?? data['message']}';
    }
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'The request took too long. Check your connection.';
      case DioExceptionType.connectionError:
        return 'No connection to the server.';
      default:
        return error.message ?? fallback;
    }
  }
  final text = error.toString();
  return text.isEmpty ? fallback : text.replaceFirst('Exception: ', '');
}
