import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../auth/login_screen.dart';
import 'offer_detail_screen.dart';

class StudentOffersScreen extends StatefulWidget {
  final String? initialShopId;
  final bool showAppBar;
  final VoidCallback? onOpenOrders;

  const StudentOffersScreen({
    super.key,
    this.initialShopId,
    this.showAppBar = true,
    this.onOpenOrders,
  });

  @override
  State<StudentOffersScreen> createState() => _StudentOffersScreenState();
}

class _StudentOffersScreenState extends State<StudentOffersScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _searchCtrl = TextEditingController();
  final GlobalKey _catalogueKey = GlobalKey();

  String _selectedCategory = 'Toutes';
  double? _maxPrice;
  String? _shopFilter;

  List<FoodOffer> _offers = [];
  List<String> _categories = const ['Toutes'];
  StudentStats? _studentStats;
  bool _loading = true;
  bool _authRequired = false;
  String? _error;
  bool _lastAuthState = false;

  @override
  void initState() {
    super.initState();
    _shopFilter = widget.initialShopId;
    _lastAuthState = context.read<AuthService>().isAuthenticated;
    _loadData();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final isAuth = context.watch<AuthService>().isAuthenticated;
    if (isAuth != _lastAuthState) {
      _lastAuthState = isAuth;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadData();
      });
    }
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _authRequired = false;
      _error = null;
    });
    try {
      final isAuth = context.read<AuthService>().isAuthenticated;
      final role = context.read<AuthService>().role;
      final offers = await _api.fetchOffers(
        query: _searchCtrl.text.trim(),
        category: _selectedCategory,
        maxPrice: _maxPrice,
        shopId: _shopFilter,
      );

      StudentStats? stats;
      if (isAuth && role == 'student') {
        try {
          stats = await _api.fetchStudentStats();
        } catch (_) {}
      }

      if (!mounted) return;
      final foundCats = offers.map((o) => o.category).where((c) => c.isNotEmpty).toSet().toList()
        ..sort();
      setState(() {
        _offers = offers;
        if (_selectedCategory == 'Toutes' && foundCats.isNotEmpty) {
          _categories = ['Toutes', ...foundCats];
        }
        _studentStats = stats;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _authRequired = e.statusCode == 401;
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Impossible de joindre le backend (${ApiService.baseUrl}) : $e';
        _loading = false;
      });
    }
  }

  void _scrollToCatalogue() {
    final ctx = _catalogueKey.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _handleOrdersTap(AuthService auth) {
    if (!auth.isAuthenticated) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      return;
    }
    widget.onOpenOrders?.call();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final screenWidth = MediaQuery.of(context).size.width;
    final isWide = screenWidth >= 860;

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAF8),
      appBar: widget.showAppBar
          ? AppBar(
        title: const Text('CampusSave · Offres'),
        actions: [
          if (!auth.isAuthenticated)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF166534),
                  foregroundColor: Colors.white,
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                child: const Text('Connexion'),
              ),
            ),
        ],
      )
          : null,
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1200),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_shopFilter == null) ...[
                    if (isWide)
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(child: _buildHeroTextCard(auth)),
                            const SizedBox(width: 24),
                            Expanded(child: _buildHeroImageCard(height: 360)),
                          ],
                        ),
                      )
                    else ...[
                      _buildHeroTextCard(auth),
                      const SizedBox(height: 16),
                      _buildHeroImageCard(height: 220),
                    ],
                    const SizedBox(height: 20),
                    _buildImpactStrip(screenWidth),
                    const SizedBox(height: 28),
                  ],

                  Container(
                    key: _catalogueKey,
                    padding: const EdgeInsets.only(bottom: 16),
                    decoration: const BoxDecoration(
                      border: Border(
                        bottom: BorderSide(color: Color(0xFFE5E7E1)),
                      ),
                    ),
                    child: isWide
                        ? Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _buildCatalogueTitle(),
                        const SizedBox(width: 16),
                        SizedBox(
                          width: 460,
                          child: _buildSearchAndPriceRow(),
                        ),
                      ],
                    )
                        : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildCatalogueTitle(),
                        const SizedBox(height: 14),
                        _buildSearchAndPriceRow(),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3F4F1),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE5E7E1)),
                        ),
                        child: Wrap(
                          spacing: 4,
                          runSpacing: 4,
                          children: _categories.map((cat) {
                            final active = _selectedCategory == cat;
                            return InkWell(
                              borderRadius: BorderRadius.circular(8),
                              onTap: () {
                                setState(() => _selectedCategory = cat);
                                _loadData();
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: active ? Colors.white : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  cat,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: active
                                        ? FontWeight.w600
                                        : FontWeight.w500,
                                    color: active
                                        ? const Color(0xFF111814)
                                        : const Color(0xFF525C55),
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      if (_shopFilter != null)
                        TextButton(
                          onPressed: () {
                            setState(() => _shopFilter = null);
                            _loadData();
                          },
                          child: const Text('Afficher tous les commerces'),
                        ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_authRequired)
                    _buildEmptyCard(
                      title: 'Connexion requise pour charger vos offres Firebase',
                      subtitle:
                      'Votre backend exige un jeton Firebase (401 Token manquant) sur GET /api/offers. Connectez-vous pour afficher vos offres Firestore en direct.',
                      actionLabel: 'Se connecter',
                      onAction: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                        );
                      },
                    )
                  else if (_error != null)
                      _buildEmptyCard(
                        title: 'Impossible de charger les offres depuis le backend',
                        subtitle: _error!,
                        actionLabel: 'Réessayer',
                        onAction: _loadData,
                      )
                    else if (_offers.isEmpty)
                        _buildEmptyCard(
                          title: 'Aucune offre ne correspond à votre recherche',
                          subtitle:
                          'Modifiez vos critères ou réinitialisez les filtres pour afficher tous les paniers.',
                          actionLabel: 'Réinitialiser les filtres',
                          onAction: () {
                            setState(() {
                              _searchCtrl.clear();
                              _selectedCategory = 'Toutes';
                              _maxPrice = null;
                              _shopFilter = null;
                            });
                            _loadData();
                          },
                        )
                      else
                        LayoutBuilder(
                          builder: (context, constraints) {
                            final cols = constraints.maxWidth >= 980
                                ? 3
                                : constraints.maxWidth >= 620
                                ? 2
                                : 1;
                            final spacing = 20.0;
                            final itemWidth =
                                (constraints.maxWidth - spacing * (cols - 1)) / cols;
                            return Wrap(
                              spacing: spacing,
                              runSpacing: spacing,
                              children: _offers
                                  .map(
                                    (offer) => SizedBox(
                                  width: itemWidth,
                                  child: _OfferCard(
                                    offer: offer,
                                    onTap: () async {
                                      await Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              OfferDetailScreen(offer: offer),
                                        ),
                                      );
                                      _loadData();
                                    },
                                    onReserve: () async {
                                      if (!auth.isAuthenticated) {
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Connectez-vous pour réserver une offre.',
                                            ),
                                          ),
                                        );
                                        await Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (_) =>
                                            const LoginScreen(),
                                          ),
                                        );
                                        return;
                                      }
                                      await Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) =>
                                              OfferDetailScreen(offer: offer),
                                        ),
                                      );
                                      _loadData();
                                    },
                                  ),
                                ),
                              )
                                  .toList(),
                            );
                          },
                        ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeroTextCard(AuthService auth) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text(
                'ESSECT Montfleury · Plateforme solidaire anti-gaspillage',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF166534),
                ),
              ),
              SizedBox(height: 12),
              Text(
                'Sauvez les invendus du campus à prix étudiant.',
                style: TextStyle(
                  fontSize: 32,
                  height: 1.12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  color: Color(0xFF111814),
                ),
              ),
              SizedBox(height: 14),
              Text(
                'Réservez les paniers du jour et offres des cafétérias et restaurants autour de l’ESSECT, réglez via Konnect et récupérez votre commande avec votre QR Code.',
                style: TextStyle(
                  fontSize: 15,
                  height: 1.55,
                  color: Color(0xFF525C55),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 10,
            children: [
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF166534),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: _scrollToCatalogue,
                child: const Text(
                  'Explorer les offres',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  backgroundColor: const Color(0xFFF3F4F1),
                  foregroundColor: const Color(0xFF111814),
                  side: const BorderSide(color: Color(0xFFE5E7E1)),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: () => _handleOrdersTap(auth),
                icon: const Icon(
                  Icons.shopping_bag_outlined,
                  size: 18,
                  color: Color(0xFF166534),
                ),
                label: const Text(
                  'Mes commandes QR',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeroImageCard({required double height}) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      clipBehavior: Clip.antiAlias,
        child: Image.asset(
        'assets/images/essect.jpg',
        fit: BoxFit.cover,
        width: double.infinity,
      ),
    );
  }

  Widget _buildImpactStrip(double width) {
    final s = _studentStats;
    final cards = [
      (
      'Offres actives',
      '${_offers.length}',
      const Color(0xFF166534),
      ),
      (
      'Commandes payées',
      '${s?.paidOrders ?? 0}',
      const Color(0xFF111814),
      ),
      (
      'Économies réalisées',
      '${(s?.totalSaved ?? 0).toStringAsFixed(2)} TND',
      const Color(0xFF111814),
      ),
      (
      'Commandes récupérées',
      '${s?.pickedUpOrders ?? 0}',
      const Color(0xFF166534),
      ),
    ];

    if (width >= 760) {
      return Row(
        children: [
          for (int i = 0; i < cards.length; i++) ...[
            if (i > 0) const SizedBox(width: 14),
            Expanded(
              child: _KpiCard(
                label: cards[i].$1,
                value: cards[i].$2,
                color: cards[i].$3,
              ),
            ),
          ],
        ],
      );
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _KpiCard(
                label: cards[0].$1,
                value: cards[0].$2,
                color: cards[0].$3,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                label: cards[1].$1,
                value: cards[1].$2,
                color: cards[1].$3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _KpiCard(
                label: cards[2].$1,
                value: cards[2].$2,
                color: cards[2].$3,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                label: cards[3].$1,
                value: cards[3].$2,
                color: cards[3].$3,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCatalogueTitle() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Paniers disponibles aujourd’hui',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFF111814),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${_offers.length} offre(s) vérifiée(s) autour de l’ESSECT',
          style: const TextStyle(fontSize: 13, color: Color(0xFF525C55)),
        ),
      ],
    );
  }

  Widget _buildSearchAndPriceRow() {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _searchCtrl,
            onSubmitted: (_) => _loadData(),
            onChanged: (_) => _loadData(),
            decoration: InputDecoration(
              hintText: 'Rechercher produit, commerce...',
              prefixIcon: const Icon(Icons.search, size: 18),
              filled: true,
              fillColor: Colors.white,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 11),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFFE5E7E1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0xFF166534)),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE5E7E1)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<double?>(
              value: _maxPrice,
              hint: const Text('Tous les prix', style: TextStyle(fontSize: 13)),
              items: const [
                DropdownMenuItem(value: null, child: Text('Tous les prix')),
                DropdownMenuItem(value: 5.0, child: Text('5.00 TND max')),
                DropdownMenuItem(value: 8.0, child: Text('8.00 TND max')),
                DropdownMenuItem(value: 15.0, child: Text('15.00 TND max')),
              ],
              onChanged: (val) {
                setState(() => _maxPrice = val);
                _loadData();
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyCard({
    required String title,
    required String subtitle,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      child: Column(
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF525C55)),
          ),
          const SizedBox(height: 14),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF166534),
            ),
            onPressed: onAction,
            child: Text(actionLabel),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF525C55)),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  final FoodOffer offer;
  final VoidCallback onTap;
  final VoidCallback onReserve;

  const _OfferCard({
    required this.offer,
    required this.onTap,
    required this.onReserve,
  });

  @override
  Widget build(BuildContext context) {
    final hasNetworkPhoto =
        offer.photoUrl != null && offer.photoUrl!.startsWith('http');

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 16 / 9,
              child: hasNetworkPhoto
                  ? Image.network(
                offer.photoUrl!,
                fit: BoxFit.cover,
                width: double.infinity,
                errorBuilder: (_, __, ___) => Image.asset(
                  offer.assetImagePath,
                  fit: BoxFit.cover,
                  width: double.infinity,
                ),
              )
                  : Image.asset(
                offer.assetImagePath,
                fit: BoxFit.cover,
                width: double.infinity,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${offer.shopName} · ${offer.category}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF525C55),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    offer.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111814),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    offer.description.isNotEmpty
                        ? offer.description
                        : 'Offre étudiante chez ${offer.shopName}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF525C55),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Retrait ${offer.pickupWindow} · ${offer.quantity > 0 ? '${offer.quantity} dispo' : 'Épuisé'}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF525C55),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text(
                            '${offer.discountedPrice.toStringAsFixed(2)} TND',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF166534),
                            ),
                          ),
                          if (offer.originalPrice > offer.discountedPrice) ...[
                            const SizedBox(width: 6),
                            Text(
                              '${offer.originalPrice.toStringAsFixed(2)} TND',
                              style: const TextStyle(
                                fontSize: 12,
                                decoration: TextDecoration.lineThrough,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                          if (offer.discountPercent > 0) ...[
                            const SizedBox(width: 6),
                            Text(
                              '-${offer.discountPercent}%',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFB45309),
                              ),
                            ),
                          ],
                        ],
                      ),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF166534),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        onPressed: offer.quantity > 0 ? onReserve : null,
                        child: const Text('Réserver', style: TextStyle(fontSize: 12.5)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
