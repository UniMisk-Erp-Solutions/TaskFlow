import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../state/auth_state.dart';
import '../state/data_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});
  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  final Map<String, Map<String, dynamic>?> _progress = {};
  String? _openId;
  bool _archived = false;
  String _error = '';
  String _loadedFor = '';

  Future<void> _loadProgress(DataController data) async {
    final signature = data.projects.map((p) => p.id).join(',') + data.tasks.length.toString();
    if (signature == _loadedFor) return;
    _loadedFor = signature;
    for (final p in data.projects) {
      try {
        final json = await Api.instance.get('/projects/${p.id}/progress');
        if (mounted) setState(() => _progress[p.id] = Map<String, dynamic>.from(json as Map));
      } catch (_) {
        if (mounted) setState(() => _progress[p.id] = null);
      }
    }
  }

  Future<void> _editor(DataController data, {String? id, String name = '', String description = ''}) async {
    final nameC = TextEditingController(text: name);
    final descC = TextEditingController(text: description);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(id == null ? 'New project' : 'Edit project'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: nameC, autofocus: true, decoration: const InputDecoration(labelText: 'Name')),
          const Gap(12),
          TextField(controller: descC, minLines: 2, maxLines: 4, decoration: const InputDecoration(labelText: 'Description')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(id == null ? 'Create' : 'Save')),
        ],
      ),
    );
    if (ok != true) return;
    if (nameC.text.trim().isEmpty) {
      setState(() => _error = 'Project name is required.');
      return;
    }
    try {
      if (id == null) {
        await data.createProject(nameC.text.trim(), descC.text.trim().isEmpty ? null : descC.text.trim());
      } else {
        await data.updateProject(id, nameC.text.trim(), descC.text.trim());
      }
      setState(() => _error = '');
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final isAdmin = context.watch<AuthController>().isAdmin;
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadProgress(data));
    final shown = data.projects.where((p) => _archived ? p.archivedAt != null : p.archivedAt == null).toList();
    final archivedCount = data.projects.where((p) => p.archivedAt != null).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Projects'),
        actions: [if (isAdmin) IconButton(onPressed: () => _editor(data), icon: const Icon(Icons.add_circle_outline), tooltip: 'New project')],
      ),
      body: RefreshIndicator(
        onRefresh: () => data.load(),
        child: ListView(padding: kPad, children: [
          if (isAdmin) ...[
            Segment2<bool>(
              value: _archived,
              options: [(false, 'Active', null), (true, 'Archived ($archivedCount)', null)],
              onChanged: (v) => setState(() => _archived = v),
            ),
            const Gap(12),
          ],
          if (_error.isNotEmpty) ...[Banner_(_error, onClose: () => setState(() => _error = '')), const Gap(12)],
          if (data.loading)
            const Loader()
          else if (shown.isEmpty)
            EmptyState(
              icon: Icons.folder_open,
              title: 'No projects',
              message: isAdmin ? 'Create one to organize tasks and meetings.' : 'You are not assigned to any project yet.',
            )
          else
            for (final project in shown)
              Builder(builder: (context) {
                final progress = _progress[project.id];
                final percent = (progress?['percent_complete'] as num?)?.toInt() ?? 0;
                final open = _openId == project.id;
                final tasks = data.tasks.where((t) => t.projectId == project.id).toList();
                final meetings = data.meetings.where((m) => m.projectId == project.id).toList();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AppCard(
                    padding: EdgeInsets.zero,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(project.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                                if ((project.description ?? '').isNotEmpty)
                                  Text(project.description!, style: TextStyle(fontSize: 13, color: context.app.muted)),
                              ]),
                            ),
                            if (isAdmin)
                              PopupMenuButton<String>(
                                onSelected: (v) async {
                                  if (v == 'edit') {
                                    await _editor(data, id: project.id, name: project.name, description: project.description ?? '');
                                  } else if (v == 'archive') {
                                    try {
                                      await data.setProjectArchived(project.id, project.archivedAt == null);
                                    } catch (e) {
                                      if (mounted) setState(() => _error = errorText(e));
                                    }
                                  } else if (v == 'delete') {
                                    final ok = await confirm(context,
                                        title: 'Delete project?',
                                        message: '"${project.name}" will be removed. Its tasks and meetings are kept as individual items.');
                                    if (!ok) return;
                                    try {
                                      await data.deleteProject(project.id);
                                    } catch (e) {
                                      if (mounted) setState(() => _error = errorText(e));
                                    }
                                  }
                                },
                                itemBuilder: (_) => [
                                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                  PopupMenuItem(value: 'archive', child: Text(project.archivedAt == null ? 'Archive' : 'Unarchive')),
                                  const PopupMenuItem(value: 'delete', child: Text('Delete')),
                                ],
                              ),
                          ]),
                          const Gap(14),
                          Row(children: [
                            Text(progress == null ? 'Loading progress…' : '${progress['completed']}/${progress['total']} tasks completed',
                                style: TextStyle(fontSize: 12, color: context.app.muted)),
                            const Spacer(),
                            Text('$percent%', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                          ]),
                          const Gap(6),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(value: percent / 100, minHeight: 8, backgroundColor: context.app.surfaceAlt),
                          ),
                          const Gap(12),
                          Row(children: [
                            OutlinedButton(
                              onPressed: () => setState(() => _openId = open ? null : project.id),
                              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                              child: Text(open ? 'Hide items' : 'Show items (${tasks.length + meetings.length})'),
                            ),
                            const Spacer(),
                            if (isAdmin)
                              TextButton.icon(
                                onPressed: () => context.push('/task/new?projectId=${project.id}'),
                                icon: const Icon(Icons.add, size: 18),
                                label: const Text('Task'),
                              ),
                          ]),
                        ]),
                      ),
                      if (open) ...[
                        Divider(color: context.app.border),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(children: [
                            if (tasks.isEmpty && meetings.isEmpty) Text('Nothing in this project yet.', style: TextStyle(color: context.app.muted, fontSize: 13)),
                            for (final t in tasks)
                              ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                                subtitle: Text(t.assigneeIds.map(data.nameOf).join(', '), maxLines: 1, overflow: TextOverflow.ellipsis),
                                trailing: StatusPill(t.status),
                                onTap: () => context.push('/task/${t.id}'),
                              ),
                            for (final m in meetings)
                              ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(Icons.videocam_outlined, color: context.cs.primary),
                                title: Text(m.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                                trailing: const Pill('Meeting'),
                                onTap: () => context.push('/meeting/${m.id}'),
                              ),
                          ]),
                        ),
                      ],
                    ]),
                  ),
                );
              }),
        ]),
      ),
    );
  }
}
