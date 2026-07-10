import { toGeminiFunctions, HOST } from './_tools.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    function_declarations: toGeminiFunctions(),
    base_url: HOST + '/api/connector',
    auth: 'Authorization: Bearer YOUR_TOKEN'
  });
}
