/**
 * shift07.ai - Supabase Client
 * Initializes the Supabase browser client and provides database helper functions.
 * Requires supabase-js CDN to be loaded before this file.
 */

// Supabase configuration
const SUPABASE_URL = 'https://xhshwuotydeerthvhhsx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qVxp1w5wCKAwP-hij17Sbw_tEBHYX3S';

// Will be initialized after CDN loads
let supabase = null;

/**
 * Initialize the Supabase client from the globally loaded supabase-js library.
 * Call this after the CDN script has loaded.
 */
function initSupabase() {
  try {
    if (window.supabase && window.supabase.createClient) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
      console.log('[shift07] Supabase client initialized');
      return true;
    } else {
      console.error('[shift07] supabase-js library not found on window. Ensure the CDN script is loaded before this file.');
      return false;
    }
  } catch (err) {
    console.error('[shift07] Failed to initialize Supabase client:', err);
    return false;
  }
}

/**
 * Database helper functions for the shift07.ai app.
 */
const db = {

  /**
   * Get the current auth session.
   * @returns {object|null} The session object or null if not authenticated.
   */
  async getSession() {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        return null;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[shift07] Error getting session:', error.message);
        return null;
      }
      return data.session;
    } catch (err) {
      console.error('[shift07] Unexpected error getting session:', err);
      return null;
    }
  },

  /**
   * Get the current authenticated user.
   * @returns {object|null} The user object or null.
   */
  async getUser() {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        return null;
      }
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('[shift07] Error getting user:', error.message);
        return null;
      }
      return data.user;
    } catch (err) {
      console.error('[shift07] Unexpected error getting user:', err);
      return null;
    }
  },

  /**
   * Get the user profile with subscription status from the profiles table.
   * @returns {object|null} The profile object or null.
   */
  async getProfile() {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        return null;
      }

      const user = await this.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[shift07] Error getting profile:', error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[shift07] Unexpected error getting profile:', err);
      return null;
    }
  },

  /**
   * Save an analysis result to the database.
   * @param {object} data - The analysis data to save.
   * @param {string} data.url - The analyzed URL.
   * @param {number} data.overall_score - Overall SEO score (0-100).
   * @param {object} data.category_scores - Scores per category.
   * @param {Array} data.issues - List of issues found.
   * @param {object} data.metadata - Page metadata (elements, images, etc.).
   * @param {object} [data.recommendations] - AI recommendations.
   * @param {object} [data.seven_day_plan] - 7-day improvement plan.
   * @returns {object|null} The saved analysis record or null on error.
   */
  async saveAnalysis(data) {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        return null;
      }

      const user = await this.getUser();

      const record = {
        url: data.url,
        overall_score: data.overall_score,
        category_scores: data.category_scores,
        issues: data.issues,
        metadata: data.metadata,
        recommendations: data.recommendations || null,
        seven_day_plan: data.seven_day_plan || null,
        user_id: user ? user.id : null,
        created_at: new Date().toISOString(),
      };

      const { data: saved, error } = await supabase
        .from('analyses')
        .insert(record)
        .select()
        .single();

      if (error) {
        console.error('[shift07] Error saving analysis:', error.message);
        return null;
      }

      console.log('[shift07] Analysis saved:', saved.id);
      return saved;
    } catch (err) {
      console.error('[shift07] Unexpected error saving analysis:', err);
      return null;
    }
  },

  /**
   * Get the current user's analyses (paginated).
   * @param {number} page - Page number (1-indexed).
   * @param {number} limit - Number of results per page.
   * @returns {object} { data: Array, count: number, error: string|null }
   */
  async getAnalyses(page = 1, limit = 20) {
    try {
      if (!supabase) {
        return { data: [], count: 0, error: 'Supabase not initialized' };
      }

      const user = await this.getUser();
      if (!user) {
        return { data: [], count: 0, error: 'Not authenticated' };
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from('analyses')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('[shift07] Error fetching analyses:', error.message);
        return { data: [], count: 0, error: error.message };
      }

      return { data: data || [], count: count || 0, error: null };
    } catch (err) {
      console.error('[shift07] Unexpected error fetching analyses:', err);
      return { data: [], count: 0, error: err.message };
    }
  },

  /**
   * Get a single analysis by ID.
   * @param {string} id - The analysis ID (UUID).
   * @returns {object|null} The analysis record or null.
   */
  async getAnalysis(id) {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        return null;
      }

      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('[shift07] Error fetching analysis:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('[shift07] Unexpected error fetching analysis:', err);
      return null;
    }
  },

  /**
   * Check the rate limit for an anonymous user (by IP hash).
   * @param {string} ipHash - A hash of the user's IP address.
   * @returns {object} { allowed: boolean, remaining: number, resetAt: string|null }
   */
  async checkRateLimit(ipHash) {
    try {
      if (!supabase) {
        return { allowed: false, remaining: 0, resetAt: null };
      }

      const { data, error } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('ip_hash', ipHash)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine (first request)
        console.error('[shift07] Error checking rate limit:', error.message);
        return { allowed: true, remaining: 3, resetAt: null };
      }

      // No record found - first request from this IP
      if (!data) {
        return { allowed: true, remaining: 3, resetAt: null };
      }

      const now = new Date();
      const resetAt = new Date(data.reset_at);

      // If the reset time has passed, allow and reset count
      if (now >= resetAt) {
        return { allowed: true, remaining: 3, resetAt: null };
      }

      // Check remaining requests
      const maxFreeScans = 3;
      const used = data.request_count || 0;
      const remaining = Math.max(0, maxFreeScans - used);

      return {
        allowed: remaining > 0,
        remaining: remaining,
        resetAt: data.reset_at,
      };
    } catch (err) {
      console.error('[shift07] Unexpected error checking rate limit:', err);
      // Fail open - allow the request
      return { allowed: true, remaining: 1, resetAt: null };
    }
  },

  /**
   * Update (increment) the rate limit counter for an anonymous user.
   * @param {string} ipHash - A hash of the user's IP address.
   * @returns {boolean} True if updated successfully.
   */
  async updateRateLimit(ipHash) {
    try {
      if (!supabase) {
        console.error('[shift07] Supabase not initialized');
        return false;
      }

      const now = new Date();
      const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Try to upsert the rate limit record
      const { data: existing } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('ip_hash', ipHash)
        .single();

      if (!existing || new Date(existing.reset_at) <= now) {
        // Create or reset the record
        const { error } = await supabase
          .from('rate_limits')
          .upsert({
            ip_hash: ipHash,
            request_count: 1,
            reset_at: resetAt.toISOString(),
            updated_at: now.toISOString(),
          }, { onConflict: 'ip_hash' });

        if (error) {
          console.error('[shift07] Error creating rate limit:', error.message);
          return false;
        }
      } else {
        // Increment the counter
        const { error } = await supabase
          .from('rate_limits')
          .update({
            request_count: (existing.request_count || 0) + 1,
            updated_at: now.toISOString(),
          })
          .eq('ip_hash', ipHash);

        if (error) {
          console.error('[shift07] Error updating rate limit:', error.message);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.error('[shift07] Unexpected error updating rate limit:', err);
      return false;
    }
  },
};

// Auto-initialize when the script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
  });
} else {
  initSupabase();
}
