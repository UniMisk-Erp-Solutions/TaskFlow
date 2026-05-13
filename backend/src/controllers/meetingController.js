const supabase = require("../config/supabase");
const webPush = require("../services/webPushService");
const {
  loadOrgRoleById,
  filterMappedMeetingsForAdmin,
  adminCanSeeAssigneeScopedOrgItem,
  employeeSeesMappedRow,
} = require("../utils/orgVisibility");

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_STATUSES = ["scheduled", "completed", "cancelled"];

async function profilesInOrg(orgId, ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase.from("profiles").select("id, role").eq("org_id", orgId).in("id", unique);
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchMeetingAssigneeIds(meetingId) {
  const { data } = await supabase.from("meeting_assignees").select("profile_id").eq("meeting_id", meetingId);
  return (data || []).map((r) => r.profile_id);
}

function mapMeetingRow(row, assigneeIdsOverride) {
  if (!row) return null;
  const fromJunction = assigneeIdsOverride
    ? assigneeIdsOverride
    : (row.meeting_assignees || []).map((t) => t.profile_id).filter(Boolean);
  const assignee_ids = fromJunction.length
    ? [...new Set(fromJunction)]
    : row.assignee_id
      ? [row.assignee_id]
      : [];
  const rest = { ...row };
  delete rest.meeting_assignees;
  return {
    ...rest,
    assignee_ids,
  };
}

async function employeeCanAccessMeeting(userId, meeting) {
  if (!meeting) return false;
  if (meeting.assignee_id === userId) return true;
  const ids = await fetchMeetingAssigneeIds(meeting.id);
  return ids.includes(userId);
}

async function replaceMeetingAssignees(meetingId, profileIds, bumpUpdated = true) {
  const unique = [...new Set((profileIds || []).filter(Boolean))];
  await supabase.from("meeting_assignees").delete().eq("meeting_id", meetingId);
  if (unique.length) {
    const { error } = await supabase.from("meeting_assignees").insert(
      unique.map((profile_id) => ({ meeting_id: meetingId, profile_id }))
    );
    if (error) throw new Error(error.message);
  }
  if (bumpUpdated) {
    await supabase.from("meetings").update({ updated_at: new Date().toISOString() }).eq("id", meetingId);
  }
}

async function loadMeetingForUser(req, id) {
  const { data: row, error } = await supabase
    .from("meetings")
    .select("*, meeting_assignees(profile_id)")
    .eq("id", id)
    .eq("org_id", req.user.org_id)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!row) return { error: "not_found" };

  const mapped = mapMeetingRow(row);

  if (req.user.role !== "admin") {
    const ok = await employeeCanAccessMeeting(req.user.id, row);
    if (!ok) return { error: "forbidden" };
    return { meeting: mapped };
  }

  try {
    const roleById = await loadOrgRoleById(req.user.org_id);
    if (!adminCanSeeAssigneeScopedOrgItem(mapped, req.user.id, roleById)) {
      return { error: "forbidden" };
    }
  } catch (e) {
    return { error: e.message };
  }

  return { meeting: mapped };
}

exports.getMeetings = async (req, res) => {
  try {
    let query = supabase
      .from("meetings")
      .select("*, meeting_assignees(profile_id)")
      .eq("org_id", req.user.org_id);

    if (req.user.role !== "admin") {
      const { data: links } = await supabase
        .from("meeting_assignees")
        .select("meeting_id")
        .eq("profile_id", req.user.id);

      const linkIds = [...new Set((links || []).map((l) => l.meeting_id).filter(Boolean))];
      if (linkIds.length) {
        query = query.or(`assignee_id.eq.${req.user.id},id.in.(${linkIds.join(",")})`);
      } else {
        query = query.eq("assignee_id", req.user.id);
      }
    }

    const { data, error } = await query.order("meeting_date", { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    let list = (data || []).map((row) => mapMeetingRow(row));

    if (req.user.role === "admin") {
      try {
        const roleById = await loadOrgRoleById(req.user.org_id);
        list = filterMappedMeetingsForAdmin(list, req.user.id, roleById);
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await loadMeetingForUser(req, id);
    if (r.error === "not_found" || r.error === "forbidden") {
      return res.status(r.error === "forbidden" ? 403 : 404).json({ error: "Meeting not found or access denied" });
    }
    if (r.error) return res.status(400).json({ error: r.error });

    const { data: subRows } = await supabase
      .from("meetings")
      .select(
        "id, title, status, meeting_date, meeting_time, priority, parent_meeting_id, assignee_id, created_by, meeting_assignees(profile_id)"
      )
      .eq("org_id", req.user.org_id)
      .eq("parent_meeting_id", id)
      .order("meeting_date", { ascending: true });

    const subsMapped = (subRows || []).map((s) => mapMeetingRow(s));

    if (req.user.role !== "admin") {
      const filtered = subsMapped.filter((s) => employeeSeesMappedRow(req.user.id, s));
      const slim = filtered.map(
        ({ id: sid, title, status, meeting_date, meeting_time, priority, parent_meeting_id }) => ({
          id: sid,
          title,
          status,
          meeting_date,
          meeting_time,
          priority,
          parent_meeting_id,
        })
      );
      return res.json({ ...r.meeting, submeetings: slim });
    }

    try {
      const roleById = await loadOrgRoleById(req.user.org_id);
      const filtered = filterMappedMeetingsForAdmin(subsMapped, req.user.id, roleById);
      const slim = filtered.map(
        ({ id: sid, title, status, meeting_date, meeting_time, priority, parent_meeting_id }) => ({
          id: sid,
          title,
          status,
          meeting_date,
          meeting_time,
          priority,
          parent_meeting_id,
        })
      );
      return res.json({ ...r.meeting, submeetings: slim });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function validateParentMeeting(req, parentMeetingId, orgId) {
  if (!parentMeetingId) return { ok: true };
  const { data: parent } = await supabase
    .from("meetings")
    .select("id, org_id")
    .eq("id", parentMeetingId)
    .maybeSingle();

  if (!parent || parent.org_id !== orgId) {
    return { ok: false, message: "Invalid parent meeting" };
  }

  if (req.user.role === "admin") return { ok: true };

  const { data: mrow } = await supabase
    .from("meetings")
    .select("id, assignee_id, org_id")
    .eq("id", parentMeetingId)
    .maybeSingle();

  const can = await employeeCanAccessMeeting(req.user.id, mrow);
  if (!can) return { ok: false, message: "You can only add sub-meetings to meetings you are assigned to" };

  return { ok: true };
}

exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      assignee_id,
      assignee_ids,
      priority,
      meeting_date,
      meeting_time,
      project_id,
      parent_meeting_id,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!meeting_date) {
      return res.status(400).json({ error: "Meeting date is required" });
    }
    if (!meeting_time) {
      return res.status(400).json({ error: "Meeting time is required" });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

    const ids = assignee_ids?.length ? assignee_ids : assignee_id ? [assignee_id] : [];
    if (!ids.length) {
      return res.status(400).json({ error: "At least one participant is required" });
    }

    const validated = await profilesInOrg(req.user.org_id, ids);
    if (validated.length !== [...new Set(ids)].length) {
      return res.status(400).json({ error: "One or more participants are not in your workspace" });
    }

    const parentCheck = await validateParentMeeting(req, parent_meeting_id, req.user.org_id);
    if (!parentCheck.ok) {
      return res.status(400).json({ error: parentCheck.message });
    }

    if (project_id) {
      const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("id", project_id)
        .eq("org_id", req.user.org_id)
        .maybeSingle();
      if (!proj) return res.status(400).json({ error: "Invalid project" });
    }

    const primaryAssignee = ids[0];

    const insertRow = {
      title: title.trim(),
      description,
      assignee_id: primaryAssignee,
      priority: priority || "medium",
      meeting_date,
      meeting_time,
      status: "scheduled",
      created_by: req.user.id,
      org_id: req.user.org_id,
      project_id: project_id || null,
      parent_meeting_id: parent_meeting_id || null,
    };

    const { data: created, error } = await supabase.from("meetings").insert([insertRow]).select().single();

    if (error) return res.status(400).json({ error: error.message });

    try {
      await replaceMeetingAssignees(created.id, ids, true);
    } catch (syncErr) {
      await supabase.from("meetings").delete().eq("id", created.id);
      return res.status(400).json({ error: syncErr.message });
    }

    const { data: fresh } = await supabase
      .from("meetings")
      .select("*, meeting_assignees(profile_id)")
      .eq("id", created.id)
      .single();

    const mapped = mapMeetingRow(fresh);
    res.status(201).json(mapped);

    const participantIds = mapped.assignee_ids || [];
    void webPush
      .getActorDisplayName(req.user.id)
      .then((who) =>
        webPush.notifyUsers({
          userIds: participantIds,
          excludeUserId: req.user.id,
          category: "meeting_assigned",
          title: "New meeting assigned",
          body: `${who} added you: ${mapped.title}`,
          data: { type: "meeting", meetingId: mapped.id, url: "/" },
        }),
      )
      .catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.patchMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
      meeting_date,
      meeting_time,
      project_id,
      assignee_ids,
      parent_meeting_id,
    } = req.body;

    const r = await loadMeetingForUser(req, id);
    if (r.error === "not_found" || r.error === "forbidden") {
      return res.status(r.error === "forbidden" ? 403 : 404).json({ error: "Meeting not found or access denied" });
    }
    if (r.error) return res.status(400).json({ error: r.error });

    const previousAssigneeIds =
      assignee_ids !== undefined && r.meeting?.assignee_ids ? [...r.meeting.assignee_ids] : [];

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}` });
    }

    if (parent_meeting_id !== undefined && parent_meeting_id !== null) {
      const pc = await validateParentMeeting(req, parent_meeting_id, req.user.org_id);
      if (!pc.ok) return res.status(400).json({ error: pc.message });
      if (parent_meeting_id === id) {
        return res.status(400).json({ error: "Meeting cannot be its own parent" });
      }
    }

    if (assignee_ids !== undefined) {
      const ids = assignee_ids || [];
      if (!ids.length) {
        return res.status(400).json({ error: "At least one participant is required" });
      }
      const validated = await profilesInOrg(req.user.org_id, ids);
      if (validated.length !== [...new Set(ids)].length) {
        return res.status(400).json({ error: "One or more participants are not in your workspace" });
      }
    }

    if (project_id !== undefined && project_id !== null && project_id !== "") {
      const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("id", project_id)
        .eq("org_id", req.user.org_id)
        .maybeSingle();
      if (!proj) return res.status(400).json({ error: "Invalid project" });
    }

    const updates = { updated_at: new Date().toISOString() };

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ error: "Title is required" });
      updates.title = String(title).trim();
    }
    if (description !== undefined) updates.description = description;
    if (priority !== undefined) updates.priority = priority;
    if (meeting_date !== undefined) updates.meeting_date = meeting_date;
    if (meeting_time !== undefined) updates.meeting_time = meeting_time;
    if (project_id !== undefined) updates.project_id = project_id || null;
    if (parent_meeting_id !== undefined) updates.parent_meeting_id = parent_meeting_id || null;

    const { data: updated, error } = await supabase
      .from("meetings")
      .update(updates)
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!updated) return res.status(404).json({ error: "Meeting not found" });

    if (assignee_ids !== undefined) {
      const ids = assignee_ids || [];
      const primary = ids[0];
      await supabase.from("meetings").update({ assignee_id: primary, updated_at: new Date().toISOString() }).eq("id", id);
      await replaceMeetingAssignees(id, ids, true);
    }

    const { data: fresh } = await supabase
      .from("meetings")
      .select("*, meeting_assignees(profile_id)")
      .eq("id", id)
      .single();

    const mappedOut = mapMeetingRow(fresh);
    res.json(mappedOut);

    if (assignee_ids !== undefined) {
      const oldSet = new Set(previousAssigneeIds);
      const added = (mappedOut.assignee_ids || []).filter((uid) => !oldSet.has(uid));
      if (added.length) {
        void webPush
          .getActorDisplayName(req.user.id)
          .then((who) =>
            webPush.notifyUsers({
              userIds: added,
              excludeUserId: req.user.id,
              category: "meeting_assigned",
              title: "Meeting participants updated",
              body: `${who} added you to: ${mappedOut.title}`,
              data: { type: "meeting", meetingId: mappedOut.id, url: "/" },
            }),
          )
          .catch(() => {});
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "Status is required" });
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const access = await loadMeetingForUser(req, id);
    if (access.error === "not_found" || access.error === "forbidden") {
      return res.status(access.error === "forbidden" ? 403 : 404).json({ error: "Meeting not found or access denied" });
    }
    if (access.error) return res.status(400).json({ error: access.error });

    const meetingTitle = access.meeting?.title || "Meeting";
    const notifyIds = access.meeting?.assignee_ids || [];

    const { data, error } = await supabase
      .from("meetings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .select("*, meeting_assignees(profile_id)")
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Meeting not found or access denied" });

    const out = mapMeetingRow(data);
    res.json(out);

    void webPush
      .getActorDisplayName(req.user.id)
      .then((who) =>
        webPush.notifyUsers({
          userIds: notifyIds,
          excludeUserId: req.user.id,
          category: "meeting_update",
          title: "Meeting status updated",
          body: `${who} set "${meetingTitle}" to ${status}`,
          data: { type: "meeting", meetingId: id, url: "/" },
        }),
      )
      .catch(() => {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    const { data: row, error: fetchErr } = await supabase
      .from("meetings")
      .select("id, created_by, assignee_id, meeting_assignees(profile_id)")
      .eq("id", id)
      .eq("org_id", req.user.org_id)
      .maybeSingle();

    if (fetchErr) return res.status(400).json({ error: fetchErr.message });
    if (!row) return res.status(404).json({ error: "Meeting not found" });

    const mapped = mapMeetingRow(row);
    const roleById = await loadOrgRoleById(req.user.org_id);
    if (!adminCanSeeAssigneeScopedOrgItem(mapped, req.user.id, roleById)) {
      return res.status(404).json({ error: "Meeting not found or access denied" });
    }

    const { error } = await supabase.from("meetings").delete().eq("id", id).eq("org_id", req.user.org_id);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
