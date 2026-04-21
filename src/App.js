import { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ───────────────────────────────────────────────
const API_URL = "/api/proxy";

// Cartella Google Drive dove caricare le foto (cambia con il tuo folder ID)
const PIATTAFORME = ["Instagram", "Facebook", "Entrambi", "TikTok (manuale)"];
const TEMI = ["Trail / Outdoor", "Struttura e servizi", "Evento locale", "Stagionale", "Offerta speciale", "TerraVivae", "Behind the scenes"];
const LUNGHEZZE = ["Breve (2-3 righe)", "Medio (4-6 righe)", "Lungo (7-10 righe)"];
const STATI = ["Da fare", "Bozza", "Pronto", "Approvato", "Pubblicato", "Errore"];

const STATO_COLORS = {
  "Da fare":    { bg: "#f1f3f5", color: "#6c757d" },
  "Bozza":      { bg: "#fff3cd", color: "#856404" },
  "Pronto":     { bg: "#d1ecf1", color: "#0c5460" },
  "Approvato":  { bg: "#d4edda", color: "#155724" },
  "Pubblicato": { bg: "#cce5ff", color: "#004085" },
  "Errore":     { bg: "#f8d7da", color: "#721c24" },
};

const PIATTAFORMA_ICONS = {
  "Instagram": "IG",
  "Facebook": "FB",
  "Entrambi": "IG+FB",
  "TikTok (manuale)": "TK",
};

// ─── API CALLS ────────────────────────────────────────────
async function apiCall(params) {
  const qs = Object.entries(params)
    .map(([k, v]) => k + "=" + encodeURIComponent(typeof v === "object" ? JSON.stringify(v) : v))
    .join("&");
  const res = await fetch(API_URL + "?" + qs);
  return res.json();
}

async function apiGet(action) {
  return apiCall({ action });
}

// ─── UPLOAD FOTO SU DRIVE tramite Apps Script ─────────────
async function uploadFotoDrive(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(",")[1];
        const data = await apiCall({
          action: "uploadFoto",
          data: { fileName: file.name, mimeType: file.type, base64Data: base64 },
        });
        if (data.url) resolve(data.url);
        else reject(new Error(data.error || "Upload fallito"));
      } catch (err) { reject(err); }
    };
    reader.readAsDataURL(file);
  });
}

// ─── EMPTY POST ───────────────────────────────────────────
const emptyPost = (data = "") => ({
  data, ora: "09:00", piattaforma: "Instagram",
  tema: "Trail / Outdoor", contesto: "", foto: "",
  hashtag: "", lunghezza: "Medio (4-6 righe)",
  stato: "Da fare", note: "", testoManuale: "",
});

// ─── MAIN APP ─────────────────────────────────────────────
export default function App() {
  const [posts, setPosts] = useState([]);
  const [view, setView] = useState("calendario");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(emptyPost());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStato, setFilterStato] = useState("tutti");

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("getPosts");
      setPosts(data.posts || []);
    } catch (e) {
      showToast("Errore nel caricamento", "err");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleSave = async () => {
    if (!form.data) return showToast("Inserisci la data", "err");
    if (!form.contesto) return showToast("Inserisci il contesto", "err");
    setSaving(true);
    try {
      if (selected) {
        await apiCall({ action: "updatePost", row: selected.row, data: form });
        showToast("Post aggiornato ✓");
      } else {
        await apiCall({ action: "addPost", data: form });
        showToast("Post aggiunto ✓");
      }
      await loadPosts();
      setView("lista");
      setSelected(null);
      setForm(emptyPost());
    } catch (e) {
      showToast("Errore nel salvataggio", "err");
    }
    setSaving(false);
  };

  const handleDelete = async (post) => {
    if (!window.confirm("Eliminare questo post?")) return;
    try {
      await apiCall({ action: "deletePost", row: post.row });
      showToast("Post eliminato");
      await loadPosts();
      setView("lista");
      setSelected(null);
    } catch (e) {
      showToast("Errore nell'eliminazione", "err");
    }
  };

  const handleEdit = (post) => {
    setSelected(post);
    setForm({
      data: post.data ? post.data.split("/").reverse().join("-") : "",
      ora: post.ora || "09:00",
      piattaforma: post.piattaforma || "Instagram",
      tema: post.tema || "Trail / Outdoor",
      contesto: post.contesto || "",
      foto: post.foto || "",
      hashtag: post.hashtag || "",
      lunghezza: post.lunghezza || "Medio (4-6 righe)",
      stato: post.stato || "Da fare",
      note: post.note || "",
      testoManuale: post.testoManuale || "",
    });
    setView("nuovo");
  };

  // 1) Click su giorno del calendario → apre form con data preimpostata
  const handleDayClick = (dateStr) => {
    setSelected(null);
    setForm(emptyPost(dateStr));
    setView("nuovo");
  };

  const handleNewPost = () => {
    setSelected(null);
    setForm(emptyPost());
    setView("nuovo");
  };

  const filteredPosts = posts.filter(p =>
    filterStato === "tutti" ? true : p.stato === filterStato
  );

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoMark}>A</div>
          <div>
            <div style={styles.logoName}>ASC Hotel</div>
            <div style={styles.logoSub}>Piano Editoriale</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {[
            { id: "calendario", label: "Calendario", icon: "▦" },
            { id: "lista", label: "Tutti i post", icon: "≡" },
          ].map(item => (
            <button
              key={item.id}
              style={{ ...styles.navBtn, ...(view === item.id ? styles.navBtnActive : {}) }}
              onClick={() => setView(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarBottom}>
          <button style={styles.newBtn} onClick={handleNewPost}>+ Nuovo post</button>
          <div style={styles.stats}>
            <div style={styles.statRow}><span>Totale</span><strong>{posts.length}</strong></div>
            <div style={styles.statRow}>
              <span>Pronti</span>
              <strong style={{ color: "#0c5460" }}>
                {posts.filter(p => p.stato === "Pronto" || p.stato === "Approvato").length}
              </strong>
            </div>
            <div style={styles.statRow}>
              <span>Pubblicati</span>
              <strong style={{ color: "#004085" }}>
                {posts.filter(p => p.stato === "Pubblicato").length}
              </strong>
            </div>
          </div>
        </div>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerTitle}>
            {view === "calendario" && "Calendario"}
            {view === "lista" && "Tutti i post"}
            {view === "nuovo" && (selected ? "Modifica post" : "Nuovo post")}
          </div>
          <div style={styles.headerActions}>
            {view !== "nuovo" && (
              <button style={styles.refreshBtn} onClick={loadPosts}>↻ Aggiorna</button>
            )}
            {view === "nuovo" && (
              <button style={styles.cancelBtn} onClick={() => { setView("lista"); setSelected(null); }}>
                Annulla
              </button>
            )}
          </div>
        </header>

        <div style={styles.content}>
          {loading && <div style={styles.loadingMsg}>Caricamento in corso…</div>}

          {!loading && view === "lista" && (
            <ListaView
              posts={filteredPosts}
              filterStato={filterStato}
              setFilterStato={setFilterStato}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}

          {!loading && view === "calendario" && (
            <CalendarioView
              posts={posts}
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              onEdit={handleEdit}
              onDayClick={handleDayClick}
            />
          )}

          {view === "nuovo" && (
            <FormView
              form={form}
              setForm={setForm}
              onSave={handleSave}
              saving={saving}
              isEdit={!!selected}
              post={selected}
              onDelete={handleDelete}
              showToast={showToast}
            />
          )}
        </div>
      </main>

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "err" ? "#721c24" : "#155724" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── LISTA VIEW ───────────────────────────────────────────
function ListaView({ posts, filterStato, setFilterStato, onEdit, onDelete }) {
  return (
    <div>
      <div style={styles.filterRow}>
        {["tutti", ...STATI].map(s => (
          <button
            key={s}
            onClick={() => setFilterStato(s)}
            style={{
              ...styles.filterBtn,
              ...(filterStato === s ? styles.filterBtnActive : {}),
              ...(s !== "tutti" ? { background: STATO_COLORS[s]?.bg, color: STATO_COLORS[s]?.color } : {}),
            }}
          >
            {s === "tutti" ? "Tutti" : s}
          </button>
        ))}
      </div>
      {posts.length === 0 && (
        <div style={styles.emptyMsg}>Nessun post. Clicca "+ Nuovo post" per iniziare.</div>
      )}
      <div style={styles.cardGrid}>
        {posts.map(post => (
          <PostCard key={post.row} post={post} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

// ─── POST CARD ────────────────────────────────────────────
function PostCard({ post, onEdit, onDelete }) {
  const sc = STATO_COLORS[post.stato] || STATO_COLORS["Da fare"];
  // 3) Fallback: se non c'è testo Claude, usa quello manuale
  const testoEffettivo = post.postGenerato || post.testoManuale;
  return (
    <div style={styles.card} onClick={() => onEdit(post)}>
      <div style={styles.cardHeader}>
        <div style={styles.cardMeta}>
          <span style={styles.cardDate}>{post.data} {post.ora && `· ${post.ora}`}</span>
          <span style={{ ...styles.statoBadge, background: sc.bg, color: sc.color }}>{post.stato}</span>
        </div>
        <div style={styles.cardPiattaforma}>{PIATTAFORMA_ICONS[post.piattaforma] || post.piattaforma}</div>
      </div>
      <div style={styles.cardTema}>{post.tema}</div>
      <div style={styles.cardContesto}>
        {post.contesto?.slice(0, 120)}{post.contesto?.length > 120 ? "…" : ""}
      </div>
      {post.foto && <div style={styles.cardFoto}>📎 Foto allegata</div>}
      <div style={styles.cardFooter}>
        {testoEffettivo ? (
          <span style={styles.cardGenerated}>
            {post.postGenerato ? "✓ Testo Claude" : "✎ Testo manuale"}
          </span>
        ) : (
          <span style={styles.cardPending}>○ Da generare</span>
        )}
        <button style={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(post); }}>✕</button>
      </div>
    </div>
  );
}

// ─── CALENDARIO VIEW ──────────────────────────────────────
function CalendarioView({ posts, currentMonth, setCurrentMonth, onEdit, onDayClick }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const monthNames = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
    "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

  const getPostsForDay = (day) => {
    const dateStr = `${String(day).padStart(2,"0")}/${String(month+1).padStart(2,"0")}/${year}`;
    return posts.filter(p => p.data === dateStr);
  };

  // Converte giorno in formato YYYY-MM-DD per il campo date del form
  const toInputDate = (day) => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={styles.calNav}>
        <button style={styles.calNavBtn} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>‹</button>
        <span style={styles.calTitle}>{monthNames[month]} {year}</span>
        <button style={styles.calNavBtn} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div style={styles.calGrid}>
        {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(d => (
          <div key={d} style={styles.calDayHeader}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} style={styles.calCellEmpty} />;
          const dayPosts = getPostsForDay(day);
          const isToday = new Date().getDate() === day &&
            new Date().getMonth() === month && new Date().getFullYear() === year;
          return (
            <div
              key={day}
              style={{ ...styles.calCell, ...(isToday ? styles.calCellToday : {}), cursor: "pointer" }}
              onClick={() => {
                // Se ci sono post esistenti apri il primo, altrimenti nuovo post con data
                if (dayPosts.length > 0) onEdit(dayPosts[0]);
                else onDayClick(toInputDate(day));
              }}
            >
              <div style={styles.calDayNum}>{day}</div>
              {dayPosts.map(p => {
                const sc = STATO_COLORS[p.stato] || {};
                return (
                  <div
                    key={p.row}
                    style={{ ...styles.calPost, background: sc.bg, color: sc.color }}
                    onClick={e => { e.stopPropagation(); onEdit(p); }}
                    title={p.contesto}
                  >
                    {PIATTAFORMA_ICONS[p.piattaforma]} · {p.tema?.split(" ")[0]}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FORM VIEW ────────────────────────────────────────────
function FormView({ form, setForm, onSave, saving, isEdit, post, onDelete, showToast }) {
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  // 2) Upload foto → Drive
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    showToast("Caricamento foto in corso…");
    try {
      const url = await uploadFotoDrive(file);
      setForm(f => ({ ...f, foto: url }));
      showToast("Foto caricata su Drive ✓");
    } catch (err) {
      showToast("Errore caricamento foto: " + err.message, "err");
    }
    setUploading(false);
  };

  // 3) Testo effettivo che verrà usato (Claude > manuale)
  const testoEffettivo = post?.postGenerato || form.testoManuale;

  return (
    <div style={styles.formWrap}>
      <div style={styles.formGrid}>

        {/* Colonna sinistra */}
        <div style={styles.formCol}>
          <Field label="Data pubblicazione *">
            <input type="date" style={styles.input} value={form.data} onChange={set("data")} />
          </Field>
          <Field label="Ora">
            <input type="time" style={styles.input} value={form.ora} onChange={set("ora")} />
          </Field>
          <Field label="Piattaforma">
            <select style={styles.input} value={form.piattaforma} onChange={set("piattaforma")}>
              {PIATTAFORME.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Tema">
            <select style={styles.input} value={form.tema} onChange={set("tema")}>
              {TEMI.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Lunghezza post">
            <select style={styles.input} value={form.lunghezza} onChange={set("lunghezza")}>
              {LUNGHEZZE.map(l => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Stato">
            <select
              style={{ ...styles.input, background: STATO_COLORS[form.stato]?.bg, color: STATO_COLORS[form.stato]?.color, fontWeight: 500 }}
              value={form.stato}
              onChange={set("stato")}
            >
              {STATI.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {/* Colonna destra */}
        <div style={styles.formCol}>
          <Field label="Contesto per Claude *">
            <textarea
              style={{ ...styles.input, minHeight: 100, resize: "vertical" }}
              value={form.contesto}
              onChange={set("contesto")}
              placeholder="Descrivi cosa vuoi comunicare, l'evento, il tono, i dettagli specifici…"
            />
          </Field>

          {/* 3) Testo manuale */}
          <Field label="Testo manuale (consultazione interna)">
            <textarea
              style={{ ...styles.input, minHeight: 90, resize: "vertical", fontFamily: "'DM Mono', monospace", fontSize: 12 }}
              value={form.testoManuale}
              onChange={set("testoManuale")}
              placeholder="Scrivi qui una bozza manuale. Verrà usata se Claude non ha ancora generato il testo."
            />
          </Field>

          {/* 2) Upload foto */}
          <Field label="Foto">
            <div style={styles.uploadArea}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                style={styles.uploadBtn}
                onClick={() => fileRef.current.click()}
                disabled={uploading}
              >
                {uploading ? "Caricamento…" : "📎 Allega foto / video"}
              </button>
              {form.foto && (
                <div style={styles.fotoPreview}>
                  <a href={form.foto} target="_blank" rel="noreferrer" style={styles.fotoLink}>
                    ✓ Foto su Drive →
                  </a>
                  <button
                    style={styles.removeFotoBtn}
                    onClick={() => setForm(f => ({ ...f, foto: "" }))}
                  >✕</button>
                </div>
              )}
              {!form.foto && (
                <input
                  style={{ ...styles.input, marginTop: 6, fontSize: 11 }}
                  value={form.foto}
                  onChange={set("foto")}
                  placeholder="…oppure incolla URL Drive manualmente"
                />
              )}
            </div>
          </Field>

          <Field label="Hashtag extra">
            <input
              style={styles.input}
              value={form.hashtag}
              onChange={set("hashtag")}
              placeholder="#TrailRunning #Pratomagno …"
            />
          </Field>

          <Field label="Note interne">
            <textarea
              style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
              value={form.note}
              onChange={set("note")}
              placeholder="Note per il team, feedback, modifiche richieste…"
            />
          </Field>

          {/* Testo Claude (read-only) con fallback visivo */}
          {post?.postGenerato ? (
            <Field label="Testo generato da Claude">
              <div style={styles.generatedBox}>{post.postGenerato}</div>
            </Field>
          ) : form.testoManuale ? (
            <Field label="Testo che verrà usato (manuale)">
              <div style={{ ...styles.generatedBox, borderColor: "#fff3cd", background: "#fffbef" }}>
                {form.testoManuale}
              </div>
            </Field>
          ) : null}
        </div>
      </div>

      <div style={styles.formActions}>
        <button style={styles.saveBtn} onClick={onSave} disabled={saving}>
          {saving ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Aggiungi al piano"}
        </button>
        {isEdit && (
          <button style={styles.dangerBtn} onClick={() => onDelete(post)}>
            Elimina post
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────
const styles = {
  root: { display: "flex", height: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#f8f7f4", color: "#1a1a2e", overflow: "hidden" },
  sidebar: { width: 220, background: "#1a1a2e", display: "flex", flexDirection: "column", padding: "24px 16px", flexShrink: 0 },
  logo: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32 },
  logoMark: { width: 36, height: 36, borderRadius: 8, background: "#c9a84c", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 20, color: "#1a1a2e" },
  logoName: { fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#fff" },
  logoSub: { fontSize: 10, color: "#8888aa", letterSpacing: "0.05em" },
  nav: { display: "flex", flexDirection: "column", gap: 4 },
  navBtn: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "none", background: "transparent", color: "#8888aa", fontSize: 13, cursor: "pointer", textAlign: "left" },
  navBtnActive: { background: "rgba(201,168,76,0.15)", color: "#c9a84c" },
  navIcon: { fontSize: 14, width: 18 },
  sidebarBottom: { marginTop: "auto" },
  newBtn: { width: "100%", padding: "10px", borderRadius: 8, border: "none", background: "#c9a84c", color: "#1a1a2e", fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 16 },
  stats: { borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 },
  statRow: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8888aa" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", borderBottom: "1px solid #e9e6df", background: "#fff" },
  headerTitle: { fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600 },
  headerActions: { display: "flex", gap: 8 },
  refreshBtn: { padding: "6px 14px", borderRadius: 7, border: "1px solid #e9e6df", background: "#fff", fontSize: 12, cursor: "pointer", color: "#666" },
  cancelBtn: { padding: "6px 14px", borderRadius: 7, border: "1px solid #e9e6df", background: "#fff", fontSize: 12, cursor: "pointer", color: "#666" },
  content: { flex: 1, overflow: "auto", padding: 24 },
  loadingMsg: { textAlign: "center", padding: 60, color: "#999", fontSize: 14 },
  emptyMsg: { textAlign: "center", padding: 60, color: "#999", fontSize: 14 },
  filterRow: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 },
  filterBtn: { padding: "4px 12px", borderRadius: 20, border: "1px solid #e9e6df", background: "#f8f7f4", fontSize: 12, cursor: "pointer", color: "#666" },
  filterBtnActive: { border: "1px solid #1a1a2e", fontWeight: 600, color: "#1a1a2e", background: "#fff" },
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: { background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e9e6df", cursor: "pointer" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardMeta: { display: "flex", flexDirection: "column", gap: 4 },
  cardDate: { fontSize: 11, color: "#999", fontFamily: "'DM Mono', monospace" },
  statoBadge: { display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 500 },
  cardPiattaforma: { fontSize: 10, fontWeight: 700, color: "#1a1a2e", background: "#f0ede6", padding: "3px 8px", borderRadius: 6, fontFamily: "'DM Mono', monospace" },
  cardTema: { fontSize: 12, fontWeight: 500, color: "#c9a84c", marginBottom: 6 },
  cardContesto: { fontSize: 12, color: "#555", lineHeight: 1.5, marginBottom: 8 },
  cardFoto: { fontSize: 11, color: "#999", marginBottom: 8 },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1px solid #f0ede6" },
  cardGenerated: { fontSize: 11, color: "#155724" },
  cardPending: { fontSize: 11, color: "#999" },
  deleteBtn: { border: "none", background: "none", cursor: "pointer", color: "#ccc", fontSize: 13, padding: "2px 6px", borderRadius: 4 },
  calNav: { display: "flex", alignItems: "center", gap: 16, marginBottom: 16 },
  calNavBtn: { border: "1px solid #e9e6df", background: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 },
  calTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600 },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "#e9e6df", border: "1px solid #e9e6df", borderRadius: 12, overflow: "hidden" },
  calDayHeader: { background: "#1a1a2e", color: "#8888aa", fontSize: 10, fontWeight: 600, textAlign: "center", padding: "8px 0", letterSpacing: "0.05em" },
  calCell: { background: "#fff", minHeight: 80, padding: 6 },
  calCellEmpty: { background: "#f8f7f4", minHeight: 80 },
  calCellToday: { background: "#fffbef" },
  calDayNum: { fontSize: 11, fontWeight: 600, color: "#1a1a2e", marginBottom: 4 },
  calPost: { fontSize: 9, padding: "2px 5px", borderRadius: 4, marginBottom: 2, cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontWeight: 500 },
  formWrap: { maxWidth: 900, margin: "0 auto" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 },
  formCol: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: "#666", letterSpacing: "0.05em", textTransform: "uppercase" },
  input: { padding: "9px 12px", borderRadius: 8, border: "1px solid #e9e6df", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", background: "#fff", color: "#1a1a2e", width: "100%", boxSizing: "border-box" },
  uploadArea: { display: "flex", flexDirection: "column", gap: 6 },
  uploadBtn: { padding: "9px 14px", borderRadius: 8, border: "1px dashed #c9a84c", background: "#fffbef", color: "#856404", fontSize: 13, cursor: "pointer", textAlign: "left" },
  fotoPreview: { display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#d4edda", borderRadius: 8 },
  fotoLink: { fontSize: 12, color: "#155724", textDecoration: "none", flex: 1 },
  removeFotoBtn: { border: "none", background: "none", cursor: "pointer", color: "#721c24", fontSize: 13 },
  generatedBox: { background: "#f8f7f4", border: "1px solid #e9e6df", borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Mono', monospace", whiteSpace: "pre-wrap", color: "#333" },
  formActions: { display: "flex", gap: 12, paddingTop: 8, borderTop: "1px solid #e9e6df" },
  saveBtn: { padding: "11px 28px", borderRadius: 8, border: "none", background: "#1a1a2e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  dangerBtn: { padding: "11px 20px", borderRadius: 8, border: "1px solid #f8d7da", background: "#fff", color: "#721c24", fontSize: 13, cursor: "pointer" },
  toast: { position: "fixed", bottom: 24, right: 24, padding: "12px 20px", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 500, zIndex: 9999 },
};
