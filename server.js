require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { v4: uuidv4 } = require('uuid');

// Database setup
const Database = require('better-sqlite3');
const db = new Database('./data/bookings.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year TEXT,
    vehicle_registration TEXT,
    services TEXT NOT NULL,
    total_price INTEGER NOT NULL,
    notes TEXT,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    stripe_session_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://www.google.com", "https://maps.google.com"],
      connectSrc: ["'self'", "https://api.stripe.com"]
    }
  }
}));

app.use(cors());

// Trust proxy (for rate limiting behind Traefik)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Parse JSON for API routes (except webhook)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get services with pricing
app.get('/api/services', (req, res) => {
  res.json(require('./config/services.json'));
});

// Create booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleRegistration,
      services,
      notes,
      appointmentDate,
      appointmentTime,
      language
    } = req.body;

    // Calculate total price
    const servicesData = require('./config/services.json');
    let totalPrice = 0;
    const selectedServices = [];

    services.forEach(serviceId => {
      for (const category of servicesData.categories) {
        const service = category.services.find(s => s.id === serviceId);
        if (service && service.price) {
          totalPrice += service.price;
          selectedServices.push(service);
        }
      }
    });

    const bookingId = uuidv4();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: selectedServices.map(service => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: service.name[language] || service.name.en,
            description: `Car Fix Garage - ${service.name[language] || service.name.en}`
          },
          unit_amount: service.price * 100 // Stripe uses cents
        },
        quantity: 1
      })),
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/?booking=cancelled`,
      customer_email: customerEmail,
      metadata: {
        bookingId,
        appointmentDate,
        appointmentTime
      }
    });

    // Save booking to database
    const stmt = db.prepare(`
      INSERT INTO bookings (
        id, customer_name, customer_email, customer_phone,
        vehicle_make, vehicle_model, vehicle_year, vehicle_registration,
        services, total_price, notes, appointment_date, appointment_time,
        stripe_session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      bookingId,
      customerName,
      customerEmail,
      customerPhone,
      vehicleMake || '',
      vehicleModel || '',
      vehicleYear || '',
      vehicleRegistration || '',
      JSON.stringify(services),
      totalPrice,
      notes || '',
      appointmentDate,
      appointmentTime,
      session.id
    );

    res.json({
      bookingId,
      checkoutUrl: session.url,
      totalPrice
    });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Quote request (for services without fixed price)
app.post('/api/quote-request', (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleRegistration,
      services,
      notes
    } = req.body;

    const quoteId = uuidv4();

    const stmt = db.prepare(`
      INSERT INTO bookings (
        id, customer_name, customer_email, customer_phone,
        vehicle_make, vehicle_model, vehicle_year, vehicle_registration,
        services, total_price, notes, appointment_date, appointment_time,
        status, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      quoteId,
      customerName,
      customerEmail,
      customerPhone,
      vehicleMake || '',
      vehicleModel || '',
      vehicleYear || '',
      vehicleRegistration || '',
      JSON.stringify(services),
      0,
      notes || '',
      'TBD',
      'TBD',
      'quote_requested',
      'quote'
    );

    res.json({
      quoteId,
      message: 'Quote request submitted successfully'
    });
  } catch (error) {
    console.error('Quote request error:', error);
    res.status(500).json({ error: 'Failed to submit quote request' });
  }
});

// Stripe webhook.
// Every event must carry a valid Stripe-Signature for STRIPE_WEBHOOK_SECRET.
// Without a usable secret the endpoint refuses everything (fail closed):
// parsing an unsigned body would let anyone mark a booking paid.
function usableWebhookSecret() {
  const s = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!s.startsWith('whsec_') || s.startsWith('whsec_placeholder')) return null;
  return s;
}

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = usableWebhookSecret();
  if (!secret) {
    console.error('Webhook refused: STRIPE_WEBHOOK_SECRET is missing or a placeholder');
    return res.status(500).send('Webhook not configured');
  }
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Missing stripe-signature');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status !== 'paid') {
      console.log('Checkout completed but not paid yet:', session.id);
      return res.json({ received: true });
    }

    const stmt = db.prepare(`
      UPDATE bookings
      SET payment_status = 'paid', status = 'confirmed'
      WHERE stripe_session_id = ?
    `);
    stmt.run(session.id);

    console.log('Payment confirmed for session:', session.id);
  }

  res.json({ received: true });
});

// Get booking status
app.get('/api/bookings/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM bookings WHERE id = ? OR stripe_session_id = ?');
  const booking = stmt.get(req.params.id, req.params.id);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  res.json({
    id: booking.id,
    status: booking.status,
    paymentStatus: booking.payment_status,
    appointmentDate: booking.appointment_date,
    appointmentTime: booking.appointment_time,
    totalPrice: booking.total_price
  });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Car Fix Garage server running on port ${PORT}`);
});
