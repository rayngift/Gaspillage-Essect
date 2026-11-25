String normalizeRole(String? rawRole) {
  switch ((rawRole ?? 'student').toLowerCase()) {
    case 'admin':
      return 'admin';
    case 'merchant':
    case 'commercant':
      return 'merchant';
    case 'student':
    case 'etudiant':
    default:
      return 'student';
  }
}

class UserProfile {
  final String uid;
  final String displayName;
  final String email;
  final String? phone;
  final String role; // 'student' | 'merchant' | 'admin'
  final bool disabled;
  final int ecopoints;
  final int mealsSaved;
  final double co2SavedKg;

  UserProfile({
    required this.uid,
    required this.displayName,
    required this.email,
    this.phone,
    required this.role,
    this.disabled = false,
    this.ecopoints = 0,
    this.mealsSaved = 0,
    this.co2SavedKg = 0,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    final uid = (json['uid'] ?? json['id'] ?? '').toString();
    return UserProfile(
      uid: uid,
      displayName: (json['name'] ?? json['displayName'] ?? 'Utilisateur CampusSave').toString(),
      email: (json['email'] ?? '').toString(),
      phone: json['phone']?.toString(),
      role: normalizeRole(json['role']?.toString()),
      disabled: json['disabled'] == true,
      ecopoints: ((json['ecopoints'] ?? 0) as num).toInt(),
      mealsSaved: ((json['mealsSaved'] ?? 0) as num).toInt(),
      co2SavedKg: ((json['co2SavedKg'] ?? 0) as num).toDouble(),
    );
  }
}

class Shop {
  final String id;
  final String ownerId;
  final String name;
  final String category; // 'restaurant' | 'cafeteria'
  final String address;
  final String? phone;
  final String? mapsUrl;
  final String description;
  final int distanceMeters;
  final double? lat;
  final double? lng;
  final String pickupWindow;
  final String status; // 'pending' | 'approved' | 'rejected'

  Shop({
    required this.id,
    required this.ownerId,
    required this.name,
    required this.category,
    required this.address,
    this.phone,
    this.mapsUrl,
    this.description = '',
    this.distanceMeters = 250,
    this.lat,
    this.lng,
    this.pickupWindow = 'Aujourd’hui',
    required this.status,
  });

  String get typeLabel => category == 'cafeteria' ? 'Cafétéria' : 'Restaurant';

  factory Shop.fromJson(Map<String, dynamic> json) {
    return Shop(
      id: (json['id'] ?? '').toString(),
      ownerId: (json['ownerId'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      category: (json['type'] ?? json['category'] ?? 'restaurant').toString(),
      address: (json['address'] ?? 'Montfleury, Tunis').toString(),
      phone: json['phone']?.toString(),
      mapsUrl: json['mapsUrl']?.toString(),
      description: (json['description'] ?? '').toString(),
      distanceMeters: ((json['distanceMeters'] ?? 250) as num).toInt(),
      lat: (json['latitude'] ?? json['lat']) != null
          ? ((json['latitude'] ?? json['lat']) as num).toDouble()
          : null,
      lng: (json['longitude'] ?? json['lng']) != null
          ? ((json['longitude'] ?? json['lng']) as num).toDouble()
          : null,
      pickupWindow: (json['pickupWindow'] ?? 'Aujourd’hui').toString(),
      status: (json['status'] ?? 'pending').toString(),
    );
  }
}

class FoodOffer {
  final String id;
  final String shopId;
  final String ownerId;
  final String shopName;
  final String title;
  final String description;
  final String category;
  final bool isSurpriseBasket;
  final double originalPrice;
  final double discountedPrice;
  final int quantity;
  final String pickupStart;
  final String pickupEnd;
  final String? photoUrl;
  final bool active;

  FoodOffer({
    required this.id,
    required this.shopId,
    required this.ownerId,
    required this.shopName,
    required this.title,
    required this.description,
    required this.category,
    required this.isSurpriseBasket,
    required this.originalPrice,
    required this.discountedPrice,
    required this.quantity,
    required this.pickupStart,
    required this.pickupEnd,
    this.photoUrl,
    required this.active,
  });

  int get discountPercent {
    if (originalPrice <= 0 || discountedPrice >= originalPrice) return 0;
    return (((originalPrice - discountedPrice) / originalPrice) * 100).round();
  }

  String get pickupWindow {
    if (pickupStart.isEmpty && pickupEnd.isEmpty) return 'Aujourd’hui';
    try {
      final start = DateTime.parse(pickupStart).toLocal();
      final end = DateTime.parse(pickupEnd).toLocal();
      String fmtTime(DateTime d) =>
          '${d.hour.toString().padLeft(2, '0')}h${d.minute.toString().padLeft(2, '0')}';
      if (start.day == end.day && start.month == end.month) {
        return '${fmtTime(start)} - ${fmtTime(end)}';
      }
      return 'Jusqu’au ${end.day.toString().padLeft(2, '0')}/${end.month.toString().padLeft(2, '0')}';
    } catch (_) {
      return pickupEnd.isNotEmpty ? pickupEnd : pickupStart;
    }
  }

  String get assetImagePath {
    final c = category.toLowerCase();
    final t = title.toLowerCase();
    if (c.contains('boulangerie') || c.contains('formule') || t.contains('cookies') || t.contains('café')) {
      return 'assets/images/offer_panier_boulangerie_1795114622897.jpg';
    }
    if (c.contains('patisserie') || c.contains('pâtisserie') || t.contains('tiramisu') || t.contains('gâteau')) {
      return 'assets/images/offer_patisserie_tunisienne_1795114622699.jpg';
    }
    if (isSurpriseBasket || c.contains('surprise') || c.contains('boisson')) {
      return 'assets/images/offer_surprise_basket_1795114624158.jpg';
    }
    return 'assets/images/offer_plat_campus_1795114622926.jpg';
  }

  factory FoodOffer.fromJson(Map<String, dynamic> json) {
    final cat = (json['category'] ?? 'repas').toString();
    return FoodOffer(
      id: (json['id'] ?? '').toString(),
      shopId: (json['shopId'] ?? '').toString(),
      ownerId: (json['merchantId'] ?? json['ownerId'] ?? '').toString(),
      shopName: (json['shopName'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      category: cat,
      isSurpriseBasket: json['isSurpriseBasket'] == true || cat.toLowerCase().contains('surprise'),
      originalPrice: ((json['originalPrice'] ?? 0) as num).toDouble(),
      discountedPrice: ((json['discountedPrice'] ?? 0) as num).toDouble(),
      quantity: ((json['quantity'] ?? 0) as num).toInt(),
      pickupStart: (json['pickupStart'] ?? '').toString(),
      pickupEnd: (json['pickupEnd'] ?? '').toString(),
      photoUrl: (json['photoUrl'] ?? json['imageUrl'])?.toString(),
      active: json['active'] ?? true,
    );
  }
}

class OrderLineItem {
  final String offerId;
  final String title;
  final int quantity;
  final double unitPrice;
  final double originalPrice;

  OrderLineItem({
    required this.offerId,
    required this.title,
    required this.quantity,
    required this.unitPrice,
    required this.originalPrice,
  });

  factory OrderLineItem.fromJson(Map<String, dynamic> json) {
    return OrderLineItem(
      offerId: (json['offerId'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      quantity: ((json['quantity'] ?? 1) as num).toInt(),
      unitPrice: ((json['unitPrice'] ?? 0) as num).toDouble(),
      originalPrice: ((json['originalPrice'] ?? 0) as num).toDouble(),
    );
  }
}

class CampusOrder {
  final String id;
  final String studentId;
  final String studentName;
  final String shopId;
  final String shopName;
  final List<OrderLineItem> items;
  final double totalAmount;
  final double savingsAmount;
  final String? paymentRef;
  final String? qrToken;
  final String status; // 'pending_payment' | 'paid' | 'picked_up' | 'cancelled'
  final String createdAt;

  CampusOrder({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.shopId,
    required this.shopName,
    required this.items,
    required this.totalAmount,
    required this.savingsAmount,
    this.paymentRef,
    this.qrToken,
    required this.status,
    required this.createdAt,
  });

  String get offerTitle =>
      items.isNotEmpty ? items.map((i) => i.title).join(', ') : 'Panier CampusSave';

  int get quantity =>
      items.isNotEmpty ? items.fold(0, (sum, i) => sum + i.quantity) : 1;

  String get shortCode =>
      id.length >= 6 ? 'CS-${id.substring(id.length - 6).toUpperCase()}' : id;

  factory CampusOrder.fromJson(Map<String, dynamic> json) {
    final rawItems = (json['items'] as List<dynamic>? ?? [])
        .map((e) => OrderLineItem.fromJson(e as Map<String, dynamic>))
        .toList();
    final saved = rawItems.fold<double>(
      0,
          (s, i) => s + ((i.originalPrice - i.unitPrice).clamp(0, 9999) * i.quantity),
    );
    return CampusOrder(
      id: (json['id'] ?? '').toString(),
      studentId: (json['studentId'] ?? '').toString(),
      studentName: (json['studentName'] ?? '').toString(),
      shopId: (json['shopId'] ?? '').toString(),
      shopName: (json['shopName'] ?? '').toString(),
      items: rawItems,
      totalAmount: ((json['total'] ?? json['totalAmount'] ?? 0) as num).toDouble(),
      savingsAmount: saved > 0 ? saved : ((json['savingsAmount'] ?? 0) as num).toDouble(),
      paymentRef: json['paymentRef']?.toString(),
      qrToken: json['qrToken']?.toString(),
      status: (json['status'] ?? 'pending_payment').toString(),
      createdAt: (json['createdAt'] ?? '').toString(),
    );
  }
}

class StudentStats {
  final int totalOrders;
  final int paidOrders;
  final int pickedUpOrders;
  final double totalSpent;
  final double totalSaved;

  StudentStats({
    required this.totalOrders,
    required this.paidOrders,
    required this.pickedUpOrders,
    required this.totalSpent,
    required this.totalSaved,
  });

  factory StudentStats.fromJson(Map<String, dynamic> json) {
    return StudentStats(
      totalOrders: ((json['totalOrders'] ?? 0) as num).toInt(),
      paidOrders: ((json['paidOrders'] ?? 0) as num).toInt(),
      pickedUpOrders: ((json['pickedUpOrders'] ?? 0) as num).toInt(),
      totalSpent: ((json['totalSpent'] ?? 0) as num).toDouble(),
      totalSaved: ((json['totalSaved'] ?? 0) as num).toDouble(),
    );
  }
}

class AdminStats {
  final int totalUsers;
  final int students;
  final int merchants;
  final int totalShops;
  final int pendingShops;
  final int approvedShops;
  final int totalOrders;
  final int pickedUpOrders;
  final double revenue;
  final int itemsRescued;

  AdminStats({
    required this.totalUsers,
    required this.students,
    required this.merchants,
    required this.totalShops,
    required this.pendingShops,
    required this.approvedShops,
    required this.totalOrders,
    required this.pickedUpOrders,
    required this.revenue,
    required this.itemsRescued,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    final u = (json['users'] as Map<String, dynamic>?) ?? {};
    final s = (json['shops'] as Map<String, dynamic>?) ?? {};
    final o = (json['orders'] as Map<String, dynamic>?) ?? {};
    return AdminStats(
      totalUsers: ((u['total'] ?? 0) as num).toInt(),
      students: ((u['students'] ?? 0) as num).toInt(),
      merchants: ((u['merchants'] ?? 0) as num).toInt(),
      totalShops: ((s['total'] ?? 0) as num).toInt(),
      pendingShops: ((s['pending'] ?? 0) as num).toInt(),
      approvedShops: ((s['approved'] ?? 0) as num).toInt(),
      totalOrders: ((o['total'] ?? 0) as num).toInt(),
      pickedUpOrders: ((o['pickedUp'] ?? 0) as num).toInt(),
      revenue: ((json['revenue'] ?? 0) as num).toDouble(),
      itemsRescued: ((json['itemsRescued'] ?? 0) as num).toInt(),
    );
  }
}
