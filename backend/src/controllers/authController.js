const supabase = require("../config/supabase");

exports.signup = async (req, res) => {
  try {
    console.log("Signup request received:", req.body);
    
    const { email, password, fullName } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Missing required fields: email, password, fullName" });
    }

    console.log("Creating user in Supabase Auth...");
    
    // Create user in Supabase Auth - trigger will handle profile creation
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    console.log("Supabase response:", { authData, authError });

    if (authError) {
      console.error("Supabase auth error:", authError);
      throw authError;
    }

    console.log("User created successfully");
    
    res.status(201).json({ 
      message: "User created successfully",
      user: authData.user
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
