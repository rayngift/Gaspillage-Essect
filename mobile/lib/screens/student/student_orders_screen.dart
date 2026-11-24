import 'package:flutter/material.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import 'qr_ticket_screen.dart';

class StudentOrdersScreen extends StatefulWidget {
  final bool showAppBar;
  const StudentOrdersScreen({super.key, this.showAppBar = true});

  @override
  State<StudentOrdersScreen> createState() => _StudentOrdersScreenState();
}

class _StudentOrdersScreenState extends State<StudentOrdersScreen> {
  final ApiService _api = ApiService();
  late Future<List<CampusOrder>> _ordersFuture;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    setState(() {
      _ordersFuture = _api.fetchMyOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAF8),
      appBar: widget.showAppBar
          ? AppBar(title: const Text('Mes commandes & QR'))
          : null,
      body: FutureBuilder<List<CampusOrder>>(
        future: _ordersFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Erreur : ${snapshot.error}'));
          }
          final orders = snapshot.data ?? [];
          if (orders.isEmpty) {
            return const Center(
              child: Text('Aucune réservation effectuée pour le moment.'),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _load(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final order = orders[index];
                final pickedUp = order.status == 'picked_up';
                final paid = order.status == 'paid';
                return ListTile(
                  tileColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: Color(0xFFE5E7E1)),
                  ),
                  title: Text(
                    '${order.offerTitle} (x${order.quantity})',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    '${order.shopName} · ${order.totalAmount.toStringAsFixed(2)} TND · ${order.shortCode}',
                  ),
                  trailing: Text(
                    pickedUp
                        ? 'Récupérée'
                        : paid
                        ? 'À retirer'
                        : order.status,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: pickedUp
                          ? const Color(0xFF166534)
                          : const Color(0xFFB45309),
                    ),
                  ),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => QrTicketScreen(order: order)),
                    );
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}
