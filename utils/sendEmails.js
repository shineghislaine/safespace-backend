import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();


const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (to, code) => {
  try {
    await resend.emails.send({
      from: "SafeSpace <noreply@send.safespace.sbs>", // You can customize this in Resend dashboard
      to,
      subject: "SafeSpace Email Verification",
      html: `
        <h2>Welcome to SafeSpace</h2>
        <p>Please use the code below to verify your email:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      `,
    });

    console.log("✅ Verification email sent successfully!");
  } catch (err) {
    console.error("❌ Error sending email:", err);
    throw err;
  }
};
