import 'package:flutter/material.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import 'qr_ticket_screen.dart';

class KonnectCheckoutScreen extends StatefulWidget {
  final FoodOffer offer;
  final int initialQuantity;
  const KonnectCheckoutScreen({
    super.key,
    required this.offer,
    this.initialQuantity = 1,
  });

  @override
  State<KonnectCheckoutScreen> createState() => _KonnectCheckoutScreenState();
}

class _KonnectCheckoutScreenState extends State<KonnectCheckoutScreen> {
  final ApiService _api = ApiService();
  final _phoneCtrl = TextEditingController(text: '22 450 810');
  String _method = 'wallet';
  bool _submitting = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _payWithKonnect() async {
    if (_method == 'wallet' && _phoneCtrl.text.replaceAll(' ', '').length < 8) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Numéro Konnect tunisien invalide (8 chiffres)')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final order = await _api.createOrder(
        offerId: widget.offer.id,
        quantity: widget.initialQuantity,
      );

      final init = await _api.initPayment(order.id);
      if (init['mode'] == 'mock') {
        await _api.confirmMockPayment(order.id);
      } else if (init['payUrl'] != null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lien Konnect généré : ${init['payUrl']}')),
        );
      }

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => QrTicketScreen(order: order)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur paiement : $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.offer.discountedPrice * widget.initialQuantity;

    return Scaffold(
      appBar: AppBar(title: const Text('Paiement Konnect · Mode Test')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${widget.offer.title} (x${widget.initialQuantity})',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text('${widget.offer.shopName} · Retrait ${widget.offer.pickupWindow}'),
            const SizedBox(height: 24),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'wallet', label: Text('Wallet Konnect')),
                ButtonSegment(value: 'card', label: Text('Carte Bancaire Test')),
              ],
              selected: {_method},
              onSelectionChanged: (val) => setState(() => _method = val.first),
            ),
            const SizedBox(height: 20),
            if (_method == 'wallet')
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Numéro mobile Konnect (test)',
                  border: OutlineInputBorder(),
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF3F4F1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text('Carte Test Konnect : 4000 •••• •••• 0002 (OTP auto)'),
              ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total à régler', style: TextStyle(fontSize: 16)),
                Text(
                  '${total.toStringAsFixed(2)} TND',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF166534),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF166534)),
                onPressed: _submitting ? null : _payWithKonnect,
                child: _submitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text('Payer ${total.toStringAsFixed(2)} TND avec Konnect'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
