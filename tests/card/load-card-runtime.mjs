import { readFile } from "node:fs/promises";

let runtimePromise;

class LitElementStub {
  constructor() {
    this.isConnected = false;
    this.updateComplete = Promise.resolve();
    this.renderRoot = { querySelector: () => null };
    this.shadowRoot = { addEventListener: () => {} };
    this.__requestUpdateCount = 0;
  }

  requestUpdate() {
    this.__requestUpdateCount++;
    this.updateComplete = Promise.resolve();
  }

  connectedCallback() {}
  disconnectedCallback() {}
}

const templateStub = (strings, ...values) => ({ strings, values });

function installBrowserStubs() {
  const location = {
    hostname: "homeassistant.local",
    protocol: "https:",
    origin: "https://homeassistant.local",
    hash: "",
  };
  const registry = new Map();
  const customElements = {
    define: (name, implementation) => registry.set(name, implementation),
    get: (name) => registry.get(name),
  };
  const document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag) => ({
      tagName: String(tag).toUpperCase(),
      canPlayType: () => "",
      load: () => {},
      pause: () => {},
      play: async () => {},
      removeAttribute: () => {},
    }),
    head: { appendChild: () => {} },
  };
  const window = {
    Hls: null,
    customCards: [],
    location,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  Object.defineProperties(globalThis, {
    location: { value: location, configurable: true, writable: true },
    window: { value: window, configurable: true, writable: true },
    document: { value: document, configurable: true, writable: true },
    customElements: {
      value: customElements,
      configurable: true,
      writable: true,
    },
    navigator: {
      value: { maxTouchPoints: 0, userAgent: "node-test" },
      configurable: true,
      writable: true,
    },
    CustomEvent: {
      value: class CustomEventStub {
        constructor(type, options = {}) {
          this.type = type;
          Object.assign(this, options);
        }
      },
      configurable: true,
      writable: true,
    },
  });

  globalThis.__frigateVisionLitStub = {
    LitElement: LitElementStub,
    html: templateStub,
    css: templateStub,
  };
}

export async function loadCardRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    installBrowserStubs();
    const sourceUrl = new URL(
      "../../custom_components/frigate_vision/frontend/frigate-vision-card.js",
      import.meta.url,
    );
    const source = await readFile(sourceUrl, "utf8");
    const litImport =
      /import\s*\{\s*LitElement,\s*html,\s*css,\s*\}\s*from\s*"\.\/vendor\/lit-3\.3\.3\.js";/;
    if (!litImport.test(source)) {
      throw new Error("Lit import in frigate-vision-card.js was not found");
    }
    const transformed = source.replace(
      litImport,
      "const { LitElement, html, css } = globalThis.__frigateVisionLitStub;",
    ) + `
export {
  FrigateVisionCard,
  FrigateVisionLiveTile,
  LivestreamController,
  frigateProxyWsPath,
  go2rtcBase,
};
`;
    const moduleUrl =
      `data:text/javascript;base64,${Buffer.from(transformed).toString("base64")}`;
    return import(moduleUrl);
  })();
  return runtimePromise;
}
