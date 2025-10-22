import nodemailer from "nodemailer";

export const sendVerificationEmail = async (to, code) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Gmail address
        pass: process.env.EMAIL_PASS, // Gmail App Password
      },
    });

    await transporter.sendMail({
      from: `"SafeSpace" <${process.env.EMAIL_USER}>`,
      to,
      subject: "SafeSpace Email Verification",
      html: `
        <h2>Welcome to SafeSpace</h2>
        <p>Please use the code below to verify your email:</p>
        <h1 style="letter-spacing: 4px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      `,
    });
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
};
