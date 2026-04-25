const supabase = require("../config/supabase");

exports.signup = async (req, res) => {
  try {
    console.log("Signup request received:", req.body);
    
    const { email, password, fullName, role = 'employee' } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Missing required fields: email, password, fullName" });
    }

    console.log("Creating user in Supabase Auth...");
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role
        }
      }
    });

    console.log("Supabase response:", { authData, authError });

    if (authError) {
      console.error("Supabase auth error:", authError);
      throw authError;
    }

    // Profile creation is handled by trigger with role from metadata

    console.log("User created successfully with role:", role);
    
    res.status(201).json({ 
      message: "User created successfully",
      user: authData.user,
      session: authData.session
    });
  } catch (err) {
    console.error("Signup error details:", {
      message: err.message,
      stack: err.stack,
      body: req.body
    });
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
