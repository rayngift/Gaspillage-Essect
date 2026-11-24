import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../models/campus_models.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final ApiService _api = ApiService();

  UserProfile? _profile;
  bool _loading = false;
  String? _error;

  User? get firebaseUser => _auth.currentUser;
  UserProfile? get profile => _profile;
  bool get isAuthenticated => _profile != null;
  bool get isLoading => _loading;
  String? get error => _error;
  String get role {
    final email = (_profile?.email ?? _auth.currentUser?.email ?? '')
        .trim()
        .toLowerCase();
    if (email == 'admin@gmail.com') return 'admin';
    return _profile?.role ?? 'student';
  }

  int get ecopoints => _profile?.ecopoints ?? 0;

  AuthService() {
    _auth.authStateChanges().listen((user) async {
      if (user != null) {
        await _syncFromBackend();
        await _initFcm();
      } else {
        _profile = null;
        notifyListeners();
      }
    });
  }

  Future<void> _syncFromBackend() async {
    try {
      _profile = await _api.fetchMe();
      _error = null;
    } catch (e) {
      debugPrint('Erreur /api/auth/me : $e');
      _error = '$e';
    }
    notifyListeners();
  }

  Future<void> _initFcm() async {
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        await _api.saveFcmToken(token);
      }
    } catch (_) {}
  }

  Future<bool> signInWithEmail(
      String email,
      String password, {
        String? expectedRole,
      }) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      _profile = await _api.fetchMe();

      final effectiveRole = role;
      if (effectiveRole != 'admin' &&
          expectedRole != null &&
          effectiveRole != expectedRole) {
        await _auth.signOut();
        _profile = null;
        _error = expectedRole == 'merchant'
            ? "Ce compte est un compte Étudiant. Sélectionnez « Étudiant » pour vous connecter."
            : "Ce compte est un compte Commerçant. Sélectionnez « Commerçant » pour vous connecter.";
        return false;
      }

      return true;
    } on FirebaseAuthException catch (e) {
      _error = e.message ?? 'Identifiants invalides';
      return false;
    } catch (e) {
      _error = '$e';
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<bool> registerWithEmail({
    required String displayName,
    required String email,
    required String password,
    String? phone,
    required String role,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      // Le backend crée le compte Firebase Auth + le document Firestore users/
      await _api.register(
        email: email,
        password: password,
        name: displayName,
        phone: phone,
        role: role,
      );
      await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      _profile = await _api.fetchMe();
      return true;
    } catch (e) {
      _error = '$e';
      return false;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshProfile() async {
    if (_auth.currentUser == null) return;
    await _syncFromBackend();
  }

  Future<void> updateDisplayName(String newName) async {
    if (_profile == null || newName.trim().length < 2) return;
    await _api.updateMe(name: newName.trim());
    await _syncFromBackend();
  }

  Future<void> signOut() async {
    await _auth.signOut();
    _profile = null;
    notifyListeners();
  }
}
