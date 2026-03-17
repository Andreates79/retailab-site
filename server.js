const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Iscrizione email via Brevo ───────────────────────────────────────────────
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email mancante' });

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email,
        listIds: [2],
        updateEnabled: true
      })
    });

    if (response.ok || response.status === 204) {
      console.log('✅ Nuova iscrizione:', email);
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
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Retailab site online sulla porta ${PORT}`);
});
