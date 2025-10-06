import nodemailer from "nodemailer";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { name, email, checkIn, checkOut, amount } = req.body;
  if (!name || !email || !checkIn || !checkOut || !amount)
    return res.status(400).json({ message: "Missing required fields" });

  try {
    // Initialize Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // must be integer in kobo
        callback_url: "https://peswes.github.io/pay/success.html",
        metadata: { name, checkIn, checkOut, total: amount },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("❌ Paystack initialization failed:", paystackData);
      return res.status(400).json({ message: "Paystack initialization failed", details: paystackData });
    }

    // Email setup
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const ownerMail = process.env.OWNER_EMAIL || "owner@example.com";
    const paymentLink = paystackData.data.authorization_url;

    // Send client email
    await transporter.sendMail({
      from: `"Chez Nous Chez Vous Apartments" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Payment Initialization Successful",
      html: `
        <h2>Dear ${name},</h2>
        <p>Your booking from <b>${checkIn}</b> to <b>${checkOut}</b> has been initialized.</p>
        <p>Total Amount: <b>₦${amount.toLocaleString()}</b></p>
        <p><a href="${paymentLink}" style="background:#ff7f00;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Complete Payment</a></p>
      `,
    });

    // Send owner email
    await transporter.sendMail({
      from: `"Chez Nous Chez Vous Website" <${process.env.EMAIL_USER}>`,
      to: ownerMail,
      subject: "New Booking Payment Started",
      html: `
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Check-in:</b> ${checkIn}</p>
        <p><b>Check-out:</b> ${checkOut}</p>
        <p><b>Amount:</b> ₦${amount.toLocaleString()}</p>
        <p>Payment Link: <a href="${paymentLink}">${paymentLink}</a></p>
      `,
    });

    // Return authorization URL AND public key
    res.status(200).json({
      status: "success",
      authorization_url: paymentLink,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (error) {
    console.error("🔥 Server Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}
