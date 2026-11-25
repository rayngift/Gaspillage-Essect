import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';

class StudentDashboardScreen extends StatefulWidget {
  final bool showAppBar;
  const StudentDashboardScreen({super.key, this.showAppBar = true});

  @override
  State<StudentDashboardScreen> createState() => _StudentDashboardScreenState();
}

class _StudentDashboardScreenState extends State<StudentDashboardScreen> {
  final ApiService _api = ApiService();
  final _nameCtrl = TextEditingController();
  late Future<StudentStats> _statsFuture;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthService>();
    _nameCtrl.text = auth.profile?.displayName ?? '';
    _statsFuture = _api.fetchStudentStats();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final profile = auth.profile;

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAF8),
      appBar: widget.showAppBar
          ? AppBar(
        title: const Text('Mon Impact & Profil'),
        actions: [
          IconButton(
            tooltip: 'Déconnexion',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.signOut(),
          ),
        ],
      )
          : null,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
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
                  Text(
                    profile?.displayName ?? 'Étudiant ESSECT',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${profile?.email ?? ''} · Rôle: ${profile?.role ?? 'student'}',
                    style: const TextStyle(color: Color(0xFF525C55)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          FutureBuilder<StudentStats>(
            future: _statsFuture,
            builder: (context, snapshot) {
              final m = snapshot.data;
              return Card(
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
                        'Mon bilan CampusSave',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          _StatBox(
                            label: 'Commandes payées',
                            value: '${m?.paidOrders ?? 0}',
                          ),
                          const SizedBox(width: 10),
                          _StatBox(
                            label: 'Récupérées',
                            value: '${m?.pickedUpOrders ?? 0}',
                          ),
                          const SizedBox(width: 10),
                          _StatBox(
                            label: 'Économisé',
                            value: '${(m?.totalSaved ?? 0).toStringAsFixed(2)} TND',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
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
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Modifier mon profil',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Nom affiché',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF166534)),
                    onPressed: () async {
                      await auth.updateDisplayName(_nameCtrl.text);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Profil mis à jour')),
                        );
                      }
                    },
                    child: const Text('Enregistrer'),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () => auth.signOut(),
                    icon: const Icon(Icons.logout, size: 18),
                    label: const Text('Déconnexion'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;
  const _StatBox({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFFAFAF8),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE5E7E1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF525C55))),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Color(0xFF166534),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
