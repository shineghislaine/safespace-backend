import nodemailer from "nodemailer";
import sgTransport from "nodemailer-sendgrid";

export const sendVerificationEmail = async (to, code) => {
  try {
    // ✅ Create transporter with SendGrid API key
    const transporter = nodemailer.createTransport(
      sgTransport({
        auth: {
          api_key: process.env.SENDGRID_API_KEY,
        },
      })
    );

    // ✅ Send email
    await transporter.sendMail({
      from: "SafeSpace <noreply@safespace.sbs>", // verified sender
      to, // recipient email (user)
      subject: "SafeSpace Email Verification",
      html: `
        <h2>Welcome to SafeSpace</h2>
        <p>Please use the code below to verify your email:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      `,
    });

    console.log("✅ Email sent successfully to:", to);
  } catch (err) {
    console.error("❌ Error sending email:", err.response?.body || err);
    throw err;
  }
};
