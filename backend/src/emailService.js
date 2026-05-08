const axios = require("axios");

exports.sendEmail = async (to, subject, html) => {
  await axios.post(
    "https://api.resend.com/emails",
    {
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      }
    }
  );
};
