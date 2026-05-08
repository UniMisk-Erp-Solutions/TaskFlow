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

// Create a new employee in the current admin's organization
exports.createUser = async (req, res) => {
  try {
    const { email, password, fullName, role = "employee" } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Email, password and full name are required" });
    }
    if (role !== "employee") {
      return res.status(400).json({ error: "Only employee role is allowed for invited users" });
    }

    // Create user via service role admin API
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "employee",
      },
    });

    if (createError) {
      console.error("admin.createUser - Supabase admin error:", createError);
      return res.status(createError.status || 400).json({ error: createError.message || "Failed to create user" });
    }

    const userId = created.user?.id;

    // Ensure profile row exists and is linked to org
    if (userId) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email,
            full_name: fullName,
            role: "employee",
            org_id: req.user.org_id,
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("admin.createUser - profiles upsert error:", upsertError);
        return res.status(500).json({ error: "User created but profile linking failed" });
      }
    }

    res.status(201).json({
      message: "User created",
      user_id: created.user?.id,
      email,
      full_name: fullName,
      role: "employee",
    });
  } catch (err) {
    console.error("admin.createUser error:", err);
    res.status(500).json({ error: err.message || "Failed to create user" });
  }
};

