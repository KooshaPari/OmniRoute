import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = String(req.query.slug || 'default');
  const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const jsonUrl = `${base}/api/schedule/${slug}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Book: ${slug}</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px;}
      .slot{display:flex;align-items:center;gap:8px;margin:6px 0;padding:8px;border:1px solid #ddd;border-radius:8px}
      button{padding:8px 12px;border:0;border-radius:6px;background:#5865F2;color:#fff;cursor:pointer}
      input,textarea{width:100%;padding:8px;margin:4px 0 12px;border:1px solid #ccc;border-radius:6px}
      .row{display:flex;gap:12px}
      .row > *{flex:1}
      .ok{color:#10b981}
      .err{color:#ef4444}
    </style>
  </head>
  <body>
    <h1>Booking: ${slug}</h1>
    <div id="loading">Loading available slots…</div>
    <div id="slots"></div>
    <h2>Details</h2>
    <div class="row">
      <div>
        <label>Title</label>
        <input id="title" placeholder="Meeting title" />
      </div>
      <div>
        <label>Attendee email (optional)</label>
        <input id="email" placeholder="you@example.com" />
      </div>
    </div>
    <label>Description (optional)</label>
    <textarea id="desc" rows="3" placeholder="Agenda or context"></textarea>
    <button id="bookBtn" disabled>Book Selected</button>
    <div id="result"></div>
    <script>
      const jsonUrl = ${JSON.stringify(jsonUrl)};
      let selected = null;
      async function load() {
        const r = await fetch(jsonUrl);
        const j = await r.json();
        document.getElementById('loading').style.display = 'none';
        const wrap = document.getElementById('slots');
        if (!j.slots || !j.slots.length) { wrap.innerHTML = '<p>No slots available.</p>'; return; }
        j.slots.forEach((s, idx) => {
          const d = document.createElement('div');
          d.className = 'slot';
          const id = 'slot_'+idx;
          d.innerHTML = 
            '<input type="radio" name="slot" id="'+id+'" />' +
            '<label for="'+id+'">'+new Date(s.start).toISOString().slice(0,16).replace('T',' ')+' → '+new Date(s.end).toISOString().slice(11,16)+' UTC</label>';
          d.querySelector('input').addEventListener('change', () => { selected = s; document.getElementById('bookBtn').disabled = false; });
          wrap.appendChild(d);
        });
      }
      load();
      document.getElementById('bookBtn').addEventListener('click', async () => {
        const title = document.getElementById('title').value || 'Meeting';
        const email = document.getElementById('email').value;
        const description = document.getElementById('desc').value;
        if (!selected) return;
        const resEl = document.getElementById('result');
        resEl.textContent = 'Booking…';
        try {
          const r = await fetch(jsonUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start: selected.start, end: selected.end, title, description, attendees: email ? [email] : [] }) });
          const j = await r.json();
          if (r.ok) {
            resEl.innerHTML = '<p class="ok">Booked!</p>' + (j.booking?.conferenceUrl ? '<p><a href="'+j.booking.conferenceUrl+'">Join link</a></p>' : '') + (j.booking?.htmlLink ? '<p><a href="'+j.booking.htmlLink+'">Calendar</a></p>' : '');
          } else {
            resEl.innerHTML = '<p class="err">'+(j.error || 'Failed')+'</p>';
          }
        } catch (e) {
          resEl.innerHTML = '<p class="err">'+(e?.message || e)+'</p>';
        }
      });
    </script>
  </body>
  </html>`);
}

