const supabase = require("../config/supabase");

exports.signup = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (authError) throw authError;

    // Create profile in database
    if (authData.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert([
          {
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName,
            created_at: new Date().toISOString()
          }
        ]);

      if (profileError) throw profileError;
    }

    res.status(201).json({ 
      message: "User created successfully",
      user: authData.user
    });
  } catch (err) {
    console.error("Signup error:", err);
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
