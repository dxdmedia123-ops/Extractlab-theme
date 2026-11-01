/* Extract Labs theme: bag drawer on the Shopify AJAX cart, menu, product page, small UI helpers. */
(function () {
  "use strict";
  const C = window.EL || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

  /* ---------- money ---------- */
  function money(cents) {
    const fmt = C.moneyFormat || "${{amount}}";
    const n = (cents || 0) / 100;
    const withDelims = (num, dec, th, ds) => {
      const p = num.toFixed(dec).split(".");
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, th);
      return p.join(ds);
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, k) => {
      switch (k) {
        case "amount_no_decimals": return withDelims(n, 0, ",", ".");
        case "amount_with_comma_separator": return withDelims(n, 2, ".", ",");
        case "amount_no_decimals_with_comma_separator": return withDelims(n, 0, ".", ",");
        case "amount_with_apostrophe_separator": return withDelims(n, 2, "'", ".");
        default: return withDelims(n, 2, ",", ".");
      }
    }).replace(/<[^>]*>/g, "");
  }

  /* ---------- cart ---------- */
  const root = (C.root || "/").replace(/\/?$/, "/");
  const api = path => fetch(root + path, { headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin" });
  async function getCart() { const r = await api("cart.js"); return r.json(); }
  async function post(path, body) {
    const r = await fetch(root + path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.description || j.message || "Something went wrong");
    return j;
  }

  /* ---------- bundle tiers ---------- */
  const TIERS = (C.tiers || [{ qty: 3, pct: 10 }, { qty: 6, pct: 15 }]).filter(t => t.qty > 0).sort((a, b) => a.qty - b.qty);
  const tierFor = n => TIERS.reduce((acc, t, i) => (n >= t.qty ? i + 1 : acc), 0); // 0 = none, 1 = first tier...
  const store = { get: k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} } };
  let shownTier = 0;

  function bundleState(n) {
    const t = tierFor(n), next = TIERS[t], cur = TIERS[t - 1];
    let msg;
    if (!cur) msg = `Add <b>${next.qty - n} more</b> to save <b>${next.pct}%</b> on your order.`;
    else if (next) msg = `<b class="unlocked">${cur.pct}% off unlocked</b> · add <b>${next.qty - n} more</b> for ${next.pct}% off.`;
    else msg = `<b class="unlocked">${cur.pct}% off unlocked</b> · your bundle discount is applied.`;
    const max = TIERS[TIERS.length - 1].qty;
    return { t, msg, width: Math.min(100, (n / max) * 100) };
  }

  function renderBag(cart) {
    $$("[data-bag-count]").forEach(e => (e.textContent = cart.item_count));
    const n = cart.item_count, b = bundleState(n);
    celebrate(b.t);
    const lines = $("#bag-lines"); if (!lines) return;
    const total = cart.total_price, original = cart.original_total_price || total, saved = original - total;
    const free = C.freeShip || 9900;
    const ship = $("#ship-msg"), bundle = $("#bundle-msg");
    if (ship) ship.innerHTML = total >= free ? "<b>Free delivery unlocked.</b>" : `Add <b>${money(free - total)}</b> for free delivery.`;
    const sb = $("#ship-bar"); if (sb) sb.style.width = Math.min(100, (total / free) * 100) + "%";
    if (bundle) { bundle.innerHTML = b.msg; bundle.classList.toggle("is-on", b.t > 0); }
    const bb = $("#bundle-bar"); if (bb) { bb.style.width = b.width + "%"; bb.parentElement.classList.toggle("is-on", b.t > 0); }
    const marks = $(".bar.tiers");
    if (marks && !marks.dataset.built) {
      const max = TIERS[TIERS.length - 1].qty;
      TIERS.forEach(t => { const m = document.createElement("span"); m.className = "mark"; m.style.left = (t.qty / max) * 100 + "%"; m.dataset.qty = t.qty; marks.appendChild(m); });
      marks.dataset.built = "1";
    }
    $$(".bar.tiers .mark").forEach(m => m.classList.toggle("hit", n >= Number(m.dataset.qty)));
    const sub = $("#bag-sub"); if (sub) sub.innerHTML = saved > 0 ? `<s>${money(original)}</s> ${money(total)}` : money(total);
    const sv = $("#bag-saved"); if (sv) { sv.hidden = !(saved > 0); const v = $("[data-saved]", sv); if (v) v.textContent = "−" + money(saved); const l = $("[data-saved-label]", sv); if (l && b.t) l.textContent = `Bundle ${TIERS[b.t - 1].pct}% off`; }
    $$("[data-express]").forEach(e => (e.hidden = !cart.items.length));
    lines.innerHTML = cart.items.length
      ? cart.items.map(it => {
          const img = it.image ? it.image.replace(/(\.[a-z]+)(\?|$)/i, "_160x$1$2") : "";
          const title = (it.product_title || it.title).split(" | ")[0];
          const variant = it.product_has_only_default_variant ? "" : `<small>${esc(it.variant_title || "")}</small>`;
          const orig = it.original_line_price, fin = it.final_line_price;
          const price = orig > fin ? `<s>${money(orig)}</s>${money(fin)}` : money(fin);
          return `<div class="line">${img ? `<img src="${esc(img)}" alt="">` : "<span></span>"}<div><h5><a href="${esc(it.url)}">${esc(title)}</a></h5>${variant}
            <div class="qty"><button type="button" aria-label="Remove one" data-q="${esc(it.key)}" data-n="${it.quantity - 1}">−</button><span>${it.quantity}</span><button type="button" aria-label="Add one" data-q="${esc(it.key)}" data-n="${it.quantity + 1}">+</button></div></div>
            <div class="price">${price}</div></div>`;
        }).join("")
      : `<div class="empty"><p>Your bag is empty.</p><a class="btn btn-holo" href="${esc(C.shopUrl || "/collections/all")}">Shop perfume oils <span class="arr">→</span></a></div>`;
  }

  /* ---------- unlock celebration ---------- */
  let primed = false; // the first cart read on each page sets the baseline without animating
  function celebrate(t) {
    if (!primed) { primed = true; shownTier = t; store.set("el_tier", t); return; }
    if (t <= shownTier) { shownTier = t; store.set("el_tier", t); return; }
    shownTier = t; store.set("el_tier", t);
    if (C.celebrate === false) return;
    const tier = TIERS[t - 1], next = TIERS[t];
    const old = $(".unlock"); if (old) old.remove();
    const el = document.createElement("div");
    el.className = "unlock"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let bits = "";
    if (!reduce) for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3, d = 110 + Math.random() * 120;
      bits += `<i style="--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;--r:${Math.random() * 540 - 270}deg;--d:${(Math.random() * 0.25).toFixed(2)}s;--c:${["#d4c6f8", "#a9d4f6", "#f5c7e5", "#f7e6b9", "#c3eedc"][i % 5]}"></i>`;
    }
    el.innerHTML = `<div class="unlock-card">
        <div class="burst" aria-hidden="true">${bits}</div>
        <div class="seal" aria-hidden="true"><small>Congratulations!</small><b>${tier.pct}%</b><span>Off</span></div>
        <p class="eyebrow">Bundle unlocked</p>
        <h3>You've saved <em>${tier.pct}%</em></h3>
        <p class="sub">${tier.qty}+ items in your bag, so ${tier.pct}% comes off automatically.${next ? ` Get to ${next.qty} items for ${next.pct}% off.` : ""}</p>
        <button type="button" class="btn btn-holo" data-unlock-close>Nice <span class="arr">→</span></button>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    const close = () => { el.classList.remove("on"); setTimeout(() => el.remove(), 350); };
    el.addEventListener("click", e => { if (e.target === el || e.target.closest("[data-unlock-close]")) close(); });
    setTimeout(close, 4200);
  }

  function openBag(on = true) {
    const d = $(".drawer"), s = $(".scrim"); if (!d) return;
    d.classList.toggle("on", on); s && s.classList.toggle("on", on);
    d.setAttribute("aria-hidden", on ? "false" : "true");
    if (on) { const x = $(".x", d); x && x.focus(); getCart().then(renderBag).catch(() => {}); }
  }

  let tt;
  function toast(m) { const t = $(".toast"); if (!t) return; t.textContent = m; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 2000); }

  async function addToCart(id, qty, title, btn, open) {
    try {
      if (btn) { btn.disabled = true; }
      await post("cart/add.js", { items: [{ id: Number(id), quantity: Number(qty) || 1 }] });
      const cart = await getCart();
      renderBag(cart);
      toast(`${title || "Item"} added to bag`);
      if (btn && btn.classList.contains("add")) { const t = btn.textContent; btn.classList.add("done"); btn.textContent = "Added ✓"; setTimeout(() => { btn.textContent = t; btn.classList.remove("done"); }, 1300); }
      if (open) openBag(true);
    } catch (e) {
      toast(e.message || "Couldn't add that to your bag");
    } finally { if (btn) btn.disabled = false; }
  }

  /* ---------- clicks ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-add]");
    if (a) { e.preventDefault(); addToCart(a.dataset.add, 1, a.dataset.title, a, false); return; }
    const q = e.target.closest("[data-q]");
    if (q) { post("cart/change.js", { id: q.dataset.q, quantity: Number(q.dataset.n) }).then(renderBag).catch(err => toast(err.message)); return; }
    if (e.target.closest("[data-open-bag]")) { e.preventDefault(); openBag(true); return; }
    if (e.target.closest("[data-close-bag]")) { openBag(false); return; }
    if (e.target.closest(".nav a")) { const n = $(".nav"); n && n.classList.remove("open"); document.body.classList.remove("menu-open"); const mb = $(".menu-btn"); mb && mb.setAttribute("aria-expanded", "false"); }
    const mb = e.target.closest(".menu-btn");
    if (mb) { const n = $(".nav"); const on = !n.classList.contains("open"); n.classList.toggle("open", on); document.body.classList.toggle("menu-open", on); if (on) window.scrollTo({ top: 0, behavior: "instant" }); mb.setAttribute("aria-expanded", on); return; }
    const cp = e.target.closest("[data-copy]");
    if (cp) {
      const v = cp.dataset.copy, done = () => { cp.textContent = "Copied"; setTimeout(() => (cp.textContent = "Copy"), 1500); };
      const fallback = () => { try { const r = document.createRange(); r.selectNodeContents(cp.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = "Press ⌘C / Ctrl+C"; } catch (_) {} };
      try { navigator.clipboard.writeText(v).then(done, fallback); } catch (_) { fallback(); }
      return;
    }
    const th = e.target.closest("[data-img]");
    if (th) {
      const m = $("#main-img");
      if (m) { m.src = th.dataset.img; m.removeAttribute("srcset"); m.setAttribute("srcset", th.dataset.srcset || ""); }
      $$(".thumbs button").forEach(b => b.setAttribute("aria-current", b === th));
      return;
    }
    const st = e.target.closest("[data-step]");
    if (st) { const i = $("#qty"); if (i) i.value = Math.max(1, Math.min(20, (Number(i.value) || 1) + Number(st.dataset.step))); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { openBag(false); const u = $(".unlock"); if (u) u.remove(); } });

  /* ---------- product form ---------- */
  const pf = $("[data-product-form]");
  if (pf) {
    pf.addEventListener("submit", e => {
      e.preventDefault();
      const id = pf.querySelector('[name="id"]').value, qty = pf.querySelector('[name="quantity"]').value;
      const title = ($("h1.display") || {}).textContent;
      addToCart(id, qty, title, pf.querySelector("[data-main-add]"), true);
    });
    const vs = pf.querySelector(".variant-select");
    if (vs) vs.addEventListener("change", () => {
      const o = vs.options[vs.selectedIndex], pr = $("[data-price]");
      if (pr && o.dataset.price) pr.innerHTML = o.dataset.price;
      const u = new URL(location.href); u.searchParams.set("variant", vs.value); history.replaceState(null, "", u);
      const mbAdd = $(".mbar [data-add]"); if (mbAdd) mbAdd.dataset.add = vs.value;
    });
    /* sticky add-to-bag bar on phones */
    const bar = $(".mbar"), main = pf.querySelector("[data-main-add]");
    if (bar && main && "IntersectionObserver" in window) {
      document.body.classList.add("has-mbar");
      new IntersectionObserver(es => { const off = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; bar.classList.toggle("on", off); }).observe(main);
    }
  }

  /* ---------- collection sort ---------- */
  const sort = $("[data-sort]");
  if (sort) sort.addEventListener("change", () => { const u = new URL(location.href); u.searchParams.set("sort_by", sort.value); u.searchParams.delete("page"); location.href = u.toString(); });

  /* ---------- initial bag state ---------- */
  getCart().then(renderBag).catch(() => {});
})();
