import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/campus_models.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

class ApiService {
  static String get baseUrl {
    const prodUrl = String.fromEnvironment('API_BASE_URL');
    if (prodUrl.isNotEmpty) return prodUrl;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5000/api';
    }
    return 'http://localhost:5000/api';
  }

  static const Duration _timeout = Duration(seconds: 8);

  Future<Map<String, String>> _headers({bool requireAuth = true}) async {
    final headers = <String, String>{'Content-Type': 'application/json'};
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      final token = await user.getIdToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    } else if (requireAuth) {
      throw ApiException(401, 'Connexion requise pour accéder à vos données Firebase.');
    }
    return headers;
  }

  dynamic _decodeResponse(http.Response res) {
    final body = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return body;
    }
    final errMsg = (body is Map && body['error'] != null)
        ? body['error'].toString()
        : 'Erreur serveur (${res.statusCode})';
    throw ApiException(res.statusCode, errMsg);
  }

  // ---------------- AUTHENTIFICATION ----------------

  Future<void> register({
    required String email,
    required String password,
    required String name,
    String? phone,
    required String role, // 'student' | 'merchant'
  }) async {
    final res = await http
        .post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email.trim(),
        'password': password,
        'name': name.trim(),
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
        'role': normalizeRole(role),
      }),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  Future<UserProfile> fetchMe() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/auth/me'), headers: headers)
        .timeout(_timeout);
    final data = _decodeResponse(res) as Map<String, dynamic>;
    return UserProfile.fromJson(data);
  }

  Future<void> updateMe({String? name, String? phone}) async {
    final headers = await _headers();
    final res = await http
        .put(
      Uri.parse('$baseUrl/auth/me'),
      headers: headers,
      body: jsonEncode({
        if (name != null) 'name': name.trim(),
        if (phone != null) 'phone': phone.trim(),
      }),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  Future<void> saveFcmToken(String token) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/auth/fcm-token'),
      headers: headers,
      body: jsonEncode({'token': token}),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  // ---------------- OFFRES ----------------

  Future<List<FoodOffer>> fetchOffers({
    String query = '',
    String category = 'Toutes',
    double? maxPrice,
    String? shopId,
  }) async {
    final params = <String, String>{};
    if (query.trim().isNotEmpty) params['search'] = query.trim();
    if (category != 'Toutes' && category.isNotEmpty) params['category'] = category;
    if (maxPrice != null) params['maxPrice'] = maxPrice.toString();
    if (shopId != null && shopId.isNotEmpty) params['shopId'] = shopId;

    final uri = Uri.parse('$baseUrl/offers').replace(
      queryParameters: params.isEmpty ? null : params,
    );
    final headers = await _headers(requireAuth: false);
    final res = await http.get(uri, headers: headers).timeout(_timeout);
    final data = _decodeResponse(res) as List<dynamic>;
    return data
        .map((e) => FoodOffer.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<FoodOffer>> fetchMyOffers() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/offers/mine'), headers: headers)
        .timeout(_timeout);
    final data = _decodeResponse(res) as List<dynamic>;
    return data
        .map((e) => FoodOffer.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<String> createOffer({
    required String title,
    required String description,
    required String category,
    required double originalPrice,
    required double discountedPrice,
    required int quantity,
    required DateTime pickupStart,
    required DateTime pickupEnd,
    String? photoUrl,
  }) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/offers'),
      headers: headers,
      body: jsonEncode({
        'title': title.trim(),
        'description': description.trim(),
        'category': category.trim(),
        'originalPrice': originalPrice,
        'discountedPrice': discountedPrice,
        'quantity': quantity,
        if (photoUrl != null && photoUrl.isNotEmpty) 'photoUrl': photoUrl,
        'pickupStart': pickupStart.toUtc().toIso8601String(),
        'pickupEnd': pickupEnd.toUtc().toIso8601String(),
      }),
    )
        .timeout(_timeout);
    final data = _decodeResponse(res) as Map<String, dynamic>;
    return data['id'].toString();
  }

  Future<void> updateOffer(
      String offerId, {
        required String title,
        required String description,
        required String category,
        required double originalPrice,
        required double discountedPrice,
        required int quantity,
        required DateTime pickupStart,
        required DateTime pickupEnd,
        bool? active,
      }) async {
    final headers = await _headers();
    final res = await http
        .put(
      Uri.parse('$baseUrl/offers/$offerId'),
      headers: headers,
      body: jsonEncode({
        'title': title.trim(),
        'description': description.trim(),
        'category': category.trim(),
        'originalPrice': originalPrice,
        'discountedPrice': discountedPrice,
        'quantity': quantity,
        'pickupStart': pickupStart.toUtc().toIso8601String(),
        'pickupEnd': pickupEnd.toUtc().toIso8601String(),
        if (active != null) 'active': active,
      }),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  Future<void> deleteOffer(String offerId) async {
    final headers = await _headers();
    final res = await http
        .delete(Uri.parse('$baseUrl/offers/$offerId'), headers: headers)
        .timeout(_timeout);
    _decodeResponse(res);
  }

  // ---------------- COMMERCES ----------------

  Future<List<Shop>> fetchShops({String? status}) async {
    final uri = status != null
        ? Uri.parse('$baseUrl/shops?status=$status')
        : Uri.parse('$baseUrl/shops');
    final headers = await _headers(requireAuth: false);
    final res = await http.get(uri, headers: headers).timeout(_timeout);
    final data = _decodeResponse(res) as List<dynamic>;
    return data.map((e) => Shop.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Shop?> fetchMyShop() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/shops/mine'), headers: headers)
        .timeout(_timeout);
    if (res.statusCode == 404) return null;
    final data = _decodeResponse(res) as Map<String, dynamic>;
    return Shop.fromJson(data);
  }

  Future<void> createShop({
    required String name,
    required String type, // 'restaurant' | 'cafeteria'
    required String address,
    String? phone,
    String? description,
  }) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/shops'),
      headers: headers,
      body: jsonEncode({
        'name': name.trim(),
        'type': type,
        'address': address.trim(),
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
      }),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  Future<void> updateShopStatus(String shopId, String status) async {
    final headers = await _headers();
    final res = await http
        .patch(
      Uri.parse('$baseUrl/shops/$shopId/status'),
      headers: headers,
      body: jsonEncode({'status': status}), // 'approved' | 'rejected'
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  // ---------------- COMMANDES & PAIEMENT ----------------

  Future<CampusOrder> createOrder({
    required String offerId,
    required int quantity,
  }) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/orders'),
      headers: headers,
      body: jsonEncode({
        'items': [
          {'offerId': offerId, 'quantity': quantity}
        ],
      }),
    )
        .timeout(_timeout);
    final data = _decodeResponse(res) as Map<String, dynamic>;
    return CampusOrder.fromJson(data);
  }

  Future<Map<String, dynamic>> initPayment(String orderId) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/payments/init'),
      headers: headers,
      body: jsonEncode({'orderId': orderId}),
    )
        .timeout(_timeout);
    return _decodeResponse(res) as Map<String, dynamic>;
  }

  Future<void> confirmMockPayment(String orderId) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/payments/mock-confirm'),
      headers: headers,
      body: jsonEncode({'orderId': orderId}),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }

  Future<List<CampusOrder>> fetchMyOrders() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/orders/mine'), headers: headers)
        .timeout(_timeout);
    final data = _decodeResponse(res) as List<dynamic>;
    return data
        .map((e) => CampusOrder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<CampusOrder>> fetchShopOrders({String? status}) async {
    final uri = status != null
        ? Uri.parse('$baseUrl/orders/shop?status=$status')
        : Uri.parse('$baseUrl/orders/shop');
    final headers = await _headers();
    final res = await http.get(uri, headers: headers).timeout(_timeout);
    final data = _decodeResponse(res) as List<dynamic>;
    return data
        .map((e) => CampusOrder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> fetchOrderQr(String orderId) async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/orders/$orderId/qr'), headers: headers)
        .timeout(_timeout);
    return _decodeResponse(res) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyQrPickup(String qrToken) async {
    final headers = await _headers();
    final res = await http
        .post(
      Uri.parse('$baseUrl/orders/verify-qr'),
      headers: headers,
      body: jsonEncode({'token': qrToken.trim()}),
    )
        .timeout(_timeout);
    return _decodeResponse(res) as Map<String, dynamic>;
  }

  // ---------------- STATISTIQUES & ADMIN ----------------

  Future<StudentStats> fetchStudentStats() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/stats/student'), headers: headers)
        .timeout(_timeout);
    return StudentStats.fromJson(_decodeResponse(res) as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> fetchMerchantStats() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/stats/merchant'), headers: headers)
        .timeout(_timeout);
    return _decodeResponse(res) as Map<String, dynamic>;
  }

  Future<AdminStats> fetchAdminStats() async {
    final headers = await _headers();
    final res = await http
        .get(Uri.parse('$baseUrl/stats/admin'), headers: headers)
        .timeout(_timeout);
    return AdminStats.fromJson(_decodeResponse(res) as Map<String, dynamic>);
  }

  Future<List<UserProfile>> fetchAdminUsers({String? role}) async {
    final uri = role != null
        ? Uri.parse('$baseUrl/admin/users?role=$role')
        : Uri.parse('$baseUrl/admin/users');
    final headers = await _headers();
    final res = await http.get(uri, headers: headers).timeout(_timeout);
    final data = _decodeResponse(res) as List<dynamic>;
    return data
        .map((e) => UserProfile.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> setUserDisabled(String uid, bool disabled) async {
    final headers = await _headers();
    final res = await http
        .patch(
      Uri.parse('$baseUrl/admin/users/$uid/disable'),
      headers: headers,
      body: jsonEncode({'disabled': disabled}),
    )
        .timeout(_timeout);
    _decodeResponse(res);
  }
}
