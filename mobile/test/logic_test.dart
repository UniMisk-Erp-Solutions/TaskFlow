import 'package:flutter_test/flutter_test.dart';
import 'package:taskflow/core/format.dart';
import 'package:taskflow/core/kanban.dart';
import 'package:taskflow/core/models.dart';
import 'package:taskflow/core/timer_logic.dart';

Task task(String id, Map<String, dynamic> extra) => Task({'id': id, 'title': 'Task $id', 'status': 'pending', ...extra});

void main() {
  test('duration is whole numbers in hours and days', () {
    expect(duration(9 * 3600 + 21 * 60), '9h 21m');
    expect(duration(25 * 3600, days: true), '1d 1h');
    expect(duration(25 * 3600), '25h');
    expect(duration(193 * 3600 + 53 * 60, days: true), '8d 1h');
    expect(duration(48 * 3600, days: true), '2d');
    expect(duration(40 * 60), '40m');
  });

  test('clock formats like a stopwatch', () {
    expect(clock(0), '0:00');
    expect(clock(600), '10:00');
    expect(clock(3725), '1:02:05');
  });

  test('kanban column falls back to status', () {
    expect(columnFor(task('1', {'status': 'submitted'})), 'done');
    expect(columnFor(task('2', {'status': 'blocked'})), 'backlog');
    expect(columnFor(task('3', {'status': 'in_progress'})), 'in_progress');
    expect(columnFor(task('4', {'kanban_column': 'to_do'})), 'to_do');
    expect(columnFor(task('5', {})), 'to_do');
  });

  test('approved tasks expire after one minute', () {
    final now = DateTime.now();
    final fresh = task('1', {'status': 'completed', 'kanban_approved_at': now.subtract(const Duration(seconds: 20)).toUtc().toIso8601String()});
    final old = task('2', {'status': 'completed', 'kanban_approved_at': now.subtract(const Duration(minutes: 5)).toUtc().toIso8601String()});
    expect(approvedTimeLeftMs(fresh, now)! > 30000, isTrue);
    expect(approvedTimeLeftMs(old, now), 0);
    expect(approvedTimeLeftMs(task('3', {'status': 'pending'}), now), isNull);
  });

  test('session history keeps a running timer reading across pauses', () {
    final now = DateTime(2026, 10, 16, 12);
    final t = task('t1', {
      'status': 'completed',
      'assignee_ids': ['u1'],
      'work_ended_at': DateTime(2026, 10, 16, 11, 30).toUtc().toIso8601String(),
    });
    final sessions = [
      TimerSession(id: 'a', taskId: 't1', userId: 'u1', startedAt: DateTime(2026, 10, 16, 9), endedAt: DateTime(2026, 10, 16, 9, 10)),
      TimerSession(id: 'b', taskId: 't1', userId: 'u1', startedAt: DateTime(2026, 10, 16, 10), endedAt: DateTime(2026, 10, 16, 10, 20)),
    ];
    final result = buildAnalytics(
      tasks: [t],
      allSessions: sessions,
      period: Period.all,
      personId: null,
      now: now,
      viewerId: 'u1',
      isAdmin: false,
      memberIds: const ['u1'],
      names: const {'u1': 'Una'},
    );
    final row = result.cards.single.rows.single;
    expect(row.seconds, 30 * 60);
    expect(row.segments[0].fromSec, 0);
    expect(row.segments[0].toSec, 600);
    expect(row.segments[1].fromSec, 600);
    expect(row.segments[1].toSec, 1800);
    expect(row.rank, 3);
    expect(result.total, 1800);
  });

  test('week period clips sessions that started before the week', () {
    final now = DateTime(2026, 10, 16, 12); // Friday
    final start = periodStart(Period.week, now)!;
    expect(start.weekday, DateTime.monday);
    final s = TimerSession(
      id: 'a',
      taskId: 't',
      userId: 'u',
      startedAt: start.subtract(const Duration(hours: 2)),
      endedAt: start.add(const Duration(hours: 1)),
    );
    final scoped = scopeSessions([s], Period.week, null, now);
    expect(scoped.single.seconds(now), 3600);
  });

  test('hour buckets split work across hours', () {
    final now = DateTime(2026, 10, 16, 18);
    final s = TimerSession(id: 'a', taskId: 't', userId: 'u', startedAt: DateTime(2026, 10, 16, 9, 30), endedAt: DateTime(2026, 10, 16, 10, 30));
    final buckets = hourBuckets([s], now);
    expect(buckets[9].seconds, 1800);
    expect(buckets[10].seconds, 1800);
  });
}
