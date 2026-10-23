/** API Gateway base URL; override in dev with VITE_API_BASE_URL (see README). */
export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  "https://vojed2b2fk.execute-api.us-west-1.amazonaws.com/dev/";
