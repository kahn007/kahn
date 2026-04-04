export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.json({ status: 'ok', service: 'kahn-ghl-booking', timestamp: new Date().toISOString() })
}
