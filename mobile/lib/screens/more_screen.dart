import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final profile = auth.profile!;
    final items = <(IconData, String, String, String, bool)>[
      (Icons.folder_outlined, 'Projects', 'Progress and project work', '/projects', false),
      (Icons.calendar_month_outlined, 'Calendar', 'Due dates and meetings', '/calendar', false),
      (Icons.chat_bubble_outline, 'Chat', 'Team and direct messages', '/chat', false),
      (Icons.auto_awesome_outlined, 'AI assistant', 'Ask or create with a prompt', '/assistant', false),
      (Icons.history, 'File activity', 'Who did what in Files', '/activity', false),
      (Icons.draw_outlined, 'Whiteboard', 'Boards you can access', '/whiteboard', false),
      (Icons.groups_outlined, 'Team', 'People and join requests', '/users', true),
      (Icons.campaign_outlined, 'Reminders', 'Nudge people about due work', '/reminders', true),
      (Icons.notifications_outlined, 'Notifications', 'Choose what alerts you', '/notifications', false),
      (Icons.person_outline, 'Profile', 'Your details and appearance', '/profile', false),
    ];
    return ListView(padding: kPad, children: [
      const Gap(8),
      const Text('More', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
      const Gap(14),
      AppCard(
        onTap: () => context.push('/profile'),
        child: Row(children: [
          Avatar(profile.displayName, size: 54),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(profile.displayName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              Text(profile.email, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: context.app.muted)),
            ]),
          ),
          Pill(profile.isAdmin ? 'Admin' : 'Employee', tone: Tone.primary),
        ]),
      ),
      const Gap(14),
      for (final (icon, label, hint, path, adminOnly) in items)
        if (!adminOnly || auth.isAdmin)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              onTap: () => context.push(path),
              child: Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: context.cs.primary.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
                  child: Icon(icon, color: context.cs.primary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(hint, style: TextStyle(fontSize: 12, color: context.app.muted)),
                  ]),
                ),
                Icon(Icons.chevron_right, color: context.app.muted),
              ]),
            ),
          ),
    ]);
  }
}
