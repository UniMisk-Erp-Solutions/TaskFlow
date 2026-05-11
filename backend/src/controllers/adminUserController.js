const supabase = require("../config/supabase");

// List users in the current admin's organization
exports.listUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("org_id", req.user.org_id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("admin.listUsers error:", err);
    res.status(500).json({ error: err.message || "Failed to load users" });
  }
};

// Create a new user in the current admin's organization (employee or co-admin)
exports.createUser = async (req, res) => {
  try {
    const { email, password, fullName, role: rawRole = "employee" } = req.body;
    const role = rawRole === "admin" ? "admin" : "employee";

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Email, password and full name are required" });
    }
    if (!req.user.org_id) {
      return res.status(400).json({ error: "Your profile has no organization; cannot create users." });
    }

    // Create user via service role admin API (metadata consumed by handle_new_user trigger)
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        org_id: String(req.user.org_id),
      },
    });

    if (createError) {
      console.error("admin.createUser - Supabase admin error:", createError);
      return res.status(createError.status || 400).json({ error: createError.message || "Failed to create user" });
    }

    const userId = created.user?.id;

    // Ensure profile row exists and is linked to org (backup if trigger is outdated)
    if (userId) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email,
            full_name: fullName,
            role,
            org_id: req.user.org_id,
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("admin.createUser - profiles upsert error:", upsertError);
        return res.status(500).json({
          error: "User created but profile linking failed",
          detail: upsertError.message,
        });
      }
    }

    res.status(201).json({
      message: "User created",
      user_id: created.user?.id,
      email,
      full_name: fullName,
      role,
    });
  } catch (err) {
    console.error("admin.createUser error:", err);
    res.status(500).json({ error: err.message || "Failed to create user" });
  }
};

