const supabase = require("../config/supabase");
const {
  loadOrgRoleById,
  filterMappedTasksForAdmin,
  filterMappedMeetingsForAdmin,
  mapTaskRowQuick,
  mapMeetingRowQuick,
} = require("../utils/orgVisibility");

/**
 * KPIs scoped to what this admin may see:
 * Tasks/meetings with only admin assignees are visible only to those admins + creator.
 */
exports.getOverviewStats = async (req, res) => {
  try {
    if (!req.user.org_id) {
      return res.json({
        pending_tasks: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        pending_meetings: 0,
        completed_meetings: 0,
        overdue_meetings: 0,
        total_users: 0,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const roleById = await loadOrgRoleById(req.user.org_id);

    const { data: taskRows, error: tErr } = await supabase
      .from("tasks")
      .select("id, status, due_date, created_by, assignee_id, task_assignees(profile_id)")
      .eq("org_id", req.user.org_id);
    if (tErr) throw tErr;

    const { data: meetRows, error: mErr } = await supabase
      .from("meetings")
      .select("id, status, meeting_date, created_by, assignee_id, meeting_assignees(profile_id)")
      .eq("org_id", req.user.org_id);
    if (mErr) throw mErr;

    const { count: userCount, error: uErr } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", req.user.org_id);
    if (uErr) throw uErr;

    const tasks = filterMappedTasksForAdmin(
      (taskRows || []).map(mapTaskRowQuick),
      req.user.id,
      roleById
    );
    const meetings = filterMappedMeetingsForAdmin(
      (meetRows || []).map(mapMeetingRowQuick),
      req.user.id,
      roleById
    );

    const pending_tasks = tasks.filter((t) =>
      ["pending", "in_progress", "blocked"].includes(t.status)
    ).length;
    const completed_tasks = tasks.filter((t) => t.status === "completed").length;
    const overdue_tasks = tasks.filter(
      (t) => t.due_date && t.due_date < today && t.status !== "completed"
    ).length;

    const pending_meetings = meetings.filter((m) => m.status === "scheduled").length;
    const completed_meetings = meetings.filter((m) => m.status === "completed").length;
    const overdue_meetings = meetings.filter(
      (m) => m.meeting_date && m.meeting_date < today && m.status === "scheduled"
    ).length;

    res.json({
      pending_tasks,
      completed_tasks,
      overdue_tasks,
      pending_meetings,
      completed_meetings,
      overdue_meetings,
      total_users: userCount ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
