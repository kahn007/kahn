const express = require('express')
const router  = express.Router()

const GHL = 'https://services.leadconnectorhq.com'

// Vapi posts here for check_calendar and book_appointment tool calls.
// GHL credentials are passed via custom headers set during Vapi tool registration:
//   x-ghl-token     — GHL private integration token
//   x-ghl-location  — GHL location / sub-account ID
//   x-ghl-calendar  — GHL calendar ID to book into
//   x-ghl-timezone  — default IANA timezone for the agent

router.post('/', async (req, res) => {
  const ghlToken   = req.headers['x-ghl-token']
  const locationId = req.headers['x-ghl-location']
  const calendarId = req.headers['x-ghl-calendar']
  const agentTz    = req.headers['x-ghl-timezone'] || 'America/New_York'

  // Always return 200 — Vapi crashes the call on non-200 from tool webhooks
  if (!ghlToken || !locationId || !calendarId) {
    const toolCalls = req.body?.message?.toolCallList || []
    return res.status(200).json({
      results: toolCalls.map(tc => ({
        toolCallId: tc.id,
        result: 'I apologise, the booking system is not configured yet. Please ask them to call back or take their details manually.',
      }))
    })
  }

  const ghlHeaders = {
    Authorization:  `Bearer ${ghlToken}`,
    Version:        '2021-07-28',
    'Content-Type': 'application/json',
  }

  // Vapi sends a message object with a toolCallList
  const toolCalls = req.body?.message?.toolCallList || []
  if (toolCalls.length === 0) {
    return res.status(200).json({ results: [] })
  }

  const results = await Promise.all(toolCalls.map(async (tc) => {
    const name = tc.function?.name
    let args = {}
    try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}

    try {
      // ── check_calendar ─────────────────────────────────────────────────
      if (name === 'check_calendar') {
        const date = args.date          // YYYY-MM-DD
        const tz   = args.timezone || agentTz

        const startMs = new Date(date + 'T00:00:00').getTime()
        const endMs   = new Date(date + 'T23:59:59').getTime()

        const slotsRes = await fetch(
          `${GHL}/calendars/${calendarId}/free-slots` +
          `?startDate=${startMs}&endDate=${endMs}&timezone=${encodeURIComponent(tz)}`,
          { headers: ghlHeaders },
        )

        if (!slotsRes.ok) {
          return { toolCallId: tc.id, result: 'Unable to retrieve available slots right now. Please ask the caller to try a different date.' }
        }

        const data  = await slotsRes.json()
        // GHL returns { availableSlots: { "2025-04-10": { slots: ["ISO..."] } } }
        const slotsData = data.availableSlots || data.slots || {}
        let slotTimes = []
        if (typeof slotsData === 'object' && !Array.isArray(slotsData)) {
          Object.values(slotsData).forEach(dayData => {
            if (Array.isArray(dayData)) slotTimes.push(...dayData)
            else if (dayData?.slots) slotTimes.push(...dayData.slots)
          })
        } else if (Array.isArray(slotsData)) {
          slotTimes = slotsData
        }
        const slots = slotTimes.slice(0, 8)

        if (slots.length === 0) {
          return { toolCallId: tc.id, result: `No available slots on ${date}. Please ask the caller to choose a different date.` }
        }

        const formatted = slots.map(s => {
          const iso = s.startTime || s.time || s
          const display = new Date(iso).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz,
          })
          return `${display} [${iso}]`
        }).join('\n')

        return { toolCallId: tc.id, result: `Available slots on ${date}:\n${formatted}` }
      }

      // ── book_appointment ────────────────────────────────────────────────
      if (name === 'book_appointment') {
        const { contactName, contactPhone, contactEmail, startTime, timezone: apptTz, notes } = args
        const tz = apptTz || agentTz

        // 1. Find or create contact
        let contactId = null

        if (contactPhone) {
          const search = await fetch(
            `${GHL}/contacts/?locationId=${locationId}&query=${encodeURIComponent(contactPhone)}&limit=1`,
            { headers: ghlHeaders },
          )
          if (search.ok) {
            const sd = await search.json()
            contactId = (sd.contacts || [])[0]?.id || null
          }
        }

        if (!contactId) {
          const parts = (contactName || '').trim().split(/\s+/)
          const create = await fetch(`${GHL}/contacts/`, {
            method: 'POST',
            headers: ghlHeaders,
            body: JSON.stringify({
              locationId,
              firstName: parts[0] || contactName || 'Unknown',
              lastName:  parts.slice(1).join(' ') || '',
              phone:     contactPhone,
              email:     contactEmail,
            }),
          })
          if (create.ok) {
            const cd = await create.json()
            contactId = cd.contact?.id || cd.id || null
          }
        }

        // 2. Book the appointment (30-min default duration)
        const start = new Date(startTime)
        const end   = new Date(start.getTime() + 30 * 60 * 1000)

        const apptRes = await fetch(`${GHL}/calendars/${calendarId}/appointments`, {
          method: 'POST',
          headers: ghlHeaders,
          body: JSON.stringify({
            calendarId,
            locationId,
            contactId,
            startTime:        start.toISOString(),
            endTime:          end.toISOString(),
            title:            `Call with ${contactName || 'Caller'}`,
            appointmentStatus: 'confirmed',
            selectedTimezone:  tz,
            ...(notes ? { notes } : {}),
          }),
        })

        if (!apptRes.ok) {
          const errJson = await apptRes.json().catch(() => ({}))
          return { toolCallId: tc.id, result: `Booking failed: ${errJson.message || apptRes.status}. Please apologize and ask them to try again.` }
        }

        const appt = await apptRes.json()
        const bookedAt = new Date(appt.startTime || startTime).toLocaleString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz,
        })

        return {
          toolCallId: tc.id,
          result: `Appointment confirmed for ${bookedAt}.${contactEmail ? ` A confirmation has been sent to ${contactEmail}.` : ''}`,
        }
      }

      return { toolCallId: tc.id, result: 'Unknown tool — no action taken.' }

    } catch (err) {
      console.error(`[GHL Booking] ${name} error:`, err.message)
      return { toolCallId: tc.id, result: `Something went wrong: ${err.message}` }
    }
  }))

  res.json({ results })
})

module.exports = router
