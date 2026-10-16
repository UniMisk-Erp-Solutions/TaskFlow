import 'package:flutter/material.dart';

import '../core/api.dart';
import '../ui/theme.dart';

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});
  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  final List<(bool, String)> _messages = [(false, 'Hi! Ask me about your tasks and meetings, or tell me what to create or update.')];
  bool _busy = false;

  static const _suggestions = ['What is overdue?', 'Summarize my tasks this week', 'Create a task to review the report tomorrow'];

  Future<void> _ask(String question) async {
    final q = question.trim();
    if (q.isEmpty || _busy) return;
    setState(() {
      _messages.add((true, q));
      _text.clear();
      _busy = true;
    });
    _toBottom();
    try {
      final data = await Api.instance.post('/ai/query', {'question': q});
      setState(() => _messages.add((false, '${(data as Map)['answer']}')));
    } catch (e) {
      setState(() => _messages.add((false, 'Sorry, that failed: ${errorText(e)}')));
    } finally {
      if (mounted) setState(() => _busy = false);
      _toBottom();
    }
  }

  void _toBottom() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      });

  @override
  void dispose() {
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('AI assistant')),
      body: Column(children: [
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.all(12),
            itemCount: _messages.length + (_busy ? 1 : 0),
            itemBuilder: (context, i) {
              if (i == _messages.length) return Padding(padding: const EdgeInsets.all(8), child: Text('Thinking…', style: TextStyle(color: context.app.muted)));
              final (user, text) = _messages[i];
              return Align(
                alignment: user ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.86),
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: user ? scheme.primary : scheme.surface,
                    border: user ? null : Border.all(color: context.app.border),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: SelectableText(text, style: TextStyle(color: user ? scheme.onPrimary : scheme.onSurface, height: 1.4)),
                ),
              );
            },
          ),
        ),
        if (_messages.length <= 1)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final s in _suggestions) ActionChip(label: Text(s), onPressed: () => _ask(s)),
            ]),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                child: TextField(
                  controller: _text,
                  minLines: 1,
                  maxLines: 5,
                  textInputAction: TextInputAction.send,
                  onSubmitted: _ask,
                  decoration: const InputDecoration(hintText: 'Ask anything…', isDense: true),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(onPressed: _busy ? null : () => _ask(_text.text), icon: const Icon(Icons.send, size: 20)),
            ]),
          ),
        ),
      ]),
    );
  }
}
