import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Configuration Firebase pour CampusSave (projet: climbing-machine-0v0ns).
/// Exécutez `flutterfire configure --project=climbing-machine-0v0ns` pour
/// générer vos identifiants natifs Android/iOS complets.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return web;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDCVxoH-_sIUAhKvm9vaFOOEP-nGAXnD_Y',
    appId: '1:837359093912:web:1bb85cee4337ef7a62a8ed',
    messagingSenderId: '837359093912',
    projectId: 'campussave-31fcd',
    authDomain: 'campussave-31fcd.firebaseapp.com',
    storageBucket: 'campussave-31fcd.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAhnUVNMkjnQxrG3tkN4QzKg6kp5btCLsI',
    appId: '1:837359093912:android:bfcf42246a62e55362a8ed',
    messagingSenderId: '837359093912',
    projectId: 'campussave-31fcd',
    storageBucket: 'campussave-31fcd.firebasestorage.app',
  );
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDh1um_Hf8pPOIRvb2yBXsvBvk9_1k5C18',
    appId: '1:837359093912:ios:40344bc8656980d662a8ed',
    messagingSenderId: '837359093912',
    projectId: 'campussave-31fcd',
    storageBucket: 'campussave-31fcd.firebasestorage.app',
    iosBundleId: 'com.example.campussaveMobile',
  );
}
