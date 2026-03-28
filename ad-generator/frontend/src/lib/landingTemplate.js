// landingTemplate.js
// Luxury minimal template — clean, professional, funnel-focused.
// Claude generates content JSON only. Design is fixed.

export function renderLandingPage(content, pc) {
  const c = content

  // ── Design tokens ──────────────────────────────────────────────
  const bg        = pc.bg        || '#080c14'
  const bg2       = pc.surface   || '#0d1422'
  const bg3       = pc.bg3       || '#131929'
  const accent    = pc.accent    || '#6c63ff'
  const accent2   = pc.accent2   || '#8b5cf6'
  const text      = pc.textColor || '#f1f5f9'
  const muted     = pc.light ? '#64748b' : '#8b98a8'
  const border    = pc.light ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.06)'
  const brand     = pc.companyName || 'Company'
  const ctaUrl    = pc.ctaUrl || '#'
  const trust     = pc.trustMetric || '2,400+ customers'
  const isLight   = pc.light || false

  const logoHtml = pc.logoSrc
    ? `<img src="${pc.logoSrc}" alt="${brand}" style="height:28px;object-fit:contain;display:block;">`
    : `<div style="width:28px;height:28px;border-radius:6px;background:${accent};flex-shrink:0;"></div>`

  const ctaText  = c.ctaText || 'Get Started'
  const stats    = c.stats || []
  const painItems = c.painItems || []
  const features  = c.features || []
  const steps     = c.steps || []
  const testimonials = c.testimonials || []
  const compRows  = c.comparisonRows || []
  const faqItems  = c.faqItems || []
  const trustCos  = c.trustCompanies || []

  // ── Avatar stack ───────────────────────────────────────────────
  const avatars = (c.avatarInitials || ['JM','KL','AR','TS','BP']).slice(0, 5)
  const avatarHtml = avatars.map((ini, i) =>
    `<div style="width:32px;height:32px;border-radius:50%;background:${accent};border:2px solid ${bg};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;${i > 0 ? 'margin-left:-8px;' : ''}flex-shrink:0;">${ini}</div>`
  ).join('')

  // ── Trust companies ────────────────────────────────────────────
  const trustCoHtml = trustCos.map((co) =>
    `<span style="font-size:13px;font-weight:600;letter-spacing:0.02em;color:${muted}50;">${co}</span>`
  ).join(`<span style="display:inline-block;width:1px;height:12px;background:${border};vertical-align:middle;margin:0 16px;"></span>`)

  // ── Stats ──────────────────────────────────────────────────────
  const statsHtml = stats.map((s, i) =>
    `<div class="sc" style="padding:28px 20px;text-align:center;${i > 0 ? `border-left:1px solid ${border};` : ''}">
      <div style="font-size:clamp(26px,4vw,40px);font-weight:900;color:${text};letter-spacing:-0.03em;line-height:1;">${s.value}</div>
      <div style="font-size:13px;font-weight:600;color:${muted};margin-top:6px;letter-spacing:0.01em;">${s.label}</div>
      ${s.sub ? `<div style="font-size:12px;color:${muted}70;margin-top:2px;">${s.sub}</div>` : ''}
    </div>`
  ).join('')

  // ── Pain items ─────────────────────────────────────────────────
  const painHtml = painItems.map((p, i) =>
    `<div style="padding:22px 0;${i < painItems.length - 1 ? `border-bottom:1px solid ${border};` : ''}">
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px;">
        <span style="font-size:11px;font-weight:700;color:${accent};letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;">0${i + 1}</span>
        <span style="font-size:15px;font-weight:700;color:${text};">${p.headline}</span>
      </div>
      <div style="font-size:14px;color:${muted};line-height:1.7;padding-left:24px;">${p.body}</div>
    </div>`
  ).join('')

  // ── Feature cards ──────────────────────────────────────────────
  const featuresHtml = features.map((f, i) =>
    `<div class="feat-card" style="background:${bg2};border:1px solid ${border};border-radius:10px;padding:28px 28px 24px;transition:border-color .18s,box-shadow .18s;">
      <div style="font-size:11px;font-weight:700;color:${accent};letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">0${i + 1}</div>
      <div style="font-size:16px;font-weight:700;color:${text};margin-bottom:10px;line-height:1.3;">${f.headline}</div>
      <div style="font-size:14px;color:${muted};line-height:1.7;">${f.body}</div>
    </div>`
  ).join('')

  // ── Steps ──────────────────────────────────────────────────────
  const stepsHtml = steps.map((s, i) =>
    `<div class="step-div" style="flex:1;position:relative;${i < steps.length - 1 ? 'padding-right:48px;' : ''}">
      ${i < steps.length - 1 ? `<div class="step-connector" style="position:absolute;top:18px;right:12px;left:calc(100% - 36px);height:1px;background:${border};"></div>` : ''}
      <div style="font-size:11px;font-weight:700;color:${accent};letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">Step ${s.num}</div>
      <div style="font-size:16px;font-weight:700;color:${text};margin-bottom:8px;line-height:1.3;">${s.headline}</div>
      <div style="font-size:14px;color:${muted};line-height:1.7;">${s.body}</div>
    </div>`
  ).join('')

  // ── Testimonial cards ──────────────────────────────────────────
  const testiHtml = testimonials.map((t) => {
    const initials = t.initials || (t.author || 'AB').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
    return `<div style="background:${bg2};border:1px solid ${border};border-radius:10px;padding:28px;">
      <p style="font-size:15px;line-height:1.75;color:${text};margin-bottom:20px;font-style:italic;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid ${border};">
        <div style="width:36px;height:36px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${initials}</div>
        <div>
          <div style="font-size:13px;font-weight:700;color:${text};">${t.author}</div>
          <div style="font-size:12px;color:${muted};">${t.role}</div>
        </div>
      </div>
    </div>`
  }).join('')

  // ── Comparison rows ────────────────────────────────────────────
  const compHtml = compRows.map((r, i) =>
    `<tr style="${i % 2 === 1 ? `background:${bg2};` : ''}">
      <td style="padding:14px 20px;font-size:14px;color:${muted};border-right:1px solid ${border};">${r.aspect}</td>
      <td style="padding:14px 20px;font-size:14px;color:${text};font-weight:600;border-right:1px solid ${border};">
        <span style="color:#10b981;margin-right:8px;font-size:12px;">✓</span>${r.us}
      </td>
      <td style="padding:14px 20px;font-size:14px;color:${muted}80;">
        <span style="color:#ef444499;margin-right:8px;font-size:12px;">✕</span>${r.them}
      </td>
    </tr>`
  ).join('')

  // ── FAQ items ──────────────────────────────────────────────────
  const faqHtml = faqItems.map((f, i) =>
    `<div class="faq-item" style="${i === 0 ? `border-top:1px solid ${border};` : ''}border-bottom:1px solid ${border};">
      <button class="faq-btn" onclick="toggleFaq(this)" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:18px 0;background:none;border:none;cursor:pointer;text-align:left;gap:20px;">
        <span style="font-size:15px;font-weight:600;color:${text};line-height:1.4;">${f.q}</span>
        <span class="faq-icon" style="flex-shrink:0;font-size:20px;color:${muted};line-height:1;transition:transform .2s,color .2s;">+</span>
      </button>
      <div class="faq-body" style="display:none;padding-bottom:18px;">
        <p style="font-size:14px;color:${muted};line-height:1.8;">${f.a}</p>
      </div>
    </div>`
  ).join('')

  const featInitials = (c.featuredAuthor || 'AB').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.pageTitle || `${brand}`}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:${bg};color:${text};-webkit-font-smoothing:antialiased;line-height:1.6;font-size:16px;}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 32px}

/* Typography */
.g{background:linear-gradient(135deg,${accent},${accent2});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:8px;background:${accent};color:#fff!important;-webkit-text-fill-color:#fff!important;font-family:'Inter',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.01em;padding:13px 26px;border-radius:8px;border:none;cursor:pointer;text-decoration:none!important;transition:opacity .18s,transform .18s;white-space:nowrap;}
.btn:hover{opacity:.88;transform:translateY(-1px)}
.btn-outline{display:inline-flex;align-items:center;gap:8px;background:transparent;color:${text};font-family:'Inter',sans-serif;font-weight:600;font-size:14px;padding:13px 26px;border-radius:8px;border:1px solid ${border};cursor:pointer;text-decoration:none;transition:border-color .18s,background .18s;white-space:nowrap;}
.btn-outline:hover{border-color:${accent}80;background:${accent}0a}

/* Cards */
.feat-card:hover{border-color:${accent}50!important;box-shadow:0 8px 32px rgba(0,0,0,0.18)!important}

/* Eyebrow label */
.label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${accent};}

/* Section divider */
.sec-divider{border:none;border-top:1px solid ${border};margin:0;}

/* Responsive */
@media(max-width:768px){
  .wrap{padding:0 20px!important}
  .nav-links{display:none!important}
  section,.sec-pad{padding:64px 0!important}
  .sec-hero{padding:100px 0 60px!important;min-height:auto!important}
  .hero-grid{grid-template-columns:1fr!important;gap:44px!important}
  .hero-visual{display:none!important}
  .hero-btns{flex-direction:column!important;align-items:stretch!important}
  .hero-btns .btn,.hero-btns .btn-outline{width:100%;justify-content:center;}
  .stats-grid{grid-template-columns:repeat(2,1fr)!important}
  .sc{padding:20px 14px!important}
  .pain-grid{grid-template-columns:1fr!important;gap:28px!important}
  .pain-l{position:static!important}
  .feat-grid{grid-template-columns:1fr!important}
  .steps-row{flex-direction:column!important;gap:24px!important}
  .step-div{padding-right:0!important}
  .step-connector{display:none!important}
  .testi-grid{grid-template-columns:1fr!important}
  .footer-inner{flex-direction:column!important;align-items:flex-start!important;gap:10px!important}
  .footer-copy{text-align:left!important}
  .btn-full{width:100%!important;justify-content:center!important}
}
</style>
</head>
<body>

<!-- ── NAVBAR ──────────────────────────────────────────────── -->
<header id="nb" style="position:fixed;top:0;left:0;right:0;height:60px;background:${bg}f0;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid ${border};z-index:999;transition:box-shadow .3s;">
  <div class="wrap" style="display:flex;align-items:center;justify-content:space-between;height:100%;gap:24px;">
    <div style="display:flex;align-items:center;gap:9px;flex-shrink:0;">
      ${logoHtml}
      <span style="font-size:15px;font-weight:700;color:${text};">${brand}</span>
    </div>
    <nav class="nav-links" style="display:flex;gap:28px;flex:1;justify-content:center;">
      <a href="#solution" style="font-size:13px;font-weight:500;color:${muted};letter-spacing:.01em;transition:color .15s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">Features</a>
      <a href="#how" style="font-size:13px;font-weight:500;color:${muted};letter-spacing:.01em;transition:color .15s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">How it works</a>
      <a href="#proof" style="font-size:13px;font-weight:500;color:${muted};letter-spacing:.01em;transition:color .15s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">Results</a>
      <a href="#faq" style="font-size:13px;font-weight:500;color:${muted};letter-spacing:.01em;transition:color .15s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">FAQ</a>
    </nav>
    <a class="btn" href="${ctaUrl}" style="font-size:13px;padding:10px 20px;flex-shrink:0;">${ctaText}</a>
  </div>
</header>

<!-- ── HERO ────────────────────────────────────────────────── -->
<section class="sec-hero" style="min-height:100vh;display:flex;align-items:center;padding:120px 0 80px;background:${bg};">
  <div class="wrap" style="width:100%;">
    <div class="hero-grid" style="display:grid;grid-template-columns:6fr 5fr;gap:80px;align-items:center;">

      <div>
        <p class="label" style="margin-bottom:20px;">${c.heroPill || 'Built for results'}</p>
        <h1 style="font-size:clamp(38px,5.5vw,70px);font-weight:900;line-height:1.05;letter-spacing:-0.04em;color:${text};margin:0 0 24px;">
          ${c.headlineHtml || brand}
        </h1>
        <p style="font-size:18px;line-height:1.75;color:${muted};max-width:480px;margin:0 0 36px;">
          ${c.subheadline || ''}
        </p>
        <div class="hero-btns" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:32px;">
          <a class="btn" href="${ctaUrl}">${ctaText} →</a>
          <a class="btn-outline" href="#how">How it works</a>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="display:flex;">${avatarHtml}</div>
          <span style="font-size:13px;color:${muted};margin-left:4px;">${trust}</span>
        </div>
      </div>

      <!-- Right: clean testimonial card -->
      <div class="hero-visual">
        <div style="background:${bg2};border:1px solid ${border};border-radius:12px;padding:32px;">
          <div style="color:#f59e0b;font-size:11px;letter-spacing:3px;margin-bottom:20px;">★★★★★</div>
          <p style="font-size:16px;line-height:1.75;color:${text};font-style:italic;margin-bottom:24px;">"${c.featuredQuote || 'This completely changed how we work.'}"</p>
          <div style="display:flex;align-items:center;gap:12px;padding-top:20px;border-top:1px solid ${border};">
            <div style="width:38px;height:38px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;">${featInitials}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:${text};">${c.featuredAuthor || 'Customer'}</div>
              <div style="font-size:12px;color:${muted};">${c.featuredRole || 'Role, Company'}</div>
            </div>
          </div>
          ${stats.length > 0 ? `<div style="display:flex;gap:0;margin-top:24px;padding-top:20px;border-top:1px solid ${border};">
            ${stats.slice(0, 2).map((s, i) => `<div style="flex:1;${i > 0 ? `border-left:1px solid ${border};padding-left:16px;` : 'padding-right:16px;'}">
              <div style="font-size:22px;font-weight:900;color:${accent};letter-spacing:-0.03em;line-height:1;">${s.value}</div>
              <div style="font-size:11px;color:${muted};margin-top:3px;">${s.label}</div>
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── TRUST STRIP ──────────────────────────────────────────── -->
${trustCos.length > 0 ? `<div style="background:${bg2};border-top:1px solid ${border};border-bottom:1px solid ${border};padding:16px 0;overflow:hidden;">
  <div class="wrap" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
    <span style="font-size:12px;font-weight:600;color:${muted}50;letter-spacing:.06em;text-transform:uppercase;margin-right:20px;white-space:nowrap;">Trusted by</span>
    ${trustCoHtml}
  </div>
</div>` : ''}

<!-- ── STATS ────────────────────────────────────────────────── -->
${stats.length > 0 ? `<section style="background:${bg};padding:56px 0;">
  <div class="wrap">
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid ${border};border-radius:10px;overflow:hidden;">
      ${statsHtml}
    </div>
  </div>
</section>` : ''}

<!-- ── PROBLEM ──────────────────────────────────────────────── -->
<section style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div class="pain-grid" style="display:grid;grid-template-columns:5fr 7fr;gap:80px;align-items:start;">
      <div class="pain-l" style="position:sticky;top:80px;">
        <p class="label" style="margin-bottom:16px;">The problem</p>
        <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:${text};margin-bottom:18px;">${c.painHeadline || ''}</h2>
        <p style="font-size:16px;color:${muted};line-height:1.75;">${c.painBody || ''}</p>
        ${c.painQuote ? `<p style="margin-top:24px;font-size:14px;font-style:italic;color:${muted};line-height:1.7;padding-left:16px;border-left:2px solid ${border};">"${c.painQuote}"</p>` : ''}
      </div>
      <div>${painHtml}</div>
    </div>
  </div>
</section>

<!-- ── SOLUTION / FEATURES ──────────────────────────────────── -->
<section id="solution" style="background:${bg};padding:100px 0;">
  <div class="wrap">
    <div style="max-width:560px;margin-bottom:56px;">
      <p class="label" style="margin-bottom:16px;">The solution</p>
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:800;line-height:1.12;letter-spacing:-0.03em;color:${text};margin-bottom:14px;">${c.featuresHeadline || ''}</h2>
      <p style="font-size:17px;color:${muted};line-height:1.75;">${c.featuresSub || ''}</p>
    </div>
    <div class="feat-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      ${featuresHtml}
    </div>
  </div>
</section>

<!-- ── HOW IT WORKS ─────────────────────────────────────────── -->
<section id="how" style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div style="max-width:520px;margin:0 auto 60px;text-align:center;">
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:800;line-height:1.12;letter-spacing:-0.03em;color:${text};margin-bottom:14px;">${c.howItWorksHeadline || ''}</h2>
      <p style="font-size:16px;color:${muted};line-height:1.75;">${c.howItWorksSub || ''}</p>
    </div>
    <div class="steps-row" style="display:flex;gap:0;align-items:flex-start;">
      ${stepsHtml}
    </div>
    <div style="text-align:center;margin-top:52px;">
      <a class="btn btn-full" href="${ctaUrl}">${ctaText} →</a>
    </div>
  </div>
</section>

<!-- ── TESTIMONIALS ─────────────────────────────────────────── -->
<section id="proof" style="background:${bg};padding:100px 0;">
  <div class="wrap">
    <p class="label" style="text-align:center;margin-bottom:48px;">What customers say</p>
    <!-- Featured quote -->
    <div style="max-width:760px;margin:0 auto 48px;text-align:center;">
      <p style="font-size:clamp(20px,3vw,28px);font-style:italic;font-weight:400;line-height:1.55;color:${text};margin-bottom:28px;">"${c.featuredQuote || ''}"</p>
      <div style="display:inline-flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;">${featInitials}</div>
        <div style="text-align:left;">
          <div style="font-size:13px;font-weight:700;color:${text};">${c.featuredAuthor || ''}</div>
          <div style="font-size:12px;color:${muted};">${c.featuredRole || ''}</div>
        </div>
      </div>
    </div>
    <hr class="sec-divider" style="margin-bottom:40px;">
    <!-- Two cards -->
    <div class="testi-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      ${testiHtml}
    </div>
  </div>
</section>

<!-- ── COMPARISON ───────────────────────────────────────────── -->
${compRows.length > 0 ? `<section style="background:${bg2};padding:100px 0;">
  <div class="wrap" style="max-width:800px;">
    <h2 style="font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:${text};margin-bottom:40px;">${c.comparisonHeadline || 'vs. The Old Way'}</h2>
    <div style="overflow-x:auto;border-radius:10px;border:1px solid ${border};">
      <table style="width:100%;border-collapse:collapse;min-width:480px;">
        <thead>
          <tr style="background:${bg3};">
            <th style="padding:14px 18px;text-align:left;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${muted};border-right:1px solid ${border};width:30%;"></th>
            <th style="padding:14px 18px;text-align:left;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${accent};border-right:1px solid ${border};width:35%;">${c.comparisonOurLabel || brand}</th>
            <th style="padding:14px 18px;text-align:left;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:${muted};width:35%;">${c.comparisonThemLabel || 'Others'}</th>
          </tr>
        </thead>
        <tbody>${compHtml}</tbody>
      </table>
    </div>
  </div>
</section>` : ''}

<!-- ── FAQ ──────────────────────────────────────────────────── -->
${faqItems.length > 0 ? `<section id="faq" style="background:${bg};padding:100px 0;">
  <div class="wrap" style="max-width:680px;">
    <h2 style="font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:${text};margin-bottom:44px;">${c.faqHeadline || 'Common questions'}</h2>
    ${faqHtml}
  </div>
</section>` : ''}

<!-- ── FINAL CTA ─────────────────────────────────────────────── -->
<section style="background:${bg2};padding:100px 0;border-top:1px solid ${border};">
  <div class="wrap" style="max-width:600px;text-align:center;">
    <h2 style="font-size:clamp(28px,5vw,54px);font-weight:900;line-height:1.08;letter-spacing:-0.04em;color:${text};margin-bottom:16px;">${c.ctaHeadline || 'Ready to get started?'}</h2>
    <p style="font-size:17px;color:${muted};line-height:1.75;margin-bottom:32px;">${c.ctaBody || ''}</p>
    <a class="btn btn-full" href="${ctaUrl}" style="font-size:16px;padding:16px 36px;">${ctaText} →</a>
    <p style="font-size:12px;color:${muted}55;margin-top:14px;">${trust}</p>
  </div>
</section>

<!-- ── FOOTER ────────────────────────────────────────────────── -->
<footer style="background:${bg};border-top:1px solid ${border};padding:32px 0;">
  <div class="wrap">
    <div class="footer-inner" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${logoHtml}
        <span style="font-size:14px;font-weight:700;color:${text};">${brand}</span>
      </div>
      <p style="font-size:13px;color:${muted};">${c.footerTagline || ''}</p>
      <p class="footer-copy" style="font-size:12px;color:${muted}55;">© ${year} ${brand}</p>
    </div>
  </div>
</footer>

<script>
(function(){
  var nb=document.getElementById('nb');
  window.addEventListener('scroll',function(){
    nb.style.boxShadow=window.scrollY>40?'0 1px 20px rgba(0,0,0,0.25)':'none';
  });
  window.toggleFaq=function(btn){
    var item=btn.parentElement;
    var body=item.querySelector('.faq-body');
    var icon=item.querySelector('.faq-icon');
    var open=body.style.display!=='none';
    document.querySelectorAll('.faq-body').forEach(function(b){b.style.display='none';});
    document.querySelectorAll('.faq-icon').forEach(function(ic){ic.textContent='+';ic.style.color='${muted}';});
    if(!open){body.style.display='block';icon.textContent='−';icon.style.color='${accent}';}
  };
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click',function(e){
      var t=document.querySelector(a.getAttribute('href'));
      if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}
    });
  });
})();
</script>
</body>
</html>`
}
