/**
 * Vercel Serverless Function — proxy verso Apps Script
 * Risolve il problema CORS: il browser chiama /api/proxy,
 * il server chiama Apps Script senza restrizioni CORS.
 */

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-ChHyRe0Snv-Qz3zerG9C2ZcRq1oIfEtbfRcbym8Cvjmj-9vHwHXVRA745MipF8jZQQ/exec";

export default async function handler(req, res) {
  // Header CORS per permettere chiamate da Vercel frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Costruisci URL con tutti i parametri della query
    const params = new URLSearchParams(req.query).toString();
    const url = params ? `${APPS_SCRIPT_URL}?${params}` : APPS_SCRIPT_URL;

    const response = await fetch(url, {
      redirect: "follow",
    });

    const text = await response.text();

    // Prova a parsare come JSON
    try {
      const json = JSON.parse(text);
      res.status(200).json(json);
    } catch {
      res.status(200).send(text);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
