const supabase = require("../config/supabase");

// Validates Supabase JWT and attaches user + role to req.user
module.exports = async (req, res, next) => {
  try {
    console.log("Auth middleware - Request headers:", {
      authorization: req.headers.authorization ? "Bearer [token]" : "No auth header",
      path: req.path,
      method: req.method
    });

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("Auth middleware - No authorization header found");
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log("Auth middleware - No token found in header");
      return res.status(401).json({ error: "Invalid token format" });
    }

    console.log("Auth middleware - Validating token...");

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    console.log("Auth middleware - Supabase response:", { user: !!user, error: error?.message });

    if (error || !user) {
      console.log("Auth middleware - Invalid token:", error?.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get user profile with role and org
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, org_id")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Auth middleware - Profile response:", { 
      profile: !!profile, 
      role: profile?.role, 
      profileError: profileError?.message 
    });

    if (profileError) {
      console.log("Auth middleware - Profile lookup error:", profileError.message);
      return res.status(403).json({ error: "Profile lookup failed" });
    }

    if (!profile) {
      console.log("Auth middleware - Profile missing for user, access denied");
      return res.status(403).json({ error: "Profile not found for user" });
    }

    req.user = { 
      ...user, 
      role: profile.role,
      org_id: profile.org_id,
    };

    console.log("Auth middleware - User authenticated:", {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    });

    next();
  } catch (err) {
    console.error("Auth middleware - Unexpected error:", err);
    res.status(401).json({ error: "Authentication failed" });
  }
};
