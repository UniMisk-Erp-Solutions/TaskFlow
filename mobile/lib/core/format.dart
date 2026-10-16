import 'package:intl/intl.dart';

DateTime? parseDate(String? value) {
  if (value == null || value.isEmpty) return null;
  final plain = RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value);
  return DateTime.tryParse(plain ? '${value}T00:00:00' : value)?.toLocal();
}

String formatDate(String? value) {
  final d = parseDate(value);
  return d == null ? '' : DateFormat('d MMM yyyy').format(d);
}

String formatDateTime(String? value, {bool seconds = false}) {
  final d = parseDate(value);
  if (d == null) return '—';
  return DateFormat(seconds ? 'd MMM yyyy, h:mm:ss a' : 'd MMM yyyy, h:mm a').format(d);
}

String formatTime12(String? value) {
  final m = RegExp(r'^(\d{2}):(\d{2})').firstMatch(value ?? '');
  if (m == null) return '';
  final h = int.parse(m.group(1)!);
  return '${((h + 11) % 12) + 1}:${m.group(2)} ${h >= 12 ? 'PM' : 'AM'}';
}

String formatSize(num? bytes) {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes < 1024) return '${bytes.toInt()} B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
  if (bytes < 1024 * 1024 * 1024) return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  return '${(bytes / 1024 / 1024 / 1024).toStringAsFixed(1)} GB';
}

/// Stopwatch reading: m:ss or h:mm:ss.
String clock(num seconds) {
  final total = seconds.isNegative ? 0 : seconds.floor();
  final h = total ~/ 3600;
  final m = (total % 3600) ~/ 60;
  final s = total % 60;
  final mm = m.toString().padLeft(2, '0');
  final ss = s.toString().padLeft(2, '0');
  return h > 0 ? '$h:$mm:$ss' : '$m:$ss';
}

/// Whole-number durations. Hours: "193h 53m". Days: "8d 1h" (a day is 24 h).
String duration(num seconds, {bool days = false}) {
  final minutes = (seconds.isNegative ? 0 : seconds.round()) ~/ 60;
  if (days) {
    final d = minutes ~/ 1440;
    final h = (minutes % 1440) ~/ 60;
    final m = minutes % 60;
    if (d > 0) return h > 0 ? '${d}d ${h}h' : '${d}d';
    if (h > 0) return m > 0 ? '${h}h ${m}m' : '${h}h';
    return '${m}m';
  }
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h > 0) return m > 0 ? '${h}h ${m}m' : '${h}h';
  return '${m}m';
}

String isoDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

String statusLabel(String status) => const {
      'pending': 'Pending',
      'in_progress': 'In progress',
      'completed': 'Completed',
      'blocked': 'Blocked',
      'submitted': 'Under review',
      'rejected': 'Rejected',
      'changes_requested': 'Changes requested',
      'scheduled': 'Scheduled',
      'cancelled': 'Cancelled',
    }[status] ??
    status.replaceAll('_', ' ');

bool isOverdue(String? dueDate, String status) {
  if (dueDate == null || dueDate.length < 10 || status == 'completed') return false;
  return dueDate.substring(0, 10).compareTo(isoDate(DateTime.now())) < 0;
}

String initialOf(String? name) {
  final t = (name ?? '').trim();
  return t.isEmpty ? '?' : t.substring(0, 1).toUpperCase();
}
