const supabase = require("../config/supabase");

// Validates Supabase JWT and attaches user + role to req.user
module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    const {
      data: { user },
      error
    } = await supabase.auth.getUser(token);

    if (error || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    req.user = { ...user, role: profile?.role ?? "employee" };
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
