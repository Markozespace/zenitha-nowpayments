import fetch from 'node-fetch';
import { Resend } from 'resend';

// Initialize Resend with your API key from Vercel environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id, email, total_price, currency } = req.body;

    if (!email) {
      throw new Error('Customer email is missing');
    }

    // Shopify order ID may be too large — take last 8 digits to ensure a safe number
    const orderId = Number(String(id).slice(-8));
    if (isNaN(orderId)) {
      throw new Error('Invalid order ID from Shopify');
    }

    const amount = parseFloat(total_price);
    const orderCurrency = currency ? currency.toUpperCase() : 'EUR';

    // ✅ Create NOWPayments invoice (supports all main fiat + crypto)
    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: orderCurrency,
        order_id: orderId,
        order_description: `Order #${orderId} from Zenitha`,
        success_url: 'https://zenitha.me/pages/success',
        cancel_url: 'https://zenitha.me/pages/cancel',
        is_fee_paid_by_user: true
      }),
    });

    const data = await response.json();
    console.log('NOWPayments response:', data);

    if (!data.invoice_url) {
      throw new Error(`NOWPayments error: ${data.message || 'Missing invoice URL'}`);
    }

    const paymentLink = data.invoice_url;

    // ✅ Send email to customer
    await resend.emails.send({
      from: 'Zenitha <info@zenitha.me>',
      to: email,
      subject: `Your Zenitha payment link (Order #${orderId})`,
      html: `
        <h2>Thank you for your order!</h2>
        <p>Please complete your payment securely using the link below:</p>
        <p><a href="${paymentLink}" target="_blank">💳 Pay Now</a></p>
        <p>Amount: <b>${amount} ${orderCurrency}</b></p>
        <p>If you've already paid, please ignore this message.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      invoice_url: paymentLink,
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ error: error.message });
  }
}