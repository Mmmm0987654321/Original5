import { ShareCardPreset, ShareCardData, ShareCardConfig, SHARE_CARD_PRESETS } from "./ShareCardTemplates";

// Helper function to calculate background relative luminance for contrast adaptation
function getLuminance(hex: string): number {
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  if (cleanHex.length !== 6) return 0; // fallback to dark
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  const a = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  data: ShareCardData,
  config: ShareCardConfig,
  currentWindowWidth?: number
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Detect dynamic layout mode
  const widthVal = typeof window !== "undefined" ? window.innerWidth : 1200;
  const screenWidth = currentWindowWidth !== undefined ? currentWindowWidth : widthVal;
  
  const layout: "portrait" | "square" | "landscape" =
    config.exportFormat !== "auto"
      ? (config.exportFormat as "portrait" | "square" | "landscape")
      : screenWidth < 640
      ? "portrait"
      : screenWidth < 1024
      ? "square"
      : "landscape";

  // Set crisp base canvas dimensions based on chosen layout
  const baseWidth = layout === "portrait" ? 1080 : layout === "square" ? 1200 : 1600;
  const baseHeight = layout === "portrait" ? 1350 : layout === "square" ? 1200 : 900; // Shorter portrait height (1350 instead of 1440) for a perfectly proportional card

  const scale = 3; // 3x scale factor for absolute 4K crispness!
  const width = baseWidth;
  const height = baseHeight;

  canvas.width = baseWidth * scale;
  canvas.height = baseHeight * scale;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply 4K scaling
  ctx.scale(scale, scale);

  // 2. Retrieve preset
  const preset = SHARE_CARD_PRESETS.find((p) => p.id === config.presetId) || SHARE_CARD_PRESETS[0];

  // 3. Contrast Adaptation: Calculate luminance of chosen background color
  const rawBgColor = config.customBgColor || preset.bgColor;
  const bgLuminance = getLuminance(rawBgColor);
  const isLightBg = bgLuminance > 0.4;

  // Override text, muted, and border colors based on luminance for bulletproof accessibility contrast
  const textColor = config.customBgColor
    ? isLightBg
      ? "#0f172a"
      : "#ffffff"
    : preset.textColor;

  const mutedTextColor = config.customBgColor
    ? isLightBg
      ? "#475569"
      : "#94a3b8"
    : preset.mutedTextColor;

  const borderColor = config.customBgColor
    ? isLightBg
      ? "#cbd5e1"
      : "#1e293b"
    : preset.borderColor;

  // Base setup
  const accentColorInput = config.customAccentColor || preset.accentColor;
  const isProfit = data.unrealizedPnl >= 0;
  const pnlColor = isProfit ? "#00E878" : "#EF4444";
  
  // Use custom accent color if specified, otherwise fall back to green/red based on PnL performance
  let finalAccentColor = accentColorInput;
  if (!config.customAccentColor) {
    if (preset.id === "dark-pro" || preset.id === "light-pro" || preset.id === "glass-theme") {
      finalAccentColor = pnlColor;
    }
  }

  const borderRadiusNum = parseInt(config.customBorderRadius || preset.borderRadius) || 16;

  // Clip border radius
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(borderRadiusNum, 0);
  ctx.lineTo(width - borderRadiusNum, 0);
  ctx.quadraticCurveTo(width, 0, width, borderRadiusNum);
  ctx.lineTo(width, height - borderRadiusNum);
  ctx.quadraticCurveTo(width, height, width - borderRadiusNum, height);
  ctx.lineTo(borderRadiusNum, height);
  ctx.quadraticCurveTo(0, height, 0, height - borderRadiusNum);
  ctx.lineTo(0, borderRadiusNum);
  ctx.quadraticCurveTo(0, 0, borderRadiusNum, 0);
  ctx.closePath();
  ctx.clip();

  // 4. Paint Background
  if (config.customBgColor) {
    ctx.fillStyle = config.customBgColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    if (preset.id === "glass-theme") {
      const grad = ctx.createRadialGradient(150, 150, 50, width / 2, height / 2, width);
      grad.addColorStop(0, "#2c044d");
      grad.addColorStop(0.5, "#0b081c");
      grad.addColorStop(1, "#020008");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (preset.bgGradient.includes("linear-gradient")) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      if (preset.id === "dark-pro") {
        grad.addColorStop(0, "#080c16");
        grad.addColorStop(1, "#141924");
      } else if (preset.id === "light-pro") {
        grad.addColorStop(0, "#f8fafc");
        grad.addColorStop(1, "#e2e8f0");
      } else if (preset.id === "exchange-style") {
        grad.addColorStop(0, "#0a0d10");
        grad.addColorStop(1, "#1c2127");
      } else {
        grad.addColorStop(0, "#111827");
        grad.addColorStop(1, "#030712");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = rawBgColor;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 5. Grid/Patterns
  if (preset.gridLines) {
    ctx.strokeStyle = isLightBg ? "rgba(15, 23, 42, 0.03)" : "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = step; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = step; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  if (preset.showPattern && preset.id === "dark-pro") {
    ctx.fillStyle = isLightBg ? "rgba(15, 23, 42, 0.02)" : "rgba(0, 232, 120, 0.02)";
    for (let x = 30; x < width; x += 40) {
      for (let y = 30; y < height; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Outer stroke
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, width, height);

  // Typography utility with failsafe defaults
  const getFont = (size: number, weight = "normal", isMono = false) => {
    const family = isMono || preset.fontFamily.includes("Mono")
      ? "JetBrains Mono, SFMono-Regular, Consolas, Courier New, monospace"
      : "Inter, system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif";
    return `${weight} ${size}px ${family}`;
  };

  // 6. Draw Logo & Brand Header
  const drawLogoHeader = (x: number, y: number) => {
    ctx.save();
    ctx.fillStyle = finalAccentColor;
    ctx.beginPath();
    ctx.moveTo(x, y - 13);
    ctx.lineTo(x + 11, y);
    ctx.lineTo(x, y + 13);
    ctx.lineTo(x - 11, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = getFont(18, "900");
    ctx.fillText("HIDEDEX", x + 24, y + 5);

    ctx.fillStyle = mutedTextColor;
    ctx.font = getFont(11, "bold", true);
    ctx.fillText("DECENTRALIZED L1 PERPETUAL & SPOT EXCHANGE", x + 24, y + 19);
    ctx.restore();
  };

  // 7. Render Layout Specific Components (Adaptive Positioning & No-Overlap)
  if (layout === "portrait") {
    // === PORTRAIT LAYOUT (1080 x 1350) ===
    const paddingX = 90;
    
    // Logo (top-left)
    drawLogoHeader(paddingX + 11, 100);

    // Symbol and Side Badges Y = 220
    ctx.fillStyle = textColor;
    ctx.font = getFont(54, "900");
    const assetText = `${data.symbol}-PERP`;
    ctx.fillText(assetText, paddingX, 220);

    const assetWidth = ctx.measureText(assetText).width;
    const badgeX = paddingX + assetWidth + 24;
    const badgeY = 220 - 46;
    const badgeW = 110;
    const badgeH = 46;

    // Side Badge (LONG / SHORT)
    ctx.fillStyle = data.type === "LONG" ? "rgba(0, 232, 120, 0.12)" : "rgba(239, 68, 68, 0.12)";
    ctx.strokeStyle = data.type === "LONG" ? "rgba(0, 232, 120, 0.3)" : "rgba(239, 68, 68, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8) : ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = data.type === "LONG" ? "#00E878" : "#EF4444";
    ctx.font = getFont(18, "900");
    ctx.textAlign = "center";
    ctx.fillText(data.type, badgeX + badgeW / 2, badgeY + 29);
    ctx.textAlign = "left";

    // Leverage Badge
    if (config.showLeverage) {
      const levX = badgeX + badgeW + 16;
      const levW = 100;
      const levH = 46;
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
      ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(levX, badgeY, levW, levH, 8) : ctx.rect(levX, badgeY, levW, levH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#A78BFA";
      ctx.font = getFont(16, "bold", true);
      ctx.textAlign = "center";
      ctx.fillText(`${data.leverage}x`, levX + levW / 2, badgeY + 29);
      ctx.textAlign = "left";
    }

    // User Profile Card row Y = 310 (Only drawn if username or wallet is shown)
    const showProfile = (config.showUsername && data.username) || (config.showWallet && data.walletAddress);
    if (showProfile) {
      const avatarX = paddingX + 24;
      const avatarY = 320;
      const radius = 26;

      // Draw avatar background gradient circle
      const avatarGrad = ctx.createLinearGradient(avatarX - radius, avatarY - radius, avatarX + radius, avatarY + radius);
      avatarGrad.addColorStop(0, "#8B5CF6");
      avatarGrad.addColorStop(1, "#3B82F6");
      ctx.fillStyle = avatarGrad;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Write initial in center
      const initial = (data.username ? data.username[0] : (data.walletAddress ? data.walletAddress[2] : "A")).toUpperCase();
      ctx.fillStyle = "#ffffff";
      ctx.font = getFont(18, "bold", true);
      ctx.textAlign = "center";
      ctx.fillText(initial, avatarX, avatarY + 6);
      ctx.textAlign = "left"; // reset

      // Username & Wallet text on the right
      const textStartX = avatarX + radius + 18;
      if (config.showUsername && data.username) {
        ctx.fillStyle = textColor;
        ctx.font = getFont(20, "900");
        ctx.fillText(data.username, textStartX, avatarY - 2);

        if (config.showWallet && data.walletAddress) {
          ctx.fillStyle = mutedTextColor;
          ctx.font = getFont(12, "bold", true);
          const shortAddress = data.walletAddress.length > 12 
            ? `${data.walletAddress.slice(0, 10)}...${data.walletAddress.slice(-8)}`
            : data.walletAddress;
          ctx.fillText(shortAddress, textStartX, avatarY + 18);
        }
      } else if (config.showWallet && data.walletAddress) {
        ctx.fillStyle = textColor;
        ctx.font = getFont(14, "bold", true);
        ctx.fillText(data.walletAddress, textStartX, avatarY + 5);
      }
    }

    // Unrealized PnL block Y = 410
    ctx.fillStyle = mutedTextColor;
    ctx.font = getFont(14, "bold", true);
    ctx.fillText("UNREALIZED ROE & PERCENT", paddingX, 410);

    let currentY = 500;
    if (config.showPnlDollar) {
      ctx.fillStyle = pnlColor;
      ctx.font = getFont(86, "900");
      const dollarStr = `${isProfit ? "+" : "-"}$${Math.abs(data.unrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      ctx.fillText(dollarStr, paddingX, currentY);
      currentY += 80;
    }

    if (config.showPnlPercent) {
      ctx.fillStyle = pnlColor;
      ctx.font = getFont(54, "900");
      const pctStr = `${isProfit ? "+" : ""}${data.unrealizedPnlPercent.toFixed(2)}%`;
      ctx.fillText(pctStr, paddingX, currentY);
    }

    // Divider 1
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, 660);
    ctx.lineTo(width - paddingX, 660);
    ctx.stroke();

    // 3 Column Grid for cell details
    const drawCell = (x: number, y: number, label: string, val: string) => {
      ctx.fillStyle = mutedTextColor;
      ctx.font = getFont(13, "bold", true);
      ctx.fillText(label.toUpperCase(), x, y);

      ctx.fillStyle = textColor;
      ctx.font = getFont(24, "bold");
      ctx.fillText(val, x, y + 36);
    };

    const cells = [];
    if (config.showSize) {
      cells.push({ label: "Position Size", val: `${data.size.toLocaleString()} ${data.symbol}` });
    }
    const prec = data.symbol === "PURR" ? 4 : 2;
    if (config.showEntryPrice) {
      cells.push({
        label: "Entry Price",
        val: `$${data.entryPrice.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}`
      });
    }
    if (config.showMarkPrice) {
      cells.push({
        label: "Mark Price",
        val: `$${data.markPrice.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}`
      });
    }
    if (config.showMargin) {
      cells.push({
        label: "Margin Value",
        val: `$${data.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
      });
    }
    if (config.showVolume) {
      const vol = data.size * data.entryPrice;
      cells.push({
        label: "Total Volume",
        val: `$${vol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      });
    }

    // Place cells dynamically without gaps (3 columns)
    const colXList = [90, 410, 730];
    const rowYList = [730, 850];

    cells.forEach((cell, idx) => {
      const colIdx = idx % 3;
      const rowIdx = Math.floor(idx / 3);
      if (rowIdx < 2) {
        drawCell(colXList[colIdx], rowYList[rowIdx], cell.label, cell.val);
      }
    });

    // Divider 2
    ctx.beginPath();
    ctx.moveTo(paddingX, 970);
    ctx.lineTo(width - paddingX, 970);
    ctx.stroke();

    // Timestamp
    let dt = "";
    if (config.showDate && data.date) {
      dt = data.date;
      if (config.showTime && data.time) dt += ` ${data.time}`;
    } else if (config.showTime && data.time) {
      dt = data.time;
    }

    if (dt) {
      ctx.fillStyle = mutedTextColor;
      ctx.font = getFont(14, "bold", true);
      ctx.fillText(`Timestamp: ${dt}`, paddingX, 1040);
    }

    if (config.showWatermark) {
      ctx.fillStyle = isLightBg ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.08)";
      ctx.font = getFont(13, "bold", true);
      ctx.fillText("SHIELD PROTECTED DECENTRALIZED TRADING", paddingX, 1220);
    }
  } else if (layout === "square") {
    // === SQUARE LAYOUT (1200 x 1200) ===
    const paddingX = 90;
    
    // Logo (top-left)
    drawLogoHeader(paddingX + 11, 100);

    // Symbol and Side Badges Y = 210
    ctx.fillStyle = textColor;
    ctx.font = getFont(54, "900");
    const assetText = `${data.symbol}-PERP`;
    ctx.fillText(assetText, paddingX, 210);

    const assetWidth = ctx.measureText(assetText).width;
    const badgeX = paddingX + assetWidth + 24;
    const badgeY = 210 - 44;
    const badgeW = 110;
    const badgeH = 44;

    ctx.fillStyle = data.type === "LONG" ? "rgba(0, 232, 120, 0.12)" : "rgba(239, 68, 68, 0.12)";
    ctx.strokeStyle = data.type === "LONG" ? "rgba(0, 232, 120, 0.3)" : "rgba(239, 68, 68, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8) : ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = data.type === "LONG" ? "#00E878" : "#EF4444";
    ctx.font = getFont(18, "900");
    ctx.textAlign = "center";
    ctx.fillText(data.type, badgeX + badgeW / 2, badgeY + 28);
    ctx.textAlign = "left";

    if (config.showLeverage) {
      const levX = badgeX + badgeW + 16;
      const levW = 100;
      const levH = 44;
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
      ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(levX, badgeY, levW, levH, 8) : ctx.rect(levX, badgeY, levW, levH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#A78BFA";
      ctx.font = getFont(15, "bold", true);
      ctx.textAlign = "center";
      ctx.fillText(`${data.leverage}x`, levX + levW / 2, badgeY + 28);
      ctx.textAlign = "left";
    }

    // User Profile Card row Y = 290
    const showProfile = (config.showUsername && data.username) || (config.showWallet && data.walletAddress);
    if (showProfile) {
      const avatarX = paddingX + 24;
      const avatarY = 300;
      const radius = 26;

      const avatarGrad = ctx.createLinearGradient(avatarX - radius, avatarY - radius, avatarX + radius, avatarY + radius);
      avatarGrad.addColorStop(0, "#8B5CF6");
      avatarGrad.addColorStop(1, "#3B82F6");
      ctx.fillStyle = avatarGrad;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
      ctx.fill();

      const initial = (data.username ? data.username[0] : (data.walletAddress ? data.walletAddress[2] : "A")).toUpperCase();
      ctx.fillStyle = "#ffffff";
      ctx.font = getFont(18, "bold", true);
      ctx.textAlign = "center";
      ctx.fillText(initial, avatarX, avatarY + 6);
      ctx.textAlign = "left";

      const textStartX = avatarX + radius + 18;
      if (config.showUsername && data.username) {
        ctx.fillStyle = textColor;
        ctx.font = getFont(20, "900");
        ctx.fillText(data.username, textStartX, avatarY - 2);

        if (config.showWallet && data.walletAddress) {
          ctx.fillStyle = mutedTextColor;
          ctx.font = getFont(12, "bold", true);
          const shortAddress = data.walletAddress.length > 12 
            ? `${data.walletAddress.slice(0, 10)}...${data.walletAddress.slice(-8)}`
            : data.walletAddress;
          ctx.fillText(shortAddress, textStartX, avatarY + 18);
        }
      } else if (config.showWallet && data.walletAddress) {
        ctx.fillStyle = textColor;
        ctx.font = getFont(14, "bold", true);
        ctx.fillText(data.walletAddress, textStartX, avatarY + 5);
      }
    }

    // Unrealized PnL Y = 380
    ctx.fillStyle = mutedTextColor;
    ctx.font = getFont(14, "bold", true);
    ctx.fillText("UNREALIZED ROE & PERCENT", paddingX, 380);

    let currentY = 460;
    if (config.showPnlDollar) {
      ctx.fillStyle = pnlColor;
      ctx.font = getFont(86, "900");
      const dollarStr = `${isProfit ? "+" : "-"}$${Math.abs(data.unrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      ctx.fillText(dollarStr, paddingX, currentY);
      currentY += 80;
    }

    if (config.showPnlPercent) {
      ctx.fillStyle = pnlColor;
      ctx.font = getFont(54, "900");
      const pctStr = `${isProfit ? "+" : ""}${data.unrealizedPnlPercent.toFixed(2)}%`;
      ctx.fillText(pctStr, paddingX, currentY);
    }

    // Divider 1
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, 620);
    ctx.lineTo(width - paddingX, 620);
    ctx.stroke();

    // 3 Column Grid for cell details
    const drawCell = (x: number, y: number, label: string, val: string) => {
      ctx.fillStyle = mutedTextColor;
      ctx.font = getFont(13, "bold", true);
      ctx.fillText(label.toUpperCase(), x, y);

      ctx.fillStyle = textColor;
      ctx.font = getFont(24, "bold");
      ctx.fillText(val, x, y + 36);
    };

    const cells = [];
    if (config.showSize) {
      cells.push({ label: "Position Size", val: `${data.size.toLocaleString()} ${data.symbol}` });
    }
    const prec = data.symbol === "PURR" ? 4 : 2;
    if (config.showEntryPrice) {
      cells.push({
        label: "Entry Price",
        val: `$${data.entryPrice.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}`
      });
    }
    if (config.showMarkPrice) {
      cells.push({
        label: "Mark Price",
        val: `$${data.markPrice.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}`
      });
    }
    if (config.showMargin) {
      cells.push({
        label: "Margin Value",
        val: `$${data.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
      });
    }
    if (config.showVolume) {
      const vol = data.size * data.entryPrice;
      cells.push({
        label: "Total Volume",
        val: `$${vol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      });
    }

    // Place cells dynamically (3 columns)
    const colXList = [90, 460, 830];
    const rowYList = [690, 810];

    cells.forEach((cell, idx) => {
      const colIdx = idx % 3;
      const rowIdx = Math.floor(idx / 3);
      if (rowIdx < 2) {
        drawCell(colXList[colIdx], rowYList[rowIdx], cell.label, cell.val);
      }
    });

    // Divider 2
    ctx.beginPath();
    ctx.moveTo(paddingX, 930);
    ctx.lineTo(width - paddingX, 930);
    ctx.stroke();

    // Footer Row
    const footerY = 1010;
    let dt = "";
    if (config.showDate && data.date) {
      dt = data.date;
      if (config.showTime && data.time) dt += ` ${data.time}`;
    } else if (config.showTime && data.time) {
      dt = data.time;
    }

    if (dt) {
      ctx.fillStyle = mutedTextColor;
      ctx.font = getFont(14, "bold", true);
      ctx.fillText(`Timestamp: ${dt}`, paddingX, footerY);
    }

    if (config.showWatermark) {
      ctx.fillStyle = isLightBg ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.08)";
      ctx.font = getFont(12, "bold", true);
      ctx.fillText("SHIELD PROTECTED DECENTRALIZED TRADING", paddingX, footerY + 60);
    }
  } else {
    // === LANDSCAPE LAYOUT (1600 x 900) ===
    const paddingX = 110;
    
    // Logo (top-left)
    drawLogoHeader(paddingX + 11, 95);

    // Symbol and Badges Y = 200
    ctx.fillStyle = textColor;
    ctx.font = getFont(58, "900");
    const assetText = `${data.symbol}-PERP`;
    ctx.fillText(assetText, paddingX, 200);

    const assetWidth = ctx.measureText(assetText).width;
    const badgeX = paddingX + assetWidth + 24;
    const badgeY = 200 - 46;
    const badgeW = 110;
    const badgeH = 46;

    ctx.fillStyle = data.type === "LONG" ? "rgba(0, 232, 120, 0.12)" : "rgba(239, 68, 68, 0.12)";
    ctx.strokeStyle = data.type === "LONG" ? "rgba(0, 232, 120, 0.3)" : "rgba(239, 68, 68, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8) : ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = data.type === "LONG" ? "#00E878" : "#EF4444";
    ctx.font = getFont(18, "900");
    ctx.textAlign = "center";
    ctx.fillText(data.type, badgeX + badgeW / 2, badgeY + 29);
    ctx.textAlign = "left";

    if (config.showLeverage) {
      const levX = badgeX + badgeW + 16;
      const levW = 100;
      const levH = 46;
      ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
      ctx.strokeStyle = "rgba(139, 92, 246, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(levX, badgeY, levW, levH, 8) : ctx.rect(levX, badgeY, levW, levH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#A78BFA";
      ctx.font = getFont(15, "bold", true);
      ctx.textAlign = "center";
      ctx.fillText(`${data.leverage}x`, levX + levW / 2, badgeY + 29);
      ctx.textAlign = "left";
    }

    // User Profile Badge on the right in Landscape Y = 200
    const showProfile = (config.showUsername && data.username) || (config.showWallet && data.walletAddress);
    if (showProfile) {
      const avatarX = width - paddingX - 250;
      const avatarY = 180;
      const radius = 24;

      const avatarGrad = ctx.createLinearGradient(avatarX - radius, avatarY - radius, avatarX + radius, avatarY + radius);
      avatarGrad.addColorStop(0, "#8B5CF6");
      avatarGrad.addColorStop(1, "#3B82F6");
      ctx.fillStyle = avatarGrad;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, radius, 0, Math.PI * 2);
      ctx.fill();

      const initial = (data.username ? data.username[0] : (data.walletAddress ? data.walletAddress[2] : "A")).toUpperCase();
      ctx.fillStyle = "#ffffff";
      ctx.font = getFont(16, "bold", true);
      ctx.textAlign = "center";
      ctx.fillText(initial, avatarX, avatarY + 5);
      ctx.textAlign = "left";

      const textStartX = avatarX + radius + 14;
      if (config.showUsername && data.username) {
        ctx.fillStyle = textColor;
        ctx.font = getFont(18, "900");
        ctx.fillText(data.username, textStartX, avatarY - 2);

        if (config.showWallet && data.walletAddress) {
          ctx.fillStyle = mutedTextColor;
          ctx.font = getFont(11, "bold", true);
          const shortAddress = data.walletAddress.length > 12 
            ? `${data.walletAddress.slice(0, 8)}...${data.walletAddress.slice(-6)}`
            : data.walletAddress;
          ctx.fillText(shortAddress, textStartX, avatarY + 16);
        }
      } else if (config.showWallet && data.walletAddress) {
        ctx.fillStyle = textColor;
        ctx.font = getFont(12, "bold", true);
        ctx.fillText(data.walletAddress, textStartX, avatarY + 4);
      }
    }

    // Unrealized PnL Y = 300
    ctx.fillStyle = mutedTextColor;
    ctx.font = getFont(14, "bold", true);
    ctx.fillText("UNREALIZED ROE & PERCENT", paddingX, 290);

    let pnlStr = "";
    if (config.showPnlDollar) {
      pnlStr += `${isProfit ? "+" : "-"}$${Math.abs(data.unrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (config.showPnlPercent) {
      if (pnlStr) pnlStr += "   ";
      pnlStr += `${isProfit ? "+" : ""}${data.unrealizedPnlPercent.toFixed(2)}%`;
    }

    if (pnlStr) {
      ctx.fillStyle = pnlColor;
      ctx.font = getFont(72, "900");
      ctx.fillText(pnlStr, paddingX, 375);
    }

    // Divider 1
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(paddingX, 440);
    ctx.lineTo(width - paddingX, 440);
    ctx.stroke();

    // 4 Column Grid for cell details
    const drawCell = (x: number, y: number, label: string, val: string) => {
      ctx.fillStyle = mutedTextColor;
      ctx.font = getFont(13, "bold", true);
      ctx.fillText(label.toUpperCase(), x, y);

      ctx.fillStyle = textColor;
      ctx.font = getFont(24, "bold");
      ctx.fillText(val, x, y + 36);
    };

    const cells = [];
    if (config.showSize) {
      cells.push({ label: "Position Size", val: `${data.size.toLocaleString()} ${data.symbol}` });
    }
    const prec = data.symbol === "PURR" ? 4 : 2;
    if (config.showEntryPrice) {
      cells.push({
        label: "Entry Price",
        val: `$${data.entryPrice.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}`
      });
    }
    if (config.showMarkPrice) {
      cells.push({
        label: "Mark Price",
        val: `$${data.markPrice.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}`
      });
    }
    if (config.showMargin) {
      cells.push({
        label: "Margin Value",
        val: `$${data.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
      });
    }
    if (config.showVolume) {
      const vol = data.size * data.entryPrice;
      cells.push({
        label: "Total Volume",
        val: `$${vol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      });
    }

    // Place cells dynamically (4 columns)
    const colWidth = (width - paddingX * 2) / 4;
    const rowYList = [500, 610];

    cells.forEach((cell, idx) => {
      const colIdx = idx % 4;
      const rowIdx = Math.floor(idx / 4);
      if (rowIdx < 2) {
        const x = paddingX + colIdx * colWidth;
        drawCell(x, rowYList[rowIdx], cell.label, cell.val);
      }
    });

    // Divider 2
    ctx.beginPath();
    ctx.moveTo(paddingX, 720);
    ctx.lineTo(width - paddingX, 720);
    ctx.stroke();

    // Footer Info
    const footerY = 790;
    let dt = "";
    if (config.showDate && data.date) {
      dt = data.date;
      if (config.showTime && data.time) dt += ` ${data.time}`;
    } else if (config.showTime && data.time) {
      dt = data.time;
    }

    if (dt) {
      ctx.fillStyle = mutedTextColor;
      ctx.font = getFont(14, "bold", true);
      ctx.fillText(`Timestamp: ${dt}`, paddingX, footerY);
    }

    if (config.showWatermark) {
      ctx.fillStyle = isLightBg ? "rgba(15, 23, 42, 0.15)" : "rgba(255, 255, 255, 0.05)";
      ctx.font = getFont(12, "900", true);
      ctx.textAlign = "right";
      ctx.fillText("SHIELD SECURE ENCRYPTED", width - paddingX, footerY);
      ctx.textAlign = "left"; // reset
    }
  }

  ctx.restore();
}

export function exportCanvasAsPNG(canvas: HTMLCanvasElement, symbol: string): void {
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `${symbol}_TradeShareCard_${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Failed to export share card PNG:", err);
  }
}

export const ShareCardRenderer = {
  render: renderShareCardToCanvas,
  export: exportCanvasAsPNG
};
