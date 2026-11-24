import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'firebase_options.dart';
import 'screens/admin/admin_dashboard_screen.dart';
import 'screens/merchant/merchant_dashboard_screen.dart';
import 'screens/shared/campus_radar_screen.dart';
import 'screens/student/student_dashboard_screen.dart';
import 'screens/student/student_offers_screen.dart';
import 'screens/student/student_orders_screen.dart';
import 'services/auth_service.dart';
import 'widgets/campus_top_bar.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthService(),
      child: const CampusSaveApp(),
    ),
  );
}

class CampusSaveApp extends StatelessWidget {
  const CampusSaveApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CampusSave',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF166534),
          surface: const Color(0xFFFAFAF8),
        ),
        scaffoldBackgroundColor: const Color(0xFFFAFAF8),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFFAFAF8),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
        ),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    if (!auth.isAuthenticated) {
      return const StudentShellScreen();
    }

    switch (auth.role) {
      case 'merchant':
        return const MerchantDashboardScreen();
      case 'admin':
        return const AdminDashboardScreen();
      case 'student':
      default:
        return const StudentShellScreen();
    }
  }
}

class StudentShellScreen extends StatefulWidget {
  const StudentShellScreen({super.key});

  @override
  State<StudentShellScreen> createState() => _StudentShellScreenState();
}

class _StudentShellScreenState extends State<StudentShellScreen> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = context.watch<AuthService>().isAuthenticated;
    final showBottomNav = MediaQuery.of(context).size.width < 640;

    final pages = isAuthenticated
        ? [
      StudentOffersScreen(
        showAppBar: false,
        onOpenOrders: () => setState(() => _tabIndex = 2),
      ),
      const CampusRadarScreen(showAppBar: false),
      const StudentOrdersScreen(showAppBar: false),
      const StudentDashboardScreen(showAppBar: false),
    ]
        : [
      StudentOffersScreen(
        showAppBar: false,
        onOpenOrders: () => setState(() => _tabIndex = 0),
      ),
      const CampusRadarScreen(showAppBar: false),
    ];

    final destinations = isAuthenticated
        ? const [
      NavigationDestination(
        icon: Icon(Icons.shopping_bag_outlined),
        selectedIcon: Icon(Icons.shopping_bag),
        label: 'Offres',
      ),
      NavigationDestination(
        icon: Icon(Icons.radar_outlined),
        selectedIcon: Icon(Icons.radar),
        label: 'Campus Radar',
      ),
      NavigationDestination(
        icon: Icon(Icons.qr_code_2_outlined),
        selectedIcon: Icon(Icons.qr_code_2),
        label: 'Commandes',
      ),
      NavigationDestination(
        icon: Icon(Icons.eco_outlined),
        selectedIcon: Icon(Icons.eco),
        label: 'Impact',
      ),
    ]
        : const [
      NavigationDestination(
        icon: Icon(Icons.shopping_bag_outlined),
        selectedIcon: Icon(Icons.shopping_bag),
        label: 'Offres',
      ),
      NavigationDestination(
        icon: Icon(Icons.radar_outlined),
        selectedIcon: Icon(Icons.radar),
        label: 'Campus Radar',
      ),
    ];

    final safeIndex = _tabIndex.clamp(0, pages.length - 1);

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAF8),
      body: Column(
        children: [
          CampusTopBar(
            activeIndex: safeIndex,
            onSelectTab: (index) => setState(() => _tabIndex = index),
          ),
          Expanded(child: pages[safeIndex]),
        ],
      ),
      bottomNavigationBar: showBottomNav
          ? NavigationBar(
        selectedIndex: safeIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: destinations,
      )
          : null,
    );
  }
}
