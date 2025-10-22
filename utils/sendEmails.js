import nodemailer from "nodemailer";

export const sendVerificationEmail = async (to, code) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_BREVO_HOST,
      port: process.env.EMAIL_BREVO_PORT,
      secure: false, // use TLS
      auth: {
        user: process.env.EMAIL_BREVO_USER,
        pass: process.env.EMAIL_BREVO_PASS,
      },
    });

    await transporter.sendMail({
      from: "SafeSpace <qnshineg@gmail.com>",
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
