const { createClient } = require("@supabase/supabase-js");
const supabase = require("../config/supabase");

function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

exports.signup = async (req, res) => {
  try {
    console.log("Signup request received:", req.body);
    
    const { email, password, fullName } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Missing required fields: email, password, fullName" });
    }

    console.log("Creating admin user in Supabase Auth (workspace owner)...");

    const serviceClient = createServiceClient();

    // Create admin user via admin API (avoids RLS/session side effects)
    const { data: created, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "admin",
      },
    });

    console.log("Supabase response:", { hasUser: !!created?.user, authError });

    if (authError) {
      console.error("Supabase auth error:", authError);
      return res.status(authError.status || 400).json({ error: authError.message || "Signup failed" });
    }

    const user = created?.user;

    // Create a new organization for this admin
    let orgId = null;
    try {
      const { data: org, error: orgError } = await serviceClient
        .from("organizations")
        .insert([
          {
            name: `${fullName}'s workspace`,
          },
        ])
        .select("id")
        .single();

      if (orgError) {
        console.error("Failed to create organization for admin:", orgError);
      } else {
        orgId = org.id;
      }
    } catch (orgErr) {
      console.error("Unexpected error creating organization:", orgErr);
    }

    // Ensure admin profile exists and is linked to org
    if (user) {
      const { error: upsertError } = await serviceClient
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email,
            full_name: fullName,
            role: "admin",
            org_id: orgId,
          },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error("Failed to upsert admin profile:", upsertError);
      }
    }

    console.log("Admin user and organization created successfully");

    // Return a normal login session for frontend
    const { data: loginData, error: loginError } = await serviceClient.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return res.status(201).json({
        message: "User created successfully. Please sign in.",
        user,
        session: null,
      });
    }
    
    res.status(201).json({ 
      message: "User created successfully",
      user: loginData.user,
      session: loginData.session
    });
  } catch (err) {
    console.error("Signup error details:", {
      message: err.message,
      stack: err.stack,
      body: req.body
    });
    const status = err?.status || (err?.__isAuthError ? 400 : 500);
    res.status(status).json({ error: err.message || "Signup failed" });
  }
};

exports.login = async (req, res) => {
  try {
    console.log("Login request received:", { email: req.body.email });
    
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields: email, password" });
    }

    console.log("Authenticating user...");
    
    const serviceClient = createServiceClient();

    // Sign in user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("Login response:", { authData, authError });

    if (authError) {
      console.error("Login auth error:", authError);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("Login successful");

    const user = authData.user;

    // Ensure profile exists and has a role/org
    if (user) {
      // Try to load existing profile
      const { data: existing, error: profileError } = await serviceClient
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Login - failed to load profile:", profileError);
      }

      let orgId = existing?.org_id || null;
      let role = existing?.role || (user.user_metadata?.role === "admin" ? "admin" : "employee");

      // If no org yet, and this looks like an admin, create a workspace for them
      if (!orgId && role === "admin") {
        try {
          const { data: org, error: orgError } = await serviceClient
            .from("organizations")
            .insert([
              {
                name: `${user.user_metadata?.full_name || user.email}'s workspace`,
              },
            ])
            .select("id")
            .single();

          if (orgError) {
            console.error("Login - failed to create organization:", orgError);
          } else {
            orgId = org.id;
          }
        } catch (orgErr) {
          console.error("Login - unexpected error creating organization:", orgErr);
        }
      }

      const profilePayload = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || existing?.full_name || "",
        role,
        org_id: orgId,
      };

      const { error: upsertError } = await serviceClient
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (upsertError) {
        console.error("Login - failed to upsert profile:", upsertError);
      }
    }

    res.json({ 
      message: "Login successful",
      user: authData.user,
      session: authData.session
    });
  } catch (err) {
    console.error("Login error details:", {
      message: err.message,
      stack: err.stack,
      body: req.body
    });
    const status = err?.status || (err?.__isAuthError ? 400 : 500);
    res.status(status).json({ error: err.message || "Login failed" });
  }
};

exports.testConnection = async (req, res) => {
  try {
    console.log("Testing Supabase connection...");
    console.log("Supabase URL:", process.env.SUPABASE_URL);
    console.log("Has service key:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Test basic connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      message: "Supabase connection successful",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Supabase connection test failed:", err);
    res.status(500).json({ 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

exports.getProfiles = async (req, res) => {
  try {
    console.log('getProfiles - Fetching profiles for org:', req.user.org_id);
    
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("org_id", req.user.org_id)
      .order("full_name");

    console.log('getProfiles - Supabase response:', { 
      data: data?.length || 0, 
      error: error?.message,
      profiles: data 
    });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('getProfiles - Error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
