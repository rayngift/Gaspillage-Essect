import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../../models/campus_models.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../auth/login_screen.dart';
import '../student/student_offers_screen.dart';

class CampusRadarScreen extends StatefulWidget {
  final bool showAppBar;
  const CampusRadarScreen({super.key, this.showAppBar = true});

  @override
  State<CampusRadarScreen> createState() => _CampusRadarScreenState();
}

class _CampusRadarScreenState extends State<CampusRadarScreen> {
  static const LatLng _essectCenter = LatLng(36.7915, 10.1712);

  final ApiService _api = ApiService();
  final Completer<GoogleMapController> _mapCompleter =
  Completer<GoogleMapController>();
  GoogleMapController? _mapController;

  double _maxDistance = 600;
  String _typeFilter = 'tous'; // 'tous' | 'restaurant' | 'cafeteria'
  String? _selectedShopId;
  late Future<List<Shop>> _shopsFuture;
  bool _lastAuth = false;

  @override
  void initState() {
    super.initState();
    _lastAuth = context.read<AuthService>().isAuthenticated;
    _shopsFuture = _api.fetchShops();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final isAuth = context.watch<AuthService>().isAuthenticated;
    if (isAuth != _lastAuth) {
      _lastAuth = isAuth;
      setState(() {
        _shopsFuture = _api.fetchShops();
      });
    }
  }

  LatLng _resolveShopPosition(Shop shop, int index) {
    if (shop.lat != null && shop.lng != null) {
      return LatLng(shop.lat!, shop.lng!);
    }
    const knownMontfleuryCoords = <String, LatLng>{
      'gg-food-n-drinks': LatLng(36.7921, 10.1723),
      'resto-hamoush': LatLng(36.7928, 10.1731),
      'resto-gusto': LatLng(36.7905, 10.1698),
      'caffe-pause': LatLng(36.7932, 10.1704),
      'restaurant-pause-sandwich': LatLng(36.7909, 10.1729),
      'caffe-chez-nous': LatLng(36.7924, 10.1726),
      'resto-delicious': LatLng(36.7902, 10.1716),
    };
    final known = knownMontfleuryCoords[shop.id];
    if (known != null) return known;

    final angle = (index * 1.15) + 0.4;
    const radiusMeters = 220.0;
    final dLat = (radiusMeters * math.cos(angle)) / 111320.0;
    final dLng = (radiusMeters * math.sin(angle)) /
        (111320.0 * math.cos(_essectCenter.latitude * math.pi / 180));
    return LatLng(_essectCenter.latitude + dLat, _essectCenter.longitude + dLng);
  }

  int _haversineMeters(LatLng a, LatLng b) {
    const earthRadiusMeters = 6371000.0;
    final dLat = (b.latitude - a.latitude) * math.pi / 180.0;
    final dLng = (b.longitude - a.longitude) * math.pi / 180.0;
    final lat1 = a.latitude * math.pi / 180.0;
    final lat2 = b.latitude * math.pi / 180.0;
    final h = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1) *
            math.cos(lat2) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    final c = 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));
    return (earthRadiusMeters * c).round();
  }

  Future<void> _animateCamera(CameraUpdate update) async {
    final controller = _mapController ?? await _mapCompleter.future;
    if (!mounted) return;
    await controller.animateCamera(update);
  }

  void _focusShop(Shop shop, LatLng pos) {
    setState(() => _selectedShopId = shop.id);
    _animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: pos, zoom: 17.0),
      ),
    );
  }

  void _recenterEssect() {
    setState(() => _selectedShopId = null);
    _animateCamera(
      CameraUpdate.newCameraPosition(
        const CameraPosition(target: _essectCenter, zoom: 16.0),
      ),
    );
  }

  void _openShopOffers(Shop shop) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StudentOffersScreen(initialShopId: shop.id),
      ),
    );
  }

  Set<Marker> _buildMarkers(
      List<_PositionedShop> items,
      _PositionedShop? selected,
      ) {
    final markers = <Marker>{
      Marker(
        markerId: const MarkerId('essect_campus'),
        position: _essectCenter,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        infoWindow: const InfoWindow(
          title: 'ESSECT Montfleury',
          snippet: 'Point de repère du campus',
        ),
        onTap: _recenterEssect,
      ),
    };

    for (final entry in items) {
      final shop = entry.shop;
      final isSelected = selected?.shop.id == shop.id;
      markers.add(
        Marker(
          markerId: MarkerId('shop_${shop.id}'),
          position: entry.position,
          icon: BitmapDescriptor.defaultMarkerWithHue(
            isSelected
                ? BitmapDescriptor.hueOrange
                : BitmapDescriptor.hueGreen,
          ),
          infoWindow: InfoWindow(
            title: shop.name,
            snippet: '${shop.typeLabel} · ${entry.distanceMeters} m',
            onTap: () => _openShopOffers(shop),
          ),
          onTap: () => _focusShop(shop, entry.position),
        ),
      );
    }

    return markers;
  }

  Set<Circle> _buildCircles() {
    return {
      Circle(
        circleId: const CircleId('essect_radius'),
        center: _essectCenter,
        radius: _maxDistance,
        fillColor: const Color(0xFF166534).withValues(alpha: 0.12),
        strokeColor: const Color(0xFF166534).withValues(alpha: 0.75),
        strokeWidth: 2,
      ),
    };
  }

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = context.watch<AuthService>().isAuthenticated;
    final isWide = MediaQuery.of(context).size.width >= 900;

    return Scaffold(
      backgroundColor: const Color(0xFFFAFAF8),
      appBar: widget.showAppBar
          ? AppBar(
        title: const Text('Campus Radar · ESSECT'),
        actions: [
          if (!isAuthenticated)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF166534),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                ),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                icon: const Icon(Icons.login, size: 18),
                label: const Text('Connexion'),
              ),
            ),
        ],
      )
          : null,
      body: FutureBuilder<List<Shop>>(
        future: _shopsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            final err = snapshot.error;
            final is401 = err is ApiException && err.statusCode == 401;
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      is401
                          ? 'Connectez-vous pour afficher les commerces de votre base Firebase.'
                          : 'Erreur backend : $err',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 14),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF166534),
                      ),
                      onPressed: () {
                        if (is401) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                          );
                        } else {
                          setState(() {
                            _shopsFuture = _api.fetchShops();
                          });
                        }
                      },
                      child: Text(is401 ? 'Se connecter' : 'Réessayer'),
                    ),
                  ],
                ),
              ),
            );
          }

          final allShops = snapshot.data ?? [];
          final positioned = <_PositionedShop>[];
          for (int i = 0; i < allShops.length; i++) {
            final shop = allShops[i];
            final pos = _resolveShopPosition(shop, i);
            final dist = _haversineMeters(_essectCenter, pos);
            final matchesType =
                _typeFilter == 'tous' || shop.category == _typeFilter;
            if (dist <= _maxDistance && matchesType) {
              positioned.add(
                _PositionedShop(
                  shop: shop,
                  position: pos,
                  distanceMeters: dist,
                ),
              );
            }
          }
          positioned.sort((a, b) => a.distanceMeters.compareTo(b.distanceMeters));

          final selected = positioned
              .where((p) => p.shop.id == _selectedShopId)
              .firstOrNull;

          if (isWide) {
            return Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1280),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        width: 400,
                        child: _buildSidebar(positioned, selected),
                      ),
                      const SizedBox(width: 20),
                      Expanded(
                        child: _buildMapCard(positioned, selected),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }

          return Column(
            children: [
              SizedBox(
                height: 310,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: _buildMapCard(positioned, selected),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: _buildSidebar(positioned, selected),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSidebar(
      List<_PositionedShop> items,
      _PositionedShop? selected,
      ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Campus Radar · ESSECT',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF111814),
                      ),
                    ),
                    Text(
                      '${items.length} lieu(x)',
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF166534),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Rayon autour de l’ESSECT',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFF525C55)),
                    ),
                    Text(
                      '${_maxDistance.round()} m',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF166534),
                      ),
                    ),
                  ],
                ),
                Slider(
                  min: 150,
                  max: 1000,
                  divisions: 17,
                  activeColor: const Color(0xFF166534),
                  value: _maxDistance,
                  onChanged: (v) => setState(() => _maxDistance = v),
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    _FilterChipBtn(
                      label: 'Tous',
                      active: _typeFilter == 'tous',
                      onTap: () => setState(() => _typeFilter = 'tous'),
                    ),
                    _FilterChipBtn(
                      label: 'Restaurants',
                      active: _typeFilter == 'restaurant',
                      onTap: () => setState(() => _typeFilter = 'restaurant'),
                    ),
                    _FilterChipBtn(
                      label: 'Cafétérias',
                      active: _typeFilter == 'cafeteria',
                      onTap: () => setState(() => _typeFilter = 'cafeteria'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE5E7E1)),
          Expanded(
            child: items.isEmpty
                ? const Center(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'Aucun commerce dans ce rayon. Augmentez la distance.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF525C55)),
                ),
              ),
            )
                : ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final entry = items[index];
                final shop = entry.shop;
                final isSelected = selected?.shop.id == shop.id;
                final walkMin = (entry.distanceMeters / 75).ceil();

                return InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => _focusShop(shop, entry.position),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFFF0FDF4)
                          : const Color(0xFFFAFAF8),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isSelected
                            ? const Color(0xFF166534)
                            : const Color(0xFFE5E7E1),
                        width: isSelected ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFF166534)
                                : const Color(0xFFE7F3EC),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            shop.category == 'cafeteria'
                                ? Icons.local_cafe
                                : Icons.restaurant,
                            size: 20,
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF166534),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                shop.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  color: Color(0xFF111814),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${shop.typeLabel} · ${shop.address}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF525C55),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${entry.distanceMeters} m (~$walkMin min à pied)${shop.phone != null ? ' · ${shop.phone}' : ''}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF166534),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Voir les offres',
                          icon: const Icon(
                            Icons.arrow_forward_ios,
                            size: 16,
                            color: Color(0xFF166534),
                          ),
                          onPressed: () => _openShopOffers(shop),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapCard(
      List<_PositionedShop> items,
      _PositionedShop? selected,
      ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7E1)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: const CameraPosition(
              target: _essectCenter,
              zoom: 16.0,
            ),
            onMapCreated: (GoogleMapController controller) {
              _mapController = controller;
              if (!_mapCompleter.isCompleted) {
                _mapCompleter.complete(controller);
              }
            },
            markers: _buildMarkers(items, selected),
            circles: _buildCircles(),
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            myLocationButtonEnabled: false,
            compassEnabled: true,
            gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
              Factory<OneSequenceGestureRecognizer>(
                    () => EagerGestureRecognizer(),
              ),
            },
          ),

          // Légende compacte en haut à gauche
          Positioned(
            top: 14,
            left: 14,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE5E7E1)),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 8,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.school, size: 15, color: Color(0xFF2563EB)),
                  SizedBox(width: 5),
                  Text(
                    'ESSECT',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111814),
                    ),
                  ),
                  SizedBox(width: 10),
                  Icon(Icons.location_on, size: 15, color: Color(0xFF166534)),
                  SizedBox(width: 4),
                  Text(
                    'Commerces',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF525C55),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Contrôles de zoom et recentrage ESSECT
          Positioned(
            top: 14,
            right: 14,
            child: Column(
              children: [
                _MapControlButton(
                  icon: Icons.add,
                  tooltip: 'Zoomer',
                  onTap: () => _animateCamera(CameraUpdate.zoomIn()),
                ),
                const SizedBox(height: 6),
                _MapControlButton(
                  icon: Icons.remove,
                  tooltip: 'Dézoomer',
                  onTap: () => _animateCamera(CameraUpdate.zoomOut()),
                ),
                const SizedBox(height: 6),
                _MapControlButton(
                  icon: Icons.my_location,
                  tooltip: 'Recentrer sur ESSECT',
                  onTap: _recenterEssect,
                ),
              ],
            ),
          ),

          // Carte flottante du commerce sélectionné
          if (selected != null)
            Positioned(
              left: 14,
              right: 14,
              bottom: 14,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE5E7E1)),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 12,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE7F3EC),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        selected.shop.category == 'cafeteria'
                            ? Icons.local_cafe
                            : Icons.restaurant,
                        color: const Color(0xFF166534),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            selected.shop.name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF111814),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${selected.shop.typeLabel} · ${selected.shop.address} · ${selected.distanceMeters} m',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF525C55),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF166534),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: () => _openShopOffers(selected.shop),
                      child: const Text('Voir les offres'),
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

class _PositionedShop {
  final Shop shop;
  final LatLng position;
  final int distanceMeters;

  _PositionedShop({
    required this.shop,
    required this.position,
    required this.distanceMeters,
  });
}

class _FilterChipBtn extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _FilterChipBtn({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF166534) : const Color(0xFFF3F4F1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? const Color(0xFF166534) : const Color(0xFFE5E7E1),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : const Color(0xFF525C55),
          ),
        ),
      ),
    );
  }
}

class _MapControlButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;

  const _MapControlButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(10),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Tooltip(
          message: tooltip,
          child: SizedBox(
            width: 38,
            height: 38,
            child: Icon(icon, size: 19, color: const Color(0xFF111814)),
          ),
        ),
      ),
    );
  }
}
