import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  formatZoneClock,
  formatZoneRow,
  zonesForPicker,
} from "../../lib/chartTimezone";

import {
  Check,
  X,
} from "lucide-react";

export function ChartTimezone({
  timezone,
  open,
  onToggle,
  onPick,
}: {
  timezone: string;
  open: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
}) {
  const [now, setNow] =
    useState(() => Date.now());

  const selectedRef =
    useRef<HTMLButtonElement | null>(
      null
    );

  useEffect(() => {
    const id =
      window.setInterval(
        () => setNow(Date.now()),
        1000
      );

    return () =>
      window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;

    const id =
      window.requestAnimationFrame(
        () => {
          const el =
            selectedRef.current;

          const wrap =
            el?.parentElement;

          if (!el || !wrap) {
            return;
          }

          wrap.scrollTop =
            Math.max(
              0,
              el.offsetTop -
                wrap.clientHeight / 2 +
                el.clientHeight / 2
            );
        }
      );

    return () =>
      window.cancelAnimationFrame(
        id
      );
  }, [
    open,
    timezone,
  ]);

  const zones =
    useMemo(
      () =>
        zonesForPicker(
          timezone
        ),
      [
        timezone,
      ]
    );

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title="Chart timezone"
        aria-expanded={open}
        onClick={onToggle}
        className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-mono tabular-nums transition-colors ${
          open
            ? "bg-brand-overlay-active text-success"
            : "text-gray-500 hover:bg-brand-overlay-normal hover:text-brand-text"
        }`}
      >
        {formatZoneClock(
          timezone,
          now
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close timezone"
            onClick={onToggle}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-[1px] touch-none sm:hidden"
          />

          <div className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[72dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-brand-border bg-brand-bg pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-50 sm:mt-1 sm:block sm:w-[15.5rem] sm:max-w-[calc(100vw-1rem)] sm:rounded-xl sm:border-b sm:pb-0">
            <div className="flex shrink-0 items-center border-b border-brand-border px-4 py-3 sm:hidden">
              <span className="text-[14px] font-bold text-brand-text">
                Timezone
              </span>

              <button
                type="button"
                aria-label="Close timezone"
                onClick={onToggle}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-sub hover:bg-brand-overlay-normal hover:text-brand-text"
              >
                <X size={17} />
              </button>
            </div>

            <div className="max-h-[calc(72dvh-3.5rem)] overflow-y-auto overscroll-contain py-1 sm:max-h-64">
              {zones.map(
                (zone) => {
                  const selected =
                    zone.id ===
                    timezone;

                  return (
                    <button
                      key={zone.id}
                      ref={
                        selected
                          ? selectedRef
                          : undefined
                      }
                      type="button"
                      onClick={() =>
                        onPick(zone.id)
                      }
                      className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] ${
                        selected
                          ? "bg-brand-overlay-subtle text-brand-text"
                          : "text-gray-400 hover:bg-brand-overlay-normal hover:text-brand-text"
                      }`}
                    >
                      <span className="inline-flex w-3.5 shrink-0 justify-center text-success">
                        {selected ? (
                          <Check
                            size={11}
                          />
                        ) : null}
                      </span>

                      {formatZoneRow(
                        zone,
                        now
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
