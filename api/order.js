// api/order.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    const order = req.body;

    // Get order amount and currency from Shopify
    const amount = order.total_price;
    const orderCurrency = order.currency ? order.currency.toUpperCase() : 'EUR';
    const NOW_API_KEY = process.env.NOWPAYMENTS_API_KEY;

    // --- SUPPORTED CURRENCIES ---
    const supportedFiat = [
      'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'
    ];

    const supportedCrypto = [
      'BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX'
    ];

    // Determine pay_currency
    let payCurrency;
    if (supportedFiat.includes(orderCurrency)) {
      payCurrency = 'BTC'; // default crypto for fiat orders
    } else if (supportedCrypto.includes(orderCurrency)) {
      payCurrency = orderCurrency;
    } else {
      payCurrency = 'BTC'; // fallback
    }

    // --- Fix for safe order_id ---
    // Shopify order.id can be too large for JS, so we use order_number
    const safeOrderId = parseInt(order.order_number);

    // --- Create payment on NOWPayments ---
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': NOW_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: orderCurrency,
        pay_currency: payCurrency,
        order_id: safeOrderId,
        order_description: `Order #${order.name} from Zenitha`
      })
    });

    const data = await response.json();
    console.log('NOWPayments response:', data);

    if (!response.ok) {
      throw new Error(`NOWPayments error: ${data.message || JSON.stringify(data)}`);
    }

    // Return the unique payment link
    return res.status(200).json({
      message: 'Payment link created successfully',
      order_id: safeOrderId,
      fiat_currency: orderCurrency,
      crypto_currency: payCurrency,
      payment_url: data.invoice_url || data.payment_url
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ error: error.message || 'Error creating payment' });
  }
}