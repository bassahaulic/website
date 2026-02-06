/**
 * Bassahaulic Productions - Cloud Functions
 *
 * Deploy to Google Cloud Functions (2nd gen) or Cloud Run.
 * Each export becomes an HTTP endpoint.
 *
 * Local development:
 *   npx @google-cloud/functions-framework --target=hello
 *
 * Deployment:
 *   gcloud functions deploy hello \
 *     --gen2 \
 *     --runtime=nodejs18 \
 *     --trigger-http \
 *     --allow-unauthenticated
 */

const functions = require('@google-cloud/functions-framework');

// Example function — replace with your actual endpoints
functions.http('hello', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  res.json({ message: 'Bassahaulic Productions API is running.' });
});
