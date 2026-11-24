import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';

class QrTicketScreen extends StatefulWidget {
  final CampusOrder order;
  const QrTicketScreen({super.key, required this.order});

  @override
  State<QrTicketScreen> createState() => _QrTicketScreenState();
}

class _QrTicketScreenState extends State<QrTicketScreen> {
  final ApiService _api = ApiService();
  late Future<Map<String, dynamic>> _qrFuture;

  @override
  void initState() {
    super.initState();
    _qrFuture = _api.fetchOrderQr(widget.order.id);
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;

    return Scaffold(
      appBar: AppBar(title: const Text('Ticket QR de récupération')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _qrFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'QR code indisponible : ${snapshot.error}',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          final data = snapshot.data ?? {};
          final token = (data['token'] ?? order.qrToken ?? order.id).toString();
          final status = (data['status'] ?? order.status).toString();
          final isPickedUp = status == 'picked_up';

          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  order.shopName,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text('${order.offerTitle} (x${order.quantity})'),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7E1)),
                  ),
                  child: QrImageView(
                    data: token,
                    version: QrVersions.auto,
                    size: 220,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Code : ${order.shortCode}',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                ),
                if (order.paymentRef != null) ...[
                  const SizedBox(height: 8),
                  Text('Réf. paiement : ${order.paymentRef}'),
                ],
                const SizedBox(height: 12),
                Text(
                  isPickedUp
                      ? 'Commande déjà récupérée !'
                      : 'Présentez ce QR code au commerçant lors du retrait.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF166534),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
