import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(500).json({ error: 'SERVER_CONFIGURATION_ERROR' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from('notes')
      .select('id,title,content,created_at');

    if (error) {
      return response.status(502).json({ error: 'UPSTREAM_SERVICE_ERROR' });
    }

    return response.status(200).json(data);
  } catch (_error) {
    return response.status(502).json({ error: 'UPSTREAM_SERVICE_ERROR' });
  }
}
