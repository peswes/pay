import crypto from "crypto";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body;
  if (event.event === "charge.success") {
    const { email, name, nights, total } = event.data.metadata;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email to client
    await transporter.sendMail({
      from: `"Booking Confirmation" <${process.env.ADMIN_EMAIL}>`,
      to: email,
      subject: "Payment Successful - Booking Confirmed",
      html: `
        <h2>Hello ${name},</h2>
        <p>Your booking for ${nights} night(s) has been confirmed.</p>
        <p>Total Paid: ₦${total.toLocaleString()}</p>
        <p>We look forward to hosting you.</p>
      `,
    });

    // Email to owner
    await transporter.sendMail({
      from: `"Booking System" <${process.env.ADMIN_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "New Payment Received",
      html: `
        <h2>New Booking</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Nights:</b> ${nights}</p>
        <p><b>Amount:</b> ₦${total.toLocaleString()}</p>
      `,
    });
  }

  res.status(200).send("Webhook received");
}
