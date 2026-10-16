String? _s(dynamic v) => v == null ? null : '$v';
List<String> _ids(dynamic v) => v is List ? v.map((e) => '$e').toList() : const [];

class Profile {
  Profile({
    required this.id,
    required this.email,
    this.fullName,
    this.phone,
    required this.role,
    this.orgId,
    this.status = 'active',
    this.orgCode,
  });

  final String id;
  final String email;
  final String? fullName;
  final String? phone;
  final String role;
  final String? orgId;
  final String status;
  final String? orgCode;

  bool get isAdmin => role == 'admin';
  String get displayName => (fullName != null && fullName!.trim().isNotEmpty) ? fullName! : email;

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
        id: '${j['id']}',
        email: _s(j['email']) ?? '',
        fullName: _s(j['full_name']),
        phone: _s(j['phone']),
        role: _s(j['role']) ?? 'employee',
        orgId: _s(j['org_id']),
        status: _s(j['status']) ?? 'active',
        orgCode: _s(j['org'] is Map ? (j['org'] as Map)['org_uid'] : null),
      );
}

class Task {
  Task(this.json);
  final Map<String, dynamic> json;

  String get id => '${json['id']}';
  String get title => _s(json['title']) ?? '';
  String? get description => _s(json['description']);
  String get status => _s(json['status']) ?? 'pending';
  String get priority => _s(json['priority']) ?? 'medium';
  String? get dueDate => _s(json['due_date']);
  String? get dueTime => _s(json['due_time']);
  String? get projectId => _s(json['project_id']);
  String? get parentTaskId => _s(json['parent_task_id']);
  String? get projectName => _s(json['project_name']);
  String? get kanbanColumn => _s(json['kanban_column']);
  double get kanbanOrder => (json['kanban_order'] is num) ? (json['kanban_order'] as num).toDouble() : 0;
  String? get approvedAt => _s(json['kanban_approved_at']);
  String? get workEndedAt => _s(json['work_ended_at']);
  String? get createdAt => _s(json['created_at']);
  String? get updatedAt => _s(json['updated_at']);

  List<String> get assigneeIds {
    final multi = _ids(json['assignee_ids']);
    if (multi.isNotEmpty) return multi;
    final single = _s(json['assignee_id']);
    return single == null ? const [] : [single];
  }

  Task copyWith(Map<String, dynamic> patch) => Task({...json, ...patch});
}

class Meeting {
  Meeting(this.json);
  final Map<String, dynamic> json;

  String get id => '${json['id']}';
  String get title => _s(json['title']) ?? '';
  String? get description => _s(json['description']);
  String get status => _s(json['status']) ?? 'scheduled';
  String get priority => _s(json['priority']) ?? 'medium';
  String? get date => _s(json['meeting_date']);
  String? get time => _s(json['meeting_time']);
  String? get projectId => _s(json['project_id']);
  String? get projectName => _s(json['project_name']);
  List<String> get assigneeIds => _ids(json['assignee_ids']);
}

class Project {
  Project(this.json);
  final Map<String, dynamic> json;

  String get id => '${json['id']}';
  String get name => _s(json['name']) ?? '';
  String? get description => _s(json['description']);
  String? get archivedAt => _s(json['archived_at']);
}

class TimerSession {
  TimerSession({required this.id, required this.taskId, required this.userId, required this.startedAt, this.endedAt});

  final String id;
  final String taskId;
  final String userId;
  final DateTime startedAt;
  final DateTime? endedAt;

  factory TimerSession.fromJson(Map<String, dynamic> j) => TimerSession(
        id: '${j['id']}',
        taskId: '${j['task_id']}',
        userId: '${j['user_id']}',
        startedAt: DateTime.tryParse('${j['started_at']}')?.toLocal() ?? DateTime.now(),
        endedAt: j['ended_at'] == null ? null : DateTime.tryParse('${j['ended_at']}')?.toLocal(),
      );

  TimerSession clippedFrom(DateTime start) =>
      TimerSession(id: id, taskId: taskId, userId: userId, startedAt: startedAt.isBefore(start) ? start : startedAt, endedAt: endedAt);

  int seconds(DateTime now) {
    final end = endedAt ?? now;
    final s = end.difference(startedAt).inSeconds;
    return s < 0 ? 0 : s;
  }
}

class DriveItem {
  DriveItem(this.json);
  final Map<String, dynamic> json;

  bool get isFolder => json['kind'] == 'folder';
  String get id => '${json['id']}';
  String get name => _s(json['name']) ?? '';
  bool get isPublic => json['visibility'] == 'public';
  bool get isOwner => json['is_owner'] == true;
  String get ownerName => _s(json['owner_name']) ?? 'Member';
  String? get contentType => _s(json['content_type']);
  int get sizeBytes => (json['size_bytes'] is num) ? (json['size_bytes'] as num).toInt() : 0;
  String? get createdAt => _s(json['created_at']);
  Map<String, dynamic>? get details => json['details'] is Map ? Map<String, dynamic>.from(json['details'] as Map) : null;
}

class DriveActivity {
  DriveActivity(this.json);
  final Map<String, dynamic> json;

  String get id => '${json['id']}';
  String get action => _s(json['action']) ?? '';
  String get itemName => _s(json['item_name']) ?? '';
  String get itemKind => _s(json['item_kind']) ?? 'file';
  String get actorName => _s(json['actor_name']) ?? 'Member';
  String? get createdAt => _s(json['created_at']);
  Map<String, dynamic> get details => json['details'] is Map ? Map<String, dynamic>.from(json['details'] as Map) : {};
}
