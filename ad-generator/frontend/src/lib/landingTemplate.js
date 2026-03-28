// landingTemplate.js
// Pre-built landing page template. Claude generates content JSON only — not HTML.
// renderLandingPage(content, pc) assembles the final page.

export function renderLandingPage(content, pc) {
  const c = content

  // ── Design tokens ──────────────────────────────────────────────
  const bg        = pc.bg        || '#080c14'
  const bg2       = pc.surface   || '#0d1422'
  const bg3       = pc.bg3       || '#131929'
  const accent    = pc.accent    || '#6c63ff'
  const accent2   = pc.accent2   || '#8b5cf6'
  const text      = pc.textColor || '#f1f5f9'
  const muted     = pc.light ? '#64748b' : '#94a3b8'
  const border    = pc.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'
  const brand     = pc.companyName || 'Company'
  const ctaUrl    = pc.ctaUrl || '#'
  const trust     = pc.trustMetric || '2,400+ customers'
  const logoHtml  = pc.logoSrc
    ? `<img src="${pc.logoSrc}" alt="${brand}" style="height:32px;object-fit:contain;display:inline-block;">`
    : `<div style="width:32px;height:32px;border-radius:8px;background:${accent};flex-shrink:0;display:inline-block;vertical-align:middle;"></div>`

  // ── Content defaults ───────────────────────────────────────────
  const ctaText    = c.ctaText    || 'Get Started'
  const avatars    = (c.avatarInitials || ['JM','KL','AR','TS','BP']).slice(0, 5)
  const heroMetrics  = c.heroMetrics  || []
  const trustCos     = c.trustCompanies || []
  const stats        = c.stats        || []
  const painItems    = c.painItems    || []
  const features     = c.features     || []
  const steps        = c.steps        || []
  const testimonials = c.testimonials || []
  const compRows     = c.comparisonRows || []
  const faqItems     = c.faqItems     || []

  // ── Build avatar stack ─────────────────────────────────────────
  const avatarHtml = avatars.map((ini, i) =>
    `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,${accent},${accent2});border:2px solid ${bg};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;${i > 0 ? 'margin-left:-10px;' : ''}flex-shrink:0;">${ini}</div>`
  ).join('')

  // ── Hero metrics ───────────────────────────────────────────────
  const heroMetricsHtml = heroMetrics.map((m, i) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;${i < heroMetrics.length - 1 ? `border-bottom:1px solid ${border};` : ''}">
      <span style="font-size:13px;color:${muted}">${m.label}</span>
      <span style="font-size:18px;font-weight:800;color:${accent}">${m.value}</span>
    </div>`
  ).join('')

  // ── Bar chart ──────────────────────────────────────────────────
  const barHeights = [35, 55, 42, 70, 58, 82, 90]
  const barsHtml = barHeights.map((h, i) =>
    `<div style="flex:1;height:${h}%;border-radius:3px 3px 0 0;background:${i === barHeights.length - 1 ? `linear-gradient(to top,${accent},${accent2})` : accent + '80'};"></div>`
  ).join('')

  // ── Trust companies ────────────────────────────────────────────
  const trustCoHtml = trustCos.map((co, i) =>
    `${i > 0 ? `<span style="width:1px;height:14px;background:${border};display:inline-block;vertical-align:middle;margin:0 4px;"></span>` : ''}<span style="font-size:14px;font-weight:600;color:${text}80;">${co}</span>`
  ).join('')

  // ── Stats row ──────────────────────────────────────────────────
  const statsHtml = stats.map((s, i) =>
    `<div class="sc" style="padding:32px 24px;text-align:center;${i > 0 ? `border-left:1px solid ${border};` : ''}">
      <div style="font-size:clamp(28px,4vw,44px);font-weight:900;color:${accent};letter-spacing:-0.03em;line-height:1;">${s.value}</div>
      <div style="font-size:14px;font-weight:700;color:${text};margin-top:6px;">${s.label}</div>
      <div style="font-size:12px;color:${muted};margin-top:3px;">${s.sub || ''}</div>
    </div>`
  ).join('')

  // ── Pain items ─────────────────────────────────────────────────
  const painHtml = painItems.map((p) =>
    `<div style="display:flex;gap:14px;padding:20px 0;border-bottom:1px solid ${border};">
      <div style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#ef444418;border:1px solid #ef444438;display:flex;align-items:center;justify-content:center;margin-top:2px;">
        <span style="font-size:11px;color:#ef4444;font-weight:900;line-height:1;">✕</span>
      </div>
      <div>
        <div style="font-size:15px;font-weight:700;color:${text};margin-bottom:5px;">${p.headline}</div>
        <div style="font-size:14px;color:${muted};line-height:1.65;">${p.body}</div>
      </div>
    </div>`
  ).join('')

  // ── Feature cards ──────────────────────────────────────────────
  const featuresHtml = features.map((f) =>
    `<div class="feat-card" style="background:${bg3};border:1px solid ${border};border-radius:16px;padding:28px;transition:border-color .2s,transform .22s,box-shadow .22s;">
      <div style="width:46px;height:46px;border-radius:12px;background:${accent}18;border:1px solid ${accent}28;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px;">${f.icon || '⚡'}</div>
      <div style="font-size:16px;font-weight:700;color:${text};margin-bottom:10px;">${f.headline}</div>
      <div style="font-size:14px;color:${muted};line-height:1.65;">${f.body}</div>
    </div>`
  ).join('')

  // ── How it works steps ─────────────────────────────────────────
  const stepsHtml = steps.map((s, i) =>
    `<div class="step-div" style="flex:1;${i < steps.length - 1 ? 'padding-right:40px;' : ''}position:relative;">
      ${i < steps.length - 1 ? `<div class="step-connector" style="position:absolute;top:22px;right:0;width:28px;height:1px;background:linear-gradient(90deg,${border},${accent}60);"></div>` : ''}
      <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,${accent},${accent2});display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;margin-bottom:18px;">${s.num}</div>
      <div style="font-size:17px;font-weight:700;color:${text};margin-bottom:8px;">${s.headline}</div>
      <div style="font-size:14px;color:${muted};line-height:1.65;">${s.body}</div>
    </div>`
  ).join('')

  // ── Testimonial cards ──────────────────────────────────────────
  const testiHtml = testimonials.map((t) => {
    const initials = t.initials || (t.author || 'AB').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
    return `<div style="background:${bg3};border:1px solid ${border};border-radius:16px;padding:28px;">
      <div style="color:#f59e0b;font-size:13px;letter-spacing:2px;margin-bottom:14px;">★★★★★</div>
      <p style="font-size:15px;line-height:1.7;color:${text};margin-bottom:20px;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,${accent},${accent2});display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0;">${initials}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:${text};">${t.author}</div>
          <div style="font-size:12px;color:${muted};">${t.role}</div>
        </div>
      </div>
    </div>`
  }).join('')

  // ── Comparison rows ────────────────────────────────────────────
  const compHtml = compRows.map((r, i) =>
    `<tr style="${i % 2 === 1 ? `background:${bg2};` : ''}">
      <td style="padding:15px 20px;font-size:14px;color:${muted};font-weight:500;border-right:1px solid ${border};">${r.aspect}</td>
      <td style="padding:15px 20px;font-size:14px;color:${text};font-weight:600;border-right:1px solid ${border};">
        <span style="display:inline-flex;align-items:center;gap:7px;"><span style="color:#10b981;font-size:13px;font-weight:900;">✓</span>${r.us}</span>
      </td>
      <td style="padding:15px 20px;font-size:14px;color:${muted}99;">
        <span style="display:inline-flex;align-items:center;gap:7px;"><span style="color:#ef4444;font-size:13px;font-weight:900;">✕</span>${r.them}</span>
      </td>
    </tr>`
  ).join('')

  // ── FAQ items ──────────────────────────────────────────────────
  const faqHtml = faqItems.map((f, i) =>
    `<div class="faq-item" style="border-bottom:1px solid ${border};${i === 0 ? `border-top:1px solid ${border};` : ''}">
      <button class="faq-btn" onclick="toggleFaq(this)" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:20px 0;background:none;border:none;cursor:pointer;text-align:left;gap:16px;">
        <span style="font-size:15px;font-weight:600;color:${text};">${f.q}</span>
        <span class="faq-icon" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${bg3};border:1px solid ${border};display:flex;align-items:center;justify-content:center;color:${muted};font-size:18px;line-height:1;transition:transform .25s,background .2s,color .2s;">+</span>
      </button>
      <div class="faq-body" style="display:none;padding-bottom:20px;">
        <p style="font-size:15px;color:${muted};line-height:1.75;">${f.a}</p>
      </div>
    </div>`
  ).join('')

  const featuredInitials = (c.featuredAuthor || 'AB').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
  const year = new Date().getFullYear()

  // ── Full page HTML ─────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.pageTitle || `${brand} — ${c.headlinePlain || 'Landing Page'}`}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:${bg};color:${text};-webkit-font-smoothing:antialiased;line-height:1.6;}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.wrap{max-width:1100px;margin:0 auto;padding:0 28px}
.g{background:linear-gradient(135deg,${accent},${accent2});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,${accent},${accent2});color:#fff!important;font-family:'Inter',sans-serif;font-weight:700;font-size:15px;padding:14px 30px;border-radius:12px;border:none;cursor:pointer;text-decoration:none!important;transition:filter .2s,transform .2s,box-shadow .2s;box-shadow:0 4px 20px ${accent}40;-webkit-text-fill-color:#fff!important;}
.btn:hover{filter:brightness(1.1);transform:translateY(-2px);box-shadow:0 8px 32px ${accent}55}
.btn-ghost{display:inline-flex;align-items:center;gap:8px;background:transparent;color:${text};font-family:'Inter',sans-serif;font-weight:600;font-size:15px;padding:14px 30px;border-radius:12px;border:1.5px solid ${border};cursor:pointer;text-decoration:none;transition:border-color .2s,background .2s;}
.btn-ghost:hover{border-color:${accent};background:${accent}10}
.feat-card:hover{border-color:${accent}45!important;transform:translateY(-4px);box-shadow:0 20px 40px rgba(0,0,0,0.22)!important}
@media(max-width:768px){
  /* Base */
  .wrap{padding:0 18px!important}
  .nav-links{display:none!important}

  /* Sections — override all inline padding:100px */
  section{padding:60px 0!important}
  .sec-hero{padding:96px 0 56px!important;min-height:auto!important}

  /* Hero */
  .hero-grid{grid-template-columns:1fr!important;gap:40px!important}
  .hero-visual{display:none!important}
  .hero-btns{flex-direction:column!important;align-items:stretch!important}
  .hero-btns .btn,.hero-btns .btn-ghost{width:100%;justify-content:center!important;text-align:center!important}

  /* Stats */
  .stats-grid{grid-template-columns:repeat(2,1fr)!important}
  .sc{padding:20px 14px!important}

  /* Pain */
  .pain-grid{grid-template-columns:1fr!important;gap:32px!important}
  .pain-l{position:static!important;margin-bottom:4px;}

  /* Features */
  .feat-grid{grid-template-columns:1fr!important}

  /* Steps */
  .steps-row{flex-direction:column!important;gap:28px!important}
  .steps-row .step-div{padding-right:0!important}
  .step-connector{display:none!important}

  /* Testimonials */
  .testi-grid{grid-template-columns:1fr!important}
  .feat-testi{padding:28px!important}

  /* Footer */
  .footer-grid{grid-template-columns:1fr!important;gap:12px!important}
  .footer-copy{text-align:left!important}

  /* Buttons standalone */
  .btn-full{width:100%!important;justify-content:center!important}
}
</style>
</head>
<body>

<!-- NAVBAR -->
<header id="nb" style="position:fixed;top:0;left:0;right:0;height:64px;background:${bg}ee;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid ${border};z-index:999;transition:box-shadow .3s;">
  <div class="wrap" style="display:flex;align-items:center;justify-content:space-between;height:100%;">
    <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
      ${logoHtml}
      <span style="font-size:16px;font-weight:700;color:${text};margin-left:2px;">${brand}</span>
    </div>
    <nav class="nav-links" style="display:flex;gap:32px;">
      <a href="#features" style="font-size:14px;color:${muted};transition:color .2s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">Features</a>
      <a href="#how" style="font-size:14px;color:${muted};transition:color .2s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">How it works</a>
      <a href="#results" style="font-size:14px;color:${muted};transition:color .2s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">Results</a>
      <a href="#faq" style="font-size:14px;color:${muted};transition:color .2s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">FAQ</a>
    </nav>
    <a class="btn" href="${ctaUrl}" style="font-size:14px;padding:10px 22px;">${ctaText}</a>
  </div>
</header>

<!-- HERO -->
<section class="sec-hero" style="min-height:100vh;display:flex;align-items:center;padding:120px 0 80px;position:relative;overflow:hidden;background:${bg};">
  <div style="position:absolute;top:-150px;right:-120px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,${accent}1a 0%,transparent 65%);pointer-events:none;z-index:0;"></div>
  <div style="position:absolute;bottom:-100px;left:3%;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,${accent2}12 0%,transparent 65%);pointer-events:none;z-index:0;"></div>
  <div class="wrap" style="position:relative;z-index:1;width:100%;">
    <div class="hero-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;">

      <!-- Left: copy -->
      <div>
        <div style="display:inline-flex;align-items:center;gap:8px;background:${accent}15;border:1px solid ${accent}35;padding:7px 18px;border-radius:100px;font-size:13px;color:${accent};margin-bottom:26px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${accent};display:inline-block;flex-shrink:0;"></span>
          ${c.heroPill || '⚡ Built for results that matter'}
        </div>
        <h1 style="font-size:clamp(36px,5.5vw,68px);font-weight:900;line-height:1.06;letter-spacing:-0.035em;color:${text};margin:0 0 22px;">
          ${c.headlineHtml || brand}
        </h1>
        <p style="font-size:18px;line-height:1.7;color:${muted};max-width:500px;margin:0 0 36px;">
          ${c.subheadline || ''}
        </p>
        <div class="hero-btns" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
          <a class="btn" href="${ctaUrl}">${ctaText} →</a>
          <a class="btn-ghost" href="#how">See how it works</a>
        </div>
        <div style="margin-top:26px;display:flex;align-items:center;gap:12px;">
          <div style="display:flex;">${avatarHtml}</div>
          <span style="font-size:14px;color:${muted};">${trust}</span>
        </div>
      </div>

      <!-- Right: visual dashboard -->
      <div class="hero-visual" style="background:${bg2};border:1px solid ${border};border-radius:20px;padding:24px;max-width:460px;width:100%;">
        <!-- Metrics -->
        <div style="background:${bg};border-radius:14px;padding:18px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${muted};">Live Results</span>
            <span style="background:${accent}22;color:${accent};font-size:10px;font-weight:700;padding:3px 9px;border-radius:4px;">● Active</span>
          </div>
          ${heroMetricsHtml}
        </div>
        <!-- Bar chart -->
        <div style="background:${bg};border-radius:14px;padding:14px;margin-bottom:14px;">
          <span style="font-size:11px;color:${muted};font-weight:600;">Performance — last 7 days</span>
          <div style="display:flex;align-items:flex-end;gap:5px;height:52px;margin-top:10px;">${barsHtml}</div>
        </div>
        <!-- Testimonial snippet -->
        <div style="background:${bg};border-radius:14px;padding:14px;">
          <span style="color:#f59e0b;font-size:12px;letter-spacing:2px;">★★★★★</span>
          <p style="font-size:13px;font-style:italic;color:${text};margin:8px 0;line-height:1.5;">"${c.heroQuote || 'Incredible results in the first week.'}"</p>
          <span style="font-size:11px;color:${muted};">— ${c.heroQuoteAuthor || 'A happy customer'}</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- TRUST STRIP -->
<div style="background:${bg2};border-top:1px solid ${border};border-bottom:1px solid ${border};padding:18px 0;overflow:hidden;">
  <div class="wrap" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px 0;">
    <span style="font-size:13px;color:${muted};margin-right:20px;white-space:nowrap;">Trusted by teams at</span>
    ${trustCoHtml}
  </div>
</div>

<!-- STATS -->
<section id="results" style="background:${bg};padding:60px 0;">
  <div class="wrap">
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid ${border};border-radius:16px;overflow:hidden;">
      ${statsHtml}
    </div>
  </div>
</section>

<!-- THE PROBLEM -->
<section style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div class="pain-grid" style="display:grid;grid-template-columns:5fr 7fr;gap:80px;align-items:start;">
      <!-- Left: sticky heading -->
      <div class="pain-l" style="position:sticky;top:84px;">
        <div style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ef4444;background:#ef444415;border:1px solid #ef444428;padding:5px 14px;border-radius:100px;margin-bottom:18px;">The Problem</div>
        <h2 style="font-size:clamp(26px,3.5vw,42px);font-weight:900;line-height:1.12;letter-spacing:-0.025em;color:${text};margin-bottom:18px;">${c.painHeadline || 'Something is broken'}</h2>
        <p style="font-size:16px;color:${muted};line-height:1.75;margin-bottom:${c.painQuote ? '28px' : '0'};">${c.painBody || ''}</p>
        ${c.painQuote ? `<blockquote style="border-left:3px solid #ef444450;padding-left:18px;margin:0;"><p style="font-size:14px;font-style:italic;color:${muted};line-height:1.7;">"${c.painQuote}"</p></blockquote>` : ''}
      </div>
      <!-- Right: pain list -->
      <div style="padding-top:6px;">${painHtml}</div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section id="features" style="background:${bg};padding:100px 0;">
  <div class="wrap">
    <div style="max-width:620px;margin-bottom:52px;">
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:900;line-height:1.1;letter-spacing:-0.025em;color:${text};margin-bottom:14px;">${c.featuresHeadline || 'Built to perform'}</h2>
      <p style="font-size:17px;color:${muted};line-height:1.7;">${c.featuresSub || ''}</p>
    </div>
    <div class="feat-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;">
      ${featuresHtml}
    </div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section id="how" style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div style="text-align:center;max-width:580px;margin:0 auto 64px;">
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:900;line-height:1.1;letter-spacing:-0.025em;color:${text};margin-bottom:14px;">${c.howItWorksHeadline || 'How it works'}</h2>
      <p style="font-size:17px;color:${muted};line-height:1.7;">${c.howItWorksSub || ''}</p>
    </div>
    <div class="steps-row" style="display:flex;gap:0;align-items:flex-start;">
      ${stepsHtml}
    </div>
    <div style="text-align:center;margin-top:56px;">
      <a class="btn btn-full" href="${ctaUrl}" style="font-size:16px;padding:16px 36px;">${ctaText} →</a>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section style="background:${bg};padding:100px 0;">
  <div class="wrap">
    <!-- Featured blockquote -->
    <div class="feat-testi" style="background:${bg2};border:1px solid ${border};border-radius:20px;padding:52px;margin-bottom:28px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-60px;right:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,${accent}10 0%,transparent 65%);pointer-events:none;"></div>
      <div style="color:#f59e0b;font-size:14px;letter-spacing:3px;margin-bottom:26px;">★★★★★</div>
      <p style="font-size:clamp(18px,2.5vw,26px);font-style:italic;font-weight:400;line-height:1.5;color:${text};max-width:820px;margin-bottom:30px;">"${c.featuredQuote || 'This completely changed how we approach our work.'}"</p>
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${accent},${accent2});display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;">${featuredInitials}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:${text};">${c.featuredAuthor || 'Customer'}</div>
          <div style="font-size:13px;color:${muted};">${c.featuredRole || 'Role, Company'}</div>
        </div>
      </div>
    </div>
    <!-- Two cards -->
    <div class="testi-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      ${testiHtml}
    </div>
  </div>
</section>

<!-- COMPARISON -->
<section style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div style="text-align:center;max-width:560px;margin:0 auto 52px;">
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:900;line-height:1.1;letter-spacing:-0.025em;color:${text};">${c.comparisonHeadline || 'vs. The Old Way'}</h2>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;border:1px solid ${border};border-radius:16px;overflow:hidden;min-width:540px;">
        <thead>
          <tr style="background:${bg3};">
            <th style="padding:16px 20px;text-align:left;font-size:13px;font-weight:700;color:${muted};border-right:1px solid ${border};width:30%;">Aspect</th>
            <th style="padding:16px 20px;text-align:left;font-size:13px;font-weight:700;color:${accent};border-right:1px solid ${border};width:35%;">${c.comparisonOurLabel || brand}</th>
            <th style="padding:16px 20px;text-align:left;font-size:13px;font-weight:700;color:${muted};width:35%;">${c.comparisonThemLabel || 'The old way'}</th>
          </tr>
        </thead>
        <tbody>${compHtml}</tbody>
      </table>
    </div>
  </div>
</section>

<!-- FAQ -->
<section id="faq" style="background:${bg};padding:100px 0;">
  <div class="wrap" style="max-width:760px;">
    <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:900;line-height:1.1;letter-spacing:-0.025em;color:${text};margin-bottom:48px;">${c.faqHeadline || 'Common questions'}</h2>
    <div>${faqHtml}</div>
  </div>
</section>

<!-- FINAL CTA -->
<section style="background:${bg2};padding:100px 0;position:relative;overflow:hidden;">
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:400px;border-radius:50%;background:radial-gradient(ellipse,${accent}14 0%,transparent 65%);pointer-events:none;z-index:0;"></div>
  <div class="wrap" style="text-align:center;position:relative;z-index:1;">
    <h2 style="font-size:clamp(28px,5vw,58px);font-weight:900;line-height:1.08;letter-spacing:-0.03em;color:${text};margin-bottom:18px;">${c.ctaHeadline || 'Ready to get started?'}</h2>
    <p style="font-size:18px;color:${muted};max-width:500px;margin:0 auto 36px;line-height:1.65;">${c.ctaBody || ''}</p>
    <a class="btn" href="${ctaUrl}" style="font-size:17px;padding:18px 44px;">${ctaText} →</a>
    <p style="font-size:13px;color:${muted}55;margin-top:16px;">${trust}</p>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:${bg};border-top:1px solid ${border};padding:40px 0;">
  <div class="wrap footer-grid" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;">
    <div style="display:flex;align-items:center;gap:10px;">
      ${logoHtml}
      <span style="font-size:15px;font-weight:700;color:${text};margin-left:2px;">${brand}</span>
    </div>
    <p style="font-size:13px;color:${muted};text-align:center;">${c.footerTagline || ''}</p>
    <p class="footer-copy" style="font-size:12px;color:${muted}55;text-align:right;">© ${year} ${brand}. All rights reserved.</p>
  </div>
</footer>

<script>
(function(){
  // Navbar shadow
  var nb=document.getElementById('nb');
  window.addEventListener('scroll',function(){
    nb.style.boxShadow=window.scrollY>60?'0 4px 24px rgba(0,0,0,0.3)':'none';
  });

  // FAQ accordion
  window.toggleFaq=function(btn){
    var item=btn.parentElement;
    var body=item.querySelector('.faq-body');
    var icon=item.querySelector('.faq-icon');
    var isOpen=body.style.display!=='none';
    // Close all first
    document.querySelectorAll('.faq-body').forEach(function(b){b.style.display='none';});
    document.querySelectorAll('.faq-icon').forEach(function(ic){
      ic.textContent='+';
      ic.style.background='${bg3}';
      ic.style.color='${muted}';
    });
    if(!isOpen){
      body.style.display='block';
      icon.textContent='−';
      icon.style.background='${accent}20';
      icon.style.color='${accent}';
    }
  };

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var target=document.querySelector(a.getAttribute('href'));
      if(target){e.preventDefault();target.scrollIntoView({behavior:'smooth'});}
    });
  });
})();
</script>
</body>
</html>`
}
