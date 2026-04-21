const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-ChHyRe0Snv-Qz3zerG9C2ZcRq1oIfEtbfRcbym8Cvjmj-9vHwHXVRA745MipF8jZQQ/exec";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let response;

    if (req.method === "POST") {
      // POST usato solo per uploadFoto (payload base64 grande)
      const params = new URLSearchParams(req.query).toString();
      const url = params ? `${APPS_SCRIPT_URL}?${params}` : APPS_SCRIPT_URL;
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        redirect: "follow",
      });
    } else {
      // GET per tutte le altre operazioni
      const params = new URLSearchParams(req.query).toString();
      const url = params ? `${APPS_SCRIPT_URL}?${params}` : APPS_SCRIPT_URL;
      response = await fetch(url, { redirect: "follow" });
    }

    const text = await response.text();
    try {
      res.status(200).json(JSON.parse(text));
    } catch {
      res.status(200).send(text);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
