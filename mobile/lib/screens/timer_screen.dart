import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/timer_logic.dart';
import '../state/auth_state.dart';
import '../state/data_state.dart';
import '../ui/live.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

enum _Chart { task, time, person }

class TimerScreen extends StatefulWidget {
  const TimerScreen({super.key});
  @override
  State<TimerScreen> createState() => _TimerScreenState();
}

class _TimerScreenState extends State<TimerScreen> {
  Period _period = Period.all;
  bool _days = false;
  String _person = '';
  _Chart _chart = _Chart.task;
  bool _showAll = false;
  String _fmt(num seconds) => duration(seconds, days: _days);

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final auth = context.watch<AuthController>();
    final isAdmin = auth.isAdmin;
    final me = auth.profile!;
    final now = DateTime.now();

    final memberIds = <String>{
      for (final t in data.tasks) ...t.assigneeIds,
      for (final p in data.people) p.id,
    }.toList();

    final analytics = buildAnalytics(
      tasks: data.tasks,
      allSessions: data.sessions,
      period: _period,
      personId: _person.isEmpty ? null : _person,
      now: now,
      viewerId: me.id,
      isAdmin: isAdmin,
      memberIds: memberIds,
      names: data.names,
    );

    final chart = (_chart == _Chart.person && (!isAdmin || _person.isNotEmpty)) ? _Chart.task : _chart;
    final buckets = _days ? timeBuckets(analytics.sessions, _period, now) : hourBuckets(analytics.sessions, now);

    return RefreshIndicator(
      onRefresh: () => data.load(),
      child: ListView(padding: kPad, children: [
        const Gap(8),
        const Text('Timer', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
        Text('Where the time goes', style: TextStyle(fontSize: 13, color: context.app.muted)),
        const Gap(14),
        Segment2<Period>(
          value: _period,
          options: const [(Period.all, 'All time', null), (Period.week, 'This week', null), (Period.month, 'This month', null)],
          onChanged: (v) => setState(() => _period = v),
        ),
        const Gap(10),
        Row(children: [
          Expanded(
            child: Segment2<bool>(
              value: _days,
              options: const [(false, 'Hours', null), (true, 'Days', null)],
              onChanged: (v) => setState(() => _days = v),
            ),
          ),
          if (isAdmin) ...[
            const SizedBox(width: 10),
            Expanded(
              child: SelectField<String>(
                label: 'Person',
                value: _person,
                options: [('', 'Everyone'), for (final id in memberIds) (id, data.nameOf(id))],
                onChanged: (v) => setState(() => _person = v),
              ),
            ),
          ],
        ]),
        const Gap(14),
        Row(children: [
          for (final (label, value, icon) in [
            ('Tracked', analytics.total, Icons.schedule),
            ('Running', analytics.running, Icons.bolt),
            ('Tasks', analytics.taskBars.length, Icons.checklist),
          ])
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 8),
                child: AppCard(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(icon, size: 16, color: context.cs.primary),
                    const Gap(6),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: label == 'Tracked'
                          ? LiveSeconds(
                              base: value,
                              running: analytics.running > 0,
                              builder: (_, s) => Text(_fmt(s), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                            )
                          : Text('$value', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    ),
                    Text(label, style: TextStyle(fontSize: 11, color: context.app.muted)),
                  ]),
                ),
              ),
            ),
        ]),
        const Gap(12),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Segment2<_Chart>(
              value: chart,
              options: [
                (_Chart.task, 'By task', null),
                (_Chart.time, 'Over time', null),
                if (isAdmin && _person.isEmpty) (_Chart.person, 'By person', null),
              ],
              onChanged: (v) => setState(() => _chart = v),
            ),
            const Gap(16),
            if (chart == _Chart.time)
              _Columns(buckets: buckets, fmt: _fmt)
            else
              _Bars(
                bars: chart == _Chart.person ? analytics.personBars : analytics.taskBars,
                fmt: _fmt,
                showAll: _showAll,
                onToggle: () => setState(() => _showAll = !_showAll),
              ),
          ]),
        ),
        const Gap(18),
        SectionLabel(isAdmin ? 'People and task time' : 'My task time'),
        if (analytics.cards.isEmpty)
          const EmptyState(icon: Icons.timer_outlined, title: 'No tracked time yet', message: 'Start a timer from a task that is In Progress.')
        else
          for (final card in analytics.cards)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _PersonCard(
                key: ValueKey('${card.personId}-$isAdmin'),
                card: card,
                name: data.nameOf(card.personId),
                showName: isAdmin,
                fmt: _fmt,
                initiallyOpen: !isAdmin || _person.isNotEmpty,
              ),
            ),
      ]),
    );
  }
}

class _Bars extends StatelessWidget {
  const _Bars({required this.bars, required this.fmt, required this.showAll, required this.onToggle});
  final List<Bar> bars;
  final String Function(num) fmt;
  final bool showAll;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    if (bars.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Center(child: Text('No tracked time for these filters.', style: TextStyle(color: context.app.muted))),
      );
    }
    final max = bars.map((b) => b.seconds).reduce((a, b) => a > b ? a : b).clamp(1, double.infinity);
    final shown = showAll ? bars : bars.take(8).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      for (final bar in shown)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(bar.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13))),
              Text(fmt(bar.seconds), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
            ]),
            const Gap(5),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: (bar.seconds / max).clamp(0.02, 1.0),
                minHeight: 10,
                backgroundColor: context.app.surfaceAlt,
              ),
            ),
          ]),
        ),
      if (bars.length > 8)
        TextButton(onPressed: onToggle, child: Text(showAll ? 'Show top 8' : 'Show all ${bars.length}')),
    ]);
  }
}

class _Columns extends StatelessWidget {
  const _Columns({required this.buckets, required this.fmt});
  final List<Bucket> buckets;
  final String Function(num) fmt;

  @override
  Widget build(BuildContext context) {
    final peak = buckets.fold<double>(0, (m, b) => b.seconds > m ? b.seconds : m);
    if (peak <= 0) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Center(child: Text('No tracked time for these filters.', style: TextStyle(color: context.app.muted))),
      );
    }
    const height = 150.0;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Peak ${fmt(peak)}', style: TextStyle(fontSize: 11, color: context.app.muted)),
      const Gap(8),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (final b in buckets)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Column(children: [
                SizedBox(
                  height: height,
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Container(
                      width: 20,
                      height: b.seconds <= 0 ? 2 : (b.seconds / peak * height).clamp(4, height),
                      decoration: BoxDecoration(
                        color: b.seconds <= 0 ? context.app.border : context.cs.primary,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(5)),
                      ),
                    ),
                  ),
                ),
                const Gap(4),
                SizedBox(width: 28, child: Text(b.label, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.clip, style: TextStyle(fontSize: 9, color: context.app.muted))),
              ]),
            ),
        ]),
      ),
    ]);
  }
}

const _filters = <(String, String, int)>[
  ('all', 'All', -1),
  ('prog', 'In progress', 0),
  ('todo', 'To do', 1),
  ('review', 'Review', 2),
  ('done', 'Completed', 3),
];

class _PersonCard extends StatefulWidget {
  const _PersonCard({super.key, required this.card, required this.name, required this.showName, required this.fmt, required this.initiallyOpen});
  final PersonCardData card;
  final String name;
  final bool showName;
  final String Function(num) fmt;
  final bool initiallyOpen;

  @override
  State<_PersonCard> createState() => _PersonCardState();
}

class _PersonCardState extends State<_PersonCard> {
  late bool _open = widget.initiallyOpen;
  String _filter = 'all';
  int _page = 1;
  String? _expanded;

  int _count(int rank) => widget.card.rows.where((r) => r.rank == rank).length;

  @override
  Widget build(BuildContext context) {
    final rank = _filters.firstWhere((f) => f.$1 == _filter).$3;
    final rows = rank < 0 ? widget.card.rows : widget.card.rows.where((r) => r.rank == rank).toList();
    final paged = Paged<dynamic>(rows, _page);
    final fmt = widget.fmt;

    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        InkWell(
          onTap: () => setState(() => _open = !_open),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              Row(children: [
                Avatar(widget.name),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(widget.showName ? widget.name : 'My tasks', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                    const Gap(4),
                    Wrap(spacing: 6, runSpacing: 4, children: [
                      Pill('${widget.card.rows.length} tasks'),
                      if (_count(0) > 0) Pill('${_count(0)} in progress', tone: Tone.primary),
                      if (_count(2) > 0) Pill('${_count(2)} review', tone: Tone.warning),
                      if (_count(3) > 0) Pill('${_count(3)} done', tone: Tone.success),
                    ]),
                  ]),
                ),
                Icon(_open ? Icons.expand_less : Icons.expand_more, color: context.app.muted),
              ]),
              const Gap(12),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('TOTAL', style: TextStyle(fontSize: 10, color: context.app.muted)),
                  Text(fmt(widget.card.totalSeconds), style: const TextStyle(fontWeight: FontWeight.w800)),
                ]),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('AVG / COMPLETED', style: TextStyle(fontSize: 10, color: context.app.muted)),
                  Text(widget.card.averageSeconds == null ? '—' : fmt(widget.card.averageSeconds!), style: const TextStyle(fontWeight: FontWeight.w800)),
                ]),
              ]),
            ]),
          ),
        ),
        if (_open) ...[
          Divider(color: context.app.border),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ChipBar<String>(
                value: _filter,
                options: [for (final f in _filters) if (f.$3 < 0 || _count(f.$3) > 0) (f.$1, f.$2)],
                counts: {for (final f in _filters) f.$1: f.$3 < 0 ? widget.card.rows.length : _count(f.$3)},
                onChanged: (v) => setState(() {
                  _filter = v;
                  _page = 1;
                }),
              ),
              const Gap(12),
              for (final item in paged.items) _row(context, item as TaskRow, fmt),
              PagerBar(page: paged.current, pageCount: paged.pageCount, total: paged.total, onPage: (p) => setState(() => _page = p)),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _row(BuildContext context, TaskRow row, String Function(num) fmt) {
    final endTimer = row.segments.isEmpty ? 0 : row.segments.last.toSec;
    final isOpen = _expanded == row.key;
    final tone = row.rank == 3 ? Tone.success : row.rank == 2 ? Tone.warning : row.rank == 0 ? Tone.primary : Tone.neutral;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Theme.of(context).scaffoldBackgroundColor, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => context.push('/task/${row.task.id}'),
          child: Row(children: [
            Expanded(child: Text(row.task.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700))),
            const SizedBox(width: 8),
            Pill(row.label, tone: tone),
          ]),
        ),
        if (row.tracked) ...[
          const Gap(8),
          Row(children: [
            Text('Time worked', style: TextStyle(fontSize: 12, color: context.app.muted)),
            const Spacer(),
            LiveSeconds(
              base: row.seconds,
              running: row.active,
              builder: (_, sec) => Text.rich(TextSpan(children: [
                TextSpan(text: '${clock(sec)}  ', style: const TextStyle(fontWeight: FontWeight.w800)),
                TextSpan(text: '(${fmt(sec)})', style: TextStyle(fontSize: 11, color: context.app.muted)),
              ])),
            ),
          ]),
          if (row.startedAt != null)
            Text('Started ${formatDateTime(row.startedAt!.toIso8601String())} · timer 0:00', style: TextStyle(fontSize: 12, color: context.app.muted)),
          if (row.active)
            Text('Running now', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.app.success))
          else if (row.endedAt != null)
            Text('Ended ${formatDateTime(row.endedAt!.toIso8601String())} · timer ${clock(endTimer)}', style: TextStyle(fontSize: 12, color: context.app.muted)),
        ],
        if (row.segments.isNotEmpty) ...[
          const Gap(6),
          GestureDetector(
            onTap: () => setState(() => _expanded = isOpen ? null : row.key),
            child: Text('${isOpen ? 'Hide' : 'Show'} ${row.segments.length} session${row.segments.length == 1 ? '' : 's'}',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.cs.primary)),
          ),
        ],
        if (isOpen)
          for (var i = 0; i < row.segments.length; i++)
            Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.only(left: 10),
              decoration: BoxDecoration(border: Border(left: BorderSide(color: context.app.border, width: 2))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text.rich(TextSpan(children: [
                  const TextSpan(text: 'Started ', style: TextStyle(fontWeight: FontWeight.w800)),
                  TextSpan(text: '${formatDateTime(row.segments[i].start.toIso8601String(), seconds: true)} · '),
                  TextSpan(text: 'timer ${clock(row.segments[i].fromSec)}', style: TextStyle(color: context.cs.primary)),
                ]), style: const TextStyle(fontSize: 12)),
                Text.rich(TextSpan(children: [
                  TextSpan(
                      text: row.segments[i].end == null ? 'Running ' : (i == row.segments.length - 1 && row.endedAt != null ? 'Ended ' : 'Paused '),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  TextSpan(text: '${row.segments[i].end == null ? 'now' : formatDateTime(row.segments[i].end!.toIso8601String(), seconds: true)} · '),
                  TextSpan(text: 'timer ${clock(row.segments[i].toSec)}', style: TextStyle(color: context.cs.primary)),
                ]), style: const TextStyle(fontSize: 12)),
              ]),
            ),
      ]),
    );
  }
}
