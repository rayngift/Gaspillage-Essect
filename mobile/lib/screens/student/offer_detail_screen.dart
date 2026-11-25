import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/campus_models.dart';
import '../../services/auth_service.dart';
import '../auth/login_screen.dart';
import 'konnect_checkout_screen.dart';

class OfferDetailScreen extends StatefulWidget {
  final FoodOffer offer;
  const OfferDetailScreen({super.key, required this.offer});

  @override
  State<OfferDetailScreen> createState() => _OfferDetailScreenState();
}

class _OfferDetailScreenState extends State<OfferDetailScreen> {
  int _quantity = 1;

  @override
  Widget build(BuildContext context) {
    final offer = widget.offer;
    final total = offer.discountedPrice * _quantity;
    final savings = (offer.originalPrice - offer.discountedPrice) * _quantity;

    return Scaffold(
      appBar: AppBar(title: Text(offer.shopName)),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${offer.category} · Retrait ${offer.pickupWindow}',
              style: const TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              offer.title,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            Text(
              offer.description,
              style: const TextStyle(fontSize: 15, height: 1.5, color: Color(0xFF525C55)),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE5E7E1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Quantité', style: TextStyle(fontWeight: FontWeight.w600)),
                      Text('${offer.quantity} disponible(s)',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF525C55))),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('$_quantity',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      IconButton(
                        onPressed: _quantity < offer.quantity
                            ? () => setState(() => _quantity++)
                            : null,
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Économie anti-gaspi : -${savings.toStringAsFixed(2)} TND · +${_quantity * 25} EcoPoints',
              style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF166534)),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF166534)),
                onPressed: offer.quantity > 0
                    ? () {
                  final isAuth = context.read<AuthService>().isAuthenticated;
                  if (!isAuth) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Connectez-vous pour réserver et payer via Konnect.'),
                      ),
                    );
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                    );
                    return;
                  }
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(
                      builder: (_) => KonnectCheckoutScreen(
                        offer: offer,
                        initialQuantity: _quantity,
                      ),
                    ),
                  );
                }
                    : null,
                child: Text(
                  offer.quantity > 0
                      ? 'Réserver · ${total.toStringAsFixed(2)} TND'
                      : 'Stock épuisé',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
