/**
 * shift07.ai - Scanner Engine
 * Orchestrates the scan animation, API calls, and result rendering.
 */

// Scanner state
var _scanState = {
  isScanning: false,
  apiResult: null,
  apiError: null,
  apiDone: false,
};

/**
 * Start a full SEO scan for the given URL.
 * This is the main entry point, called from the hero section button.
 * @param {string} url - The URL to analyze.
 */
window.startScan = async function(url) {
  if (_scanState.isScanning) {
    console.warn('[shift07] Scan already in progress');
    return;
  }

  // Validate URL
  url = _normalizeUrl(url);
  if (!url) {
    _showScanError('Bitte gib eine gültige URL ein (z.B. example.com)');
    return;
  }

  _scanState.isScanning = true;
  _scanState.apiResult = null;
  _scanState.apiError = null;
  _scanState.apiDone = false;

  try {
    // Show the scan overlay
    _showScanOverlay();

    // Start the API call in the background
    _callAnalyzeAPI(url);

    // Run animation phases sequentially
    await _animatePhase1();
    await _animatePhase2();
    await _animatePhase3();
    await _animatePhase4();

    // Wait for API if not done yet - show animated status so user knows it's still working
    if (!_scanState.apiDone) {
      _updateScanStatus('Tiefenanalyse läuft, bitte einen Moment Geduld...');
      var dots = 0;
      var statusInterval = setInterval(function() {
        dots = (dots + 1) % 4;
        var messages = [
          'Tiefenanalyse läuft' + '.'.repeat(dots),
          'KI wertet Ergebnisse aus' + '.'.repeat(dots),
          'Detaillierter Report wird erstellt' + '.'.repeat(dots),
        ];
        var idx = Math.floor(Date.now() / 5000) % messages.length;
        _updateScanStatus(messages[idx]);
      }, 800);
      await _waitForApi(90000);
      clearInterval(statusInterval);
    }

    // Hide overlay
    _hideScanOverlay();

    // Display results or error
    if (_scanState.apiError) {
      _showScanError(_scanState.apiError);
    } else if (_scanState.apiResult) {
      var isLoggedIn = await auth.isAuthenticated();
      var isPro = isLoggedIn ? await auth.isPro() : false;
      _displayResults(_scanState.apiResult, !isPro);
    } else {
      _showScanError('Die Analyse hat zu lange gedauert. Bitte versuche es erneut.');
    }

  } catch (err) {
    console.error('[shift07] Scan error:', err);
    _hideScanOverlay();
    _showScanError('Ein unerwarteter Fehler ist aufgetreten: ' + err.message);
  } finally {
    _scanState.isScanning = false;
  }
};

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

function _normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  input = input.trim();
  if (!input) return null;

  // Add protocol if missing
  if (!/^https?:\/\//i.test(input)) {
    input = 'https://' + input;
  }

  try {
    var parsed = new URL(input);
    if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) return null;
    return parsed.href;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scan overlay
// ---------------------------------------------------------------------------

function _showScanOverlay() {
  // Remove existing
  var existing = document.getElementById('scan-overlay');
  if (existing) existing.remove();

  // Inject styles if needed
  if (!document.getElementById('scan-overlay-styles')) {
    var style = document.createElement('style');
    style.id = 'scan-overlay-styles';
    style.textContent =
      '@keyframes scanPulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }' +
      '@keyframes scanSpin { to { transform:rotate(360deg); } }' +
      '@keyframes scanFadeIn { from { opacity:0;transform:scale(0.95); } to { opacity:1;transform:scale(1); } }' +
      '@keyframes scanCountUp { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }' +
      '.scan-counter { font-size:32px;font-weight:700;color:#a5b4fc;font-variant-numeric:tabular-nums; }' +
      '.scan-counter-label { font-size:13px;color:#64748b;margin-top:2px; }' +
      '.scan-phase { animation:scanFadeIn 0.4s ease-out; }' +
      '.scan-issue-item { padding:10px 14px;background:rgba(239,68,68,0.1);border-left:3px solid #ef4444;border-radius:0 8px 8px 0;margin-bottom:8px;color:#fca5a5;font-size:14px;animation:scanCountUp 0.3s ease-out; }' +
      '.scan-issue-item.warning { background:rgba(245,158,11,0.1);border-left-color:#f59e0b;color:#fcd34d; }' +
      '.scan-issue-item.info { background:rgba(99,102,241,0.1);border-left-color:#6366f1;color:#a5b4fc; }';
    document.head.appendChild(style);
  }

  var overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.97);z-index:9998;display:flex;align-items:center;justify-content:center;overflow-y:auto;';

  overlay.innerHTML =
    '<div style="width:100%;max-width:720px;padding:40px 24px;text-align:center;">' +
      // Spinner
      '<div id="scan-spinner" style="width:64px;height:64px;border:3px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:scanSpin 1s linear infinite;margin:0 auto 24px;"></div>' +
      // Status text
      '<p id="scan-status" style="color:#e2e8f0;font-size:20px;font-weight:600;margin:0 0 8px;">Verbindung wird hergestellt...</p>' +
      '<p id="scan-substatus" style="color:#64748b;font-size:14px;margin:0 0 32px;">Bitte warte einen Moment</p>' +
      // Phase content container
      '<div id="scan-phase-content" style="min-height:200px;"></div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function _hideScanOverlay() {
  var overlay = document.getElementById('scan-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.4s ease-out';
    setTimeout(function() {
      overlay.remove();
      document.body.style.overflow = '';
    }, 400);
  }
}

function _updateScanStatus(text, subtext) {
  var el = document.getElementById('scan-status');
  if (el) el.textContent = text;
  if (subtext !== undefined) {
    var sub = document.getElementById('scan-substatus');
    if (sub) sub.textContent = subtext;
  }
}

// ---------------------------------------------------------------------------
// Animation Phases
// ---------------------------------------------------------------------------

/**
 * Phase 1 (0-3s): "Verbindung wird hergestellt..."
 * Pulsing animation, initial connection.
 */
function _animatePhase1() {
  return new Promise(function(resolve) {
    _updateScanStatus('Verbindung wird hergestellt...', 'Server wird kontaktiert');

    var content = document.getElementById('scan-phase-content');
    if (content) {
      content.innerHTML =
        '<div class="scan-phase" style="display:flex;justify-content:center;gap:12px;margin-top:20px;">' +
          '<div style="width:12px;height:12px;border-radius:50%;background:#6366f1;animation:scanPulse 1s ease-in-out infinite;"></div>' +
          '<div style="width:12px;height:12px;border-radius:50%;background:#8b5cf6;animation:scanPulse 1s ease-in-out 0.2s infinite;"></div>' +
          '<div style="width:12px;height:12px;border-radius:50%;background:#a78bfa;animation:scanPulse 1s ease-in-out 0.4s infinite;"></div>' +
        '</div>';
    }

    setTimeout(resolve, 3000);
  });
}

/**
 * Phase 2 (3-10s): "Seite wird analysiert..."
 * Animate counters: elements, images, headings, links counting up.
 */
function _animatePhase2() {
  return new Promise(function(resolve) {
    _updateScanStatus('Seite wird analysiert...', 'HTML-Struktur und Inhalte werden geprüft');

    var content = document.getElementById('scan-phase-content');
    if (!content) { setTimeout(resolve, 7000); return; }

    content.innerHTML =
      '<div class="scan-phase" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:400px;margin:24px auto 0;">' +
        '<div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);border-radius:12px;padding:16px;text-align:center;">' +
          '<div class="scan-counter" id="scan-count-elements">0</div>' +
          '<div class="scan-counter-label">HTML Elemente</div>' +
        '</div>' +
        '<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);border-radius:12px;padding:16px;text-align:center;">' +
          '<div class="scan-counter" id="scan-count-images">0</div>' +
          '<div class="scan-counter-label">Bilder</div>' +
        '</div>' +
        '<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:16px;text-align:center;">' +
          '<div class="scan-counter" id="scan-count-headings">0</div>' +
          '<div class="scan-counter-label">Überschriften</div>' +
        '</div>' +
        '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);border-radius:12px;padding:16px;text-align:center;">' +
          '<div class="scan-counter" id="scan-count-links">0</div>' +
          '<div class="scan-counter-label">Links</div>' +
        '</div>' +
      '</div>';

    // Determine target values from API result or use random placeholders
    var meta = (_scanState.apiResult && _scanState.apiResult.metadata) || null;
    var targets = {
      elements: meta ? (meta.elements || meta.element_count || 247) : Math.floor(Math.random() * 300) + 100,
      images: meta ? (meta.images || meta.image_count || 34) : Math.floor(Math.random() * 50) + 10,
      headings: meta ? (meta.headings || meta.heading_count || 18) : Math.floor(Math.random() * 25) + 5,
      links: meta ? (meta.links || meta.link_count || 67) : Math.floor(Math.random() * 80) + 20,
    };

    // Animate counters
    _animateCounter('scan-count-elements', targets.elements, 6500);
    _animateCounter('scan-count-images', targets.images, 5500);
    _animateCounter('scan-count-headings', targets.headings, 5000);
    _animateCounter('scan-count-links', targets.links, 6000);

    setTimeout(resolve, 7000);
  });
}

/**
 * Phase 3 (10-20s): "KI-Analyse läuft..."
 * Fill radar chart categories one by one with scores.
 */
function _animatePhase3() {
  return new Promise(function(resolve) {
    _updateScanStatus('KI-Analyse läuft...', 'Kategorien werden bewertet');

    var content = document.getElementById('scan-phase-content');
    if (!content) { setTimeout(resolve, 10000); return; }

    var categories = [
      { key: 'technical_seo', label: 'Technical SEO', color: '#6366f1' },
      { key: 'content_quality', label: 'Inhaltsqualität', color: '#8b5cf6' },
      { key: 'meta_tags', label: 'Meta Tags', color: '#a78bfa' },
      { key: 'heading_structure', label: 'Überschriften', color: '#c4b5fd' },
      { key: 'mobile_usability', label: 'Mobile', color: '#10b981' },
      { key: 'performance', label: 'Performance', color: '#34d399' },
      { key: 'accessibility', label: 'Barrierefreiheit', color: '#f59e0b' },
      { key: 'security', label: 'Sicherheit', color: '#ef4444' },
    ];

    // Get real scores if available
    var scores = (_scanState.apiResult && _scanState.apiResult.category_scores) || null;

    var barsHtml = '';
    categories.forEach(function(cat) {
      var score = scores ? (scores[cat.key] || Math.floor(Math.random() * 40) + 50) : 0;
      barsHtml += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;" class="scan-category-bar" data-key="' + cat.key + '" data-score="' + score + '">' +
        '<span style="color:#94a3b8;font-size:13px;width:130px;text-align:right;flex-shrink:0;">' + cat.label + '</span>' +
        '<div style="flex:1;height:8px;background:rgba(100,116,139,0.15);border-radius:4px;overflow:hidden;">' +
          '<div class="scan-bar-fill" style="width:0%;height:100%;background:' + cat.color + ';border-radius:4px;transition:width 0.8s ease-out;"></div>' +
        '</div>' +
        '<span class="scan-bar-value" style="color:#e2e8f0;font-size:14px;font-weight:600;width:36px;text-align:right;">0</span>' +
      '</div>';
    });

    content.innerHTML = '<div class="scan-phase" style="max-width:500px;margin:24px auto 0;">' + barsHtml + '</div>';

    // Animate bars one by one
    var bars = content.querySelectorAll('.scan-category-bar');
    var delay = 0;
    bars.forEach(function(bar, i) {
      delay = i * 1100;
      setTimeout(function() {
        var targetScore = parseInt(bar.getAttribute('data-score')) || Math.floor(Math.random() * 40) + 50;
        var fill = bar.querySelector('.scan-bar-fill');
        var valueEl = bar.querySelector('.scan-bar-value');

        if (fill) fill.style.width = targetScore + '%';
        _animateCounterElement(valueEl, targetScore, 800);
      }, delay);
    });

    setTimeout(resolve, 10000);
  });
}

/**
 * Phase 4 (20-25s): "Report wird erstellt..."
 * Count up overall score, reveal issues one by one.
 */
function _animatePhase4() {
  return new Promise(async function(resolve) {
    _updateScanStatus('Report wird erstellt...', 'Empfehlungen werden generiert');

    var content = document.getElementById('scan-phase-content');
    if (!content) { setTimeout(resolve, 5000); return; }

    // Wait for API result if not ready yet (max 60s)
    if (!_scanState.apiDone) {
      content.innerHTML =
        '<div class="scan-phase" style="max-width:500px;margin:24px auto 0;text-align:center;">' +
          '<div style="width:48px;height:48px;border:3px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:scanSpin 1s linear infinite;margin:0 auto 16px;"></div>' +
          '<p style="color:#94a3b8;font-size:14px;">Ergebnisse werden zusammengestellt...</p>' +
        '</div>';
      await _waitForApi(60000);
    }

    // Now use the REAL data
    var overallScore = (_scanState.apiResult && _scanState.apiResult.overall_score) || 0;
    var issues = (_scanState.apiResult && _scanState.apiResult.issues) || [];
    var topIssues = issues.slice(0, 5);

    var scoreColor = overallScore >= 80 ? '#10b981' : overallScore >= 50 ? '#f59e0b' : '#ef4444';

    var issuesHtml = '';
    topIssues.forEach(function(issue, i) {
      var severity = issue.severity || 'error';
      var cssClass = severity === 'warning' ? 'warning' : severity === 'info' ? 'info' : '';
      issuesHtml += '<div class="scan-issue-item ' + cssClass + '" id="scan-issue-' + i + '" style="opacity:0;">' +
        _escapeHtml(issue.title || issue.message || 'Issue ' + (i + 1)) +
      '</div>';
    });

    content.innerHTML =
      '<div class="scan-phase" style="max-width:500px;margin:24px auto 0;">' +
        '<div style="margin-bottom:32px;">' +
          '<div id="scan-overall-score" style="font-size:72px;font-weight:800;color:' + scoreColor + ';line-height:1;">0</div>' +
          '<div style="color:#64748b;font-size:14px;margin-top:4px;">Gesamtbewertung</div>' +
        '</div>' +
        '<div style="text-align:left;">' +
          '<p style="color:#94a3b8;font-size:13px;font-weight:600;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Gefundene Issues (' + issues.length + ')</p>' +
          issuesHtml +
        '</div>' +
      '</div>';

    // Animate score counter with REAL score
    var scoreEl = document.getElementById('scan-overall-score');
    if (scoreEl) {
      _animateCounterElement(scoreEl, overallScore, 2000);
    }

    // Reveal issues one by one
    topIssues.forEach(function(issue, i) {
      setTimeout(function() {
        var issueEl = document.getElementById('scan-issue-' + i);
        if (issueEl) {
          issueEl.style.opacity = '1';
          issueEl.style.animation = 'scanCountUp 0.3s ease-out';
        }
      }, 2000 + i * 600);
    });

    setTimeout(resolve, 5000);
  });
}

// ---------------------------------------------------------------------------
// Counter animation helpers
// ---------------------------------------------------------------------------

function _animateCounter(elementId, target, duration) {
  var el = document.getElementById(elementId);
  if (!el) return;
  _animateCounterElement(el, target, duration);
}

function _animateCounterElement(el, target, duration) {
  var start = 0;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    // Ease out cubic
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.floor(eased * target);
    el.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

async function _callAnalyzeAPI(url) {
  try {
    var session = await db.getSession();

    var headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    };

    if (session && session.access_token) {
      headers['Authorization'] = 'Bearer ' + session.access_token;
    } else {
      headers['Authorization'] = 'Bearer ' + SUPABASE_ANON_KEY;
    }

    var response = await fetch(SUPABASE_URL + '/functions/v1/analyze', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ url: url }),
    });

    if (!response.ok) {
      var errorData = await response.json().catch(function() { return {}; });
      throw new Error(errorData.error || errorData.message || 'Analyse fehlgeschlagen (HTTP ' + response.status + ')');
    }

    var data = await response.json();

    // Normalize the API response for _displayResults
    if (data.success && data.data && data.data.analysis) {
      var analysis = data.data.analysis;
      // Flatten category scores and collect all issues
      var flatScores = {};
      var allIssues = [];
      var categories = analysis.categories || {};
      for (var catKey in categories) {
        var cat = categories[catKey];
        flatScores[catKey] = cat.score || 0;
        if (cat.issues && cat.issues.length) {
          cat.issues.forEach(function(issue) {
            // Map severity: high→error, medium→warning, low→info
            if (issue.severity === 'high') issue.severity = 'error';
            else if (issue.severity === 'medium') issue.severity = 'warning';
            else if (issue.severity === 'low') issue.severity = 'info';
            allIssues.push(issue);
          });
        }
      }

      _scanState.apiResult = {
        url: data.data.url,
        overall_score: analysis.overall_score,
        summary: analysis.summary,
        category_scores: flatScores,
        categories: categories,
        issues: allIssues,
        quick_wins: analysis.quick_wins || [],
      };
    } else {
      _scanState.apiResult = data;
    }

    _scanState.apiDone = true;

    // Save to database if we have a result
    if (_scanState.apiResult && _scanState.apiResult.url) {
      db.saveAnalysis(_scanState.apiResult).catch(function(err) {
        console.error('[shift07] Failed to save analysis:', err);
      });
    }

    console.log('[shift07] API analysis complete:', _scanState.apiResult && _scanState.apiResult.overall_score);
  } catch (err) {
    console.error('[shift07] API call failed:', err);
    _scanState.apiError = err.message;
    _scanState.apiDone = true;
  }
}

function _waitForApi(timeout) {
  return new Promise(function(resolve) {
    var elapsed = 0;
    var interval = setInterval(function() {
      elapsed += 200;
      if (_scanState.apiDone || elapsed >= timeout) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}

// ---------------------------------------------------------------------------
// Results display
// ---------------------------------------------------------------------------

/**
 * Display analysis results in #results-container.
 * @param {object} result - The analysis result.
 * @param {boolean} isFree - If true, blur premium content.
 */
function _displayResults(result, isFree) {
  var container = document.getElementById('results-container');
  if (!container) {
    console.error('[shift07] #results-container not found in DOM');
    return;
  }

  var overallScore = result.overall_score || 0;
  var categoryScores = result.category_scores || {};
  var issues = result.issues || [];
  var metadata = result.metadata || {};
  var recommendations = result.recommendations || {};
  var sevenDayPlan = result.seven_day_plan || null;

  var scoreColor = overallScore >= 80 ? '#10b981' : overallScore >= 50 ? '#f59e0b' : '#ef4444';
  var scoreLabel = overallScore >= 80 ? 'Gut' : overallScore >= 50 ? 'Verbesserungsbedarf' : 'Kritisch';

  // Free users see top 3 issues, pro users see all
  var visibleIssues = isFree ? issues.slice(0, 3) : issues;
  var hiddenIssueCount = isFree ? Math.max(0, issues.length - 3) : 0;

  var html = '';

  // --- Score header ---
  html += '<div style="text-align:center;padding:40px 20px 32px;">' +
    '<h2 style="color:#f1f5f9;font-size:24px;font-weight:700;margin:0 0 8px;">Analyse abgeschlossen</h2>' +
    '<p style="color:#64748b;font-size:14px;margin:0 0 24px;">' + _escapeHtml(result.url || '') + '</p>' +
    '<div style="display:inline-flex;align-items:center;gap:16px;background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.2);border-radius:16px;padding:24px 40px;">' +
      '<div style="font-size:64px;font-weight:800;color:' + scoreColor + ';line-height:1;">' + overallScore + '</div>' +
      '<div style="text-align:left;">' +
        '<div style="font-size:14px;color:#64748b;">Gesamtbewertung</div>' +
        '<div style="font-size:18px;font-weight:600;color:' + scoreColor + ';">' + scoreLabel + '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  // --- Radar chart ---
  html += '<div style="padding:0 20px 32px;">' +
    '<h3 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 16px;">Kategorie-Übersicht</h3>' +
    '<div id="results-radar-chart" style="display:flex;justify-content:center;"></div>' +
  '</div>';

  // --- Category score bars ---
  html += '<div style="padding:0 20px 32px;max-width:600px;margin:0 auto;">';
  var catLabels = {
    technical_seo: 'Technical SEO',
    content_quality: 'Inhaltsqualität',
    meta_tags: 'Meta Tags',
    heading_structure: 'Überschriften',
    mobile_usability: 'Mobile',
    performance: 'Performance',
    accessibility: 'Barrierefreiheit',
    security: 'Sicherheit',
  };
  for (var key in catLabels) {
    var val = categoryScores[key] || 0;
    var barColor = val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444';
    html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">' +
      '<span style="color:#94a3b8;font-size:13px;width:130px;text-align:right;flex-shrink:0;">' + catLabels[key] + '</span>' +
      '<div style="flex:1;height:8px;background:rgba(100,116,139,0.15);border-radius:4px;overflow:hidden;">' +
        '<div style="width:' + val + '%;height:100%;background:' + barColor + ';border-radius:4px;"></div>' +
      '</div>' +
      '<span style="color:#e2e8f0;font-size:14px;font-weight:600;width:36px;text-align:right;">' + val + '</span>' +
    '</div>';
  }
  html += '</div>';

  // --- Issues list ---
  html += '<div style="padding:0 20px 32px;">' +
    '<h3 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 16px;">Gefundene Issues (' + issues.length + ')</h3>';

  visibleIssues.forEach(function(issue) {
    var severity = issue.severity || 'error';
    var sevColor = severity === 'error' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#6366f1';
    var sevBg = severity === 'error' ? 'rgba(239,68,68,0.1)' : severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)';
    var sevLabel = severity === 'error' ? 'Fehler' : severity === 'warning' ? 'Warnung' : 'Info';

    html += '<div style="background:' + sevBg + ';border:1px solid ' + sevColor + '33;border-radius:12px;padding:16px;margin-bottom:12px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="background:' + sevColor + ';color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;text-transform:uppercase;">' + sevLabel + '</span>' +
        '<span style="color:#e2e8f0;font-weight:600;font-size:15px;">' + _escapeHtml(issue.title || issue.message || '') + '</span>' +
      '</div>';

    if (issue.description) {
      html += '<p style="color:#94a3b8;font-size:14px;margin:0 0 8px;line-height:1.5;">' + _escapeHtml(issue.description) + '</p>';
    }

    // Code fix (pro only)
    if (issue.fix && !isFree) {
      html += '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;margin-top:8px;">' +
        '<p style="color:#6ee7b7;font-size:12px;font-weight:600;margin:0 0 6px;text-transform:uppercase;">Lösung</p>' +
        '<code style="color:#e2e8f0;font-size:13px;white-space:pre-wrap;word-break:break-all;">' + _escapeHtml(issue.fix) + '</code>' +
      '</div>';
    }

    html += '</div>';
  });

  // --- Blurred section for free users ---
  if (isFree && hiddenIssueCount > 0) {
    html += '<div style="position:relative;margin-top:8px;">' +
      // Blurred fake issues
      '<div style="filter:blur(6px);pointer-events:none;user-select:none;opacity:0.5;">';
    for (var i = 0; i < Math.min(hiddenIssueCount, 4); i++) {
      html += '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.1);border-radius:12px;padding:16px;margin-bottom:12px;">' +
        '<div style="height:16px;width:60%;background:rgba(100,116,139,0.15);border-radius:4px;margin-bottom:8px;"></div>' +
        '<div style="height:12px;width:90%;background:rgba(100,116,139,0.1);border-radius:4px;margin-bottom:4px;"></div>' +
        '<div style="height:12px;width:75%;background:rgba(100,116,139,0.1);border-radius:4px;"></div>' +
      '</div>';
    }
    html += '</div>';

    // Glass-morphism CTA overlay
    html += '<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">' +
      '<div style="background:rgba(15,23,42,0.7);backdrop-filter:blur(8px);border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:32px;text-align:center;max-width:400px;">' +
        '<div style="width:48px;height:48px;background:rgba(99,102,241,0.15);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
          '<svg width="24" height="24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' +
        '</div>' +
        '<p style="color:#f1f5f9;font-size:18px;font-weight:700;margin:0 0 8px;">' + hiddenIssueCount + ' weitere Issues gefunden</p>' +
        '<p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">Vollständigen Report freischalten inkl. Code-Fixes und 7-Tage-Plan</p>' +
        '<button onclick="auth.showAuthModal(\'signup\')" style="padding:12px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:opacity 0.2s;">Jetzt freischalten</button>' +
      '</div>' +
    '</div>';

    html += '</div>';
  }

  html += '</div>';

  // --- 7-Day Plan (pro only) ---
  if (!isFree && sevenDayPlan) {
    html += '<div style="padding:0 20px 32px;">' +
      '<h3 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 16px;">7-Tage Optimierungsplan</h3>';

    var days = Array.isArray(sevenDayPlan) ? sevenDayPlan : sevenDayPlan.days || [];
    days.forEach(function(day, i) {
      html += '<div style="display:flex;gap:16px;margin-bottom:16px;">' +
        '<div style="width:40px;height:40px;background:rgba(99,102,241,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<span style="color:#a5b4fc;font-weight:700;font-size:14px;">T' + (i + 1) + '</span>' +
        '</div>' +
        '<div style="flex:1;">' +
          '<p style="color:#e2e8f0;font-weight:600;font-size:15px;margin:0 0 4px;">' + _escapeHtml(day.title || 'Tag ' + (i + 1)) + '</p>' +
          '<p style="color:#94a3b8;font-size:14px;margin:0;line-height:1.5;">' + _escapeHtml(day.description || day.tasks || '') + '</p>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
  } else if (isFree) {
    // Blurred 7-day plan placeholder
    html += '<div style="position:relative;padding:0 20px 32px;">' +
      '<h3 style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 16px;">7-Tage Optimierungsplan</h3>' +
      '<div style="filter:blur(6px);pointer-events:none;user-select:none;opacity:0.4;">';
    for (var d = 1; d <= 3; d++) {
      html += '<div style="display:flex;gap:16px;margin-bottom:16px;">' +
        '<div style="width:40px;height:40px;background:rgba(99,102,241,0.15);border-radius:10px;flex-shrink:0;"></div>' +
        '<div style="flex:1;">' +
          '<div style="height:14px;width:40%;background:rgba(100,116,139,0.15);border-radius:4px;margin-bottom:8px;"></div>' +
          '<div style="height:10px;width:80%;background:rgba(100,116,139,0.1);border-radius:4px;"></div>' +
        '</div>' +
      '</div>';
    }
    html += '</div>' +
      '<div style="position:absolute;top:40px;left:20px;width:calc(100% - 40px);height:calc(100% - 60px);display:flex;align-items:center;justify-content:center;">' +
        '<div style="background:rgba(15,23,42,0.7);backdrop-filter:blur(8px);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:20px 32px;text-align:center;">' +
          '<p style="color:#a5b4fc;font-size:15px;font-weight:600;margin:0;">Pro-Feature</p>' +
          '<p style="color:#64748b;font-size:13px;margin:4px 0 0;">Upgrade für den vollständigen Plan</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // --- Action buttons ---
  html += '<div style="text-align:center;padding:20px 20px 40px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
    '<button onclick="window.startScan(document.getElementById(\'scan-url-input\')?.value || \'\')" style="padding:12px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Neue Analyse starten</button>';

  if (isFree) {
    html += '<button onclick="auth.showAuthModal(\'signup\')" style="padding:12px 24px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Pro-Report freischalten</button>';
  }

  html += '</div>';

  container.innerHTML = html;
  container.style.display = 'block';

  // Render radar chart
  _renderRadarChart(categoryScores, 'results-radar-chart');

  // Scroll to results
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Radar chart
// ---------------------------------------------------------------------------

/**
 * Render an SVG radar chart with 8 axes.
 * @param {object} categoryScores - Scores keyed by category.
 * @param {string} targetElementId - DOM element ID to render into.
 */
function _renderRadarChart(categoryScores, targetElementId) {
  var target = document.getElementById(targetElementId);
  if (!target) return;

  var categories = [
    { key: 'technical_seo', label: 'Technical SEO' },
    { key: 'content_quality', label: 'Inhaltsqualität' },
    { key: 'meta_tags', label: 'Meta Tags' },
    { key: 'heading_structure', label: 'Überschriften' },
    { key: 'mobile_usability', label: 'Mobile' },
    { key: 'performance', label: 'Performance' },
    { key: 'accessibility', label: 'Barrierefreiheit' },
    { key: 'security', label: 'Sicherheit' },
  ];

  var size = 320;
  var center = size / 2;
  var maxRadius = 120;
  var numAxes = categories.length;
  var angleStep = (2 * Math.PI) / numAxes;

  // Build SVG
  var svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">';

  // Defs for gradient
  svg += '<defs>' +
    '<linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.4" />' +
      '<stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0.2" />' +
    '</linearGradient>' +
  '</defs>';

  // Grid rings
  var rings = [0.25, 0.5, 0.75, 1.0];
  rings.forEach(function(frac) {
    var r = maxRadius * frac;
    var points = [];
    for (var i = 0; i < numAxes; i++) {
      var angle = angleStep * i - Math.PI / 2;
      points.push((center + r * Math.cos(angle)).toFixed(1) + ',' + (center + r * Math.sin(angle)).toFixed(1));
    }
    svg += '<polygon points="' + points.join(' ') + '" fill="none" stroke="rgba(100,116,139,0.15)" stroke-width="1" />';
  });

  // Axis lines
  for (var i = 0; i < numAxes; i++) {
    var angle = angleStep * i - Math.PI / 2;
    var x2 = center + maxRadius * Math.cos(angle);
    var y2 = center + maxRadius * Math.sin(angle);
    svg += '<line x1="' + center + '" y1="' + center + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="rgba(100,116,139,0.1)" stroke-width="1" />';
  }

  // Data polygon
  var dataPoints = [];
  categories.forEach(function(cat, i) {
    var score = categoryScores[cat.key] || 0;
    var frac = score / 100;
    var angle = angleStep * i - Math.PI / 2;
    var x = center + maxRadius * frac * Math.cos(angle);
    var y = center + maxRadius * frac * Math.sin(angle);
    dataPoints.push(x.toFixed(1) + ',' + y.toFixed(1));
  });

  svg += '<polygon points="' + dataPoints.join(' ') + '" fill="url(#radarGrad)" stroke="#6366f1" stroke-width="2" />';

  // Data points (circles)
  categories.forEach(function(cat, i) {
    var score = categoryScores[cat.key] || 0;
    var frac = score / 100;
    var angle = angleStep * i - Math.PI / 2;
    var x = center + maxRadius * frac * Math.cos(angle);
    var y = center + maxRadius * frac * Math.sin(angle);
    svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="#6366f1" stroke="#fff" stroke-width="1.5" />';
  });

  // Labels
  categories.forEach(function(cat, i) {
    var angle = angleStep * i - Math.PI / 2;
    var labelRadius = maxRadius + 28;
    var x = center + labelRadius * Math.cos(angle);
    var y = center + labelRadius * Math.sin(angle);

    var anchor = 'middle';
    if (Math.cos(angle) > 0.3) anchor = 'start';
    if (Math.cos(angle) < -0.3) anchor = 'end';

    var score = categoryScores[cat.key] || 0;
    svg += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif">' + cat.label + '</text>';
    svg += '<text x="' + x.toFixed(1) + '" y="' + (y + 14).toFixed(1) + '" text-anchor="' + anchor + '" dominant-baseline="middle" fill="#e2e8f0" font-size="12" font-weight="600" font-family="system-ui,sans-serif">' + score + '</text>';
  });

  svg += '</svg>';

  target.innerHTML = svg;
}

// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------

function _showScanError(message) {
  var container = document.getElementById('results-container');
  if (!container) {
    alert(message);
    return;
  }

  container.innerHTML =
    '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="width:56px;height:56px;background:rgba(239,68,68,0.15);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">' +
        '<svg width="28" height="28" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '</div>' +
      '<h3 style="color:#f1f5f9;font-size:20px;font-weight:600;margin:0 0 8px;">Analyse fehlgeschlagen</h3>' +
      '<p style="color:#94a3b8;font-size:15px;margin:0 0 24px;max-width:400px;display:inline-block;">' + _escapeHtml(message) + '</p>' +
      '<div>' +
        '<button onclick="window.startScan(document.getElementById(\'scan-url-input\')?.value || \'\')" style="padding:12px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Erneut versuchen</button>' +
      '</div>' +
    '</div>';
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function _escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
