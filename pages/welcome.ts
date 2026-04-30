/**
 * pages/welcome.ts — Landing page for the ln URL shortener.
 *
 * Explains the service, how to set up browser shortcuts, and provides
 * a sign-in CTA. Fully self-contained HTML with embedded CSS.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SITE_HOST = BASE_URL.replace(/^https?:\/\//, "");

export function renderWelcomePage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${SITE_HOST} — Link Shortener</title>
  <meta name="description" content="URL shortening service. Claim short paths, share links, and set up browser shortcuts.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg-primary: #06060b;
      --bg-card: rgba(255,255,255,0.03);
      --bg-card-hover: rgba(255,255,255,0.06);
      --border: rgba(255,255,255,0.07);
      --border-hover: rgba(255,255,255,0.14);
      --text-primary: #e8e8f0;
      --text-secondary: #8888a0;
      --text-muted: #55556a;
      --accent: #7c5cfc;
      --accent-glow: rgba(124,92,252,0.25);
      --accent-2: #5ce0d8;
      --accent-3: #fc5c8c;
      --success: #34d399;
      --mono: 'JetBrains Mono', monospace;
    }

    html { scroll-behavior: smooth; }

    body {
      min-height: 100vh;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      overflow-x: hidden;
    }

    /* ---- Hero ---- */
    .hero {
      position: relative;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
      overflow: hidden;
    }

    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,92,252,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 40% 30% at 80% 20%, rgba(92,224,216,0.06) 0%, transparent 60%),
        radial-gradient(ellipse 30% 30% at 20% 80%, rgba(252,92,140,0.06) 0%, transparent 60%);
      pointer-events: none;
    }

    .hero-content {
      position: relative;
      z-index: 1;
      max-width: 700px;
    }

    .logo {
      font-family: var(--mono);
      font-size: 1rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      color: var(--accent);
      text-transform: uppercase;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .logo .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-sub {
      font-size: 1.15rem;
      color: var(--text-secondary);
      max-width: 520px;
      margin: 0 auto 2.5rem;
      line-height: 1.7;
    }

    .hero-demo {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-family: var(--mono);
      font-size: 0.95rem;
      color: var(--text-muted);
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 0.85rem 1.5rem;
      margin-bottom: 3rem;
      transition: all 0.3s ease;
    }

    .hero-demo:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
    }

    .hero-demo .cmd {
      color: var(--accent-2);
    }

    .hero-demo .arrow {
      color: var(--text-muted);
      font-size: 1.2rem;
    }

    .hero-demo .url {
      color: var(--text-secondary);
    }

    .cta-group {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 2rem;
      border-radius: 12px;
      font-family: 'Inter', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.25s ease;
      border: none;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
      box-shadow: 0 4px 24px var(--accent-glow);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 32px var(--accent-glow);
    }

    .btn-ghost {
      background: var(--bg-card);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
      transform: translateY(-2px);
    }

    .scroll-hint {
      position: absolute;
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      color: var(--text-muted);
      animation: float 2s ease-in-out infinite;
      font-size: 1.5rem;
    }

    @keyframes float {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(8px); }
    }

    /* ---- Sections ---- */
    section {
      max-width: 900px;
      margin: 0 auto;
      padding: 6rem 2rem;
    }

    .section-label {
      font-family: var(--mono);
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 1rem;
    }

    h2 {
      font-size: clamp(1.8rem, 4vw, 2.5rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
    }

    .section-desc {
      color: var(--text-secondary);
      font-size: 1.05rem;
      margin-bottom: 3rem;
      max-width: 600px;
    }

    /* ---- Steps ---- */
    .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
    }

    .step {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .step:hover {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
      transform: translateY(-4px);
    }

    .step::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
    }

    .step:nth-child(1)::before { background: linear-gradient(90deg, var(--accent), transparent); }
    .step:nth-child(2)::before { background: linear-gradient(90deg, var(--accent-2), transparent); }
    .step:nth-child(3)::before { background: linear-gradient(90deg, var(--accent-3), transparent); }

    .step-num {
      font-family: var(--mono);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    .step:nth-child(1) .step-num { color: var(--accent); }
    .step:nth-child(2) .step-num { color: var(--accent-2); }
    .step:nth-child(3) .step-num { color: var(--accent-3); }

    .step h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .step p {
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.6;
    }

    /* ---- Browser Setup ---- */
    .browser-tabs {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 0;
      flex-wrap: wrap;
    }

    .browser-tab {
      padding: 0.6rem 1.2rem;
      border-radius: 10px 10px 0 0;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-bottom: none;
      color: var(--text-muted);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .browser-tab.active, .browser-tab:hover {
      background: var(--bg-card-hover);
      color: var(--text-primary);
      border-color: var(--border-hover);
    }

    .browser-tab.active {
      color: var(--accent);
    }

    .browser-panels {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 0 16px 16px 16px;
      padding: 2rem;
    }

    .browser-panel {
      display: none;
    }

    .browser-panel.active {
      display: block;
    }

    .browser-panel h4 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--accent-2);
    }

    .browser-panel ol {
      padding-left: 1.5rem;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .browser-panel ol li {
      margin-bottom: 0.75rem;
      line-height: 1.6;
    }

    .browser-panel code {
      font-family: var(--mono);
      font-size: 0.85rem;
      background: rgba(124,92,252,0.1);
      color: var(--accent);
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
    }

    .browser-panel .example {
      margin-top: 1.5rem;
      padding: 1rem 1.5rem;
      background: rgba(52,211,153,0.05);
      border: 1px solid rgba(52,211,153,0.15);
      border-radius: 10px;
      font-family: var(--mono);
      font-size: 0.85rem;
      color: var(--success);
    }

    /* ---- Footer ---- */
    footer {
      text-align: center;
      padding: 3rem 2rem;
      color: var(--text-muted);
      font-size: 0.8rem;
      border-top: 1px solid var(--border);
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }

    /* ---- Grid decoration ---- */
    .grid-bg {
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: 60px 60px;
      pointer-events: none;
      z-index: 0;
    }

    /* ---- Responsive ---- */
    @media (max-width: 640px) {
      .hero-demo { flex-direction: column; gap: 0.25rem; }
      .cta-group { flex-direction: column; align-items: center; }
      .btn { width: 100%; justify-content: center; max-width: 280px; }
      .browser-tabs { gap: 0.15rem; }
      .browser-tab { padding: 0.5rem 0.8rem; font-size: 0.75rem; }
    }
  </style>
</head>
<body>
  <div class="grid-bg"></div>

  <!-- Hero -->
  <div class="hero">
    <div class="hero-content">
      <div class="logo">
        <span class="dot"></span>
        ${escapeHtml(SITE_HOST)}
      </div>
      <h1>Short links,<br>zero friction</h1>
      <p class="hero-sub">
        The internal link shortener.
        Claim a short path, get a real URL that works everywhere —
        hyperlinks, documents, Slack, email.
      </p>

      <a href="${escapeHtml(BASE_URL)}/yt" class="hero-demo" style="text-decoration:none">
        <span class="cmd">${escapeHtml(BASE_URL.replace(/^https?:\/\//, ''))}/yt</span>
        <span class="arrow">→</span>
        <span class="url">youtube.com</span>
      </a>

      <div class="cta-group">
        <a href="/_/auth/login" class="btn btn-primary" id="btn-signin">
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none"><path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107"/><path d="M5.3 14.7l7.4 5.4C14.4 16.3 18.8 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 6.1 29.6 4 24 4 15.4 4 8.1 8.5 5.3 14.7z" fill="#FF3D00"/><path d="M24 44c5.4 0 10.2-1.8 14-4.9l-7-5.7C28.9 35 26.6 36 24 36c-6 0-10.5-3.9-11.7-9.2l-7.3 5.6C8 38.2 15.4 44 24 44z" fill="#4CAF50"/><path d="M44.5 20H24v8.5h11.8c-.9 2.4-2.5 4.4-4.6 5.8l7 5.7C42.3 36.2 46 30.7 46 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2"/></svg>
          Sign in with Google
        </a>
        <a href="#how-it-works" class="btn btn-ghost">How it works</a>
      </div>
    </div>
    <div class="scroll-hint">↓</div>
  </div>

  <!-- How It Works -->
  <section id="how-it-works">
    <div class="section-label">How it works</div>
    <h2>Three steps to shorter links</h2>
    <p class="section-desc">
      Sign in with your account, claim a path, and
      share it. No tracking, no ads, just fast redirects.
    </p>

    <div class="steps">
      <div class="step">
        <div class="step-num">01</div>
        <h3>Claim a path</h3>
        <p>
          Pick any unused short path like <code>/yt</code>,
          <code>/docs</code>, or <code>/jira/board</code> and point it at
          any URL.
        </p>
      </div>
      <div class="step">
        <div class="step-num">02</div>
        <h3>Use it everywhere</h3>
        <p>
          Your link <code>${escapeHtml(SITE_HOST)}/yt</code> is a real URL.
          Use it in documents, emails, Slack messages, hyperlinks —
          anywhere a URL works.
        </p>
      </div>
      <div class="step">
        <div class="step-num">03</div>
        <h3>Instant redirect</h3>
        <p>
          Visitors are redirected in milliseconds. Edit or delete your
          links anytime from the dashboard.
        </p>
      </div>
    </div>
  </section>

  <!-- Local DNS Setup -->
  <section id="local-dns">
    <div class="section-label">🔗 Use anywhere</div>
    <h2>Make <code style="font-family:var(--mono);color:var(--accent-2);background:none;">http://ln/yt</code> work everywhere</h2>
    <p class="section-desc">
      Add <code>ln</code> as a local hostname so short links work in
      <strong>any</strong> app — curl, hyperlinks, documents, Slack, scripts.
    </p>

    <div class="steps" style="grid-template-columns: 1fr;">
      <div class="step">
        <div class="step-num">one-line install</div>
        <h3>Linux &amp; macOS</h3>
        <p style="margin-bottom: 1rem;">Run this in your terminal:</p>
        <div style="position:relative;">
          <pre style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:10px;padding:1rem 1.25rem;font-family:var(--mono);font-size:0.85rem;color:var(--accent-2);overflow-x:auto;margin:0;"><code id="install-cmd">curl -fsSL ${escapeHtml(BASE_URL)}/_/setup.sh | sudo bash</code></pre>
          <button onclick="navigator.clipboard.writeText(document.getElementById('install-cmd').textContent);this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)" style="position:absolute;top:0.6rem;right:0.6rem;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-muted);font-size:0.7rem;padding:0.25rem 0.6rem;cursor:pointer;font-family:var(--mono);">Copy</button>
        </div>
        <p style="margin-top:1rem;font-size:0.85rem;color:var(--text-muted);">
          To uninstall: <code>curl -fsSL ${escapeHtml(BASE_URL)}/_/setup.sh | sudo bash -s -- --remove</code>
        </p>
      </div>
    </div>

    <div class="steps" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-top: 1.5rem;">
      <div class="step">
        <div class="step-num">after setup</div>
        <h3>Terminal</h3>
        <p><code>curl -L http://ln/yt</code></p>
      </div>
      <div class="step">
        <div class="step-num">after setup</div>
        <h3>Browser URL bar</h3>
        <p><code>http://ln/yt</code></p>
      </div>
      <div class="step">
        <div class="step-num">after setup</div>
        <h3>Hyperlinks &amp; docs</h3>
        <p><code>&lt;a href="http://ln/yt"&gt;</code></p>
      </div>
    </div>
  </section>

  <!-- Browser Setup -->
  <section id="browser-setup">
    <div class="section-label">⚡ Power user tip</div>
    <h2>Even shorter — type <code style="font-family:var(--mono);color:var(--accent);background:none;">ln&nbsp;</code> + path</h2>
    <p class="section-desc">
      Set up a browser keyword so typing <code>ln yt</code> in your address
      bar takes you straight to the destination — no need to type even <code>http://</code>.
    </p>

    <div class="browser-tabs">
      <div class="browser-tab active" data-panel="chrome">Chrome</div>
      <div class="browser-tab" data-panel="firefox">Firefox</div>
      <div class="browser-tab" data-panel="edge">Edge</div>
      <div class="browser-tab" data-panel="safari">Safari</div>
    </div>

    <div class="browser-panels">
      <div class="browser-panel active" id="panel-chrome">
        <h4>Google Chrome</h4>
        <ol>
          <li>Open <strong>Settings → Search engine → Manage search engines & site search</strong></li>
          <li>Under "Site search", click <strong>Add</strong></li>
          <li>Set the name to <code>${escapeHtml(SITE_HOST)}</code></li>
          <li>Set the shortcut to <code>ln</code></li>
          <li>Set the URL to <code>${escapeHtml(BASE_URL)}/%s</code></li>
          <li>Click <strong>Add</strong></li>
        </ol>
        <div class="example">
          Now type: <strong>ln</strong> → Tab → <strong>yt</strong> → Enter
        </div>
      </div>

      <div class="browser-panel" id="panel-firefox">
        <h4>Mozilla Firefox</h4>
        <ol>
          <li>Go to <code>${escapeHtml(BASE_URL)}</code> and bookmark this page</li>
          <li>Open <strong>Bookmarks → Manage Bookmarks</strong> (Ctrl+Shift+O)</li>
          <li>Find the bookmark, right-click → <strong>Edit Bookmark</strong></li>
          <li>Set the <strong>URL</strong> to <code>${escapeHtml(BASE_URL)}/%s</code></li>
          <li>Set the <strong>Keyword</strong> to <code>ln</code></li>
          <li>Save</li>
        </ol>
        <div class="example">
          Now type: <strong>ln yt</strong> → Enter
        </div>
      </div>

      <div class="browser-panel" id="panel-edge">
        <h4>Microsoft Edge</h4>
        <ol>
          <li>Open <strong>Settings → Privacy, search, and services → Address bar and search</strong></li>
          <li>Click <strong>Manage search engines</strong></li>
          <li>Click <strong>Add</strong></li>
          <li>Name: <code>${escapeHtml(SITE_HOST)}</code>, Keyword: <code>ln</code></li>
          <li>URL: <code>${escapeHtml(BASE_URL)}/%s</code></li>
        </ol>
        <div class="example">
          Now type: <strong>ln</strong> → Tab → <strong>yt</strong> → Enter
        </div>
      </div>

      <div class="browser-panel" id="panel-safari">
        <h4>Apple Safari</h4>
        <ol>
          <li>Safari doesn't natively support custom search keywords</li>
          <li>Install a Safari extension like <strong>Keyword Search</strong> from the App Store</li>
          <li>Add a keyword: <code>ln</code> → <code>${escapeHtml(BASE_URL)}/%s</code></li>
        </ol>
        <div class="example">
          Alternatively, just type <strong>${escapeHtml(SITE_HOST)}/yt</strong> directly
        </div>
      </div>
    </div>
  </section>

  <footer>
    <p>${escapeHtml(SITE_HOST)}</p>
  </footer>

  <script>
    // Browser tab switching
    document.querySelectorAll('.browser-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.browser-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.browser-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
      });
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
