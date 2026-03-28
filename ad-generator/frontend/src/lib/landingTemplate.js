// landingTemplate.js
// Luxury minimal template — black/white foundations, accent color hints,
// real icons (Lucide CDN), scroll animations, premium typography.

export function renderLandingPage(content, pc) {
  const c = content

  // ── Design tokens ──────────────────────────────────────────────
  const bg      = pc.bg        || '#0A0A0A'
  const bg2     = pc.surface   || '#111111'
  const bg3     = pc.bg3       || '#1A1A1A'
  const accent  = pc.accent    || '#C9A84C'
  const accent2 = pc.accent2   || '#E8C96A'
  const text    = pc.textColor || '#F5F5F5'
  const muted   = pc.mutedColor || (pc.light ? '#666666' : '#888888')
  const border  = pc.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'
  const brand   = pc.companyName || 'Company'
  const ctaUrl  = pc.ctaUrl || '#'
  const trust   = pc.trustMetric || '2,400+ customers'
  const isLight = pc.light || false

  const logoHtml = pc.logoSrc
    ? `<img src="${pc.logoSrc}" alt="${brand}" style="height:28px;object-fit:contain;display:block;">`
    : `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" style="flex-shrink:0;"><rect width="28" height="28" rx="6" fill="${accent}"/><path d="M8 14h12M14 8v12" stroke="${isLight ? '#fff' : bg}" stroke-width="2.5" stroke-linecap="round"/></svg>`

  const ctaText   = c.ctaText  || 'Get Started'
  const stats     = c.stats    || []
  const painItems = c.painItems  || []
  const features  = c.features   || []
  const steps     = c.steps      || []
  const testimonials = c.testimonials || []
  const compRows  = c.comparisonRows  || []
  const faqItems  = c.faqItems   || []
  const trustCos  = c.trustCompanies  || []

  // ── Avatar stack ───────────────────────────────────────────────
  const avatars = (c.avatarInitials || ['JM','KL','AR','TS','BP']).slice(0, 5)
  const avatarHtml = avatars.map((ini, i) =>
    `<div style="width:30px;height:30px;border-radius:50%;background:${accent};border:2px solid ${bg};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${isLight ? '#fff' : bg};${i > 0 ? 'margin-left:-7px;' : ''}flex-shrink:0;">${ini}</div>`
  ).join('')

  // ── Trust companies ────────────────────────────────────────────
  const trustCoHtml = trustCos.map((co) =>
    `<span style="font-size:13px;font-weight:600;letter-spacing:0.04em;color:${muted};">${co}</span>`
  ).join(`<span style="display:inline-block;width:1px;height:11px;background:${border};vertical-align:middle;margin:0 18px;"></span>`)

  // ── Stats ──────────────────────────────────────────────────────
  const statsHtml = stats.map((s, i) =>
    `<div class="sc anim d${(i % 4) + 1}" style="padding:32px 20px;text-align:center;${i > 0 ? `border-left:1px solid ${border};` : ''}">
      <div style="font-size:clamp(28px,4vw,42px);font-weight:900;color:${text};letter-spacing:-0.04em;line-height:1;">${s.value}</div>
      <div style="font-size:12px;font-weight:600;color:${muted};margin-top:7px;letter-spacing:0.04em;text-transform:uppercase;">${s.label}</div>
      ${s.sub ? `<div style="font-size:11px;color:${muted}80;margin-top:2px;">${s.sub}</div>` : ''}
    </div>`
  ).join('')

  // ── Pain items ─────────────────────────────────────────────────
  const painHtml = painItems.map((p, i) =>
    `<div class="anim d${i + 1}" style="padding:22px 0;${i < painItems.length - 1 ? `border-bottom:1px solid ${border};` : ''}">
      <div style="display:flex;align-items:baseline;gap:14px;margin-bottom:7px;">
        <span style="font-size:10px;font-weight:700;color:${accent};letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;flex-shrink:0;">0${i + 1}</span>
        <span style="font-size:15px;font-weight:700;color:${text};line-height:1.3;">${p.headline}</span>
      </div>
      <div style="font-size:14px;color:${muted};line-height:1.75;padding-left:26px;">${p.body}</div>
    </div>`
  ).join('')

  // ── Feature cards ──────────────────────────────────────────────
  const featuresHtml = features.map((f, i) =>
    `<div class="feat-card anim d${(i % 3) + 1}" style="background:${bg2};border:1px solid ${border};border-radius:10px;padding:28px;display:flex;flex-direction:column;gap:0;">
      <div class="feat-icon" style="width:40px;height:40px;border-radius:8px;background:${accent}18;border:1px solid ${accent}25;display:flex;align-items:center;justify-content:center;color:${accent};margin-bottom:16px;flex-shrink:0;">
        <i data-lucide="${f.icon || 'zap'}" style="width:18px;height:18px;stroke-width:1.75;"></i>
      </div>
      <div style="font-size:15px;font-weight:700;color:${text};margin-bottom:9px;line-height:1.3;">${f.headline}</div>
      <div style="font-size:13px;color:${muted};line-height:1.75;flex:1;">${f.body}</div>
    </div>`
  ).join('')

  // ── Steps ──────────────────────────────────────────────────────
  const stepsHtml = steps.map((s, i) =>
    `<div class="step-div anim d${i + 1}" style="flex:1;position:relative;${i < steps.length - 1 ? 'padding-right:52px;' : ''}">
      ${i < steps.length - 1 ? `<div class="step-connector" style="position:absolute;top:19px;right:12px;left:calc(100% - 40px);height:1px;background:${border};"></div>` : ''}
      <div style="width:38px;height:38px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${isLight ? '#fff' : bg};margin-bottom:16px;flex-shrink:0;letter-spacing:-0.02em;">${s.num}</div>
      <div style="font-size:15px;font-weight:700;color:${text};margin-bottom:8px;line-height:1.3;">${s.headline}</div>
      <div style="font-size:13px;color:${muted};line-height:1.75;">${s.body}</div>
    </div>`
  ).join('')

  // ── Testimonial cards ──────────────────────────────────────────
  const testiHtml = testimonials.map((t, i) => {
    const initials = t.initials || (t.author || 'AB').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase()
    return `<div class="anim d${i + 1}" style="background:${bg2};border:1px solid ${border};border-radius:10px;padding:28px;">
      <p style="font-size:14px;line-height:1.8;color:${text};margin-bottom:22px;font-style:italic;">"${t.quote}"</p>
      <div style="display:flex;align-items:center;gap:11px;padding-top:18px;border-top:1px solid ${border};">
        <div style="width:34px;height:34px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:${isLight ? '#fff' : bg};flex-shrink:0;">${initials}</div>
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
      <td style="padding:14px 18px;font-size:13px;color:${muted};border-right:1px solid ${border};">${r.aspect}</td>
      <td style="padding:14px 18px;font-size:13px;color:${text};font-weight:600;border-right:1px solid ${border};">
        <span style="display:inline-flex;align-items:center;gap:8px;">
          <i data-lucide="check" style="width:14px;height:14px;color:#10b981;stroke-width:2.5;flex-shrink:0;"></i>${r.us}
        </span>
      </td>
      <td style="padding:14px 18px;font-size:13px;color:${muted}80;">
        <span style="display:inline-flex;align-items:center;gap:8px;">
          <i data-lucide="x" style="width:14px;height:14px;color:#ef444480;stroke-width:2.5;flex-shrink:0;"></i>${r.them}
        </span>
      </td>
    </tr>`
  ).join('')

  // ── FAQ items ──────────────────────────────────────────────────
  const faqHtml = faqItems.map((f, i) =>
    `<div class="faq-item" style="${i === 0 ? `border-top:1px solid ${border};` : ''}border-bottom:1px solid ${border};">
      <button class="faq-btn" onclick="toggleFaq(this)" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:19px 0;background:none;border:none;cursor:pointer;text-align:left;gap:20px;">
        <span style="font-size:15px;font-weight:600;color:${text};line-height:1.4;">${f.q}</span>
        <span class="faq-icon" style="flex-shrink:0;width:24px;height:24px;border-radius:50%;border:1px solid ${border};display:flex;align-items:center;justify-content:center;color:${muted};transition:transform .25s,color .2s,border-color .2s;">
          <i data-lucide="plus" style="width:13px;height:13px;stroke-width:2.5;pointer-events:none;"></i>
        </span>
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
<title>${c.pageTitle || brand}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:${bg};color:${text};-webkit-font-smoothing:antialiased;line-height:1.6;}
img{max-width:100%;display:block}a{color:inherit;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 32px}
/* Gradient text — H1 accent words only */
.g{background:linear-gradient(135deg,${accent},${accent2});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
/* Buttons */
.btn{display:inline-flex;align-items:center;gap:8px;background:${accent};color:${isLight ? '#fff' : bg}!important;-webkit-text-fill-color:${isLight ? '#fff' : bg}!important;font-family:'Inter',sans-serif;font-weight:700;font-size:14px;padding:13px 26px;border-radius:8px;border:none;cursor:pointer;text-decoration:none!important;letter-spacing:.01em;transition:opacity .2s,transform .2s,box-shadow .2s;white-space:nowrap;}
.btn:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 6px 20px ${accent}40;}
.btn-outline{display:inline-flex;align-items:center;gap:8px;background:transparent;color:${text};font-family:'Inter',sans-serif;font-weight:600;font-size:14px;padding:13px 26px;border-radius:8px;border:1px solid ${border};cursor:pointer;text-decoration:none;letter-spacing:.01em;transition:border-color .2s,background .2s;white-space:nowrap;}
.btn-outline:hover{border-color:${accent}80;background:${accent}0c;}
/* Feature card hover */
.feat-card{transition:border-color .2s,transform .2s,box-shadow .2s;cursor:default;}
.feat-card:hover{border-color:${accent}60!important;transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,${isLight ? '.1' : '.3'})!important;}
/* Scroll animations */
.anim{opacity:0;transform:translateY(22px);transition:opacity .55s cubic-bezier(.22,1,.36,1),transform .55s cubic-bezier(.22,1,.36,1);}
.anim.in{opacity:1;transform:none;}
.d1{transition-delay:.05s}.d2{transition-delay:.12s}.d3{transition-delay:.19s}.d4{transition-delay:.26s}.d5{transition-delay:.33s}.d6{transition-delay:.40s}
/* Mobile */
@media(max-width:768px){
  .wrap{padding:0 20px!important}
  .nav-links{display:none!important}
  section{padding:64px 0!important}
  .sec-hero{padding:96px 0 56px!important;min-height:auto!important}
  .hero-grid{grid-template-columns:1fr!important;gap:44px!important}
  .hero-visual{display:none!important}
  .hero-btns{flex-direction:column!important;align-items:stretch!important}
  .hero-btns .btn,.hero-btns .btn-outline{width:100%;justify-content:center;}
  .stats-grid{grid-template-columns:repeat(2,1fr)!important}
  .sc{padding:20px 12px!important}
  .pain-grid{grid-template-columns:1fr!important;gap:28px!important}
  .pain-l{position:static!important}
  .feat-grid{grid-template-columns:1fr!important}
  .steps-row{flex-direction:column!important;gap:24px!important}
  .step-div{padding-right:0!important}
  .step-connector{display:none!important}
  .testi-grid{grid-template-columns:1fr!important}
  .footer-inner{flex-direction:column!important;align-items:flex-start!important;gap:8px!important}
  .footer-right{text-align:left!important}
  .btn-w{width:100%!important;justify-content:center!important}
}
</style>
</head>
<body>

<!-- NAVBAR -->
<header id="nb" style="position:fixed;top:0;left:0;right:0;height:60px;background:${bg}f2;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid ${border};z-index:999;transition:box-shadow .3s;">
  <div class="wrap" style="display:flex;align-items:center;justify-content:space-between;height:100%;gap:24px;">
    <div style="display:flex;align-items:center;gap:9px;flex-shrink:0;">
      ${logoHtml}
      <span style="font-size:15px;font-weight:700;color:${text};letter-spacing:-.01em;">${brand}</span>
    </div>
    <nav class="nav-links" style="display:flex;gap:28px;flex:1;justify-content:center;">
      ${['Features','How it works','Results','FAQ'].map((l, i) => {
        const href = ['#solution','#how','#proof','#faq'][i]
        return `<a href="${href}" style="font-size:13px;font-weight:500;color:${muted};transition:color .15s;" onmouseover="this.style.color='${text}'" onmouseout="this.style.color='${muted}'">${l}</a>`
      }).join('')}
    </nav>
    <a class="btn" href="${ctaUrl}" style="font-size:13px;padding:10px 20px;flex-shrink:0;">${ctaText}</a>
  </div>
</header>

<!-- HERO -->
<section class="sec-hero" style="min-height:100vh;display:flex;align-items:center;padding:120px 0 80px;background:${bg};">
  <div class="wrap" style="width:100%;">
    <div class="hero-grid" style="display:grid;grid-template-columns:6fr 5fr;gap:80px;align-items:center;">
      <div>
        <p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};margin-bottom:20px;">${c.heroPill || 'Built for results'}</p>
        <h1 style="font-size:clamp(40px,6vw,72px);font-weight:900;line-height:1.03;letter-spacing:-0.045em;color:${text};margin:0 0 24px;">
          ${c.headlineHtml || brand}
        </h1>
        <p style="font-size:18px;line-height:1.75;color:${muted};max-width:460px;margin:0 0 36px;">${c.subheadline || ''}</p>
        <div class="hero-btns" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:32px;">
          <a class="btn" href="${ctaUrl}">${ctaText} <i data-lucide="arrow-right" style="width:15px;height:15px;stroke-width:2.5;"></i></a>
          <a class="btn-outline" href="#how">How it works</a>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="display:flex;">${avatarHtml}</div>
          <span style="font-size:13px;color:${muted};margin-left:5px;">${trust}</span>
        </div>
      </div>
      <!-- Right: testimonial card -->
      <div class="hero-visual">
        <div style="background:${bg2};border:1px solid ${border};border-radius:12px;padding:32px;">
          <div style="display:flex;gap:2px;margin-bottom:20px;">
            ${Array(5).fill(`<i data-lucide="star" style="width:14px;height:14px;fill:${accent};color:${accent};stroke-width:1.5;"></i>`).join('')}
          </div>
          <p style="font-size:16px;line-height:1.75;color:${text};font-style:italic;margin-bottom:24px;">"${c.featuredQuote || 'This completely changed how we work.'}"</p>
          <div style="display:flex;align-items:center;gap:12px;padding-top:20px;border-top:1px solid ${border};">
            <div style="width:36px;height:36px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:${isLight ? '#fff' : bg};flex-shrink:0;">${featInitials}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:${text};">${c.featuredAuthor || 'Customer'}</div>
              <div style="font-size:12px;color:${muted};">${c.featuredRole || 'Role, Company'}</div>
            </div>
          </div>
          ${stats.length >= 2 ? `<div style="display:flex;margin-top:22px;padding-top:20px;border-top:1px solid ${border};">
            ${stats.slice(0,2).map((s,i) => `<div style="flex:1;${i>0?`border-left:1px solid ${border};padding-left:16px;`:'padding-right:16px;'}">
              <div style="font-size:22px;font-weight:900;color:${accent};letter-spacing:-0.04em;line-height:1;">${s.value}</div>
              <div style="font-size:11px;color:${muted};margin-top:3px;letter-spacing:.03em;">${s.label}</div>
            </div>`).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>
  </div>
</section>

<!-- TRUST STRIP -->
${trustCos.length > 0 ? `<div style="background:${bg2};border-top:1px solid ${border};border-bottom:1px solid ${border};padding:15px 0;">
  <div class="wrap" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
    <span style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${muted}55;margin-right:20px;white-space:nowrap;">Used by teams at</span>
    ${trustCoHtml}
  </div>
</div>` : ''}

<!-- STATS -->
${stats.length > 0 ? `<section style="background:${bg};padding:52px 0;">
  <div class="wrap">
    <div class="stats-grid" style="display:grid;grid-template-columns:repeat(4,1fr);border:1px solid ${border};border-radius:10px;overflow:hidden;">
      ${statsHtml}
    </div>
  </div>
</section>` : ''}

<!-- PROBLEM -->
<section style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div class="pain-grid" style="display:grid;grid-template-columns:5fr 7fr;gap:80px;align-items:start;">
      <div class="pain-l anim" style="position:sticky;top:80px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};margin-bottom:16px;">The problem</p>
        <h2 style="font-size:clamp(26px,3.5vw,40px);font-weight:800;line-height:1.12;letter-spacing:-0.035em;color:${text};margin-bottom:18px;">${c.painHeadline || ''}</h2>
        <p style="font-size:16px;color:${muted};line-height:1.75;">${c.painBody || ''}</p>
        ${c.painQuote ? `<p style="margin-top:22px;font-size:14px;font-style:italic;color:${muted};line-height:1.75;padding-left:16px;border-left:2px solid ${accent}50;">"${c.painQuote}"</p>` : ''}
      </div>
      <div>${painHtml}</div>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section id="solution" style="background:${bg};padding:100px 0;">
  <div class="wrap">
    <div class="anim" style="max-width:540px;margin-bottom:52px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};margin-bottom:16px;">The solution</p>
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:800;line-height:1.1;letter-spacing:-0.035em;color:${text};margin-bottom:14px;">${c.featuresHeadline || ''}</h2>
      <p style="font-size:17px;color:${muted};line-height:1.75;">${c.featuresSub || ''}</p>
    </div>
    <div class="feat-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">${featuresHtml}</div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section id="how" style="background:${bg2};padding:100px 0;">
  <div class="wrap">
    <div class="anim" style="max-width:500px;margin:0 auto 60px;text-align:center;">
      <h2 style="font-size:clamp(26px,3.5vw,44px);font-weight:800;line-height:1.1;letter-spacing:-0.035em;color:${text};margin-bottom:14px;">${c.howItWorksHeadline || ''}</h2>
      <p style="font-size:16px;color:${muted};line-height:1.75;">${c.howItWorksSub || ''}</p>
    </div>
    <div class="steps-row" style="display:flex;gap:0;align-items:flex-start;">${stepsHtml}</div>
    <div style="text-align:center;margin-top:52px;">
      <a class="btn btn-w" href="${ctaUrl}" style="font-size:15px;padding:15px 34px;">${ctaText} <i data-lucide="arrow-right" style="width:16px;height:16px;stroke-width:2.5;"></i></a>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section id="proof" style="background:${bg};padding:100px 0;">
  <div class="wrap">
    <div class="anim" style="max-width:700px;margin:0 auto 48px;text-align:center;">
      <p style="font-size:clamp(20px,3vw,28px);font-style:italic;font-weight:400;line-height:1.55;color:${text};margin-bottom:26px;">"${c.featuredQuote || ''}"</p>
      <div style="display:inline-flex;align-items:center;gap:12px;">
        <div style="width:34px;height:34px;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:${isLight ? '#fff' : bg};">${featInitials}</div>
        <div style="text-align:left;">
          <div style="font-size:13px;font-weight:700;color:${text};">${c.featuredAuthor || ''}</div>
          <div style="font-size:12px;color:${muted};">${c.featuredRole || ''}</div>
        </div>
      </div>
    </div>
    <div style="border-top:1px solid ${border};margin-bottom:40px;"></div>
    <div class="testi-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">${testiHtml}</div>
  </div>
</section>

<!-- COMPARISON -->
${compRows.length > 0 ? `<section style="background:${bg2};padding:100px 0;">
  <div class="wrap" style="max-width:800px;">
    <div class="anim" style="margin-bottom:36px;">
      <h2 style="font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:${text};">${c.comparisonHeadline || 'vs. The Old Way'}</h2>
    </div>
    <div style="overflow-x:auto;border-radius:10px;border:1px solid ${border};">
      <table style="width:100%;border-collapse:collapse;min-width:480px;">
        <thead><tr style="background:${bg3};">
          <th style="padding:13px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${muted};border-right:1px solid ${border};width:30%;"></th>
          <th style="padding:13px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${accent};border-right:1px solid ${border};width:35%;">${c.comparisonOurLabel || brand}</th>
          <th style="padding:13px 18px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${muted};width:35%;">${c.comparisonThemLabel || 'Without it'}</th>
        </tr></thead>
        <tbody>${compHtml}</tbody>
      </table>
    </div>
  </div>
</section>` : ''}

<!-- FAQ -->
${faqItems.length > 0 ? `<section id="faq" style="background:${bg};padding:100px 0;">
  <div class="wrap" style="max-width:660px;">
    <h2 class="anim" style="font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:${text};margin-bottom:40px;">${c.faqHeadline || 'Common questions'}</h2>
    ${faqHtml}
  </div>
</section>` : ''}

<!-- CTA -->
<section style="background:${bg2};padding:100px 0;border-top:1px solid ${border};">
  <div class="wrap anim" style="max-width:580px;text-align:center;">
    <h2 style="font-size:clamp(28px,5vw,54px);font-weight:900;line-height:1.06;letter-spacing:-0.045em;color:${text};margin-bottom:16px;">${c.ctaHeadline || 'Ready to get started?'}</h2>
    <p style="font-size:17px;color:${muted};line-height:1.75;margin-bottom:32px;">${c.ctaBody || ''}</p>
    <a class="btn btn-w" href="${ctaUrl}" style="font-size:16px;padding:16px 36px;">${ctaText} <i data-lucide="arrow-right" style="width:16px;height:16px;stroke-width:2.5;"></i></a>
    <p style="font-size:12px;color:${muted}55;margin-top:14px;">${trust}</p>
  </div>
</section>

<!-- FOOTER -->
<footer style="background:${bg};border-top:1px solid ${border};padding:28px 0;">
  <div class="wrap">
    <div class="footer-inner" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${logoHtml}
        <span style="font-size:14px;font-weight:700;color:${text};letter-spacing:-.01em;">${brand}</span>
      </div>
      <p style="font-size:13px;color:${muted};">${c.footerTagline || ''}</p>
      <p class="footer-right" style="font-size:12px;color:${muted}55;text-align:right;">© ${year} ${brand}</p>
    </div>
  </div>
</footer>

<script>
(function(){
  // Init Lucide icons
  if(window.lucide) lucide.createIcons();

  // Navbar shadow
  var nb=document.getElementById('nb');
  window.addEventListener('scroll',function(){
    nb.style.boxShadow=window.scrollY>40?'0 1px 24px rgba(0,0,0,.22)':'none';
  },{passive:true});

  // Scroll animations
  var els=document.querySelectorAll('.anim');
  if('IntersectionObserver' in window){
    var obs=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add('in');obs.unobserve(e.target);}
      });
    },{threshold:0.08,rootMargin:'0px 0px -32px 0px'});
    els.forEach(function(el){obs.observe(el);});
  } else {
    els.forEach(function(el){el.classList.add('in');});
  }

  // FAQ accordion
  window.toggleFaq=function(btn){
    var item=btn.parentElement;
    var body=item.querySelector('.faq-body');
    var icon=item.querySelector('.faq-icon');
    var open=body.style.display!=='none';
    document.querySelectorAll('.faq-body').forEach(function(b){b.style.display='none';});
    document.querySelectorAll('.faq-icon').forEach(function(ic){
      ic.style.borderColor='${border}';ic.style.color='${muted}';ic.style.transform='rotate(0deg)';
    });
    if(!open){
      body.style.display='block';
      icon.style.borderColor='${accent}';icon.style.color='${accent}';icon.style.transform='rotate(45deg)';
    }
    if(window.lucide) lucide.createIcons();
  };

  // Smooth scroll
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
