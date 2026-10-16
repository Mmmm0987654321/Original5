/**
 * KLine renderer for `ChartPriceLine[]` (entry / liq / TP / SL / limits).
 *
 * One locked, event-transparent overlay holds all lines as points, so the
 * layout runs on every draw with live pixel coordinates.
 *
 * Price lines always stay at their true price. Only tags move if they would
 * collide, with an elbow leader connecting the displaced tag to its line.
 */

import {
  registerOverlay,
  utils,
  type Chart,
  type OverlayFigure,
} from 'klinecharts';

import type {
  ChartPriceLine,
} from './chartLines';

export const PRICE_LINE_OVERLAY =
  'ht_price_lines';

export const PRICE_LINE_GROUP =
  'ht_price_lines';

const OVERLAY_ID =
  `${PRICE_LINE_GROUP}_all`;

const FONT =
  '"Basel Grotesk", Basel, Inter, ui-sans-serif, system-ui, sans-serif';

const LINE_ALPHA =
  'bb';

const TAG_BG =
  '#12131aee';

const TAG_FONT_SIZE =
  10;

const TAG_FONT_WEIGHT =
  600;

const TAG_PAD_X =
  5;

const TAG_PAD_Y =
  2;

const TAG_BOX_H =
  TAG_FONT_SIZE +
  TAG_PAD_Y * 2 +
  2;

const TAG_H =
  TAG_BOX_H +
  3;

const EDGE_PAD =
  8;

const TAG_GAP =
  8;

const RIGHT_INSET =
  2;

const DASH:
  [number, number] = [
    6,
    4,
  ];

let registered =
  false;

function tagWidth(
  label: string,
): number {
  return (
    Math.ceil(
      utils.calcTextWidth(
        label,
        TAG_FONT_SIZE,
        TAG_FONT_WEIGHT,
        FONT,
      ),
    ) +
    TAG_PAD_X * 2
  );
}

function layoutTagY(
  ys: number[],
  height: number,
): number[] {
  const n =
    ys.length;

  if (
    !n ||
    height <= 0
  ) {
    return ys.slice();
  }

  const minY =
    EDGE_PAD +
    TAG_H / 2;

  const maxY =
    height -
    EDGE_PAD -
    TAG_H / 2;

  const clampEdge =
    (v: number) =>
      Math.min(
        maxY,
        Math.max(
          minY,
          v,
        ),
      );

  const order =
    ys
      .map(
        (
          _,
          i,
        ) => i,
      )
      .sort(
        (
          a,
          b,
        ) =>
          ys[a] -
          ys[b],
      );

  const want =
    order.map(
      (i) =>
        clampEdge(
          ys[i],
        ),
    );

  const pos =
    want.slice();

  for (
    let k = 1;
    k < n;
    k++
  ) {
    pos[k] =
      Math.max(
        want[k],
        pos[k - 1] +
          TAG_H,
      );
  }

  if (
    pos[n - 1] >
    maxY
  ) {
    pos[n - 1] =
      maxY;

    for (
      let k =
        n - 2;
      k >= 0;
      k--
    ) {
      pos[k] =
        Math.min(
          pos[k],
          pos[k + 1] -
            TAG_H,
        );
    }
  }

  let start =
    0;

  while (
    start <
    n
  ) {
    let end =
      start + 1;

    while (
      end < n &&
      pos[end] -
        pos[end - 1] <
        TAG_H +
          0.5
    ) {
      end += 1;
    }

    if (
      end -
        start >
      1
    ) {
      let meanLine =
        0;

      let meanTag =
        0;

      for (
        let k =
          start;
        k < end;
        k++
      ) {
        meanLine +=
          want[k];

        meanTag +=
          pos[k];
      }

      let shift =
        (
          meanLine -
          meanTag
        ) /
        (
          end -
          start
        );

      const lo =
        Math.max(
          minY,
          start > 0
            ? pos[
                start -
                  1
              ] +
              TAG_H
            : -Infinity,
        ) -
        pos[start];

      const hi =
        Math.min(
          maxY,
          end < n
            ? pos[end] -
              TAG_H
            : Infinity,
        ) -
        pos[
          end -
            1
        ];

      shift =
        Math.min(
          hi,
          Math.max(
            lo,
            shift,
          ),
        );

      for (
        let k =
          start;
        k < end;
        k++
      ) {
        pos[k] +=
          shift;
      }
    }

    start =
      end;
  }

  const out:
    number[] =
      new Array(n);

  order.forEach(
    (
      i,
      k,
    ) => {
      out[i] =
        Math.round(
          pos[k],
        );
    },
  );

  return out;
}

export function ensureKlinePriceLineOverlay():
  void {
  if (registered) {
    return;
  }

  registered =
    true;

  registerOverlay<
    ChartPriceLine[]
  >({
    name:
      PRICE_LINE_OVERLAY,

    totalStep:
      2,

    lock:
      true,

    needDefaultPointFigure:
      false,

    needDefaultXAxisFigure:
      false,

    needDefaultYAxisFigure:
      false,

    createPointFigures: ({
      chart,
      coordinates,
      bounding,
      overlay,
    }) => {
      const lines =
        overlay.extendData;

      if (
        !Array.isArray(
          lines,
        ) ||
        !lines.length
      ) {
        return [];
      }

      const height =
        bounding.height;

      const edgeTop =
        EDGE_PAD +
        TAG_H / 2;

      const edgeBottom =
        height -
        EDGE_PAD -
        TAG_H / 2;

      const visible:
        {
          line:
            ChartPriceLine;

          y:
            number;

          edge:
            "above" |
            "below" |
            null;
        }[] = [];

      lines.forEach(
        (
          line,
          i,
        ) => {
          const converted =
            chart.convertToPixel(
              {
                value:
                  line.price,
              },
              {
                paneId:
                  'candle_pane',
              }
            );

          const convertedY =
            Array.isArray(
              converted
            )
              ? converted[0]?.y
              : converted?.y;

          const raw =
            Number.isFinite(
              Number(
                convertedY
              )
            )
              ? Number(
                  convertedY
                )
              : coordinates[i]
                  ?.y;

          if (
            raw == null ||
            !Number.isFinite(
              raw,
            )
          ) {
            return;
          }

          const edge =
            raw < 0
              ? "above"
              : raw > height
                ? "below"
                : null;

          const y =
            edge ===
            "above"
              ? Math.round(
                  edgeTop
                )
              : edge ===
                  "below"
                ? Math.round(
                    edgeBottom
                  )
                : Math.round(
                    raw
                  );

          visible.push({
            line,
            y,
            edge,
          });
        },
      );

      if (
        !visible.length
      ) {
        return [];
      }

      const displayLabel = (
        item:
          (typeof visible)[number],
      ) =>
        item.edge ===
        "above"
          ? `↑ ${item.line.label}`
          : item.edge ===
              "below"
            ? `↓ ${item.line.label}`
            : item.line.label;

      const widths =
        visible.map(
          (item) =>
            tagWidth(
              displayLabel(
                item
              )
            )
        );

      const colW =
        Math.max(
          ...widths,
        );

      const xRight =
        bounding.width -
        RIGHT_INSET;

      const xColLeft =
        Math.max(
          0,
          Math.round(
            xRight -
              colW,
          ),
        );

      const xLineEnd =
        Math.max(
          0,
          xColLeft -
            TAG_GAP,
        );

      const xLeader =
        Math.round(
          (
            xLineEnd +
            xColLeft
          ) /
            2,
        ) +
        0.5;

      const tagLeft =
        (
          i: number,
        ) =>
          Math.max(
            xColLeft,
            Math.round(
              xRight -
                widths[i],
            ),
          );

      const tagYs =
        layoutTagY(
          visible.map(
            (v) =>
              v.y,
          ),
          height,
        );

      const figures:
        OverlayFigure[] =
          [];

      visible.forEach(
        (
          {
            line,
            y,
            edge,
          },
          i,
        ) => {
          const color =
            line.color
              .length ===
            7
              ? `${line.color}${LINE_ALPHA}`
              : line.color;

          const tagY =
            tagYs[i];

          if (!edge) {
            figures.push({
              type:
                'line',

              attrs: {
                coordinates: [
                  {
                    x:
                      xLineEnd,

                    y,
                  },
                  {
                    x:
                      0,

                    y,
                  },
                ],
              },

              styles: {
                style:
                  line.dashed
                    ? 'dashed'
                    : 'solid',

                dashedValue:
                  DASH,

                size:
                  1,

                color,
              },

              ignoreEvent:
                true,
            });
          } else {
            figures.push({
              type:
                'line',

              attrs: {
                coordinates: [
                  {
                    x:
                      Math.max(
                        0,
                        xLineEnd -
                          12,
                      ),

                    y,
                  },
                  {
                    x:
                      xLineEnd,

                    y,
                  },
                ],
              },

              styles: {
                style:
                  'solid',

                size:
                  1,

                color,
              },

              ignoreEvent:
                true,
            });
          }

          const xTag =
            tagLeft(i);

          if (
            Math.abs(
              tagY -
                y,
            ) >
            1
          ) {
            figures.push({
              type:
                'line',

              attrs: {
                coordinates: [
                  {
                    x:
                      xLineEnd,

                    y,
                  },
                  {
                    x:
                      xLeader,

                    y,
                  },
                  {
                    x:
                      xLeader,

                    y:
                      tagY,
                  },
                  {
                    x:
                      xTag,

                    y:
                      tagY,
                  },
                ],
              },

              styles: {
                style:
                  'solid',

                size:
                  1,

                color,
              },

              ignoreEvent:
                true,
            });
          } else if (
            xTag >
            xColLeft
          ) {
            figures.push({
              type:
                'line',

              attrs: {
                coordinates: [
                  {
                    x:
                      xLineEnd,

                    y,
                  },
                  {
                    x:
                      xTag,

                    y,
                  },
                ],
              },

              styles: {
                style:
                  'solid',

                size:
                  1,

                color,
              },

              ignoreEvent:
                true,
            });
          }
        },
      );

      visible.forEach(
        (
          {
            line,
            edge,
          },
          i,
        ) => {
          const tagY =
            tagYs[i];

          const xTag =
            tagLeft(i);

          figures.push({
            type:
              'rect',

            attrs: {
              x:
                xTag,

              y:
                tagY -
                TAG_BOX_H /
                  2,

              width:
                xRight -
                xTag,

              height:
                TAG_BOX_H,
            },

            styles: {
              style:
                'fill',

              color:
                TAG_BG,

              borderRadius:
                3,

              borderSize:
                0,
            },

            ignoreEvent:
              true,
          });

          figures.push({
            type:
              'text',

            attrs: {
              x:
                xRight -
                TAG_PAD_X,

              y:
                tagY,

              text:
                edge ===
                "above"
                  ? `↑ ${line.label}`
                  : edge ===
                      "below"
                    ? `↓ ${line.label}`
                    : line.label,

              align:
                'right',

              baseline:
                'middle',
            },

            styles: {
              style:
                'fill',

              color:
                line.color,

              backgroundColor:
                'transparent',

              size:
                TAG_FONT_SIZE,

              weight:
                TAG_FONT_WEIGHT,

              family:
                FONT,

              paddingLeft:
                0,

              paddingRight:
                0,

              paddingTop:
                0,

              paddingBottom:
                0,

              borderSize:
                0,
            },

            ignoreEvent:
              true,
          });
        },
      );

      return figures;
    },
  });
}

export function syncKlinePriceLines(
  chart: Chart,
  lines:
    ChartPriceLine[],
): void {
  ensureKlinePriceLineOverlay();

  const sorted =
    [
      ...lines,
    ].sort(
      (
        a,
        b,
      ) =>
        b.price -
        a.price,
    );

  const existing =
    chart.getOverlays({
      groupId:
        PRICE_LINE_GROUP,
    });

  if (
    !sorted.length
  ) {
    for (
      const o of
      existing
    ) {
      chart.removeOverlay({
        id:
          o.id,
      });
    }

    return;
  }

  const points =
    sorted.map(
      (l) => ({
        value:
          l.price,
      }),
    );

  const extendData =
    sorted.map(
      (l) => ({
        ...l,
      }),
    );

  const has =
    existing.some(
      (o) =>
        o.id ===
        OVERLAY_ID,
    );

  for (
    const o of
    existing
  ) {
    if (
      o.id !==
      OVERLAY_ID
    ) {
      chart.removeOverlay({
        id:
          o.id,
      });
    }
  }

  if (has) {
    chart.overrideOverlay({
      id:
        OVERLAY_ID,

      points,

      extendData,
    });
  } else {
    chart.createOverlay({
      name:
        PRICE_LINE_OVERLAY,

      id:
        OVERLAY_ID,

      groupId:
        PRICE_LINE_GROUP,

      paneId:
        'candle_pane',

      points,

      extendData,

      lock:
        true,

      visible:
        true,

      zLevel:
        -1,
    });
  }
}
