import fetch from 'node-fetch';

import { Resend } from 'resend';

 

// Initialize Resend with your API key from Vercel environment variables

const resend = new Resend(process.env.RESEND_API_KEY);

 

export default async function handler(req, res) {

  if (req.method !== 'POST') {

    return res.status(405).json({ message: 'Method not allowed' });

  }

 

  try {

    // Grab Shopify order data

    const { id, email, total_price, currency, customer } = req.body;

 

    // Ensure we have a valid customer email

    const customerEmail = email || customer?.email || 'info@zenitha.me';

    console.log('Customer email for order:', customerEmail);

 

    // Shopify order ID may be too large — take last 8 digits to ensure a safe number

    const orderId = Number(String(id).slice(-8));

    if (isNaN(orderId)) {

      throw new Error('Invalid order ID from Shopify');

    }

 

    const amount = parseFloat(total_price);

    const orderCurrency = currency ? currency.toUpperCase() : 'EUR';

 

    // Create NOWPayments invoice (supports all main fiat + crypto)

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

        is_fee_paid_by_user: true,

      }),

    });

 

    const data = await response.json();

    console.log('NOWPayments response:', data);

 

    if (!data.invoice_url) {

      throw new Error(`NOWPayments error: ${data.message || 'Missing invoice URL'}`);

    }

 

    const paymentLink = data.invoice_url;

    console.log('Payment link:', paymentLink);

 

    // Send email to customer via Resend

    try {

      const sendRes = await resend.emails.send({

        from: 'Zenitha <info@zenitha.me>',

        to: customerEmail,

        subject: `Your Zenitha payment link (Order #${orderId})`,

        html: `

          <h2>Thank you for your order!</h2>

          <p>Please complete your payment securely using the link below, fast and encrypted:</p>

          <p><a href="${paymentLink}" target="_blank">Pay Now</a></p>

          <p>Amount: <b>${amount} ${orderCurrency}</b></p>

          <p>If you've already paid, please ignore this message.</p>

          <p style="margin-top:20px;">

            <img src="https://cdn.shopify.com/s/files/1/0663/6522/7169/files/Zenitha_Logo.png?v=1758033599"

                 alt="Zenitha Logo"

                 style="width:2cm; height:2cm;">

          </p>

        `,

      });

      console.log('Resend send response:', JSON.stringify(sendRes, null, 2));

    } catch (err) {

      console.error('Resend send error:', err && err.toString ? err.toString() : err);

    }

 

    // Return success response

    return res.status(200).json({

      success: true,

      invoice_url: paymentLink,

    });

 

  } catch (error) {

    console.error('Error creating payment:', error);

    return res.status(500).json({ error: error.message });

  }

}