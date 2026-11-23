import 'dart:async';
import 'package:dio/dio.dart';
import 'config.dart';

class ApiException implements Exception {
  final int statusCode;
  final String title;
  final String detail;

  const ApiException({
    required this.statusCode,
    required this.title,
    required this.detail,
  });

  @override
  String toString() => '$title ($statusCode): $detail';
}

class RetryInterceptor extends Interceptor {
  final Dio dio;
  final int maxRetries;

  RetryInterceptor({required this.dio, this.maxRetries = 2});

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final attempt = (err.requestOptions.extra['retry_attempt'] as int?) ?? 0;
    final shouldRetry = attempt < maxRetries &&
        (err.type == DioExceptionType.connectionTimeout ||
            err.type == DioExceptionType.receiveTimeout ||
            err.type == DioExceptionType.connectionError ||
            (err.response?.statusCode ?? 0) >= 500);

    if (!shouldRetry) {
      return handler.next(err);
    }

    await Future<void>.delayed(Duration(milliseconds: 400 * (attempt + 1)));
    final options = err.requestOptions;
    options.extra['retry_attempt'] = attempt + 1;

    try {
      final response = await dio.fetch<dynamic>(options);
      return handler.resolve(response);
    } on DioException catch (retryErr) {
      return handler.next(retryErr);
    }
  }
}

class SpaceApiClient {
  late final Dio _dio;

  SpaceApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 10),
        headers: {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(RetryInterceptor(dio: _dio));
  }

  Future<Map<String, dynamic>> getJson(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final resp = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: queryParameters,
      );
      return resp.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw _mapException(e);
    }
  }

  Future<Map<String, dynamic>> postJson(String path) async {
    try {
      final resp = await _dio.post<Map<String, dynamic>>(path);
      return resp.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw _mapException(e);
    }
  }

  ApiException _mapException(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic> && data.containsKey('detail')) {
      return ApiException(
        statusCode: (data['status'] as num?)?.toInt() ??
            e.response?.statusCode ??
            500,
        title: (data['title'] as String?) ?? 'API Error',
        detail: data['detail'].toString(),
      );
    }
    return ApiException(
      statusCode: e.response?.statusCode ?? 0,
      title: 'Network Error',
      detail: e.message ?? 'Unable to reach Antariksh Watch backend.',
    );
  }
}
