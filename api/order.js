// api/order.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    const order = req.body;

    // Order details from Shopify webhook
    const amount = order.total_price;
    const orderCurrency = order.currency ? order.currency.toUpperCase() : 'EUR';
    const NOW_API_KEY = process.env.NOWPAYMENTS_API_KEY;

    // --- SUPPORTED CURRENCIES CONFIG ---
    const supportedFiat = [
      'USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'
    ];

    const supportedCrypto = [
      'BTC', 'ETH', 'USDT', 'USDC', 'XRP', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX'
    ];

    // Default pay currency
    let payCurrency;

    // --- LOGIC ---
    // If Shopify order is in fiat → offer crypto conversion
    if (supportedFiat.includes(orderCurrency)) {
      payCurrency = 'BTC'; // default crypto target
    }
    // If order is already in crypto (e.g. from custom logic later)
    else if (supportedCrypto.includes(orderCurrency)) {
      payCurrency = orderCurrency;
    }
    // If unknown currency, fallback to EUR→BTC
    else {
      payCurrency = 'BTC';
    }

    // --- CREATE PAYMENT ON NOWPayments ---
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
        order_id: order.id,
        order_description: `Order #${order.name} from Zenitha`
      })
    });

    const data = await response.json();
    console.log('NOWPayments response:', data);

    if (!response.ok) {
      throw new Error(`NOWPayments error: ${data.message || JSON.stringify(data)}`);
    }

    // --- RETURN UNIQUE LINK ---
    return res.status(200).json({
      message: 'Payment link created successfully',
      order_id: order.id,
      fiat_currency: orderCurrency,
      crypto_currency: payCurrency,
      payment_url: data.invoice_url || data.payment_url
    });

  } catch (error) {
    console.error('Error creating payment:', error);
    return res.status(500).json({ error: error.message || 'Error creating payment' });
  }
}

