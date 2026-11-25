import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';

class MerchantDashboardScreen extends StatefulWidget {
  const MerchantDashboardScreen({super.key});

  @override
  State<MerchantDashboardScreen> createState() => _MerchantDashboardScreenState();
}

class _MerchantDashboardScreenState extends State<MerchantDashboardScreen> {
  final ApiService _api = ApiService();
  int _tabIndex = 0;
  Shop? _myShop;
  List<FoodOffer> _offers = [];
  List<CampusOrder> _orders = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;
  String? _error;

  final _qrManualCtrl = TextEditingController();
  String _scanFeedback = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _qrManualCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.fetchMyShop(),
        _api.fetchMyOffers(),
        _api.fetchShopOrders(),
        _api.fetchMerchantStats(),
      ]);
      if (!mounted) return;
      setState(() {
        _myShop = results[0] as Shop?;
        _offers = results[1] as List<FoodOffer>;
        _orders = results[2] as List<CampusOrder>;
        _stats = results[3] as Map<String, dynamic>;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyQr(String token) async {
    if (token.trim().isEmpty) return;
    try {
      final res = await _api.verifyQrPickup(token.trim());
      setState(() {
        _scanFeedback = '${res['message'] ?? 'Commande validée'} (${res['orderId'] ?? ''})';
      });
      _qrManualCtrl.clear();
      await _loadData();
    } catch (e) {
      setState(() => _scanFeedback = 'Refusé : $e');
    }
  }

  Future<void> _openOfferDialog({FoodOffer? existing}) async {
    if (_myShop == null || _myShop!.status != 'approved') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Votre commerce doit être inscrit et validé par l’administrateur.'),
        ),
      );
      return;
    }

    String category = existing?.category ?? 'repas';
    const categories = ['repas', 'sandwich', 'pizza', 'formule', 'boisson', 'patisserie'];
    if (!categories.contains(category)) category = 'repas';

    final titleCtrl = TextEditingController(text: existing?.title ?? '');
    final descCtrl = TextEditingController(text: existing?.description ?? '');
    final origCtrl = TextEditingController(text: existing?.originalPrice.toString() ?? '14');
    final discCtrl = TextEditingController(text: existing?.discountedPrice.toString() ?? '5');
    final qtyCtrl = TextEditingController(text: existing?.quantity.toString() ?? '5');
    final hoursCtrl = TextEditingController(text: '4');

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            20,
            20,
            MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  existing == null ? 'Publier une offre (${_myShop!.name})' : 'Modifier l’offre',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: category,
                  decoration: const InputDecoration(
                    labelText: 'Catégorie',
                    border: OutlineInputBorder(),
                  ),
                  items: categories
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => category = v ?? category,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: titleCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Titre',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Description',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: origCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Prix initial',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: discCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Prix réduit',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: qtyCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Qté',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: hoursCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Durée de validité (heures à partir de maintenant)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF166534)),
                  onPressed: () async {
                    final orig = double.tryParse(origCtrl.text) ?? 0;
                    final disc = double.tryParse(discCtrl.text) ?? 0;
                    final qty = int.tryParse(qtyCtrl.text) ?? 0;
                    final hours = int.tryParse(hoursCtrl.text) ?? 4;
                    if (titleCtrl.text.trim().length < 2 || disc <= 0 || disc >= orig || qty < 1) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Vérifiez titre, prix réduit < prix initial et quantité >= 1'),
                        ),
                      );
                      return;
                    }
                    final start = DateTime.now();
                    final end = start.add(Duration(hours: hours.clamp(1, 720)));
                    try {
                      if (existing == null) {
                        await _api.createOffer(
                          title: titleCtrl.text.trim(),
                          description: descCtrl.text.trim(),
                          category: category,
                          originalPrice: orig,
                          discountedPrice: disc,
                          quantity: qty,
                          pickupStart: start,
                          pickupEnd: end,
                        );
                      } else {
                        await _api.updateOffer(
                          existing.id,
                          title: titleCtrl.text.trim(),
                          description: descCtrl.text.trim(),
                          category: category,
                          originalPrice: orig,
                          discountedPrice: disc,
                          quantity: qty,
                          pickupStart: start,
                          pickupEnd: end,
                        );
                      }
                      if (ctx.mounted) Navigator.pop(ctx);
                      await _loadData();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Erreur : $e')),
                        );
                      }
                    }
                  },
                  child: Text(existing == null ? 'Publier l’offre' : 'Enregistrer'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _openCreateShopDialog() async {
    final nameCtrl = TextEditingController();
    final addrCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    String type = 'restaurant';

    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Inscrire mon commerce'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Nom du commerce'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: const [
                  DropdownMenuItem(value: 'restaurant', child: Text('Restaurant')),
                  DropdownMenuItem(value: 'cafeteria', child: Text('Cafétéria')),
                ],
                onChanged: (v) => type = v ?? type,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: addrCtrl,
                decoration: const InputDecoration(labelText: 'Adresse (5+ caractères)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: phoneCtrl,
                decoration: const InputDecoration(labelText: 'Téléphone (optionnel)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF166534)),
            onPressed: () async {
              if (nameCtrl.text.trim().length < 2 || addrCtrl.text.trim().length < 5) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Nom (2+ car.) et adresse (5+ car.) requis.'),
                  ),
                );
                return;
              }
              try {
                await _api.createShop(
                  name: nameCtrl.text.trim(),
                  type: type,
                  address: addrCtrl.text.trim(),
                  phone: phoneCtrl.text.trim(),
                );
                if (ctx.mounted) Navigator.pop(ctx);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Commerce soumis pour validation administrateur.'),
                    ),
                  );
                }
                await _loadData();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Erreur : $e')),
                  );
                }
              }
            },
            child: const Text('Soumettre'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final revenue = ((_stats['revenue'] ?? 0) as num).toDouble();
    final activeOffers = ((_stats['activeOffers'] ?? _offers.length) as num).toInt();
    final pendingPickup =
    ((_stats['pendingPickup'] ?? _orders.where((o) => o.status == 'paid').length) as num)
        .toInt();

    return Scaffold(
      appBar: AppBar(
        title: Text(_myShop != null ? _myShop!.name : 'CampusSave · Commerçant'),
        actions: [
          if (_myShop == null)
            IconButton(
              tooltip: 'Inscrire un établissement',
              icon: const Icon(Icons.add_business),
              onPressed: _openCreateShopDialog,
            ),
          IconButton(
            tooltip: 'Déconnexion',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.signOut(),
          ),
        ],
      ),
      floatingActionButton: _tabIndex == 0
          ? FloatingActionButton.extended(
        backgroundColor: const Color(0xFF166534),
        foregroundColor: Colors.white,
        onPressed: () => _openOfferDialog(),
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle offre'),
      )
          : null,
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
                if (_myShop == null)
                  Card(
                    color: Colors.white,
                    child: ListTile(
                      title: const Text('Aucun commerce enregistré'),
                      subtitle: const Text('Inscrivez votre établissement pour publier des offres.'),
                      trailing: FilledButton(
                        onPressed: _openCreateShopDialog,
                        child: const Text('Inscrire'),
                      ),
                    ),
                  )
                else if (_myShop!.status != 'approved')
                  Card(
                    color: const Color(0xFFFEF3C7),
                    child: ListTile(
                      title: Text('${_myShop!.name} (${_myShop!.status})'),
                      subtitle: const Text('En attente de validation par l’administrateur.'),
                    ),
                  ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _KpiTile(
                        label: 'Revenus',
                        value: '${revenue.toStringAsFixed(2)} TND',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _KpiTile(
                        label: 'Offres actives',
                        value: '$activeOffers',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _KpiTile(
                        label: 'À retirer',
                        value: '$pendingPickup',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ..._offers.map(
                      (offer) => Card(
                    color: Colors.white,
                    elevation: 0,
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: const BorderSide(color: Color(0xFFE5E7E1)),
                    ),
                    child: ListTile(
                      title: Text(offer.title,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        '${offer.category} · ${offer.discountedPrice.toStringAsFixed(2)} TND · Stock: ${offer.quantity}',
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined),
                            onPressed: () => _openOfferDialog(existing: offer),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () async {
                              await _api.deleteOffer(offer.id);
                              await _loadData();
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Column(
            children: [
              SizedBox(
                height: 220,
                child: MobileScanner(
                  onDetect: (capture) {
                    final value = capture.barcodes.firstOrNull?.rawValue;
                    if (value != null) _verifyQr(value);
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_scanFeedback.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          _scanFeedback,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF166534),
                          ),
                        ),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _qrManualCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Token QR client',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF166534),
                          ),
                          onPressed: () => _verifyQr(_qrManualCtrl.text),
                          child: const Text('Valider'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _orders.length,
                  itemBuilder: (context, index) {
                    final ord = _orders[index];
                    return ListTile(
                      title: Text('${ord.studentName} · ${ord.shortCode}'),
                      subtitle: Text('${ord.offerTitle} (x${ord.quantity})'),
                      trailing: Text(
                        ord.status,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF166534),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Mes offres',
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner),
            label: 'Scanner QR',
          ),
        ],
      ),
    );
  }
}

class _KpiTile extends StatelessWidget {
  final String label;
  final String value;
  const _KpiTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
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
    );
  }
}
