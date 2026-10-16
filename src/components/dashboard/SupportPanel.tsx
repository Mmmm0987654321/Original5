/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { HelpCircle, ChevronDown, Terminal, BookOpen, Send, Mail, CheckCircle, Paperclip, Image as ImageIcon, X, ExternalLink } from "lucide-react";

interface SupportPanelProps {
  initialTab?: "faq" | "support";
}

export default function SupportPanel({ initialTab = "faq" }: SupportPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"faq" | "support">(initialTab);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  
  // Support state
  const [ticketReason, setTicketReason] = useState("Deposit / Withdrawal Issue");
  const [ticketMsg, setTicketMsg] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const OFFICIAL_EMAIL = "hidedex.com@gmail.com";

  const ISSUE_REASONS = [
    "Deposit / Withdrawal Issue",
    "Order Execution / Trading Query",
    "Wallet Connection / Signature Problem",
    "Airdrop / Points Query",
    "Security & Account Safety",
    "Bug Report / Technical Glitch",
    "Other General Inquiry",
  ];

  const faqItems = [
    {
      q: "HideDex kya hai aur yeh kaise kaam karta hai?",
      a: "HideDex (hidedex.com) spot aur perpetual trading ke liye ek wallet-connected interface hai. Saari liquidity aur order settlement real decentralized network par hoti hai jabki aapko custom luxury branding aur ultra-low latency terminal support milta hai.",
    },
    {
      q: "Kya trading shuru karne ke liye gas fees ki zaroorat hai?",
      a: "Nahi. HideDex completely off-chain gasless cryptographic signatures par chalta hai. Aapko sirf initial clearing fund deposit karne ke waqt normal gas lagti hai, uske baad trading contracts execute karna bilkul free aur instant hai.",
    },
    {
      q: "Wallet Signature verify karna kyun zaroorat hai?",
      a: "HideDex network gasless operations aur instant settlement enable karne ke liye aapke wallet se cryptographic ownership verify karta hai via EIP-712. Yeh signature completely gasless aur safe hai, jisse trading orders secure aur authorize ho jate hain.",
    },
    {
      q: "Mere funds kahan store hote hain? Kya platform custodial hai?",
      a: "Bilkul nahi. HideDex poori tarah non-custodial hai. Aapka fund hamesha smart-contracts and decentralized vault chains par securely locked rehta hai. Kisi bhi point par platform moderators ya servers aapke funds control nahi kar sakte.",
    },
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setAttachedImagePreview(null);
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketMsg) return;

    const subject = encodeURIComponent(`[HideDex Support] - ${ticketReason}`);
    const imageInfo = attachedImage ? `\n\n[Attached Screenshot: ${attachedImage.name}]` : "";
    const bodyText = encodeURIComponent(
      `Support Category: ${ticketReason}\n\nMessage:\n${ticketMsg}${imageInfo}\n\nSent from HideDex App Platform (hidedex.com)`
    );

    // Open direct Gmail composer
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${OFFICIAL_EMAIL}&su=${subject}&body=${bodyText}`;
    window.open(gmailUrl, "_blank");

    setTicketSuccess(true);
    setTimeout(() => {
      setTicketSuccess(false);
      setTicketMsg("");
      setAttachedImage(null);
      setAttachedImagePreview(null);
    }, 4000);
  };

  return (
    <div className="space-y-2" id="support-docs-panel">
      {/* Category selector */}
      <div className="flex bg-brand-overlay-subtle rounded-xl p-1 border border-brand-border w-full">
        {(["faq", "support"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
              activeSubTab === tab ? "bg-brand-overlay-normal text-brand-text" : "text-gray-400 hover:text-brand-text"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="w-full pt-1">
        {/* FAQ View */}
        {activeSubTab === "faq" && (
          <div className="space-y-1.5">
            <h3 className="font-display font-bold text-base text-brand-text mb-2 text-center">Frequently Asked Questions</h3>
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div 
                  key={idx} 
                  className="glass-panel rounded-xl border border-brand-border hover:border-brand-border overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex justify-between items-center p-5 text-left text-sm font-semibold text-brand-text focus:outline-none"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="p-5 pt-0 text-xs text-gray-400 leading-relaxed border-t border-brand-border font-sans">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Support Tickets Form */}
        {activeSubTab === "support" && (
          <div className="glass-panel rounded-xl p-4 border border-brand-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-lg text-brand-text flex items-center gap-2">
                <Mail className="w-5 h-5 text-violet-400" />
                Direct Support Desk
              </h3>
              <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded">
                Official: {OFFICIAL_EMAIL}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Have a question or encounter an issue? Select your reason, write details, attach a screenshot, and send directly to our official support Gmail <span className="text-violet-400 font-mono font-bold">{OFFICIAL_EMAIL}</span>.
            </p>

            <form onSubmit={handleSupportSubmit} className="space-y-4">
              {/* Reason Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Select Issue Reason / Category
                </label>
                <select
                  value={ticketReason}
                  onChange={(e) => setTicketReason(e.target.value)}
                  className="w-full bg-brand-surface border border-brand-border focus:border-violet-500 px-3.5 py-2.5 rounded-xl text-xs text-brand-text focus:outline-none cursor-pointer"
                >
                  {ISSUE_REASONS.map((reason) => (
                    <option key={reason} value={reason} className="bg-brand-bg text-brand-text">
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chat / Message Area */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Message / Issue Details
                </label>
                <textarea
                  value={ticketMsg}
                  onChange={(e) => setTicketMsg(e.target.value)}
                  rows={4}
                  className="w-full bg-brand-surface border border-brand-border focus:border-violet-500 px-3.5 py-2.5 rounded-xl text-xs text-brand-text focus:outline-none resize-none"
                  placeholder="Describe your issue, transaction hash, or question..."
                  required
                />
              </div>

              {/* Image Attachment Upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Attach Screenshot (Optional)
                </label>
                {!attachedImagePreview ? (
                  <label className="flex items-center justify-center gap-2 border border-dashed border-brand-border hover:border-violet-500/50 bg-brand-surface/50 p-3.5 rounded-xl cursor-pointer transition-colors group">
                    <Paperclip className="w-4 h-4 text-gray-400 group-hover:text-violet-400 transition-colors" />
                    <span className="text-xs text-gray-400 group-hover:text-brand-text font-medium">
                      Upload Screenshot or Image File
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative border border-brand-border rounded-xl p-2 bg-brand-surface flex items-center gap-3">
                    <img
                      src={attachedImagePreview}
                      alt="Attachment Preview"
                      className="w-12 h-12 object-cover rounded-lg border border-brand-border"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-brand-text truncate block">
                        {attachedImage?.name}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {attachedImage ? (attachedImage.size / 1024).toFixed(1) + " KB" : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="p-1 rounded-lg hover:bg-rose-500/10 text-rose-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {ticketSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Redirecting to Gmail compose for {OFFICIAL_EMAIL}...</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-brand-text font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                Send via Gmail ({OFFICIAL_EMAIL})
                <ExternalLink className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
