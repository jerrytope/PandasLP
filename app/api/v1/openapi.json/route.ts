import { BRAND_API_SPEC } from '@/lib/brandApiSpec'

// GET /api/v1/openapi.json: the brand API's OpenAPI description, for the brand's developers
// (import it into Postman, Swagger UI or a code generator). Public: it holds no secrets.
export function GET() {
  return Response.json(BRAND_API_SPEC, { headers: { 'cache-control': 'public, max-age=3600' } })
}
