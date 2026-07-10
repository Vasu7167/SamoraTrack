import { toOpenApiSpec, HOST } from './_tools.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(toOpenApiSpec(HOST));
}
