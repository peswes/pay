import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // ✅ Allow frontend requests (replace * with your frontend domain in production)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { name, email, checkIn, checkOut, amount } = req.body;

  if (!name || !email || !checkIn || !checkOut || !amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // ✅ Initialize Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Convert to kobo
        callback_url: "https://chezvous.github.io/success.html", // ✅ replace with your actual success page
        metadata: {
          name,
          checkIn,
          checkOut,
          total: amount,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("❌ Paystack initialization failed:", paystackData);
      return res.status(400).json({
        message: "Paystack initialization failed",
        details: paystackData,
      });
    }

    // ✅ Email notifications setup
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, // your email (e.g. Gmail or Zoho)
        pass: process.env.EMAIL_PASS, // your app password
      },
    });

    const ownerMail = process.env.OWNER_EMAIL || "owner@example.com";
    const paymentLink = paystackData.data.authorization_url;

    // ✅ Send confirmation to client
    await transporter.sendMail({
      from: `"Chez Nous Chez Vous Apartments" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Payment Initialization Successful — Chez Nous Chez Vous Apartments",
      html: `
        <h2>Dear ${name},</h2>
        <p>Your booking from <b>${checkIn}</b> to <b>${checkOut}</b> has been initialized.</p>
        <p>Total Amount: <b>₦${amount.toLocaleString()}</b></p>
        <p>Click the button below to complete your payment:</p>
        <p>
          <a href="${paymentLink}"
            style="background:#ff7f00;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
            Complete Payment
          </a>
        </p>
        <br>
        <p>Thank you for choosing Chez Nous Chez Vous Apartments!</p>
      `,
    });

    // ✅ Notify owner
    await transporter.sendMail({
      from: `"Chez Nous Chez Vous Website" <${process.env.EMAIL_USER}>`,
      to: ownerMail,
      subject: "New Booking Payment Started",
      html: `
        <h3>New Booking Payment Started</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Check-in:</b> ${checkIn}</p>
        <p><b>Check-out:</b> ${checkOut}</p>
        <p><b>Amount:</b> ₦${amount.toLocaleString()}</p>
        <p>Payment Link: <a href="${paymentLink}">${paymentLink}</a></p>
      `,
    });

    // ✅ Return Paystack authorization URL to frontend
    res.status(200).json({
      status: "success",
      authorization_url: paymentLink,
      message: "Payment initialized successfully",
    });
  } catch (error) {
    console.error("🔥 Server Error:", error);
    res.status(500).json({
      message: "Server error during payment initialization",
      error: error.message,
    });
  }
}
