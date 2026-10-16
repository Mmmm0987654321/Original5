import React from "react";

export type TradingTabId = "BALANCES" | "POSITIONS" | "OPEN_ORDERS" | "TRADE_HISTORY";

/** The exact HideDex account tabs presentation is shared by Hyperliquid and Lighter.
 * Exchange-specific account data belongs to the parent, not this UI component.
 */
export default function TradingAccountTabBar({
  activeTab, onSelect, positionsCount, ordersCount, isFieldHidden,
}: {
  activeTab: TradingTabId;
  onSelect: (tab: TradingTabId) => void;
  positionsCount?: number;
  ordersCount?: number;
  isFieldHidden?: (field: string) => boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-brand-border px-2 py-1.5 bg-brand-surface/20">
            <div 
              className="flex items-center overflow-x-auto whitespace-nowrap gap-1.5 py-0.5 px-1 scrollbar-none flex-1 max-w-[92%]"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {[
                { id: "BALANCES" as const, name: "Balances", field: "balances" },
                { id: "POSITIONS" as const, name: "Positions", field: "positions" },
                { id: "OPEN_ORDERS" as const, name: "Open Orders", field: "openOrders" },
                { id: "TRADE_HISTORY" as const, name: "Trade History", field: "tradeHistory" },
              ].filter(tab => !isFieldHidden || !isFieldHidden(tab.field)).map((tab) => {
                const isSelected = activeTab === tab.id;
                let labelSuffix = "";
                if (tab.id === "POSITIONS" && positionsCount !== undefined) labelSuffix = ` (${positionsCount})`;
                else if (tab.id === "OPEN_ORDERS" && ordersCount !== undefined) labelSuffix = ` (${ordersCount})`;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelect(tab.id)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer select-none shrink-0 ${
                      isSelected
                        ? "border font-extrabold"
                        : "border border-brand-border/30 hover:bg-brand-overlay-subtle text-gray-400 hover:text-brand-text"
                    }`}
                    style={isSelected ? {
                      backgroundColor: "var(--accent-primary)",
                      borderColor: "var(--accent-primary)",
                      color: "var(--bg-main, #060608)"
                    } : undefined}
                  >
                    {tab.name}{labelSuffix}
                  </button>
                );
              })}
            </div>
          </div>
  );
}
