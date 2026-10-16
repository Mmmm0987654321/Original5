/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function getCurrentVisibilityState(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  return document.visibilityState === "visible";
}

export function onVisibilityStateChange(
  callback: (visible: boolean) => void
): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  const handler = () => {
    callback(document.visibilityState === "visible");
  };

  document.addEventListener("visibilitychange", handler, false);

  return () => {
    document.removeEventListener("visibilitychange", handler, false);
  };
}
