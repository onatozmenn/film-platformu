export const googleImaSdkUrl = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";

export type GoogleImaSdkLoadOutcome = "blocked" | "ready" | "timeout";

type BrowserEnvironment = Readonly<{ document: Document; window: Window }>;

function hasGoogleImaSdk(window: Window): boolean {
  const google = Reflect.get(window, "google");
  if (typeof google !== "object" || google === null) {
    return false;
  }
  const ima = Reflect.get(google, "ima");
  return typeof ima === "object" && ima !== null;
}

export function createGoogleImaSdkLoader(environment: BrowserEnvironment) {
  let pending: Promise<GoogleImaSdkLoadOutcome> | undefined;

  return {
    load(timeoutMilliseconds: number = 4_000): Promise<GoogleImaSdkLoadOutcome> {
      if (hasGoogleImaSdk(environment.window)) {
        return Promise.resolve("ready");
      }
      pending ??= new Promise<GoogleImaSdkLoadOutcome>((resolve) => {
        const selector = 'script[data-film-google-ima="true"]';
        const existing = environment.document.querySelector<HTMLScriptElement>(selector);
        const script = existing ?? environment.document.createElement("script");
        let settled = false;

        const finish = (outcome: GoogleImaSdkLoadOutcome) => {
          if (settled) {
            return;
          }
          settled = true;
          environment.window.clearTimeout(timeout);
          script.removeEventListener("load", handleLoad);
          script.removeEventListener("error", handleError);
          if (outcome !== "ready") {
            script.remove();
            pending = undefined;
          }
          resolve(outcome);
        };
        const handleLoad = () => finish(hasGoogleImaSdk(environment.window) ? "ready" : "blocked");
        const handleError = () => finish("blocked");

        script.addEventListener("load", handleLoad, { once: true });
        script.addEventListener("error", handleError, { once: true });
        const timeout = environment.window.setTimeout(() => finish("timeout"), timeoutMilliseconds);

        if (existing === null) {
          script.async = true;
          script.crossOrigin = "anonymous";
          script.dataset.filmGoogleIma = "true";
          script.referrerPolicy = "strict-origin-when-cross-origin";
          script.src = googleImaSdkUrl;
          environment.document.head.append(script);
        }
      });
      return pending;
    },
  };
}

let browserLoader: ReturnType<typeof createGoogleImaSdkLoader> | undefined;

export function loadGoogleImaSdk(
  timeoutMilliseconds: number = 4_000,
): Promise<GoogleImaSdkLoadOutcome> {
  browserLoader ??= createGoogleImaSdkLoader({ document, window });
  return browserLoader.load(timeoutMilliseconds);
}
