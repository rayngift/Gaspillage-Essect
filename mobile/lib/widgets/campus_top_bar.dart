import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../screens/auth/login_screen.dart';
import '../services/auth_service.dart';

class CampusTopBar extends StatelessWidget {
  final int activeIndex;
  final ValueChanged<int> onSelectTab;

  const CampusTopBar({
    super.key,
    required this.activeIndex,
    required this.onSelectTab,
  });

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final isAuth = auth.isAuthenticated;
    final firstName = (auth.profile?.displayName ?? 'Compte').split(' ').first;
    final width = MediaQuery.of(context).size.width;
    final showCenterLinks = width >= 640;

    final tabs = <(int, String)>[
      (0, 'Offres'),
      (1, 'Campus Radar'),
      if (isAuth && auth.role == 'student') ...[
        (2, 'Commandes'),
        (3, 'Impact'),
      ],
    ];

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFAFAF8),
        border: Border(bottom: BorderSide(color: Color(0xFFE5E7E1))),
      ),
      child: SafeArea(
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1240),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => onSelectTab(0),
                    borderRadius: BorderRadius.circular(6),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                      child: Text(
                        'CampusSave',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                          color: Color(0xFF111814),
                        ),
                      ),
                    ),
                  ),
                  if (showCenterLinks) ...[
                    const Spacer(),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: tabs.map((tab) {
                        final isActive = activeIndex == tab.$1;
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: InkWell(
                            onTap: () => onSelectTab(tab.$1),
                            child: Container(
                              padding: const EdgeInsets.only(bottom: 4, top: 4),
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color: isActive
                                        ? const Color(0xFF166534)
                                        : Colors.transparent,
                                    width: 2,
                                  ),
                                ),
                              ),
                              child: Text(
                                tab.$2,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: isActive
                                      ? FontWeight.w600
                                      : FontWeight.w500,
                                  color: isActive
                                      ? const Color(0xFF166534)
                                      : const Color(0xFF525C55),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const Spacer(),
                  ] else
                    const Spacer(),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF166534),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 11,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: () {
                      if (!isAuth) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const LoginScreen()),
                        );
                      } else if (auth.role == 'student') {
                        onSelectTab(3);
                      }
                    },
                    child: Text(
                      isAuth ? firstName : 'Connexion',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
