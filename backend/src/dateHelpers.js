// Get today's date (YYYY-MM-DD)
exports.getToday = () => {
  return new Date().toISOString().split("T")[0];
};

// Add hours to current time
exports.addHours = (hours) => {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

// Check if date is within next X hours
exports.isWithinHours = (date, hours) => {
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return new Date(date) <= future;
};

// Check if overdue
exports.isOverdue = (date) => {
  const today = new Date().toISOString().split("T")[0];
  return new Date(date) < new Date(today);
};
