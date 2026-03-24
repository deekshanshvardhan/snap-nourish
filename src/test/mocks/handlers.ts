import { http, HttpResponse } from "msw";

const SUPABASE_URL = "https://placeholder.supabase.co";

export const handlers = [
  http.post(`${SUPABASE_URL}/functions/v1/analyze-photo`, () => {
    return HttpResponse.json({
      description: "Grilled chicken with rice",
      calories: 485,
      protein: 42,
      carbs: 48,
      fat: 12,
      confidence: 0.9,
      items: [{ name: "Grilled chicken with rice", quantity: 1 }],
    });
  }),

  http.post(`${SUPABASE_URL}/functions/v1/analyze-text`, () => {
    return HttpResponse.json({
      description: "2 eggs and toast",
      calories: 276,
      protein: 16,
      carbs: 24,
      fat: 12,
      confidence: 0.85,
      items: [
        { name: "eggs", quantity: 2 },
        { name: "toast", quantity: 1 },
      ],
    });
  }),

  http.post(`${SUPABASE_URL}/rest/v1/*`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/*`, () => {
    return HttpResponse.json([]);
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/*`, () => {
    return HttpResponse.json([]);
  }),
];
