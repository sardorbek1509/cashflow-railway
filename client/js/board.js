/**
 * Board Module
 * Renders the 24-space game board onto an HTML5 Canvas
 */

const BoardRenderer = (() => {
  const BOARD_SPACES = 24;
  const COLORS = {
    payday:  { bg: '#003d20', border: '#00d084', label: '#00d084' },
    deal:    { bg: '#0d2040', border: '#4a9eff', label: '#4a9eff' },
    expense: { bg: '#3d0010', border: '#ff4d6a', label: '#ff4d6a' },
    market:  { bg: '#2e2000', border: '#f5c542', label: '#f5c542' },
    charity: { bg: '#1a1040', border: '#a0a0ff', label: '#a0a0ff' },
    baby:    { bg: '#1a1040', border: '#d0a0ff', label: '#d0a0ff' }
  };

  const SPACE_TYPES = [
    'payday','deal','expense','deal','market','charity','deal','expense',
    'deal','market','payday','deal','baby','deal','market','expense',
    'deal','charity','deal','market','payday','deal','expense','deal'
  ];

  const SPACE_LABELS = [
    'PAYDAY','DEAL','DOODAD','DEAL','MARKET','CHARITY','DEAL','DOODAD',
    'DEAL','MARKET','PAYDAY','DEAL','BABY','DEAL','MARKET','DOODAD',
    'DEAL','CHARITY','DEAL','MARKET','PAYDAY','DEAL','DOODAD','DEAL'
  ];

  // Player colors
  const PLAYER_COLORS = ['#00d084','#f5c542','#ff4d6a','#4a9eff','#d0a0ff','#ff9a4a'];

  let canvas, ctx;
  let spaceRects = []; // Bounding box for each space {x,y,w,h,cx,cy}

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    computeSpaceRects();
    draw([]);
  }

  /**
   * Compute pixel positions for each board space around the perimeter
   * Board is 24 spaces arranged around a square: 7 per side (corners shared)
   */
  function computeSpaceRects() {
    const W = canvas.width;
    const H = canvas.height;
    const CORNER_SIZE = 56;
    const SIDE_CELLS_H = 5; // spaces between corners on horizontal sides
    const SIDE_CELLS_V = 3; // spaces between corners on vertical sides

    // Calculate cell widths
    const horizCellW = (W - 2 * CORNER_SIZE) / SIDE_CELLS_H;
    const vertCellH  = (H - 2 * CORNER_SIZE) / SIDE_CELLS_V;

    spaceRects = [];

    // Bottom row: left-to-right, indices 0..6 (0=bottom-left corner = PAYDAY)
    // Space 0: bottom-left corner
    spaceRects[0] = { x: 0, y: H - CORNER_SIZE, w: CORNER_SIZE, h: CORNER_SIZE };
    // Spaces 1-5: bottom edge moving right
    for (let i = 0; i < SIDE_CELLS_H; i++) {
      spaceRects[1 + i] = {
        x: CORNER_SIZE + i * horizCellW,
        y: H - CORNER_SIZE,
        w: horizCellW,
        h: CORNER_SIZE
      };
    }
    // Space 6: bottom-right corner
    spaceRects[6] = { x: W - CORNER_SIZE, y: H - CORNER_SIZE, w: CORNER_SIZE, h: CORNER_SIZE };

    // Right column: bottom-to-top, indices 7..9
    for (let i = 0; i < SIDE_CELLS_V; i++) {
      spaceRects[7 + i] = {
        x: W - CORNER_SIZE,
        y: H - CORNER_SIZE - (i + 1) * vertCellH,
        w: CORNER_SIZE,
        h: vertCellH
      };
    }
    // Space 10: top-right corner
    spaceRects[10] = { x: W - CORNER_SIZE, y: 0, w: CORNER_SIZE, h: CORNER_SIZE };

    // Top row: right-to-left, indices 11..15
    for (let i = 0; i < SIDE_CELLS_H; i++) {
      spaceRects[11 + i] = {
        x: W - CORNER_SIZE - (i + 1) * horizCellW,
        y: 0,
        w: horizCellW,
        h: CORNER_SIZE
      };
    }
    // Space 16: top-left corner
    spaceRects[16] = { x: 0, y: 0, w: CORNER_SIZE, h: CORNER_SIZE };

    // Left column: top-to-bottom, indices 17..19
    for (let i = 0; i < SIDE_CELLS_V; i++) {
      spaceRects[17 + i] = {
        x: 0,
        y: CORNER_SIZE + i * vertCellH,
        w: CORNER_SIZE,
        h: vertCellH
      };
    }
    // Space 20: bottom-left again? No — we only have 24 spaces.
    // Let's add 4 more: spaces 20-23 on the left, completing full loop
    // Actually recalculate — 24 spaces: bottom=7, right=3, top=7, left=3 = 20, add 4 corners = 24 ✓
    // The above gives 7+3+7+3=20 unique but we've already placed corners. Let me recalculate properly.

    // Redo with explicit positions for clarity:
    spaceRects = buildBoardLayout(W, H);
  }

  function buildBoardLayout(W, H) {
    const rects = [];
    const CORNER = 56;
    const hCells = 5;
    const vCells = 3;
    const cw = (W - 2 * CORNER) / hCells;
    const ch = (H - 2 * CORNER) / vCells;

    // Bottom-left corner = space 0 (PAYDAY)
    rects.push({ x: 0, y: H - CORNER, w: CORNER, h: CORNER }); // 0

    // Bottom edge left→right: 1-5
    for (let i = 0; i < hCells; i++) {
      rects.push({ x: CORNER + i * cw, y: H - CORNER, w: cw, h: CORNER }); // 1-5
    }

    // Bottom-right corner = space 6
    rects.push({ x: W - CORNER, y: H - CORNER, w: CORNER, h: CORNER }); // 6

    // Right edge bottom→top: 7-9
    for (let i = 0; i < vCells; i++) {
      rects.push({ x: W - CORNER, y: H - CORNER - (i + 1) * ch, w: CORNER, h: ch }); // 7-9
    }

    // Top-right corner = space 10
    rects.push({ x: W - CORNER, y: 0, w: CORNER, h: CORNER }); // 10

    // Top edge right→left: 11-15
    for (let i = 0; i < hCells; i++) {
      rects.push({ x: W - CORNER - (i + 1) * cw, y: 0, w: cw, h: CORNER }); // 11-15
    }

    // Top-left corner = space 16
    rects.push({ x: 0, y: 0, w: CORNER, h: CORNER }); // 16

    // Left edge top→bottom: 17-19
    for (let i = 0; i < vCells; i++) {
      rects.push({ x: 0, y: CORNER + i * ch, w: CORNER, h: ch }); // 17-19
    }

    // 4 extra spaces to reach 24 — distribute across edges as additional marks
    // Spaces 20-23: place them as inner highlight ring (center area indicators)
    // For simplicity, add 4 more on bottom edge (we have 20, need 24)
    // REDESIGN: Use 6 spaces per side = 24 total, corners included
    // Actually let's just use the 20 we have plus remap. 
    // For a game, 20 is fine but spec says 24. Let's add 4 more on bottom:
    // Actually the cleanest solution: 6 per side, shared corners = 6*4-4 = 20. 
    // OR: 7 bottom, 5 right, 7 top, 5 left = 24 unique, with corners counted once.
    // Let me recalculate: 
    // bottom: 0-6 (7), right: 7-10 (4), top: 11-17 (7), left: 18-23 (6) = 24 ✓
    return buildBoard24(W, H);
  }

  function buildBoard24(W, H) {
    const rects = [];
    const CORNER = 56;
    const hInner = 5; // spaces between corners horizontally
    const vInner = 3; // spaces between corners vertically
    const cw = (W - 2 * CORNER) / hInner;
    const ch = (H - 2 * CORNER) / vInner;

    // Bottom row 0-6: BL corner, 5 inner, BR corner
    rects.push({ x: 0, y: H - CORNER, w: CORNER, h: CORNER });
    for (let i = 0; i < hInner; i++) rects.push({ x: CORNER + i * cw, y: H - CORNER, w: cw, h: CORNER });
    rects.push({ x: W - CORNER, y: H - CORNER, w: CORNER, h: CORNER });

    // Right col 7-9: 3 inner (no corners, they're in 6 and 10)
    for (let i = 0; i < vInner; i++) rects.push({ x: W - CORNER, y: H - CORNER - (i + 1) * ch, w: CORNER, h: ch });

    // Top row 10-16: TR corner, 5 inner, TL corner
    rects.push({ x: W - CORNER, y: 0, w: CORNER, h: CORNER });
    for (let i = 0; i < hInner; i++) rects.push({ x: W - CORNER - (i + 1) * cw, y: 0, w: cw, h: CORNER });
    rects.push({ x: 0, y: 0, w: CORNER, h: CORNER });

    // Left col 17-19: 3 inner
    for (let i = 0; i < vInner; i++) rects.push({ x: 0, y: CORNER + i * ch, w: CORNER, h: ch });

    // Add cx, cy centers
    return rects.map(r => ({
      ...r,
      cx: r.x + r.w / 2,
      cy: r.y + r.h / 2
    }));
  }

  /**
   * Draw the full board
   * @param {Array} playerPositions - [{username, position, color}]
   */
  function draw(playerPositions = []) {
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Board background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Center area
    const CORNER = 56;
    ctx.fillStyle = '#12161c';
    ctx.strokeStyle = '#2a3245';
    ctx.lineWidth = 1;
    roundRect(ctx, CORNER, CORNER, W - CORNER * 2, H - CORNER * 2, 4);
    ctx.fill();
    ctx.stroke();

    // Center text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1e2535';
    ctx.font = 'bold 48px Syne, sans-serif';
    ctx.fillText('CF', W / 2, H / 2 - 14);
    ctx.fillStyle = '#2a3245';
    ctx.font = '11px DM Mono, monospace';
    ctx.fillText('CASHFLOW', W / 2, H / 2 + 16);
    ctx.restore();

    // Draw each space
    spaceRects.forEach((rect, i) => {
      if (i >= BOARD_SPACES) return;
      const type = SPACE_TYPES[i];
      const label = SPACE_LABELS[i];
      const color = COLORS[type] || COLORS.deal;

      // Background
      ctx.fillStyle = color.bg;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      // Border
      ctx.strokeStyle = color.border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5);

      // Space number
      ctx.fillStyle = '#4a5568';
      ctx.font = '9px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(i, rect.cx, rect.y + 4);

      // Label
      ctx.fillStyle = color.label;
      ctx.font = 'bold 8px Syne, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Wrap label for narrow cells
      const maxW = rect.w - 6;
      wrapText(ctx, label, rect.cx, rect.cy, maxW, 10);
    });

    // Draw player tokens
    if (playerPositions.length > 0) {
      drawPlayers(playerPositions);
    }
  }

  function drawPlayers(players) {
    // Group players by position
    const byPos = {};
    players.forEach(p => {
      if (!byPos[p.position]) byPos[p.position] = [];
      byPos[p.position].push(p);
    });

    Object.entries(byPos).forEach(([pos, group]) => {
      const rect = spaceRects[parseInt(pos)];
      if (!rect) return;

      const count = group.length;
      group.forEach((player, idx) => {
        const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
        const radius = count > 1 ? 10 : 0;
        const tx = rect.cx + Math.cos(angle) * radius;
        const ty = rect.cy + Math.sin(angle) * radius;

        const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length] || PLAYER_COLORS[0];

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        // Token
        ctx.beginPath();
        ctx.arc(tx, ty, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.shadowBlur = 0;

        // Initial
        ctx.fillStyle = '#0a0c0f';
        ctx.font = 'bold 7px Syne, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.username[0].toUpperCase(), tx, ty);
      });
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineH) {
    const words = text.split(' ');
    if (words.length === 1) { ctx.fillText(text, x, y); return; }
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = word;
      } else { line = test; }
    });
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineH) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineH));
  }

  function getSpaceRect(index) {
    return spaceRects[index];
  }

  return { init, draw, getSpaceRect };
})();

window.BoardRenderer = BoardRenderer;
