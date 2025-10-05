import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { name, email, nights, total } = req.body;

  try {
    // ✅ Initialize Paystack transaction using built-in fetch
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: total * 100, // convert to kobo
        callback_url: "https://your-frontend-domain.com/success.html",
        metadata: { name, nights, total },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return res.status(400).json({ message: "Paystack initialization failed" });
    }

    // ✅ Send email notification to the customer & owner
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER, // e.g., your Gmail or Zoho email
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    const ownerMail = process.env.OWNER_EMAIL || "owner@example.com";

    const mailOptionsClient = {
      from: `"Chez Nous Chez Vous Apartments" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Payment Initialization Successful",
      html: `
        <h3>Dear ${name},</h3>
        <p>Your payment for <b>${nights}</b> night(s) at Chez Nous Chez Vous Apartments has been initialized.</p>
        <p>Total amount: <b>₦${total.toLocaleString()}</b></p>
        <p>Click below to complete your payment:</p>
        <a href="${paystackData.data.authorization_url}" 
          style="background:#ff7f00;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
          Pay Now
        </a>
        <br><br>
        <small>Thank you for choosing Chez Nous Chez Vous Apartments.</small>
      `,
    };

    const mailOptionsOwner = {
      from: `"Chez Nous Chez Vous Website" <${process.env.EMAIL_USER}>`,
      to: ownerMail,
      subject: "New Payment Initialization",
      html: `
        <h3>New Booking Payment Started</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Nights:</b> ${nights}</p>
        <p><b>Amount:</b> ₦${total.toLocaleString()}</p>
        <p>Transaction Link: <a href="${paystackData.data.authorization_url}">${paystackData.data.authorization_url}</a></p>
      `,
    };

    await transporter.sendMail(mailOptionsClient);
    await transporter.sendMail(mailOptionsOwner);

    // ✅ Send back the Paystack authorization URL
    res.status(200).json({
      authorization_url: paystackData.data.authorization_url,
    });
  } catch (error) {
    console.error("Error initializing payment:", error);
    res.status(500).json({ message: "Server error during payment initialization" });
  }
}
