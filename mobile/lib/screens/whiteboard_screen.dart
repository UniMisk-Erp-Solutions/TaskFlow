import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/format.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

/// Boards are drawn with the web whiteboard editor; this screen lists the boards you can reach.
class WhiteboardScreen extends StatefulWidget {
  const WhiteboardScreen({super.key});
  @override
  State<WhiteboardScreen> createState() => _WhiteboardScreenState();
}

class _WhiteboardScreenState extends State<WhiteboardScreen> {
  List<Map<String, dynamic>> _boards = [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final rows = await Supabase.instance.client.from('whiteboards').select('id, name, visibility, owner_id, updated_at').order('updated_at', ascending: false);
      if (mounted) {
        setState(() {
          _boards = (rows as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _error = '';
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Whiteboard')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: kPad, children: [
          const Banner_('Drawing and live collaboration happen in the TaskFlow web app. Your boards are listed here.', tone: Tone.info),
          if (_error.isNotEmpty) ...[const Gap(12), Banner_(_error)],
          const Gap(12),
          if (_loading)
            const Loader()
          else if (_boards.isEmpty)
            const EmptyState(icon: Icons.draw_outlined, title: 'No whiteboards yet')
          else
            for (final b in _boards)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  child: Row(children: [
                    Icon(Icons.draw_outlined, color: context.cs.primary),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${b['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        if (b['updated_at'] != null) Text('Updated ${formatDateTime('${b['updated_at']}')}', style: TextStyle(fontSize: 12, color: context.app.muted)),
                      ]),
                    ),
                    Pill(b['visibility'] == 'public' ? 'Public' : 'Private', tone: b['visibility'] == 'public' ? Tone.success : Tone.neutral),
                  ]),
                ),
              ),
        ]),
      ),
    );
  }
}
