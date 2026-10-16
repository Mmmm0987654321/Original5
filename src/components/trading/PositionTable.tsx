/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Position, OpenOrder, TradeHistoryItem } from "../../types";
import { Trash2, AlertCircle, RefreshCw, Layers, Edit2, Check, X, Eye, Lock } from "lucide-react";
import { useTrustShield } from "../../lib/TrustShieldManager";
import { TrustShieldValue } from "../common/TrustShieldValue";
import TpSlModal from "./TpSlModal";
import ClosePositionModal from "./ClosePositionModal";

function normalizePortfolioCoinKey(v?: string | null): string {
  return String(v ?? '').trim().toUpperCase();
}

function findPositionForSymbol(
  positionsList: Position[],
  symbol: string
): Position | undefined {
  const target = normalizePortfolioCoinKey(symbol);
  if (!target) return undefined;

  return positionsList.find(
    (p) =>
      normalizePortfolioCoinKey(p?.sourceCoin || p?.symbol) === target
  );
}

interface PositionTableProps {
  isPerp: boolean;
  positions: Position[];
  openOrders: OpenOrder[];
  tradeHistory: TradeHistoryItem[];
  onCancelOrder?: (id: string) => Promise<void> | void;
  onClosePosition?: (
    position: Position,
    closePercent: number
  ) => Promise<void> | void;
  onModifyOrder?: (id: string, newPrice: number, newSize: number) => Promise<void> | void;
  onSavePositionTpSl?: (position: Position, tpPrice: number | null, slPrice: number | null) => Promise<void> | void;
  initialTab?: "POSITIONS" | "OPEN_ORDERS" | "HISTORY";
}

export default function PositionTable({
  isPerp,
  positions,
  openOrders,
  tradeHistory,
  onCancelOrder = () => {},
  onClosePosition,
  onModifyOrder = () => {},
  onSavePositionTpSl,
  initialTab = "POSITIONS",
}: PositionTableProps) {
  const [activeSubTab, setActiveSubTab] = useState<"POSITIONS" | "OPEN_ORDERS" | "HISTORY">(initialTab);

  const { isFieldHidden, toggleTempReveal } = useTrustShield();

  const isPositionsHidden = isFieldHidden("positionHistory");
  const isOrdersHidden = isFieldHidden("orderHistory");
  const isHistoryHidden = isFieldHidden("tradeHistory");

  const renderShieldPlaceholder = (fieldKey: string, label: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500 animate-in fade-in duration-150 w-full">
      <div className="p-3 bg-accent/5 border border-accent/20 text-accent rounded-full mb-3">
        <Lock className="w-6 h-6" />
      </div>
      <p className="text-xs font-bold text-brand-text mb-1 uppercase tracking-wider">{label} Hidden</p>
      <p className="text-[10px] text-gray-400 mb-4 max-w-[240px] text-center leading-normal">
        This information is currently masked by Trust Shield privacy settings.
      </p>
      <button
        type="button"
        onClick={() => toggleTempReveal(fieldKey)}
        className="px-4 py-2 bg-accent hover:opacity-90 text-brand-bg font-black text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-accent/5 border-none"
      >
        <Eye className="w-3.5 h-3.5" /> Temporarily Reveal
      </button>
    </div>
  );

  // TP/SL Modal state
  const [selectedTpSlPosition, setSelectedTpSlPosition] = useState<Position | null>(null);
  // Close Position Modal state
  const [selectedClosePosition, setSelectedClosePosition] = useState<Position | null>(null);

  const handleOpenTpSlModal = (pos: Position) => {
    setSelectedTpSlPosition(pos);
  };

  const handleSaveTpSl = async (tpPrice: number | null, slPrice: number | null) => {
    if (!selectedTpSlPosition) return;
    if (onSavePositionTpSl) {
      await onSavePositionTpSl(selectedTpSlPosition, tpPrice, slPrice);
    }
    setSelectedTpSlPosition(null);
  };

  React.useEffect(() => {
    setActiveSubTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (isHistoryHidden && activeSubTab === "HISTORY") {
      setActiveSubTab("POSITIONS");
    }
  }, [isHistoryHidden, activeSubTab]);
  
  // Inline editing state for orders
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEditing = (ord: OpenOrder) => {
    const triggerPx =
      typeof ord.triggerPrice === "number"
        ? ord.triggerPrice
        : NaN;

    const isTriggerEdit =
      (
        ord.isTrigger === true ||
        Number.isFinite(triggerPx)
      ) &&
      Number.isFinite(triggerPx) &&
      triggerPx > 0;

    const isRegularLimit =
      ord.type === "LIMIT" &&
      !isTriggerEdit;

    const isModifiable =
      isRegularLimit ||
      isTriggerEdit;

    if (!isModifiable) return;

    setEditingOrderId(ord.id);

    const initialPrice =
      isTriggerEdit && Number.isFinite(triggerPx) && triggerPx > 0
        ? triggerPx
        : ord.price;

    setEditPrice(initialPrice.toString());

    let szNum = ord.size;
    if (isTriggerEdit && (!Number.isFinite(szNum) || szNum <= 0)) {
      const orderCoin = ord.sourceCoin || ord.symbol;
      const matchingPos = findPositionForSymbol(positions, orderCoin);
      if (matchingPos && Number.isFinite(matchingPos.size) && matchingPos.size > 0) {
        szNum = matchingPos.size;
      }
    }

    setEditSize(
      Number.isFinite(szNum) && szNum > 0
        ? String(szNum)
        : (ord.size ? String(ord.size) : "")
    );
    setEditError(null);
  };

  const cancelEditing = () => {
    if (editSaving) return;
    setEditingOrderId(null);
    setEditError(null);
  };

  const saveEdit = async (id: string) => {
    const p = parseFloat(editPrice);
    const s = parseFloat(editSize);
    if (isNaN(p) || p <= 0) {
      setEditError("Price must be greater than 0");
      return;
    }
    if (isNaN(s) || s <= 0) {
      setEditError("Size must be greater than 0");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await onModifyOrder(id, p, s);
      setEditingOrderId(null);
      setEditError(null);
    } catch (err: any) {
      setEditError(err?.message ? String(err.message) : "Failed to modify order");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 overflow-hidden flex flex-col justify-between" id="trading-dashboard-manager">
      {/* Sub tabs switching */}
      <div className="flex items-center justify-between border-b border-brand-border pb-3 mb-4">
        <div className="flex gap-4">
          {isPerp && (
            <button
              onClick={() => setActiveSubTab("POSITIONS")}
              className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative cursor-pointer ${
                activeSubTab === "POSITIONS" ? "text-violet-400" : "text-gray-400 hover:text-brand-text"
              }`}
            >
              Positions ({positions.length})
              {activeSubTab === "POSITIONS" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500 rounded-full" />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveSubTab("OPEN_ORDERS")}
            className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative cursor-pointer ${
              activeSubTab === "OPEN_ORDERS" || (!isPerp && activeSubTab === "POSITIONS") ? "text-violet-400" : "text-gray-400 hover:text-brand-text"
            }`}
          >
            Open Orders ({openOrders.length})
            {(activeSubTab === "OPEN_ORDERS" || (!isPerp && activeSubTab === "POSITIONS")) && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500 rounded-full" />
            )}
          </button>

          {!isHistoryHidden && (
            <button
              onClick={() => setActiveSubTab("HISTORY")}
              className={`pb-3 text-xs font-bold tracking-wider uppercase transition-all relative cursor-pointer ${
                activeSubTab === "HISTORY" ? "text-violet-400" : "text-gray-400 hover:text-brand-text"
              }`}
            >
              Trading History ({tradeHistory.length})
              {activeSubTab === "HISTORY" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-violet-500 rounded-full" />
              )}
            </button>
          )}
        </div>

        <button className="text-gray-500 hover:text-brand-text transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main tables views */}
      <div className="overflow-x-auto min-h-[180px]">
        {/* Render Perp Positions */}
        {isPerp && activeSubTab === "POSITIONS" && (
          isPositionsHidden ? (
            renderShieldPlaceholder("positionHistory", "Leveraged Positions")
          ) : positions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <Layers className="w-8 h-8 text-brand-text/10 mb-2" />
              <p className="text-xs">No active leveraged positions currently held.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full pr-1 overflow-y-auto max-h-[420px] scrollbar-thin scrollbar-thumb-brand-border/60 scrollbar-track-transparent" id="positions-card-container">
              {positions.map((pos) => {
                const isLong = pos.type === "LONG";
                const positionValue = pos.size * pos.markPrice;
                
                const realizedPnl = pos.realizedPnl !== undefined ? pos.realizedPnl : (pos.fees ? -pos.fees : null);
                const marginRatio = pos.marginRatio;

                return (
                  <div 
                    key={pos.id}
                    className="bg-brand-card hover:bg-brand-surface border border-brand-border/60 hover:border-brand-primary/30 rounded-xl p-3 md:p-4 transition-all duration-150 shadow-md flex flex-col gap-3 w-full text-xs font-mono text-left text-brand-sub"
                    id={`pos-card-${pos.id}`}
                  >
                    {/* Header Row: Symbol, Size, Direction, Leverage Badge & PnL */}
                    <div className="flex items-center justify-between border-b border-brand-divider/30 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          pos.symbol === "BTC" ? "bg-[#f7931a]" :
                          pos.symbol === "ETH" ? "bg-[#627eea]" :
                          pos.symbol === "SOL" ? "bg-[#9945ff]" : "bg-cyan-400"
                        }`} />
                        <span className="font-bold text-[13px] text-brand-text tracking-tight">{pos.symbol}-PERP</span>
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-black tracking-wider ${
                          isLong ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"
                        }`}>
                          {pos.type}
                        </span>
                        <span className="text-[9px] text-brand-muted font-bold bg-brand-overlay-subtle px-1.5 py-0.2 rounded border border-brand-border/30">
                          {pos.marginType === 'isolated' ? 'Isolated' : pos.marginType === 'cross' ? 'Cross' : '--'} {Number.isFinite(pos.leverage) && pos.leverage > 0 ? `${pos.leverage}x` : '--'}
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-[13px] font-bold tracking-tight ${pos.unrealizedPnl >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
                          <TrustShieldValue fieldKey="pnl" value={`${pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(2)} USDC`} />
                        </div>
                        <div className={`text-[9px] font-bold ${pos.unrealizedPnlPercent >= 0 ? "text-pnl-profit" : "text-pnl-loss"}`}>
                          ROI: <TrustShieldValue fieldKey="pnl" value={`${pos.unrealizedPnlPercent >= 0 ? "+" : ""}${pos.unrealizedPnlPercent.toFixed(2)}%`} />
                        </div>
                      </div>
                    </div>

                    {/* Technical Position Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-[11px] text-brand-sub">
                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Position Size</span>
                        <span className="font-semibold text-brand-text">
                          {pos.size} {pos.symbol} <span className="text-[10px] text-brand-muted">($<TrustShieldValue fieldKey="portfolio" value={(pos.size * pos.entryPrice).toLocaleString(undefined, { maximumFractionDigits: 1 })} />)</span>
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Margin (USDC)</span>
                        <span className="font-semibold text-brand-text">
                          $<TrustShieldValue fieldKey="margin" value={pos.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                        </span>
                      </div>

                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Margin Ratio</span>
                        <span className={`font-bold ${
                          marginRatio !== undefined ? (marginRatio > 80 ? "text-brand-loss animate-pulse" : marginRatio > 50 ? "text-amber-400" : "text-brand-profit") : "text-brand-muted"
                        }`}>
                          {marginRatio !== undefined ? `${marginRatio.toFixed(2)}%` : "--"}
                        </span>
                      </div>

                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Realized PNL</span>
                        <span className={`font-semibold ${realizedPnl !== null ? (realizedPnl >= 0 ? "text-pnl-profit" : "text-pnl-loss") : "text-brand-muted"}`}>
                          {realizedPnl !== null ? (
                            <TrustShieldValue fieldKey="pnl" value={`${realizedPnl >= 0 ? "+" : ""}${realizedPnl.toFixed(2)} USDC`} />
                          ) : (
                            "--"
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Entry Price</span>
                        <span className="font-semibold text-brand-text">
                          $<TrustShieldValue fieldKey="entryPrice" value={pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })} />
                        </span>
                      </div>

                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Mark Price</span>
                        <span className="font-semibold text-brand-text">
                          {Number.isFinite(pos.markPrice) && pos.markPrice > 0 ? (
                            <>$<TrustShieldValue fieldKey="markPrice" value={pos.markPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })} /></>
                          ) : (
                            "--"
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">Liquidation Price</span>
                        <span className="font-bold text-brand-loss">
                          <TrustShieldValue fieldKey="liqPrice" value={pos.liqPrice > 0 ? `$${pos.liqPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : "None"} />
                        </span>
                      </div>

                      <div>
                        <span className="text-brand-muted block mb-0.5 uppercase text-[8px] font-bold tracking-wider">TP / SL Target</span>
                        <span className="font-semibold text-brand-text">
                          {(() => {
                            const posKey = pos.sourceCoin || pos.symbol;
                            const matchingTriggers = posKey
                              ? openOrders.filter((order) => {
                                  if (order.isSpot === true) return false;
                                  if (order.tpsl !== "tp" && order.tpsl !== "sl") return false;
                                  const ordKey = order.sourceCoin || order.symbol;
                                  return (
                                    String(ordKey ?? "").trim().toUpperCase() ===
                                    String(posKey ?? "").trim().toUpperCase()
                                  );
                                })
                              : [];

                            if (matchingTriggers.length === 0) {
                              return <span className="text-brand-muted">Not set</span>;
                            }

                            return (
                              <span className="flex flex-wrap gap-x-2">
                                {matchingTriggers.map((trig) => {
                                  const isTp = trig.tpsl === "tp";
                                  const hasPrice = typeof trig.triggerPrice === "number" && Number.isFinite(trig.triggerPrice);
                                  const priceStr = hasPrice ? `$${trig.triggerPrice!.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : "--";

                                  return (
                                    <span key={trig.id} className={isTp ? "text-brand-profit" : "text-brand-loss"}>
                                      {isTp ? "TP" : "SL"}: {priceStr}
                                    </span>
                                  );
                                })}
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                    </div>

                    {/* Compact Center-Aligned Action Buttons */}
                    <div className="flex items-center gap-2 border-t border-brand-divider/30 pt-2.5 mt-0.5">
                      <button
                        onClick={() => handleOpenTpSlModal(pos)}
                        className="flex-1 py-1.5 px-2 text-[10px] md:text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 hover:bg-brand-primary hover:text-brand-bg rounded-lg border border-brand-primary/20 transition-all duration-150 cursor-pointer text-center select-none"
                      >
                        TP/SL
                      </button>
                      
                      <button
                        onClick={() => setSelectedClosePosition(pos)}
                        className="flex-1 py-1.5 px-2 text-[10px] md:text-xs font-bold uppercase tracking-wider text-brand-loss bg-brand-loss/10 hover:bg-brand-loss hover:text-brand-bg rounded-lg border border-brand-loss/20 transition-all duration-150 cursor-pointer text-center select-none"
                      >
                        Close Position
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Render Open Orders */}
        {(activeSubTab === "OPEN_ORDERS" || (!isPerp && activeSubTab === "POSITIONS")) && (
          isOrdersHidden ? (
            renderShieldPlaceholder("orderHistory", "Open Orders")
          ) : openOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-brand-muted">
              <AlertCircle className="w-8 h-8 text-brand-text/10 mb-2" />
              <p className="text-xs">No pending open limit order book records found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
                  <th className="py-2.5">Symbol</th>
                  <th className="py-2.5">Type</th>
                  <th className="py-2.5">Side</th>
                  <th className="py-2.5">Price</th>
                  <th className="py-2.5">Size</th>
                  <th className="py-2.5">Filled</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-divider/30 text-xs font-mono text-brand-sub">
                {openOrders.map((ord) => {
                  const isBuy = ord.side === "BUY";
                  const isEditing = editingOrderId === ord.id;
                  const triggerPx =
                    typeof ord.triggerPrice === "number"
                      ? ord.triggerPrice
                      : NaN;

                  const isTriggerEdit =
                    (
                      ord.isTrigger === true ||
                      Number.isFinite(triggerPx)
                    ) &&
                    Number.isFinite(triggerPx) &&
                    triggerPx > 0;

                  const isRegularLimit =
                    ord.type === "LIMIT" &&
                    !isTriggerEdit;

                  const isModifiable =
                    isRegularLimit ||
                    isTriggerEdit;

                  const orderTpsl = ord.tpsl;
                  const orderTriggerPx = ord.triggerPrice;
                  const isTpSlOrder =
                    orderTpsl === "tp" ||
                    orderTpsl === "sl" ||
                    (
                      typeof orderTriggerPx === "number" &&
                      Number.isFinite(orderTriggerPx) &&
                      orderTriggerPx > 0
                    );

                  const orderCoin = ord.sourceCoin || ord.symbol;
                  const posForOrder = isTpSlOrder
                    ? findPositionForSymbol(positions, orderCoin)
                    : undefined;

                  const rawSize =
                    typeof ord.size === "number" &&
                    Number.isFinite(ord.size)
                      ? ord.size
                      : 0;

                  const numericPositionSize =
                    typeof posForOrder?.size === "number" && Number.isFinite(posForOrder.size)
                      ? Math.abs(posForOrder.size)
                      : 0;

                  const rawPositionSize =
                    Math.abs(
                      parseFloat(
                        posForOrder?.rawSzi ?? "0"
                      )
                    ) || 0;

                  const positionSize =
                    numericPositionSize > 0
                      ? numericPositionSize
                      : rawPositionSize;

                  const displaySize =
                    isTpSlOrder &&
                    rawSize === 0 &&
                    positionSize > 0
                      ? positionSize
                      : rawSize;

                  const displayPrice =
                    isTpSlOrder &&
                    typeof orderTriggerPx === "number" &&
                    Number.isFinite(orderTriggerPx) &&
                    orderTriggerPx > 0
                      ? orderTriggerPx
                      : ord.price;

                  const displayType =
                    orderTpsl === "tp"
                      ? "Take Profit"
                      : orderTpsl === "sl"
                        ? "Stop Loss"
                        : ord.type;

                  return (
                    <React.Fragment key={ord.id}>
                      <tr className="hover:bg-brand-overlay-subtle transition-colors">
                        <td className="py-3 font-semibold text-brand-text">{ord.symbol}</td>
                        <td className="py-3 text-brand-sub">{displayType}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBuy ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>
                            {ord.side}
                          </span>
                        </td>
                        
                        {/* Price column - editable */}
                        <td className="py-3 text-brand-sub">
                          {isEditing ? (
                            <input
                              type="number"
                              disabled={editSaving}
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="bg-brand-overlay-normal border border-brand-border rounded px-1.5 py-0.5 text-brand-text font-mono w-24 text-xs focus:outline-none focus:border-brand-primary disabled:opacity-50"
                            />
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span>${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              {isTpSlOrder && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-violet-500/10 text-violet-400 font-bold border border-violet-500/20">
                                  Trigger
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                        {/* Size column - editable */}
                        <td className="py-3 text-brand-sub">
                          {isEditing ? (
                            <input
                              type="number"
                              disabled={editSaving}
                              value={editSize}
                              onChange={(e) => setEditSize(e.target.value)}
                              className="bg-brand-overlay-normal border border-brand-border rounded px-1.5 py-0.5 text-brand-text font-mono w-20 text-xs focus:outline-none focus:border-brand-primary disabled:opacity-50"
                            />
                          ) : (
                            `${displaySize} ${ord.symbol}`
                          )}
                        </td>

                        <td className="py-3 text-brand-muted">{typeof ord.filled === "number" ? `${ord.filled.toFixed(1)}%` : "--"}</td>
                        <td className="py-3 text-brand-sub">
                          <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] rounded font-semibold border border-yellow-500/5">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {isEditing ? (
                            <div className="flex gap-1 justify-end items-center">
                              <button
                                onClick={() => saveEdit(ord.id)}
                                disabled={editSaving}
                                className="p-1.5 rounded bg-brand-profit/10 text-brand-profit hover:bg-brand-profit hover:text-brand-bg transition-all cursor-pointer disabled:opacity-50"
                                title="Save Changes"
                              >
                                {editSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={editSaving}
                                className="p-1.5 rounded bg-brand-overlay-subtle text-brand-muted hover:text-brand-text transition-all cursor-pointer disabled:opacity-50"
                                title="Cancel Edit"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end">
                              {isModifiable && (
                                <button
                                  onClick={() => startEditing(ord)}
                                  className="p-1.5 rounded bg-brand-overlay-subtle hover:bg-brand-overlay-normal text-brand-muted hover:text-brand-text transition-all cursor-pointer"
                                  title="Modify Order"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => onCancelOrder(ord.id)}
                                className="p-1.5 rounded bg-brand-overlay-subtle hover:bg-brand-loss/10 text-brand-muted hover:text-brand-loss transition-all cursor-pointer"
                                title="Cancel Order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && editError && (
                        <tr>
                          <td colSpan={8} className="py-1 px-2 text-right text-[11px] text-brand-loss bg-brand-loss/10">
                            {editError}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {/* Render Historical Trades */}
        {activeSubTab === "HISTORY" && !isHistoryHidden && (
          tradeHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-brand-muted">
              <AlertCircle className="w-8 h-8 text-brand-text/10 mb-2" />
              <p className="text-xs">No historical trades found for this address.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-[10px] font-mono text-brand-muted uppercase border-b border-brand-border pb-2">
                  <th className="py-2.5">ID</th>
                  <th className="py-2.5">Symbol</th>
                  <th className="py-2.5">Side</th>
                  <th className="py-2.5">Price</th>
                  <th className="py-2.5">Size</th>
                  <th className="py-2.5">Value (USDC)</th>
                  <th className="py-2.5">Protocol Fee</th>
                  <th className="py-2.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-divider/30 text-xs font-mono text-brand-sub">
                {tradeHistory.map((tr) => {
                  const isBuy = tr.side === "BUY";
                  return (
                    <tr key={tr.id} className="hover:bg-brand-overlay-subtle transition-colors text-brand-sub">
                      <td className="py-3 text-brand-muted">#{tr.id.slice(0, 6)}</td>
                      <td className="py-3 font-semibold text-brand-text">{tr.symbol}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isBuy ? "bg-brand-profit/10 text-brand-profit border border-brand-profit/20" : "bg-brand-loss/10 text-brand-loss border border-brand-loss/20"}`}>
                          {tr.side}
                        </span>
                      </td>
                      <td className="py-3">${tr.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3">{tr.size} {tr.symbol}</td>
                      <td className="py-3">${tr.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 text-violet-400">${tr.fee.toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                      <td className="py-3 text-right text-brand-muted">{tr.timestamp}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* TAKE PROFIT / STOP LOSS MODAL */}
      {selectedTpSlPosition && (
        <TpSlModal
          position={selectedTpSlPosition}
          openOrders={openOrders}
          onClose={() => setSelectedTpSlPosition(null)}
          onSave={handleSaveTpSl}
          onCancelOrder={onCancelOrder}
        />
      )}

      {/* CLOSE POSITION MODAL */}
      {selectedClosePosition && (
        <ClosePositionModal
          position={positions.find(p => p.id === selectedClosePosition.id) || selectedClosePosition}
          onClose={() => setSelectedClosePosition(null)}
          onConfirmClose={(position, closePercent) => {
            if (onClosePosition) {
              return onClosePosition(position, closePercent);
            }
          }}
        />
      )}
    </div>
  );
}
