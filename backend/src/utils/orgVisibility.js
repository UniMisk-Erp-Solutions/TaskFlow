const supabase = require("../config/supabase");

async function loadOrgRoleById(orgId) {
  const { data, error } = await supabase.from("profiles").select("id, role").eq("org_id", orgId);
  if (error) throw new Error(error.message);
  const m = {};
  for (const p of data || []) m[p.id] = p.role;
  return m;
}

/** Assignees from mapped task/meeting row */
function assigneeListFromMapped(row) {
  if (row.assignee_ids?.length) return [...new Set(row.assignee_ids.filter(Boolean))];
  if (row.assignee_id) return [row.assignee_id];
  return [];
}

/**
 * If every assignee is an admin, item is scoped: only creator + assignee admins see it among admins.
 */
function isRestrictedAdminOnlyTeam(assigneeIds, roleById) {
  if (!assigneeIds.length) return false;
  return assigneeIds.every((id) => roleById[id] === "admin");
}

function adminCanSeeAssigneeScopedOrgItem(row, viewerId, roleById) {
  const assignees = assigneeListFromMapped(row);
  if (!isRestrictedAdminOnlyTeam(assignees, roleById)) return true;
  if (row.created_by === viewerId) return true;
  return assignees.includes(viewerId);
}

function filterMappedTasksForAdmin(tasks, viewerId, roleById) {
  return tasks.filter((t) => adminCanSeeAssigneeScopedOrgItem(t, viewerId, roleById));
}

function filterMappedMeetingsForAdmin(meetings, viewerId, roleById) {
  return meetings.filter((m) => adminCanSeeAssigneeScopedOrgItem(m, viewerId, roleById));
}

function employeeSeesMappedRow(userId, row) {
  if (!row || !userId) return false;
  if (row.assignee_id === userId) return true;
  const ids = row.assignee_ids || [];
  return ids.includes(userId);
}

function mapTaskRowQuick(r) {
  if (!r) return null;
  const fromJ = (r.task_assignees || []).map((t) => t.profile_id).filter(Boolean);
  const assignee_ids = fromJ.length ? [...new Set(fromJ)] : r.assignee_id ? [r.assignee_id] : [];
  return {
    id: r.id,
    status: r.status,
    due_date: r.due_date,
    created_by: r.created_by,
    assignee_id: r.assignee_id,
    assignee_ids,
  };
}

function mapMeetingRowQuick(r) {
  if (!r) return null;
  const fromJ = (r.meeting_assignees || []).map((t) => t.profile_id).filter(Boolean);
  const assignee_ids = fromJ.length ? [...new Set(fromJ)] : r.assignee_id ? [r.assignee_id] : [];
  return {
    id: r.id,
    status: r.status,
    meeting_date: r.meeting_date,
    created_by: r.created_by,
    assignee_id: r.assignee_id,
    assignee_ids,
  };
}

module.exports = {
  loadOrgRoleById,
  assigneeListFromMapped,
  adminCanSeeAssigneeScopedOrgItem,
  filterMappedTasksForAdmin,
  filterMappedMeetingsForAdmin,
  employeeSeesMappedRow,
  mapTaskRowQuick,
  mapMeetingRowQuick,
};
