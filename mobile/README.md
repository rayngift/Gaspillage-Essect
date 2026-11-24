# CampusSave — Application Mobile Flutter (ESSECT 3ème année E-Business)

Application mobile complète connectée au backend commun **Node.js / Express** et à **Firebase (Authentication, Firestore, Cloud Messaging)**.

## Prérequis
- Flutter SDK >= 3.22
- Compte Firebase configuré via `flutterfire configure` (projet `climbing-machine-0v0ns`)
- Backend Node.js / Express démarré (`npm run dev` sur le port `3000`)

## Installation et exécution
```bash
cd flutter_campussave
flutter pub get
flutterfire configure --project=climbing-machine-0v0ns
flutter run
```

## URL du Backend selon l'environnement
- **Émulateur Android** : `http://10.0.2.2:3000`
- **Simulateur iOS / Desktop / Web** : `http://localhost:3000`
- **Serveur déployé** : passer `--dart-define=API_BASE_URL=https://votre-url`

## Architecture complète (`lib/`)
- `lib/main.dart` : Initialisation Firebase, thème CampusSave, `AuthGate` par rôle et `StudentShellScreen`
- `lib/firebase_options.dart` : Configuration Firebase pour le projet `climbing-machine-0v0ns`
- `lib/models/campus_models.dart` : Modèles `UserProfile`, `Shop`, `FoodOffer`, `CampusOrder`, `ImpactMetrics`
- `lib/services/api_service.dart` : Client REST HTTP complet vers Express (`/api/offers`, `/api/shops`, `/api/orders`, `/api/payments/konnect/*`, `/api/orders/verify-qr`, `/api/analytics/impact`, `/api/users`)
- `lib/services/auth_service.dart` : Authentification Firebase (Email/Mot de passe), synchronisation Firestore (`ai-studio-6bc1d9ab-50a3-4787-b401-af874df62042`) & Express, permissions FCM et sélecteur de rôle démo
- `lib/screens/auth/` :
  - `login_screen.dart` : Connexion et bascule rapide Étudiant / Commerçant / Admin
  - `register_screen.dart` : Inscription avec sélection du rôle (`etudiant` / `commercant`)
- `lib/screens/student/` :
  - `student_offers_screen.dart` : Catalogue, recherche multi-critères, filtre prix max et catégories / Surprise Basket
  - `offer_detail_screen.dart` : Fiche offre, sélection quantité et réservation
  - `konnect_checkout_screen.dart` : Paiement électronique Konnect (mode test/sandbox)
  - `student_orders_screen.dart` : Historique des commandes
  - `qr_ticket_screen.dart` : Ticket QR Code généré (`qr_flutter`) + code retrait `CS-XXXX`
  - `student_dashboard_screen.dart` : Tableau de bord personnel, EcoPoints et profil
- `lib/screens/shared/` :
  - `campus_radar_screen.dart` : Radar géographique autour de l’ESSECT Montfleury (`CustomPainter`) avec curseur de rayon
- `lib/screens/merchant/` :
  - `merchant_dashboard_screen.dart` : KPIs commerçant, inscription d’établissement, CRUD offres alimentaires et scanner QR caméra (`mobile_scanner`) + saisie manuelle
- `lib/screens/admin/` :
  - `admin_dashboard_screen.dart` : Impact Dashboard global, file de validation des commerces et gestion RBAC des utilisateurs
