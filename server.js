const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
// Solo la cartella public è esposta: server.js, package.json e node_modules restano privati
app.use(express.static(path.join(__dirname, 'public')));

// ─── Rate limit minimale in memoria: max 5 richieste al minuto per IP ─────────
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear(); // evita crescita illimitata
  return recent.length > 5;
}

// ─── Iscrizione email via Brevo + notifica Pina ───────────────────────────────
app.post('/api/subscribe', async (req, res) => {
  const { email, interesse, azienda } = req.body;

  // Honeypot: il campo "azienda" è invisibile agli umani — se è pieno è un bot.
  // Rispondiamo success per non dargli indizi, ma non salviamo nulla.
  if (azienda) return res.json({ success: true });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Email non valida' });
  }
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: 'Troppe richieste, riprova tra poco' });
  }

  const listaId = interesse === 'app' ? 5 : 6; // Lista 5 = app turni, Lista 6 = follower
  const interesseLabel = interesse === 'app' ? '🔧 Vuole provare l\'app turni' : '👀 Vuole seguire il progetto';

  try {
    // Salva su Brevo
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email,
        listIds: [listaId],
        attributes: { INTERESSE: interesse },
        updateEnabled: true
      })
    });

    if (response.ok || response.status === 204) {
      console.log(`✅ Nuova iscrizione: ${email} — ${interesseLabel}`);

      // Notifica Pina su Telegram — se fallisce l'iscrizione resta comunque valida
      if (process.env.TELEGRAM_TOKEN && process.env.ANDREA_TELEGRAM_ID) {
        try {
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: process.env.ANDREA_TELEGRAM_ID,
              text: `📬 Nuova iscrizione su Retailab!\n\n📧 ${email}\n${interesseLabel}`
            })
          });
        } catch (tgErr) {
          console.error('Notifica Telegram fallita:', tgErr);
        }
      }

      res.json({ success: true });
    } else {
      const err = await response.json();
      console.error('Errore Brevo:', err);
      res.status(500).json({ error: 'Errore iscrizione' });
    }
  } catch (err) {
    console.error('Errore:', err);
    res.status(500).json({ error: 'Errore server' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Retailab site online sulla porta ${PORT}`);
});
