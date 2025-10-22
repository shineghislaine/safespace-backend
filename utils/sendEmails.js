import nodemailer from "nodemailer";
import sgTransport from "nodemailer-sendgrid";

export const sendVerificationEmail = async (to, code) => {
  try {
    const transporter = nodemailer.createTransport(
      sgTransport({
        apiKey: process.env.SENDGRID_API_KEY,
      })
    );

    await transporter.sendMail({
  from: "SafeSpace <noreply@safespace.sbs>", // ✅ Verified domain sender
  to,
  subject: "SafeSpace Email Verification",
  html: `
    <h2>Welcome to SafeSpace</h2>
    <p>Please use the code below to verify your email:</p>
    <h1 style="letter-spacing: 4px;">${code}</h1>
    <p>This code will expire in 10 minutes.</p>
  `,
});

    console.log("✅ Email sent successfully!");
  } catch (err) {
    console.error("❌ Error sending email:", err);
    throw err;
  }
};
