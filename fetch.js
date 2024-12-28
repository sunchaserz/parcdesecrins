var $fetch = (function (y) {
  "use strict";
  var w = ((e) => ((e.None = "none"), (e.Outseta = "outseta"), (e.MemberstackV1 = "memberstack_v1"), (e.MemberstackV2 = "memberstack_v2"), e))(
    w || {}
  );
  const d = (e, o) => {
    e = v(e);
    const r = document.getElementById(e);
    r && (r.style.display = o);
  };
  function M(e) {
    const o = {};
    e.headers || (e.headers = []), ["GET", "HEAD"].includes(e.method.toUpperCase()) ? delete e.body : e.body || (e.body = []);
    for (const [r, n] of Object.entries(e))
      n !== null &&
        (r === "headers"
          ? (o[r] = n.reduce((t, i) => ((t[i.key] = i.value), t), {}))
          : r === "body"
          ? (o[r] = n.reduce((t, i) => ((t[i.key] = i.value), t), {}))
          : (o[r] = n));
    return (
      (o.mode = o.mode || "cors"),
      (o.cache = o.cache || "default"),
      (o.credentials = o.credentials || "same-origin"),
      (o.redirect = o.redirect || "follow"),
      (o.referrerPolicy = o.referrerPolicy || "no-referrer-when-downgrade"),
      o
    );
  }
  const F = (e) => {
    let o = null;
    return (
      e === w.Outseta
        ? (o = window == null ? void 0 : window.Outseta.getAccessToken())
        : e === w.MemberstackV1
        ? (o = window == null ? void 0 : window.MemberStack.getToken())
        : e === w.MemberstackV2 && (o = window == null ? void 0 : window.$memberstackDom.getMemberCookie()),
      `Bearer ${o}`
    );
  };
  function v(e) {
    return e && e.charAt(0) === "#" ? e.substring(1) : e;
  }
  const T = new Map(),
    S = (e) => {
      e = v(e);
      const o = document.getElementById(e);
      o && !T.has(o) && T.set(o, o.style.display);
    },
    b = (e) => {
      e = v(e);
      const o = document.getElementById(e);
      return T.get(o);
    },
    A = (e) => {
      let o = b(e);
      return (!o || o === "none") && (o = "block"), o;
    },
    k = async (e, o) => {
      var O, $, x, N;
      const { options: r, integrations: n, events: t } = e,
        i = (c) => {
          if (!c) throw new Error("Network request failed");
          return c.ok
            ? Promise.resolve(c)
            : h(c).then(([a, f]) => {
                const u = new Error(`API error: ${a.status} ${a.statusText}`);
                throw ((u.response = a), (u.data = f), u);
              });
        },
        h = (c) => {
          const a = c.headers.get("Content-Type"),
            f = a && a.includes("application/json") ? c.json() : c.text();
          return Promise.all([c, f]);
        },
        E = async ([c, a]) => {
          var f, u, g, p;
          if (t) {
            if ((f = t.onSuccess) != null && f.callback && typeof t.onSuccess.callback == "function")
              try {
                await t.onSuccess.callback(c, a, o);
              } catch (U) {
                console.error(U);
              }
            (u = t.onSuccess) != null && u.redirectUrl && (window.location.href = t.onSuccess.redirectUrl),
              (g = t.onSuccess) != null && g.showElement && d(t.onSuccess.showElement, A(t.onSuccess.showElement)),
              (p = t.onSuccess) != null && p.hideElement && d(t.onSuccess.hideElement, "none");
          }
          return { response: c, data: a };
        },
        m = async (c) => {
          var a, f, u, g;
          if (t) {
            if ((a = t.onError) != null && a.callback && typeof t.onError.callback == "function")
              try {
                await t.onError.callback(c.response, c.data, o);
              } catch (p) {
                console.error(p);
              }
            (f = t.onError) != null && f.redirectUrl && (window.location.href = t.onError.redirectUrl),
              (u = t.onError) != null && u.showElement && d(t.onError.showElement, A(t.onError.showElement)),
              (g = t.onError) != null && g.hideElement && d(t.onError.hideElement, "none");
          }
        };
      let s = M(r);
      if (
        t &&
        ((O = t.onError) != null && O.showElement && d(t.onError.showElement, b(t.onError.showElement) || "none"),
        ($ = t.onSuccess) != null && $.showElement && d(t.onSuccess.showElement, b(t.onSuccess.showElement) || "none"),
        (x = t.onError) != null && x.hideElement && d(t.onError.hideElement, b(t.onError.hideElement) || "none"),
        (N = t.onSuccess) != null && N.hideElement && d(t.onSuccess.hideElement, b(t.onSuccess.hideElement) || "none"),
        t != null && t.onRequestInit && typeof t.onRequestInit.callback == "function")
      )
        try {
          if (((s = await t.onRequestInit.callback(s, o)), !s)) {
            console.error("Request options invalid");
            return;
          }
        } catch (c) {
          console.error(c);
        }
      s != null && s.body && (s.body = JSON.stringify(s.body)), n && n.authentication && (s.headers.Authorization = F(n.authentication));
      const R = s.url;
      delete s.url, fetch(R, s).then(i).then(h).then(E).catch(m);
    },
    l = {},
    q = (e, o) => {
      var i, h, E, m;
      l[e] = o;
      const r = `body[x-fetch="${e}"],form[x-fetch="${e}"], button[x-fetch="${e}"], a[x-fetch="${e}"]`;
      document.querySelectorAll(r).forEach((s) => D(s));
      const { events: t } = o;
      t &&
        ((i = t.onSuccess) != null && i.showElement && S(t.onSuccess.showElement),
        (h = t.onSuccess) != null && h.hideElement && S(t.onSuccess.hideElement),
        (E = t.onError) != null && E.showElement && S(t.onError.showElement),
        (m = t.onError) != null && m.hideElement && S(t.onError.hideElement));
    },
    P = (e) => {
      e in l && k(l[e]);
    };
  function D(e) {
    const o = e.tagName.toLowerCase();
    if (!["body", "button", "a", "form"].includes(o)) {
      console.error(`Trigger Error: Tag '<${o}>' not supported please use <button>, <a> or <form>.`);
      return;
    }
    if (!e.getAttribute("x-fetch")) {
      console.error("Trigger Error: Attribute 'x-fetch' required.");
      return;
    }
    ["body"].includes(o)
      ? B(e)
      : ["button", "a"].includes(o)
      ? e.addEventListener("click", function (n) {
          C(n, e);
        })
      : o === "form" &&
        e.addEventListener("submit", function (n) {
          I(n, e);
        });
  }
  function B(e) {
    const o = e.getAttribute("x-fetch");
    if (o && o in l) {
      const r = l[o];
      r.options ? k(r, e) : console.error("Fetch options undefined!");
    }
  }
  function C(e, o) {
    e.preventDefault();
    const r = o.getAttribute("x-fetch");
    if (r && r in l) {
      const n = l[r];
      n.options ? k(n, o) : console.error("Fetch options undefined!");
    }
  }
  function I(e, o) {
    e.preventDefault(), e.stopPropagation();
    const r = o.getAttribute("x-fetch");
    if (r && r in l) {
      const n = l[r];
      new FormData(o).forEach((i, h) => {
        if ((n.options.hasOwnProperty("body") || (n.options.body = []), n.options.body)) {
          const E = n.options.body.findIndex((m) => m.key === h);
          E >= 0 ? (n.options.body[E].value = i) : n.options.body.push({ key: h, value: i });
        }
      }),
        n.options ? k(n, o) : console.error("Fetch options undefined!");
    }
  }
  return (
    console.log("SO-Fetch v0.0.1"),
    (y.createAction = q),
    (y.registerTrigger = D),
    (y.triggerAction = P),
    Object.defineProperty(y, Symbol.toStringTag, { value: "Module" }),
    y
  );
})({});
