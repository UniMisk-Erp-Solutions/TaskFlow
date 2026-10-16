import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../state/data_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  String _selected = isoDate(DateTime.now());

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final tasksByDay = <String, List<Task>>{};
    final meetingsByDay = <String, List<Meeting>>{};
    for (final t in data.tasks) {
      if (t.dueDate != null && t.dueDate!.length >= 10) tasksByDay.putIfAbsent(t.dueDate!.substring(0, 10), () => []).add(t);
    }
    for (final m in data.meetings) {
      if (m.date != null && m.date!.length >= 10) meetingsByDay.putIfAbsent(m.date!.substring(0, 10), () => []).add(m);
    }

    final offset = (DateTime(_month.year, _month.month, 1).weekday + 6) % 7;
    final days = DateUtils.getDaysInMonth(_month.year, _month.month);
    final cells = [for (var i = 0; i < offset; i++) null, for (var d = 1; d <= days; d++) d];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final today = isoDate(DateTime.now());
    final dayTasks = tasksByDay[_selected] ?? const <Task>[];
    final dayMeetings = meetingsByDay[_selected] ?? const <Meeting>[];

    return Scaffold(
      appBar: AppBar(title: const Text('Calendar')),
      body: ListView(padding: kPad, children: [
        AppCard(
          child: Column(children: [
            Row(children: [
              IconButton(onPressed: () => setState(() => _month = DateTime(_month.year, _month.month - 1)), icon: const Icon(Icons.chevron_left)),
              Expanded(child: Center(child: Text(DateFormat('MMMM yyyy').format(_month), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)))),
              IconButton(onPressed: () => setState(() => _month = DateTime(_month.year, _month.month + 1)), icon: const Icon(Icons.chevron_right)),
            ]),
            Row(children: [
              for (final d in const ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
                Expanded(child: Center(child: Text(d, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: context.app.muted)))),
            ]),
            const Gap(6),
            for (var row = 0; row < cells.length ~/ 7; row++)
              Row(children: [
                for (var col = 0; col < 7; col++)
                  Expanded(child: _cell(context, cells[row * 7 + col], tasksByDay, meetingsByDay, today)),
              ]),
          ]),
        ),
        const Gap(16),
        Row(children: [
          Expanded(
            child: Text(DateFormat('EEEE, d MMMM').format(DateTime.parse(_selected)), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          ),
          OutlinedButton.icon(
            onPressed: () => context.push('/meeting/new?date=$_selected'),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Meeting'),
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
          ),
        ]),
        const Gap(12),
        if (dayTasks.isEmpty && dayMeetings.isEmpty)
          const EmptyState(icon: Icons.event_available_outlined, title: 'Nothing scheduled', message: 'Tasks due and meetings on this day show up here.'),
        for (final m in dayMeetings)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              accent: context.cs.primary,
              onTap: () => context.push('/meeting/${m.id}'),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(m.time != null ? formatTime12(m.time) : 'All day', style: TextStyle(fontSize: 12, color: context.app.muted)),
                  ]),
                ),
                const Pill('Meeting', tone: Tone.primary, icon: Icons.videocam_outlined),
              ]),
            ),
          ),
        for (final t in dayTasks)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              accent: context.app.warning,
              onTap: () => context.push('/task/${t.id}'),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    if (t.dueTime != null) Text('by ${formatTime12(t.dueTime)}', style: TextStyle(fontSize: 12, color: context.app.muted)),
                  ]),
                ),
                const Pill('Due', tone: Tone.warning, icon: Icons.flag_outlined),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _cell(BuildContext context, int? day, Map<String, List<Task>> tasks, Map<String, List<Meeting>> meetings, String today) {
    if (day == null) return const SizedBox(height: 46);
    final key = isoDate(DateTime(_month.year, _month.month, day));
    final selected = key == _selected;
    final hasTasks = tasks.containsKey(key);
    final hasMeetings = meetings.containsKey(key);
    return GestureDetector(
      onTap: () => setState(() => _selected = key),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        height: 46,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? context.cs.primary : null,
              shape: BoxShape.circle,
              border: key == today && !selected ? Border.all(color: context.cs.primary, width: 1.5) : null,
            ),
            child: Text('$day',
                style: TextStyle(
                  fontWeight: selected || hasTasks || hasMeetings ? FontWeight.w800 : FontWeight.w400,
                  color: selected ? context.cs.onPrimary : null,
                )),
          ),
          SizedBox(
            height: 6,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (hasTasks) Container(width: 5, height: 5, margin: const EdgeInsets.symmetric(horizontal: 1), decoration: BoxDecoration(color: context.app.warning, shape: BoxShape.circle)),
              if (hasMeetings) Container(width: 5, height: 5, margin: const EdgeInsets.symmetric(horizontal: 1), decoration: BoxDecoration(color: context.cs.primary, shape: BoxShape.circle)),
            ]),
          ),
        ]),
      ),
    );
  }
}
