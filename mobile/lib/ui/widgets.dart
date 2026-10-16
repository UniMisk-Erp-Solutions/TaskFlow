import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/env.dart';
import '../core/format.dart';
import 'live.dart';
import 'theme.dart';

/// Standard page padding, with room for the bottom navigation.
const kPad = EdgeInsets.fromLTRB(16, 8, 16, 32);

class Gap extends StatelessWidget {
  const Gap(this.size, {super.key});
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(height: size, width: size);
}

class PageTitle extends StatelessWidget {
  const PageTitle(this.title, {super.key, this.subtitle, this.actions = const []});
  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
            if (subtitle != null) Text(subtitle!, style: TextStyle(fontSize: 13, color: context.app.muted)),
          ]),
        ),
        ...actions,
      ]),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(text.toUpperCase(),
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: context.app.muted)),
      );
}

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(16), this.accent});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(16);
    return RepaintBoundary(child: Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Container(
          decoration: accent == null ? null : BoxDecoration(border: Border(left: BorderSide(color: accent!, width: 4))),
          padding: padding,
          child: child,
        ),
      ),
    ));
  }
}

enum Tone { neutral, primary, success, warning, danger, info }

class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.tone = Tone.neutral, this.icon});
  final String label;
  final Tone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    final p = context.cs.primary;
    final (bg, fg) = switch (tone) {
      Tone.neutral => (a.surfaceAlt, a.muted),
      Tone.primary => (p.withValues(alpha: 0.14), p),
      Tone.success => (a.successSoft, a.success),
      Tone.warning => (a.warningSoft, a.warning),
      Tone.danger => (a.dangerSoft, a.danger),
      Tone.info => (a.infoSoft, a.info),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 11, color: fg), const SizedBox(width: 4)],
        Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

Tone statusTone(String status) => switch (status) {
      'in_progress' || 'scheduled' => Tone.primary,
      'submitted' => Tone.warning,
      'completed' => Tone.success,
      'rejected' || 'changes_requested' || 'blocked' => Tone.danger,
      _ => Tone.neutral,
    };

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) => Pill(statusLabel(status), tone: statusTone(status));
}

class PriorityPill extends StatelessWidget {
  const PriorityPill(this.priority, {super.key});
  final String priority;
  @override
  Widget build(BuildContext context) => Pill(
        priority == 'high' ? 'High' : priority == 'low' ? 'Low' : 'Medium',
        tone: priority == 'high' ? Tone.danger : priority == 'low' ? Tone.info : Tone.success,
      );
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 40});
  final String? name;
  final double size;
  @override
  Widget build(BuildContext context) {
    final p = context.cs.primary;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: p.withValues(alpha: 0.14), shape: BoxShape.circle),
      child: Text(initialOf(name), style: TextStyle(color: p, fontWeight: FontWeight.w800, fontSize: size * 0.4)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.message, this.action});
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(color: context.cs.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
          child: Icon(icon, color: context.cs.primary, size: 26),
        ),
        const Gap(12),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        if (message != null) ...[
          const Gap(4),
          Text(message!, textAlign: TextAlign.center, style: TextStyle(color: context.app.muted, fontSize: 13)),
        ],
        if (action != null) ...[const Gap(12), action!],
      ]),
    );
  }
}

class Banner_ extends StatelessWidget {
  const Banner_(this.message, {super.key, this.tone = Tone.danger, this.onClose});
  final String message;
  final Tone tone;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final a = context.app;
    final (bg, fg, icon) = switch (tone) {
      Tone.success => (a.successSoft, a.success, Icons.check_circle_outline),
      Tone.warning => (a.warningSoft, a.warning, Icons.warning_amber_rounded),
      Tone.info => (a.infoSoft, a.info, Icons.info_outline),
      _ => (a.dangerSoft, a.danger, Icons.error_outline),
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: fg, size: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(message, style: TextStyle(color: fg, fontSize: 13, fontWeight: FontWeight.w500))),
        if (onClose != null) GestureDetector(onTap: onClose, child: Icon(Icons.close, size: 18, color: fg)),
      ]),
    );
  }
}

class Loader extends StatelessWidget {
  const Loader({super.key});
  @override
  Widget build(BuildContext context) => const SkeletonList(count: 3);
}

class SearchField extends StatelessWidget {
  const SearchField({super.key, required this.controller, this.hint = 'Search', this.onChanged});
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: const Icon(Icons.search, size: 20),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close, size: 18),
                onPressed: () {
                  controller.clear();
                  onChanged?.call('');
                }),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
      ),
    );
  }
}

/// Horizontal filter chips.
class ChipBar<T> extends StatelessWidget {
  const ChipBar({super.key, required this.value, required this.options, required this.onChanged, this.counts, this.equalWidth = false});
  final bool equalWidth;
  final T value;
  final List<(T, String)> options;
  final ValueChanged<T> onChanged;
  final Map<T, int>? counts;

  @override
  Widget build(BuildContext context) {
    if (equalWidth) {
      return Row(children: [
        for (var i = 0; i < options.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: _EqualChip(
              label: options[i].$2,
              count: counts?[options[i].$1],
              selected: options[i].$1 == value,
              onTap: () => onChanged(options[i].$1),
            ),
          ),
        ],
      ]);
    }
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: options.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final (v, label) = options[i];
          final selected = v == value;
          final count = counts?[v];
          return ChoiceChip(
            selected: selected,
            showCheckmark: false,
            label: Text(count == null ? label : '$label  $count'),
            onSelected: (_) => onChanged(v),
          );
        },
      ),
    );
  }
}

class Segment2<T> extends StatelessWidget {
  const Segment2({super.key, required this.value, required this.options, required this.onChanged});
  final T value;
  final List<(T, String, IconData?)> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: SegmentedButton<T>(
        showSelectedIcon: false,
        style: SegmentedButton.styleFrom(visualDensity: VisualDensity.compact),
        segments: [
          for (final (v, label, icon) in options)
            ButtonSegment<T>(value: v, label: Text(label), icon: icon == null ? null : Icon(icon, size: 16)),
        ],
        selected: {value},
        onSelectionChanged: (s) => onChanged(s.first),
      ),
    );
  }
}

class PagerBar extends StatelessWidget {
  const PagerBar({super.key, required this.page, required this.pageCount, required this.total, required this.onPage});
  final int page;
  final int pageCount;
  final int total;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    if (total <= Env.pageSize) return const SizedBox.shrink();
    final from = (page - 1) * Env.pageSize + 1;
    final to = (page * Env.pageSize).clamp(0, total);
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        Text('$from–$to of $total', style: TextStyle(fontSize: 12, color: context.app.muted)),
        const Spacer(),
        IconButton(onPressed: page > 1 ? () => onPage(page - 1) : null, icon: const Icon(Icons.chevron_left)),
        Text('$page / $pageCount', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        IconButton(onPressed: page < pageCount ? () => onPage(page + 1) : null, icon: const Icon(Icons.chevron_right)),
      ]),
    );
  }
}

/// Splits a list into pages of [Env.pageSize].
class Paged<T> {
  Paged(List<T> items, this.page)
      : total = items.length,
        pageCount = (items.length / Env.pageSize).ceil().clamp(1, 1 << 30) {
    final current = page.clamp(1, pageCount);
    this.items = items.skip((current - 1) * Env.pageSize).take(Env.pageSize).toList();
    this.current = current;
  }
  final int page;
  final int total;
  final int pageCount;
  late final List<T> items;
  late final int current;
}

/// Bottom sheet with title and scrollable body.
Future<R?> showSheet<R>(BuildContext context, {required String title, required Widget Function(BuildContext) builder, Widget? footer}) {
  return showModalBottomSheet<R>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 8, 4),
          child: Row(children: [
            Expanded(child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
            IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close)),
          ]),
        ),
        Flexible(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 16), child: builder(ctx))),
        if (footer != null) Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 16), child: footer),
      ]),
    ),
  );
}

/// Single selection through a bottom sheet.
class SelectField<T> extends StatelessWidget {
  const SelectField({super.key, required this.label, required this.value, required this.options, required this.onChanged, this.placeholder = 'Select'});
  final String? label;
  final T value;
  final List<(T, String)> options;
  final ValueChanged<T> onChanged;
  final String placeholder;

  @override
  Widget build(BuildContext context) {
    final current = options.where((o) => o.$1 == value).map((o) => o.$2).firstOrNull;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => showSheet<void>(context, title: label ?? placeholder, builder: (ctx) {
        return Column(children: [
          for (final (v, text) in options)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(text, style: TextStyle(fontWeight: v == value ? FontWeight.w800 : FontWeight.w400, color: v == value ? context.cs.primary : null)),
              trailing: v == value ? Icon(Icons.check, color: context.cs.primary) : null,
              onTap: () {
                Navigator.pop(ctx);
                onChanged(v);
              },
            ),
        ]);
      }),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, suffixIcon: const Icon(Icons.expand_more)),
        child: Text(current ?? placeholder, style: TextStyle(color: current == null ? context.app.muted : null)),
      ),
    );
  }
}

/// Multi selection (assignees) through a bottom sheet.
class MultiSelectField extends StatelessWidget {
  const MultiSelectField({super.key, required this.label, required this.values, required this.options, required this.onChanged});
  final String label;
  final List<String> values;
  final List<(String, String)> options;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    final summary = options.where((o) => values.contains(o.$1)).map((o) => o.$2).join(', ');
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final selected = [...values];
        await showSheet<void>(context, title: label, footer: Builder(builder: (ctx) {
          return FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done'));
        }), builder: (ctx) {
          return StatefulBuilder(builder: (ctx, setState) {
            return Column(children: [
              for (final (id, name) in options)
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: selected.contains(id),
                  title: Row(children: [Avatar(name, size: 30), const SizedBox(width: 10), Expanded(child: Text(name))]),
                  onChanged: (on) {
                    setState(() => on == true ? selected.add(id) : selected.remove(id));
                    onChanged([...selected]);
                  },
                ),
            ]);
          });
        });
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, suffixIcon: const Icon(Icons.group_outlined)),
        child: Text(summary.isEmpty ? 'Select people' : summary,
            maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: summary.isEmpty ? context.app.muted : null)),
      ),
    );
  }
}

/// Date picker field returning yyyy-MM-dd ('' when cleared).
class DateField extends StatelessWidget {
  const DateField({super.key, required this.label, required this.value, required this.onChanged, this.clearable = true, this.lastDate});
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  final bool clearable;
  final DateTime? lastDate;

  @override
  Widget build(BuildContext context) {
    final date = parseDate(value);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: date ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: lastDate ?? DateTime(2100),
        );
        if (picked != null) onChanged(isoDate(picked));
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
          suffixIcon: clearable && value.isNotEmpty ? IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => onChanged('')) : null,
        ),
        child: Text(date == null ? 'Not set' : DateFormat('EEE, d MMM yyyy').format(date),
            style: TextStyle(color: date == null ? context.app.muted : null)),
      ),
    );
  }
}

/// Time picker field returning HH:mm ('' when cleared).
class TimeField extends StatelessWidget {
  const TimeField({super.key, required this.label, required this.value, required this.onChanged});
  final String label;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final m = RegExp(r'^(\d{2}):(\d{2})').firstMatch(value);
        final initial = m == null ? const TimeOfDay(hour: 17, minute: 0) : TimeOfDay(hour: int.parse(m.group(1)!), minute: int.parse(m.group(2)!));
        final picked = await showTimePicker(context: context, initialTime: initial);
        if (picked != null) {
          onChanged('${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: const Icon(Icons.schedule, size: 18),
          suffixIcon: value.isNotEmpty ? IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => onChanged('')) : null,
        ),
        child: Text(value.isEmpty ? 'Not set' : formatTime12(value), style: TextStyle(color: value.isEmpty ? context.app.muted : null)),
      ),
    );
  }
}

void toast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating));
}

Future<bool> confirm(BuildContext context, {required String title, required String message, String action = 'Delete', bool destructive = true}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: destructive ? FilledButton.styleFrom(backgroundColor: ctx.app.danger) : null,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(action),
        ),
      ],
    ),
  );
  return result ?? false;
}

class _EqualChip extends StatelessWidget {
  const _EqualChip({required this.label, required this.count, required this.selected, required this.onTap});
  final String label;
  final int? count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cs = context.cs;
    return Material(
      color: selected ? cs.primary : cs.surface,
      shape: StadiumBorder(side: BorderSide(color: selected ? cs.primary : context.app.border)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: selected ? cs.onPrimary : cs.onSurface)),
              if (count != null)
                Text('$count', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: selected ? cs.onPrimary.withValues(alpha: 0.85) : context.app.muted)),
            ]),
          ),
        ),
      ),
    );
  }
}
