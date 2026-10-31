/*
 * <saathi-widget> — drop-in Saathi chat for a host dashboard.
 *
 *   <script src="https://saathi.example/saathi-widget.js" defer></script>
 *   <saathi-widget token="<short-lived merchant token>" lang="hi" primary="#00b9f5"></saathi-widget>
 *
 * The token comes from YOUR backend (POST /v1/embed/token with your host key); the browser never
 * sees the host key. Events (CustomEvent on the element): saathi-ready, saathi-message-sent,
 * saathi-case-update {state, case_ids}, saathi-token-expired. Methods: open(), close(), toggle().
 */
(() => {
  if (customElements.get("saathi-widget")) return;
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const LANGS = ["hi", "hinglish", "en"];
  const BASE = (() => {
    try { return new URL(document.currentScript.src).origin; } catch { return location.origin; }
  })();

  const css = `
    :host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .launcher { width: 56px; height: 56px; border-radius: 50%; border: 0; cursor: pointer;
      background: var(--saathi-primary, #00b9f5); color: #003b55; font-weight: 700; font-size: 22px;
      box-shadow: 0 6px 20px rgba(10,31,60,.28); }
    .launcher:focus-visible, .close:focus-visible { outline: 3px solid #002e6e; outline-offset: 2px; }
    .panel { display: none; position: fixed; right: 20px; bottom: 88px; width: 380px; height: min(640px, calc(100dvh - 110px));
      border-radius: 18px; overflow: hidden; background: #fff; box-shadow: 0 16px 48px rgba(10,31,60,.35); }
    :host([open]) .panel { display: block; }
    iframe { width: 100%; height: 100%; border: 0; }
    .close { position: absolute; top: 8px; right: 8px; z-index: 1; width: 28px; height: 28px; border: 0; border-radius: 50%;
      background: rgba(255,255,255,.18); color: #fff; cursor: pointer; font-size: 16px; line-height: 1; display: none; }
    @media (max-width: 480px) {
      .panel { right: 0; bottom: 0; width: 100vw; height: 100dvh; border-radius: 0; }
      .close { display: block; top: 12px; right: 56px; }
    }
  `;

  class SaathiWidget extends HTMLElement {
    static observedAttributes = ["token", "lang", "primary", "src"];

    connectedCallback() {
      if (this.shadowRoot) return;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${css}</style>
        <button class="launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-label="Open Saathi help chat">S</button>
        <div class="panel" role="dialog" aria-label="Saathi help chat">
          <button class="close" type="button" aria-label="Close chat">&times;</button>
        </div>`;
      this.launcher = root.querySelector(".launcher");
      this.panel = root.querySelector(".panel");
      this.launcher.addEventListener("click", () => this.toggle());
      root.querySelector(".close").addEventListener("click", () => this.close());
      this.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
      this._onMessage = (e) => {
        const frame = this.iframe;
        if (!frame || e.source !== frame.contentWindow || e.origin !== this._origin) return;
        if (!e.data || e.data.source !== "saathi" || typeof e.data.type !== "string") return;
        const detail = { ...e.data };
        delete detail.source;
        delete detail.type;
        this.dispatchEvent(new CustomEvent(e.data.type.replace(/^saathi:/, "saathi-"), { detail, bubbles: true, composed: true }));
      };
      window.addEventListener("message", this._onMessage);
      this._applyTheme();
    }

    disconnectedCallback() { window.removeEventListener("message", this._onMessage); }

    attributeChangedCallback(name) {
      if (!this.shadowRoot) return;
      if (name === "primary") this._applyTheme();
      else if (this.iframe) this._mount(); // token/lang/src changed: reload the chat
    }

    _applyTheme() {
      const c = this.getAttribute("primary");
      if (c && HEX.test(c)) this.style.setProperty("--saathi-primary", c);
    }

    _mount() {
      const token = this.getAttribute("token");
      if (!token) return;
      const src = this.getAttribute("src") || BASE;
      let origin;
      try { origin = new URL(src).origin; } catch { return; }
      this._origin = origin;
      const lang = LANGS.includes(this.getAttribute("lang")) ? this.getAttribute("lang") : "hinglish";
      const params = new URLSearchParams({ token, lang, host: location.origin });
      const primary = this.getAttribute("primary");
      if (primary && HEX.test(primary)) params.set("primary", primary);
      if (!this.iframe) {
        this.iframe = document.createElement("iframe");
        this.iframe.title = "Saathi help chat";
        this.iframe.allow = "microphone";
        this.panel.appendChild(this.iframe);
      }
      this.iframe.src = `${origin}/chat#${params.toString()}`;
    }

    open() {
      if (!this.iframe) this._mount();
      this.setAttribute("open", "");
      this.launcher.setAttribute("aria-expanded", "true");
    }
    close() {
      this.removeAttribute("open");
      this.launcher.setAttribute("aria-expanded", "false");
      this.launcher.focus();
    }
    toggle() {
      if (this.hasAttribute("open")) this.close();
      else this.open();
    }
  }
  customElements.define("saathi-widget", SaathiWidget);
})();
