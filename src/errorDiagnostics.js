// Categorizes an error from Supabase (Postgres/PostgREST/Auth/Realtime)
// or a network failure into a small set of actionable categories, so
// every catch block in the app can show something more useful than a
// raw driver error string, and so the same triage logic isn't
// reimplemented slightly differently in every component (spec §6).
//
// Usage:
//   const { error } = await supabase.from('logbooks').insert(...);
//   if (error) {
//     const diagnosis = diagnoseError(error);
//     setError(diagnosis.userMessage);
//     if (diagnosis.category === 'auth') { /* maybe redirect to login */ }
//   }

export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  AUTH: 'auth',
  PERMISSION: 'permission', // RLS denial
  RATE_LIMIT: 'rate_limit',
  VALIDATION: 'validation', // constraint violation, bad input
  NOT_FOUND: 'not_found',
  UNKNOWN: 'unknown',
};

// Postgres error codes worth naming explicitly.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_CODE_MAP = {
  '42501': ERROR_CATEGORIES.PERMISSION, // insufficient_privilege (RLS denial surfaces here)
  '23505': ERROR_CATEGORIES.VALIDATION, // unique_violation
  '23503': ERROR_CATEGORIES.VALIDATION, // foreign_key_violation
  '23502': ERROR_CATEGORIES.VALIDATION, // not_null_violation
  '23514': ERROR_CATEGORIES.VALIDATION, // check_violation
  PGRST116: ERROR_CATEGORIES.NOT_FOUND, // PostgREST "no rows"
};

export function diagnoseError(error) {
  if (!error) {
    return { category: ERROR_CATEGORIES.UNKNOWN, userMessage: 'Unknown error.', raw: error };
  }

  // Network-level failure (fetch threw before a response came back).
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return {
      category: ERROR_CATEGORIES.NETWORK,
      userMessage: 'Connection problem — check your internet and try again.',
      raw: error,
    };
  }

  const code = error.code;
  const status = error.status;
  const message = error.message || '';

  if (code && PG_CODE_MAP[code]) {
    const category = PG_CODE_MAP[code];
    return { category, userMessage: messageFor(category, message), raw: error };
  }

  if (status === 401 || /jwt|token expired|not authenticated/i.test(message)) {
    return {
      category: ERROR_CATEGORIES.AUTH,
      userMessage: 'Your session expired — please log in again.',
      raw: error,
    };
  }

  if (status === 403 || /row-level security|permission denied/i.test(message)) {
    return {
      category: ERROR_CATEGORIES.PERMISSION,
      userMessage: "You don't have permission to do that.",
      raw: error,
    };
  }

  if (status === 429 || /rate limit|too many requests/i.test(message)) {
    return {
      category: ERROR_CATEGORIES.RATE_LIMIT,
      userMessage: 'Too many requests — please wait a moment and try again.',
      raw: error,
    };
  }

  return {
    category: ERROR_CATEGORIES.UNKNOWN,
    userMessage: message || 'Something went wrong.',
    raw: error,
  };
}

function messageFor(category, rawMessage) {
  switch (category) {
    case ERROR_CATEGORIES.PERMISSION:
      return "You don't have permission to do that.";
    case ERROR_CATEGORIES.VALIDATION:
      return 'That value conflicts with an existing record or is missing required data.';
    case ERROR_CATEGORIES.NOT_FOUND:
      return 'Not found.';
    default:
      return rawMessage;
  }
}
