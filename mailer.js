import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSKEY,
  },
});

export default async function sendMail(verificationCode, receiver) {
  try {
    // send mail with defined transport object
    await transporter.sendMail({
      from: "toxicheck3@gmail.com",
      to: receiver,
      subject: "Your verification code!",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
      <h2 style="color: #333;">Password Reset Verification</h2>
      <p>We have received a request to reset the password for your account.</p>
      <p>Use the code given below to reset your password</p>
      <div style="text-align: center; margin: 15px 0;">
          <p style="font-size: 24px; font-weight: bold; color: #007bff; background-color: #f9f9f9; padding: 10px; border: 1px solid #ddd; border-radius: 4px; display: inline-block;">
              ${verificationCode}
          </p>
      </div>
      <p>If you did not request this code, it is possible that someone else is trying to access your account. Do not forward or give this code to anyone.</p>
      <p>Thank you!</p>
  </div>
        `,
    });
   
    transporter.close();
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
