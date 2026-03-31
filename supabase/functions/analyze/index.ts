import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// System prompt for the AI analysis (German)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Du bist ein erfahrener Web-Analyst und SEO-Experte. Du analysierst die bereitgestellten Website-Metadaten und gibst eine strukturierte Bewertung zurück.

WICHTIGE REGELN:
- Bewerte jede der 8 Kategorien von 0 bis 100.
- Finde konkrete, umsetzbare Probleme — keine allgemeinen Ratschläge.
- Schreibe alle Erklärungen in einfachem Deutsch ohne SEO-Fachbegriffe.
- Erkläre die geschäftliche Auswirkung jedes Problems.
- Gib, wo möglich, kopierfertige Code-Fixes an.
- Sei ehrlich: Wenn etwas gut ist, sage das auch.
- Identifiziere 2-3 "Quick Wins" (hohe Wirkung, geringer Aufwand).

Du MUSST exakt dieses JSON-Format zurückgeben:

{
  "overall_score": <0-100>,
  "summary": "<Kurze Zusammenfassung auf Deutsch>",
  "categories": {
    "technical_seo": {
      "score": <0-100>,
      "label": "Technical SEO",
      "issues": [<Issue-Objekte>]
    },
    "content_quality": {
      "score": <0-100>,
      "label": "Inhaltsqualität",
      "issues": [<Issue-Objekte>]
    },
    "meta_tags": {
      "score": <0-100>,
      "label": "Meta-Tags & Open Graph",
      "issues": [<Issue-Objekte>]
    },
    "heading_structure": {
      "score": <0-100>,
      "label": "Überschriften-Struktur",
      "issues": [<Issue-Objekte>]
    },
    "mobile_usability": {
      "score": <0-100>,
      "label": "Mobile Nutzbarkeit",
      "issues": [<Issue-Objekte>]
    },
    "performance": {
      "score": <0-100>,
      "label": "Performance",
      "issues": [<Issue-Objekte>]
    },
    "accessibility": {
      "score": <0-100>,
      "label": "Barrierefreiheit",
      "issues": [<Issue-Objekte>]
    },
    "security": {
      "score": <0-100>,
      "label": "Sicherheit",
      "issues": [<Issue-Objekte>]
    }
  },
  "quick_wins": [
    {
      "title": "<Titel>",
      "description": "<Beschreibung>",
      "impact": "high",
      "effort": "low"
    }
  ]
}

Jedes Issue-Objekt MUSS dieses Format haben:
{
  "id": "<kebab-case-id>",
  "severity": "high" | "medium" | "low",
  "title": "<Titel auf Deutsch>",
  "description": "<Beschreibung auf Deutsch>",
  "impact": "<Geschäftliche Auswirkung auf Deutsch>",
  "fix": "<Lösung auf Deutsch>",
  "code_snippet": "<Optionaler Code-Fix oder leerer String>",
  "effort": "low" | "medium" | "high",
  "category": "<Kategorie-Schlüssel>"
}

Antworte NUR mit dem JSON-Objekt, ohne Markdown-Codeblocks.`;

// ---------------------------------------------------------------------------
// HTML metadata extraction (regex-based, no DOM parser)
// ---------------------------------------------------------------------------
interface ExtractedMetadata {
  url: string;
  is_https: boolean;
  page_size_kb: number;
  title: string;
  meta_description: string;
  meta_keywords: string;
  canonical_url: string;
  viewport: string;
  robots: string;
  language: string;
  charset: string;
  og_tags: Record<string, string>;
  twitter_tags: Record<string, string>;
  headings: { level: number; text: string }[];
  images: { src: string; alt: string }[];
  links: { href: string; text: string; is_external: boolean }[];
  structured_data: string[];
  script_count: number;
  stylesheet_count: number;
}

function extractMetadata(html: string, url: string): ExtractedMetadata {
  const parsedUrl = new URL(url);

  // Helper to match a single regex group
  const match = (pattern: RegExp, source = html): string => {
    const m = source.match(pattern);
    return m ? m[1].trim() : "";
  };

  // Helper to decode basic HTML entities
  const decode = (s: string): string =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");

  // Title
  const title = decode(match(/<title[^>]*>([\s\S]*?)<\/title>/i));

  // Meta tags
  const metaTag = (name: string): string => {
    const re = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
      "i"
    );
    return decode(match(re) || match(re2));
  };

  const meta_description = metaTag("description");
  const meta_keywords = metaTag("keywords");
  const viewport = metaTag("viewport");
  const robots = metaTag("robots");

  // Canonical
  const canonical_url = match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i
  ) || match(
    /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i
  );

  // Language
  const language = match(/<html[^>]+lang=["']([^"']*)["']/i);

  // Charset
  const charset =
    match(/<meta[^>]+charset=["']([^"']*)["']/i) ||
    match(/<meta[^>]+charset=([^\s"'>]+)/i) ||
    "";

  // Open Graph tags
  const og_tags: Record<string, string> = {};
  const ogRegex =
    /<meta[^>]+(?:property|name)=["'](og:[^"']*)["'][^>]+content=["']([^"']*)["']/gi;
  let ogMatch: RegExpExecArray | null;
  while ((ogMatch = ogRegex.exec(html)) !== null) {
    og_tags[ogMatch[1]] = decode(ogMatch[2]);
  }
  // Also catch reversed attribute order
  const ogRegex2 =
    /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](og:[^"']*)["']/gi;
  while ((ogMatch = ogRegex2.exec(html)) !== null) {
    if (!og_tags[ogMatch[2]]) {
      og_tags[ogMatch[2]] = decode(ogMatch[1]);
    }
  }

  // Twitter Card tags
  const twitter_tags: Record<string, string> = {};
  const twRegex =
    /<meta[^>]+(?:property|name)=["'](twitter:[^"']*)["'][^>]+content=["']([^"']*)["']/gi;
  let twMatch: RegExpExecArray | null;
  while ((twMatch = twRegex.exec(html)) !== null) {
    twitter_tags[twMatch[1]] = decode(twMatch[2]);
  }
  const twRegex2 =
    /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](twitter:[^"']*)["']/gi;
  while ((twMatch = twRegex2.exec(html)) !== null) {
    if (!twitter_tags[twMatch[2]]) {
      twitter_tags[twMatch[2]] = decode(twMatch[1]);
    }
  }

  // Headings H1-H6
  const headings: { level: number; text: string }[] = [];
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const text = decode(hMatch[2].replace(/<[^>]*>/g, "").trim());
    if (text) {
      headings.push({ level: parseInt(hMatch[1]), text });
    }
  }

  // Images
  const images: { src: string; alt: string }[] = [];
  const imgRegex = /<img[^>]*>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const tag = imgMatch[0];
    const src = match(/src=["']([^"']*)["']/i, tag);
    const alt = match(/alt=["']([^"']*)["']/i, tag);
    if (src) {
      images.push({ src, alt: decode(alt) });
    }
  }

  // Links
  const links: { href: string; text: string; is_external: boolean }[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    const text = decode(linkMatch[2].replace(/<[^>]*>/g, "").trim());
    if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
      let is_external = false;
      try {
        const linkUrl = new URL(href, url);
        is_external = linkUrl.hostname !== parsedUrl.hostname;
      } catch {
        // relative URL — internal
      }
      links.push({ href, text, is_external });
    }
  }

  // Structured data (JSON-LD)
  const structured_data: string[] = [];
  const jsonLdRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch: RegExpExecArray | null;
  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    structured_data.push(jsonLdMatch[1].trim());
  }

  // Counts
  const scriptMatches = html.match(/<script[\s>]/gi);
  const script_count = scriptMatches ? scriptMatches.length : 0;

  const styleMatches = html.match(
    /<link[^>]+rel=["']stylesheet["'][^>]*>|<style[\s>]/gi
  );
  const stylesheet_count = styleMatches ? styleMatches.length : 0;

  // Page size
  const page_size_kb = Math.round((new TextEncoder().encode(html).length / 1024) * 10) / 10;

  return {
    url,
    is_https: parsedUrl.protocol === "https:",
    page_size_kb,
    title,
    meta_description,
    meta_keywords,
    canonical_url,
    viewport,
    robots,
    language,
    charset,
    og_tags,
    twitter_tags,
    headings,
    images: images.slice(0, 50), // limit to keep payload manageable
    links: links.slice(0, 100),
    structured_data,
    script_count,
    stylesheet_count,
  };
}

// ---------------------------------------------------------------------------
// Rate limiting (simple in-memory, per-function instance)
// ---------------------------------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ---- Input validation ----
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid 'url' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid URL. Please provide a valid http or https URL." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Authentication (optional) ----
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        userId = user.id;
      }
    }

    // ---- Rate limiting for anonymous users ----
    if (!userId) {
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("cf-connecting-ip") ||
        "unknown";
      if (!checkRateLimit(clientIp)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Rate limit exceeded. Please wait a minute or sign in for more analyses.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ---- Fetch the target URL ----
    console.log(`[analyze] Fetching URL: ${url}`);
    let html: string;

    const fetchHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    };

    async function tryFetch(targetUrl: string): Promise<string> {
      const fetchResponse = await fetch(targetUrl, {
        headers: fetchHeaders,
        redirect: "follow",
      });
      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status} ${fetchResponse.statusText}`);
      }
      return await fetchResponse.text();
    }

    try {
      html = await tryFetch(url);
    } catch (firstErr) {
      const firstMessage = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.warn(`[analyze] First fetch attempt failed: ${firstMessage}`);

      // If the URL was HTTPS and the error looks like an SSL/TLS issue, try HTTP fallback
      const isSSLError = firstMessage.includes("certificate") ||
        firstMessage.includes("SSL") ||
        firstMessage.includes("TLS") ||
        firstMessage.includes("CERT_") ||
        firstMessage.includes("NotValidForName") ||
        firstMessage.includes("invalid peer") ||
        firstMessage.includes("Connect");

      if (isSSLError && parsedUrl.protocol === "https:") {
        const httpUrl = url.replace(/^https:\/\//i, "http://");
        console.log(`[analyze] SSL error detected, trying HTTP fallback: ${httpUrl}`);
        try {
          html = await tryFetch(httpUrl);
          console.log(`[analyze] HTTP fallback succeeded`);
        } catch (fallbackErr) {
          const fallbackMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          console.error(`[analyze] HTTP fallback also failed: ${fallbackMessage}`);
          return new Response(
            JSON.stringify({
              success: false,
              error: `Die Website konnte nicht abgerufen werden. Es liegt ein SSL/TLS-Zertifikatsproblem vor. Das Zertifikat ist möglicherweise nicht korrekt für diese Domain konfiguriert. Bitte prüfe die SSL-Einstellungen der Website.`,
            }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Non-SSL error or already HTTP
        console.error(`[analyze] Failed to fetch URL: ${firstMessage}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Die URL konnte nicht abgerufen werden: ${firstMessage}`,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ---- Extract metadata ----
    console.log(`[analyze] Extracting metadata...`);
    const metadata = extractMetadata(html, url);

    // ---- Call OpenAI API ----
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("[analyze] OPENAI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Analysis service is not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Required category keys for validation
    const REQUIRED_CATEGORIES = [
      "technical_seo",
      "content_quality",
      "meta_tags",
      "heading_structure",
      "mobile_usability",
      "performance",
      "accessibility",
      "security",
    ];

    /**
     * Call OpenAI with retry logic, timeout, and response validation.
     */
    async function callOpenAIWithRetry(messages: any[], maxRetries = 3): Promise<any> {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000);

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: messages,
              temperature: 0.3,
              max_tokens: 4000,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.status === 429) {
            // Rate limited - wait and retry
            const waitTime = Math.pow(2, attempt) * 1000;
            console.log(`[analyze] Rate limited, retry ${attempt + 1}/${maxRetries} after ${waitTime}ms`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
          }

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (!content) throw new Error("Empty response from OpenAI");

          const parsed = JSON.parse(content);

          // Validate the response has the expected structure
          if (!parsed.overall_score || !parsed.categories) {
            throw new Error("Invalid response structure");
          }

          // Ensure all 8 categories exist with valid data
          for (const key of REQUIRED_CATEGORIES) {
            if (!parsed.categories[key]) {
              console.warn(`[analyze] Missing category '${key}', adding default`);
              parsed.categories[key] = {
                score: 50,
                label: key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                issues: [],
              };
            } else {
              if (typeof parsed.categories[key].score !== "number") {
                parsed.categories[key].score = 50;
              }
              if (!Array.isArray(parsed.categories[key].issues)) {
                parsed.categories[key].issues = [];
              }
            }
          }

          return parsed;
        } catch (err) {
          if (attempt === maxRetries - 1) throw err;
          const waitTime = Math.pow(2, attempt) * 1000;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.log(`[analyze] Retry ${attempt + 1}/${maxRetries} after ${waitTime}ms: ${errMsg}`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }

    console.log(`[analyze] Calling OpenAI API...`);
    let analysis: Record<string, unknown>;
    try {
      analysis = await callOpenAIWithRetry([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(metadata) },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[analyze] OpenAI API failed after retries: ${errMsg}`);
      return new Response(
        JSON.stringify({ success: false, error: "Analysis failed. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const durationMs = Date.now() - startTime;
    console.log(`[analyze] Analysis complete in ${durationMs}ms`);

    // ---- Save to database (if authenticated) ----
    if (userId) {
      try {
        const { error: dbError } = await supabase.from("analyses").insert({
          user_id: userId,
          url,
          overall_score: analysis.overall_score,
          results: analysis,
          metadata: {
            title: metadata.title,
            meta_description: metadata.meta_description,
            page_size_kb: metadata.page_size_kb,
          },
          duration_ms: durationMs,
        });
        if (dbError) {
          console.error(`[analyze] DB insert error: ${JSON.stringify(dbError)}`);
        }
      } catch (dbErr) {
        console.error(`[analyze] DB save failed: ${dbErr}`);
        // Non-fatal — still return results
      }
    }

    // ---- Return results ----
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url,
          analysis,
          metadata: {
            title: metadata.title,
            is_https: metadata.is_https,
            page_size_kb: metadata.page_size_kb,
          },
          duration_ms: durationMs,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[analyze] Unhandled error: ${message}`);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
