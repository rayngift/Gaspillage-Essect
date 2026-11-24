import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final ApiService _api = ApiService();
  int _tabIndex = 0;
  List<Shop> _shops = [];
  List<UserProfile> _users = [];
  AdminStats? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.fetchShops(status: 'pending'),
        _api.fetchShops(status: 'approved'),
        _api.fetchAdminUsers(),
        _api.fetchAdminStats(),
      ]);
      if (!mounted) return;
      setState(() {
        _shops = [...(results[0] as List<Shop>), ...(results[1] as List<Shop>)];
        _users = results[2] as List<UserProfile>;
        _stats = results[3] as AdminStats;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('CampusSave · Admin ESSECT'),
        actions: [
          IconButton(
            tooltip: 'Déconnexion',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.signOut(),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Erreur : $_error', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _loadData, child: const Text('Réessayer')),
            ],
          ),
        ),
      )
          : IndexedStack(
        index: _tabIndex,
        children: [
          RefreshIndicator(
            onRefresh: _loadData,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_stats != null)
                  Card(
                    color: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: const BorderSide(color: Color(0xFFE5E7E1)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Impact Global Plateforme',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text('Utilisateurs : ${_stats!.totalUsers} (${_stats!.students} étudiants, ${_stats!.merchants} commerçants)'),
                          Text('Articles sauvés : ${_stats!.itemsRescued}'),
                          Text('Revenus : ${_stats!.revenue.toStringAsFixed(2)} TND'),
                          Text('Commerces validés : ${_stats!.approvedShops}/${_stats!.totalShops}'),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                const Text(
                  'Validation des commerces',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                ..._shops.map(
                      (shop) => Card(
                    color: Colors.white,
                    elevation: 0,
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFFE5E7E1)),
                    ),
                    child: ListTile(
                      title: Text(shop.name,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${shop.typeLabel} · Statut: ${shop.status}'),
                      trailing: Wrap(
                        spacing: 6,
                        children: [
                          if (shop.status != 'approved')
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFF166534),
                              ),
                              onPressed: () async {
                                await _api.updateShopStatus(shop.id, 'approved');
                                await _loadData();
                              },
                              child: const Text('Valider'),
                            ),
                          if (shop.status != 'rejected')
                            OutlinedButton(
                              onPressed: () async {
                                await _api.updateShopStatus(shop.id, 'rejected');
                                await _loadData();
                              },
                              child: const Text('Refuser'),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          RefreshIndicator(
            onRefresh: _loadData,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _users.length,
              itemBuilder: (context, index) {
                final u = _users[index];
                return Card(
                  color: Colors.white,
                  elevation: 0,
                  margin: const EdgeInsets.only(bottom: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFFE5E7E1)),
                  ),
                  child: ListTile(
                    title: Text(u.displayName,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${u.email} · Rôle: ${u.role}'),
                    trailing: Switch(
                      value: !u.disabled,
                      activeColor: const Color(0xFF166534),
                      onChanged: u.uid == auth.profile?.uid
                          ? null
                          : (active) async {
                        await _api.setUserDisabled(u.uid, !active);
                        await _loadData();
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.store_mall_directory_outlined),
            selectedIcon: Icon(Icons.store_mall_directory),
            label: 'Commerces',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: 'Utilisateurs',
          ),
        ],
      ),
    );
  }
}
