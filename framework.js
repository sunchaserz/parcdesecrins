var $app = (function (f) {
  var y, K;
  ("use strict");
  var it = Object.defineProperty;
  var st = (f, s, u) => (s in f ? it(f, s, { enumerable: !0, configurable: !0, writable: !0, value: u }) : (f[s] = u));
  var A = (f, s, u) => (st(f, typeof s != "symbol" ? s + "" : s, u), u),
    ot = (f, s, u) => {
      if (!s.has(f)) throw TypeError("Cannot " + u);
    };
  var F = (f, s, u) => {
    if (s.has(f)) throw TypeError("Cannot add the same private member more than once");
    s instanceof WeakSet ? s.add(f) : s.set(f, u);
  };
  var j = (f, s, u) => (ot(f, s, "access private method"), u);
  var s = ((e) => (
      (e.ID = "x-oid"),
      (e.TEXT = "x-text"),
      (e.SYNC = "x-sync"),
      (e.MODEL = "x-model"),
      (e.SHOW = "x-show"),
      (e.FOR = "x-for"),
      (e.BIND_SRC = "x-bind:src"),
      (e.BIND_HREF = "x-bind:href"),
      (e.BIND_CHECKED = "x-bind:checked"),
      (e.BIND_VALUE = "x-bind:value"),
      (e.BIND_SELECTED = "x-bind:selected"),
      (e.BIND_CLASS = "x-bind:class"),
      (e.ON_INPUT = "x-on:input"),
      (e.ON_CHANGE = "x-on:change"),
      (e.ON_CLICK = "x-on:click"),
      (e.ON_SUBMIT = "x-on:submit"),
      (e.ON_MOUNTED = "x-on:mounted"),
      e
    ))(s || {}),
    u = ((e) => ((e.INPUT = "input"), (e.CHANGE = "change"), (e.CLICK = "click"), (e.SUBMIT = "submit"), e))(u || {});
  const q = (e = document) => e.documentElement.getAttribute("data-wf-site"),
    G = async (e) => {
      var i, n;
      const { Webflow: t } = window;
      if (!(!t || !("destroy" in t) || !("ready" in t) || !("require" in t)) && !(e && !e.length)) {
        if ((e || (t.destroy(), t.ready()), !e || e.includes("ix2"))) {
          const r = t.require("ix2");
          if (r) {
            const { store: o, actions: c } = r,
              { eventState: a } = o.getState().ixSession,
              l = Object.entries(a);
            e || r.destroy(), r.init(), await Promise.all(l.map((h) => o.dispatch(c.eventStateChanged(...h))));
          }
        }
        if (!e || e.includes("commerce")) {
          const r = t.require("commerce"),
            o = q();
          r && o && (r.destroy(), r.init({ siteId: o, apiUrl: "https://render.webflow.com" }));
        }
        if ((e != null && e.includes("lightbox") && ((i = t.require("lightbox")) == null || i.ready()), e != null && e.includes("slider"))) {
          const r = t.require("slider");
          r && (r.redraw(), r.ready());
        }
        return e != null && e.includes("tabs") && ((n = t.require("tabs")) == null || n.redraw()), new Promise((r) => t.push(() => r(void 0)));
      }
    };
  function Y(e, t, i = "") {
    let n = `${i}[${t}]`;
    t === s.SYNC && (n += `, ${i}[${s.MODEL}]`);
    let r = Array.from(e.querySelectorAll(n.replaceAll(":", "\\:"))).filter(
      (o) => o instanceof HTMLElement && o.parentElement && !o.parentElement.closest(`[${s.FOR}]`)
    );
    return e.hasAttribute(t) && r.push(e), r;
  }
  function V(e, t, i) {
    const n = t.split("."),
      r = n.pop() || "",
      o = n.reduce((c, a) => c[a], e);
    o[r] = i;
  }
  function I(e, t) {
    return !e || !t ? void 0 : t.split(".").reduce((n, r) => n && n[r], e);
  }
  function X() {
    var t;
    const e = document.createElement("style");
    (e.title = "soFetch - Global Styles"), document.head.appendChild(e), (t = e.sheet) == null || t.insertRule(`[${s.FOR}] {display: none;}`);
  }
  function z() {
    return document.documentElement.hasAttribute("data-wf-domain");
  }
  async function Z(e) {
    await G(e), e || document.dispatchEvent(new Event("readystatechange"));
  }
  class N {
    constructor(t, i, n = []) {
      A(this, "target");
      return (this.target = t), new Proxy(this.target, this.createHandler(i, n));
    }
    createHandler(t, i) {
      return {
        set(n, r, o, c) {
          let a = null;
          if (n[r] === o) return !0;
          Array.isArray(n[r]) && (a = t.targetMap.get(n[r]));
          const l = Reflect.set(n, r, o, c);
          return (
            a && (t.targetMap.delete(n[r]), t.targetMap.set(c[r], a)),
            t.trigger(c, r),
            window.$app.inspector && typeof window.$app.inspector == "function" && window.$app.inspector(t.name, t.store),
            l
          );
        },
        get: function (n, r, o) {
          return r === "_isProxy"
            ? !0
            : (typeof n[r] == "function" ||
                (r in n && typeof n[r] == "object" && n[r] !== null && !n[r]._isProxy && (n[r] = new N(n[r], t, i.concat(r))),
                typeof r != "symbol" &&
                  t.activeEffect.el &&
                  t.activeEffect.fn &&
                  t.activeEffect.ctx &&
                  t.watch(o, r, t.activeEffect.el, t.activeEffect.fn, t.activeEffect.ctx)),
              n[r]);
        },
      };
    }
  }
  const C = Object.create(null),
    b = (e, t, i, n, r) => J(e, t, `return(${i})`, n, r),
    J = (e, t, i, n, r) => {
      const o = C[i] || (C[i] = Q(i));
      try {
        return o(e, t, n, r);
      } catch (c) {
        console.error(c);
      }
    },
    Q = (e) => {
      try {
        return new Function("$store", "$scope", "$el", "$event", `with($scope){${e}}`);
      } catch (t) {
        return console.error(`${t.message} in expression: ${e}`), () => {};
      }
    };
  function tt(e, t = 100, i = !1) {
    let n;
    return function (...r) {
      const o = this,
        c = function () {
          (n = void 0), i || e.apply(o, r);
        },
        a = i && !n;
      clearTimeout(n), (n = setTimeout(c, t)), a && e.apply(o, r);
    };
  }
  const x = (e, t, i, n, r) => {
      r.preventDefault(), b(e, t, `${i}`, n, r);
    },
    et = tt((e, t, i, n, r) => (r.preventDefault(), b(e, t, i, n, r)), 300),
    M = (e, t, i) => {
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLSelectElement)) {
        console.error(`${s.SYNC} only supports <input> elements.`);
        return;
      }
      const n = t.getAttribute(s.SYNC) || t.getAttribute(s.MODEL);
      if (n)
        if (n.includes(".")) {
          const r = n.split("."),
            o = r.pop(),
            c = I(i, r.join("."));
          t.value = c[o];
        } else t.value = i[n];
    },
    T = (e, t, i, n, r) => {
      if (!(n instanceof HTMLInputElement) && !(n instanceof HTMLTextAreaElement) && !(n instanceof HTMLSelectElement)) {
        console.error(`${s.SYNC} only supports <input> elements.`);
        return;
      }
      r.preventDefault(), V(t, i, n.value);
    },
    _ = (e, t, i) => {
      const n = t.getAttribute(s.TEXT);
      n && (t.textContent = b(e.store, i, n, t));
    },
    O = (e, t, i) => {
      if (!(t instanceof HTMLImageElement)) {
        console.error(`${s.BIND_SRC} only supports <src> elements.`);
        return;
      }
      const n = t.getAttribute(s.BIND_SRC);
      n && (t.src = b(e.store, i, n, t));
    },
    L = (e, t, i, n, r) => {
      r.preventDefault(), b(e, t, `${i}`, n, r);
    },
    D = (e, t, i) => {
      var o;
      const n = t.getAttribute(s.SHOW),
        r = t.getAttribute(s.ID);
      if (n && r) {
        const c = b(e.store, i, n, t);
        t.style.display = c === !0 ? ((o = e.initialStateMap.get(r)) == null ? void 0 : o.display) || "block" : "none";
      }
    },
    $ = (e, t, i, n, r) => {
      r.preventDefault(), r.stopPropagation(), b(e, t, `${i}`, n, r);
    },
    H = (e, t, i) => {
      var o, c, a, l;
      if (!(t instanceof HTMLInputElement)) {
        console.error(`${s.BIND_CHECKED} only supports <input> elements.`);
        return;
      }
      const n =
          (t.type === "checkbox" && ((o = t.previousElementSibling) == null ? void 0 : o.classList.contains("w-checkbox-input--inputType-custom"))) ||
          (t.type === "radio" && ((c = t.previousElementSibling) == null ? void 0 : c.classList.contains("w-form-formradioinput--inputType-custom"))),
        r = t.getAttribute(s.BIND_CHECKED);
      r &&
        ((t.checked = b(e.store, i, r, t)),
        n &&
          (t.checked
            ? (a = t.previousElementSibling) == null || a.classList.add("w--redirected-checked")
            : (l = t.previousElementSibling) == null || l.classList.remove("w--redirected-checked")));
    },
    B = (e, t, i) => {
      if (!(t instanceof HTMLAnchorElement)) {
        console.error(`${s.BIND_HREF} does not support <a> elements.`);
        return;
      }
      const n = t.getAttribute(s.BIND_HREF);
      n && (t.href = b(e.store, i, n, t));
    },
    R = (e, t, i, n, r) => {
      r.preventDefault(), r.stopPropagation(), b(e, t, `${i}`, n, r);
    },
    P = (e, t, i) => {
      if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLOptionElement) && !(t instanceof HTMLTextAreaElement)) {
        console.error(`${s.BIND_VALUE} does not support <input> and <option> elements.`);
        return;
      }
      const n = t.getAttribute(s.BIND_VALUE);
      n && (t.value = b(e.store, i, n, t));
    },
    v = (e, t, i) => {
      if (!(t instanceof HTMLOptionElement)) {
        console.error(`${s.BIND_SELECTED} does not support <option> elements.`);
        return;
      }
      const n = t.getAttribute(s.BIND_SELECTED);
      n && (t.selected = b(e.store, i, n, t));
    },
    U = (e, t, i) => {
      const n = /^([a-zA-Z-_]+)\s+(?:if)\s+([\s\S]+)$/,
        r = t.getAttribute(s.BIND_CLASS),
        o = r && r.match(n);
      if (!o) {
        console.warn(`invalid x-bind:class expression: ${r}`);
        return;
      }
      const c = o[1].trim(),
        a = o[2].trim();
      a && (b(e.store, i, a, t) ? t.classList.add(c) : t.classList.remove(c));
    },
    g = (e, t, i) => {
      const n = /^([a-zA-Z]+)\s+(?:in)\s+([\s\S]+)$/,
        r = t.getAttribute(s.FOR),
        o = r && r.match(n);
      if (!o) {
        console.warn(`invalid x-for expression: ${r}`);
        return;
      }
      const c = o[1].trim(),
        a = o[2].trim(),
        l = b(e.store, i, a, t);
      if (((e.activeEffect = { fn: null, el: null, ctx: null }), !l || !Array.isArray(l))) return;
      let h, d;
      if (a.includes(".")) {
        const m = a.lastIndexOf("."),
          w = a.substring(0, m);
        (d = a.substring(m + 1)), (h = I(i, w));
      } else (d = a), (h = i);
      for (e.watch(h, d, t, g, i), e.watch(h[d], "__root__", t, g, i); t.parentElement && t.nextSibling; ) t.parentElement.removeChild(t.nextSibling);
      l.forEach((m, w) => {
        var k;
        const p = t.cloneNode(!0);
        p.removeAttribute(s.FOR);
        const E = Object.create(i);
        Object.defineProperties(E, Object.getOwnPropertyDescriptors({ [c]: m, index: w })),
          e.registerAttribute(s.TEXT, E, p, _),
          e.registerAttribute(s.SHOW, E, p, D),
          e.registerAttribute(s.BIND_VALUE, E, p, P),
          e.registerAttribute(s.BIND_SRC, E, p, O),
          e.registerAttribute(s.BIND_CHECKED, E, p, H),
          e.registerAttribute(s.BIND_SELECTED, E, p, v),
          e.registerAttribute(s.BIND_HREF, E, p, B),
          e.registerAttribute(s.BIND_CLASS, E, p, U),
          e.registerAttribute(s.ON_INPUT, E, p, null, u.INPUT, x),
          e.registerAttribute(s.ON_CHANGE, E, p, null, u.CHANGE, R),
          e.registerAttribute(s.ON_CLICK, E, p, null, u.CLICK, L),
          e.registerAttribute(s.ON_SUBMIT, E, p, null, u.SUBMIT, $),
          e.registerAttribute(s.SYNC, E, p, M, u.INPUT, T),
          e.registerAttribute(s.FOR, E, p, g),
          (k = t.parentElement) == null || k.appendChild(p);
      });
    };
  class rt {
    constructor(t, i) {
      F(this, y);
      A(this, "name");
      A(this, "store");
      A(this, "initialStateMap");
      A(this, "activeEffect");
      A(this, "element");
      A(this, "targetMap");
      (this.name = t),
        (this.element = null),
        (this.store = new N(i, this)),
        (this.targetMap = new WeakMap()),
        (this.initialStateMap = new Map()),
        (this.activeEffect = { fn: null, el: null, ctx: null });
    }
    mount(t) {
      var i, n;
      if (
        (t
          ? typeof t == "string"
            ? (this.element = document.querySelector(t))
            : (this.element = t)
          : document.currentScript &&
            (z() && (n = (i = document.currentScript) == null ? void 0 : i.parentElement) != null && n.parentElement
              ? (this.element = document.currentScript.parentElement.parentElement)
              : (this.element = document.currentScript.parentElement)),
        !this.element)
      )
        throw new Error(`element not found using selector  '${t}'`);
      if (
        (Array.from(this.element.querySelectorAll(`[${s.SHOW}]`)).forEach((r) => {
          const o = crypto.randomUUID();
          r.setAttribute(s.ID, o);
          let c = getComputedStyle(r).display;
          (r.classList.contains("w-form-done") || r.classList.contains("w-form-fail")) && (c = "block"), this.initialStateMap.set(o, { display: c });
        }),
        this.registerRootAttribute(s.BIND_VALUE, P),
        this.registerRootAttribute(s.BIND_SRC, O),
        this.registerRootAttribute(s.BIND_CHECKED, H),
        this.registerRootAttribute(s.BIND_SELECTED, v),
        this.registerRootAttribute(s.BIND_HREF, B),
        this.registerRootAttribute(s.BIND_CLASS, U),
        this.registerRootAttribute(s.TEXT, _),
        this.registerRootAttribute(s.SHOW, D),
        this.registerRootAttribute(s.ON_INPUT, null, u.INPUT, x),
        this.registerRootAttribute(s.ON_CHANGE, null, u.CHANGE, R),
        this.registerRootAttribute(s.ON_CLICK, null, u.CLICK, L),
        this.registerRootAttribute(s.ON_SUBMIT, null, u.SUBMIT, $),
        this.registerRootAttribute(s.SYNC, M, u.INPUT, T),
        this.registerRootAttribute(s.FOR, g),
        this.element.hasAttribute(s.ON_MOUNTED))
      ) {
        const r = this.element.getAttribute(s.ON_MOUNTED);
        b(this.store, this.store, `${r}`, this.element);
      }
      return this;
    }
    registerAttribute(t, i, n, r, o, c) {
      Y(n, t).forEach((l) => {
        let h = l.getAttribute(t);
        l.hasAttribute(s.MODEL) &&
          console.warn(
            "DEPRECATION WARNING: x-model is being replaced by x-sync and will be removed in a future release. Please update your code accordingly. For more information, see the x-sync documentation at https://shinyobjectlabs.gitbook.io/framework-js/attributes/x-sync"
          ),
          !h && t === s.SYNC && (h = l.getAttribute(s.MODEL)),
          t === s.ON_INPUT && l instanceof HTMLInputElement && (l.type === "text" || l.type === "textarea") && (c = et),
          h &&
            (c &&
              o &&
              l.addEventListener(o, (d) => {
                c && h && c(this.store, i, h, l, d);
              }),
            r && j(this, y, K).call(this, r, i, h, l));
      });
    }
    registerRootAttribute(t, i, n, r) {
      this.element && this.registerAttribute(t, this.store, this.element, i, n, r);
    }
    watch(t, i, n, r, o) {
      if (i === "" || typeof t != "object") return;
      const c = this.targetMap.get(t);
      if (c) {
        const a = c.get(i);
        if (a) {
          const l = a.get(n);
          if (l) (l.context = o), l.effects.add(r);
          else {
            const h = new Set();
            h.add(r);
            const d = { context: o, effects: h };
            a.set(n, d);
          }
        } else {
          const l = new Set();
          l.add(r);
          const h = { context: o, effects: l },
            d = new Map();
          d.set(n, h), c.set(i, d);
        }
      } else {
        const a = new Set();
        a.add(r);
        const l = { context: o, effects: a },
          h = new Map();
        h.set(n, l);
        const d = new Map();
        d.set(i, h), this.targetMap.set(t, d);
      }
    }
    trigger(t, i) {
      const n = this.targetMap.get(t);
      if (n)
        if (Array.isArray(t) || Array.isArray(t[i])) for (let [r, o] of n) this.processElementMap(o);
        else {
          const r = n.get(i);
          if (!r) return;
          this.processElementMap(r);
        }
    }
    processElementMap(t) {
      const i = Array.from(t.keys());
      for (const n of i) {
        const r = t.get(n);
        if (!r) return;
        const o = Array.from(r.effects);
        for (let c of o) {
          if (!n) {
            t.delete(n);
            return;
          }
          const a = r.context || this.store;
          c(this, n, a);
        }
      }
    }
  }
  (y = new WeakSet()),
    (K = function (t, i, n, r) {
      (this.activeEffect.fn = t),
        this.activeEffect.fn && ((this.activeEffect.el = r), (this.activeEffect.ctx = i), this.activeEffect.fn(this, r, i)),
        (this.activeEffect = { fn: null, el: null, ctx: null });
    });
  const S = {},
    W = {};
  (f.inspector = void 0), console.log("SO-Framework v0.1.0"), X();
  const nt = (e, t = {}) => ((S[e] = new rt(e, t)), S[e]);
  return (
    (W.restartWebflow = async function (e) {
      await Z(e);
    }),
    (f.inspector = null),
    (f.components = S),
    (f.createComponent = nt),
    (f.helpers = W),
    Object.defineProperty(f, Symbol.toStringTag, { value: "Module" }),
    f
  );
})({});
