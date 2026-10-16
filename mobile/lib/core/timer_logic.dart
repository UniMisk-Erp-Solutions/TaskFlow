import 'kanban.dart' show columnFor;
import 'models.dart';

enum Period { all, week, month }

DateTime startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

DateTime? periodStart(Period period, DateTime now) {
  switch (period) {
    case Period.week:
      final day = startOfDay(now);
      return day.subtract(Duration(days: (day.weekday + 6) % 7));
    case Period.month:
      return DateTime(now.year, now.month, 1);
    case Period.all:
      return null;
  }
}

class Segment {
  Segment(this.id, this.start, this.end, this.fromSec, this.toSec);
  final String id;
  final DateTime start;
  final DateTime? end;
  final int fromSec;
  final int toSec;
}

class TaskRow {
  TaskRow({
    required this.key,
    required this.task,
    required this.personId,
    required this.seconds,
    required this.active,
    required this.rank,
    required this.label,
    required this.tracked,
    required this.startedAt,
    required this.endedAt,
    required this.segments,
  });

  final String key;
  final Task task;
  final String personId;
  final int seconds;
  final bool active;
  final int rank; // 0 in progress, 1 to do, 2 review/rejected, 3 completed
  final String label;
  final bool tracked;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final List<Segment> segments;
}

class PersonCardData {
  PersonCardData(this.personId, this.rows, this.totalSeconds, this.averageSeconds);
  final String personId;
  final List<TaskRow> rows;
  final int totalSeconds;
  final int? averageSeconds;
}

class Bar {
  Bar(this.id, this.label, this.seconds);
  final String id;
  final String label;
  final double seconds;
}

class Analytics {
  Analytics({
    required this.sessions,
    required this.total,
    required this.running,
    required this.cards,
    required this.taskBars,
    required this.personBars,
  });

  final List<TimerSession> sessions;
  final int total;
  final int running;
  final List<PersonCardData> cards;
  final List<Bar> taskBars;
  final List<Bar> personBars;
}

(int, String, bool) _group(Task task, bool active) {
  if (task.status == 'completed') return (3, 'Completed', true);
  if (task.status == 'submitted') return (2, 'Under review', true);
  if (task.status == 'rejected') return (2, 'Rejected', true);
  final col = task.kanbanColumn ?? columnFor(task);
  if (active || col == 'in_progress' || task.status == 'in_progress') {
    return (0, active ? 'Running' : 'In progress', true);
  }
  return (1, col == 'backlog' ? 'Backlog' : 'To do', false);
}

/// Sessions limited to the period start (and a person) so all figures stay consistent.
List<TimerSession> scopeSessions(List<TimerSession> all, Period period, String? personId, DateTime now) {
  final start = periodStart(period, now);
  final out = <TimerSession>[];
  for (final s in all) {
    if (personId != null && s.userId != personId) continue;
    if (start == null) {
      out.add(s);
      continue;
    }
    final end = s.endedAt ?? now;
    if (!end.isAfter(start)) continue;
    out.add(s.clippedFrom(start));
  }
  return out;
}

Analytics buildAnalytics({
  required List<Task> tasks,
  required List<TimerSession> allSessions,
  required Period period,
  required String? personId,
  required DateTime now,
  required String viewerId,
  required bool isAdmin,
  required List<String> memberIds,
  required Map<String, String> names,
}) {
  final sessions = scopeSessions(allSessions, period, isAdmin ? personId : viewerId, now);
  final byPersonTask = <String, int>{};
  final byTask = <String, int>{};
  final byPerson = <String, int>{};
  final activeKeys = <String>{};
  var total = 0;
  var running = 0;
  for (final s in sessions) {
    final sec = s.seconds(now);
    total += sec;
    final key = '${s.taskId}:${s.userId}';
    if (s.endedAt == null) {
      running += 1;
      activeKeys.add(key);
    }
    byTask[s.taskId] = (byTask[s.taskId] ?? 0) + sec;
    byPerson[s.userId] = (byPerson[s.userId] ?? 0) + sec;
    byPersonTask[key] = (byPersonTask[key] ?? 0) + sec;
  }

  // Real start/end and session readings come from unclipped data.
  final firstStart = <String, DateTime>{};
  final lastEnd = <String, DateTime>{};
  final segments = <String, List<Segment>>{};
  final ordered = [...allSessions]..sort((a, b) => a.startedAt.compareTo(b.startedAt));
  for (final s in ordered) {
    final key = '${s.taskId}:${s.userId}';
    if (!firstStart.containsKey(key) || s.startedAt.isBefore(firstStart[key]!)) firstStart[key] = s.startedAt;
    if (s.endedAt != null && (!lastEnd.containsKey(key) || s.endedAt!.isAfter(lastEnd[key]!))) lastEnd[key] = s.endedAt!;
    final list = segments.putIfAbsent(key, () => []);
    final from = list.isEmpty ? 0 : list.last.toSec;
    list.add(Segment(s.id, s.startedAt, s.endedAt, from, from + s.seconds(now)));
  }

  final personIds = isAdmin
      ? (personId != null ? [personId] : {...memberIds, ...allSessions.map((s) => s.userId)}.toList())
      : [viewerId];

  final cards = <PersonCardData>[];
  for (final pid in personIds) {
    final rows = <TaskRow>[];
    for (final task in tasks) {
      final key = '${task.id}:$pid';
      final assigned = task.assigneeIds.contains(pid) || byPersonTask.containsKey(key) || segments.containsKey(key);
      if (!assigned) continue;
      final seconds = byPersonTask[key] ?? 0;
      final active = activeKeys.contains(key);
      if (period != Period.all && seconds == 0 && !active) continue;
      final g = _group(task, active);
      final finished = task.status == 'completed' || task.status == 'submitted';
      DateTime? endedAt;
      if (finished) {
        endedAt = DateTime.tryParse(task.workEndedAt ?? '')?.toLocal() ?? lastEnd[key];
      }
      rows.add(TaskRow(
        key: key,
        task: task,
        personId: pid,
        seconds: seconds,
        active: active,
        rank: g.$1,
        label: g.$2,
        tracked: g.$3,
        startedAt: firstStart[key],
        endedAt: endedAt,
        segments: segments[key] ?? const [],
      ));
    }
    rows.sort((a, b) => a.rank != b.rank ? a.rank.compareTo(b.rank) : a.task.title.compareTo(b.task.title));
    final completed = rows.where((r) => r.task.status == 'completed' && r.seconds > 0).toList();
    final completedSeconds = completed.fold<int>(0, (sum, r) => sum + r.seconds);
    cards.add(PersonCardData(
      pid,
      rows,
      rows.fold<int>(0, (sum, r) => sum + r.seconds),
      completed.isEmpty ? null : completedSeconds ~/ completed.length,
    ));
  }

  final taskBars = tasks
      .map((t) => Bar(t.id, t.title, (byTask[t.id] ?? 0).toDouble()))
      .where((b) => b.seconds > 0)
      .toList()
    ..sort((a, b) => b.seconds.compareTo(a.seconds));
  final personBars = byPerson.entries
      .map((e) => Bar(e.key, names[e.key] ?? 'Member', e.value.toDouble()))
      .toList()
    ..sort((a, b) => b.seconds.compareTo(a.seconds));

  return Analytics(
    sessions: sessions,
    total: total,
    running: running,
    cards: cards.where((c) => c.rows.isNotEmpty || !isAdmin).toList(),
    taskBars: taskBars,
    personBars: personBars,
  );
}

class Bucket {
  Bucket(this.label, this.seconds);
  final String label;
  final double seconds;
}

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/// Seconds per day (week/month) or per week (all time).
List<Bucket> timeBuckets(List<TimerSession> sessions, Period period, DateTime now) {
  final weekly = period == Period.all;
  DateTime keyOf(DateTime d) {
    final day = startOfDay(d);
    return weekly ? day.subtract(Duration(days: (day.weekday + 6) % 7)) : day;
  }

  final sums = <int, double>{};
  var earliest = now;
  for (final s in sessions) {
    final end = s.endedAt ?? now;
    if (!end.isAfter(s.startedAt)) continue;
    if (s.startedAt.isBefore(earliest)) earliest = s.startedAt;
    var cursor = s.startedAt;
    while (cursor.isBefore(end)) {
      final nextDay = startOfDay(cursor).add(const Duration(days: 1));
      final chunkEnd = end.isBefore(nextDay) ? end : nextDay;
      final k = keyOf(cursor).millisecondsSinceEpoch;
      sums[k] = (sums[k] ?? 0) + chunkEnd.difference(cursor).inMilliseconds / 1000;
      cursor = chunkEnd;
    }
  }

  final start = periodStart(period, now) ?? keyOf(earliest);
  final DateTime last;
  switch (period) {
    case Period.week:
      last = start.add(const Duration(days: 6));
    case Period.month:
      last = DateTime(start.year, start.month + 1, 0);
    case Period.all:
      last = keyOf(now);
  }

  final out = <Bucket>[];
  for (var d = start; !d.isAfter(last); d = DateTime(d.year, d.month, d.day + (weekly ? 7 : 1))) {
    final label = weekly
        ? '${d.day} ${_months[d.month - 1]}'
        : (period == Period.week ? _weekdays[(d.weekday + 6) % 7] : '${d.day}');
    out.add(Bucket(label, sums[keyOf(d).millisecondsSinceEpoch] ?? 0));
  }
  return weekly && out.length > 12 ? out.sublist(out.length - 12) : out;
}

/// Seconds worked per hour of day (0-23).
List<Bucket> hourBuckets(List<TimerSession> sessions, DateTime now) {
  final sums = List<double>.filled(24, 0);
  for (final s in sessions) {
    final end = s.endedAt ?? now;
    if (!end.isAfter(s.startedAt)) continue;
    var cursor = s.startedAt;
    while (cursor.isBefore(end)) {
      final nextHour = DateTime(cursor.year, cursor.month, cursor.day, cursor.hour + 1);
      final chunkEnd = end.isBefore(nextHour) ? end : nextHour;
      sums[cursor.hour] += chunkEnd.difference(cursor).inMilliseconds / 1000;
      cursor = chunkEnd;
    }
  }
  return List.generate(24, (h) => Bucket('${h % 12 == 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}', sums[h]));
}
