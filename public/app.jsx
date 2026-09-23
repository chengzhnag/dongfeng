import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import confetti from 'canvas-confetti';
import { 
  Wind, Sparkles, ShieldCheck, Compass, Heart, Share2, RefreshCw, Plus, 
  Trash2, ArrowUp, ArrowDown, User, LogIn, LogOut, Check, Eye, Lock, Globe, 
  Volume2, VolumeX, Shuffle, ScrollText, ChevronRight, Award, ExternalLink, 
  HelpCircle, Copy, Download, Tag, Search, Loader2
} from 'lucide-react';

// --- Web Audio Procedural Chime & Gong Synthesizer ---
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  playWindChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // Pentatonic scale frequencies
      const freqs = [523.25, 659.25, 783.99, 880.00, 1046.50, 1318.51];
      
      for (let i = 0; i < 3; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const freq = freqs[Math.floor(Math.random() * freqs.length)];
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.01, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.15, now + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 1.3);
      }
    } catch (e) {
      console.warn('Audio play warning', e);
    }
  }

  playGongSound() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 1.5);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 3.0);
    } catch (e) {
      console.warn('Gong sound error', e);
    }
  }

  playWindSwish() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.4);
      filter.Q.value = 3;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + 0.5);
    } catch (e) {}
  }

  playTick(pitch = 800) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {}
  }
}

const audioEngine = new AudioEngine();

// Poetic Eastern Quotes
const POETIC_QUOTES = [
  "东风随春归，发我枝上花。",
  "九万里风鹏正举，风休住，蓬舟吹取三山去。",
  "风定花犹落，顺心即是路。",
  "等闲识得东风面，万紫千红总是春。",
  "随风潜入夜，润物细无声。此时定夺，正是时机。",
  "大风起兮云飞扬，心中所想，顺理成章。",
  "长风破浪会有时，直挂云帆济沧海。",
  "风起于青萍之末，决断于顺念之时。"
];

// Presets
const PRESET_DECISIONS = [
  {
    title: "今晚宵夜吃什么？",
    options: [
      { text: "热气腾腾的火锅", weight: 3 },
      { text: "木炭烧烤与冷饮", weight: 3 },
      { text: "精致手作日料", weight: 2 },
      { text: "清爽关东煮", weight: 1 }
    ],
    tags: ["美食", "宵夜"]
  },
  {
    title: "本周末去哪里充能？",
    options: [
      { text: "郊外公园露营听风", weight: 2 },
      { text: "图书馆与咖啡馆沉浸", weight: 2 },
      { text: "约朋友打羽毛球", weight: 1 },
      { text: "在家看经典电影深度放松", weight: 2 }
    ],
    tags: ["生活", "周末"]
  },
  {
    title: "A / B 两难抉择建议",
    options: [
      { text: "方案 A：追求长期稳健", weight: 1 },
      { text: "方案 B：拥抱变化与突破", weight: 1 }
    ],
    tags: ["抉择", "思考"]
  },
  {
    title: "今天工作番茄钟优先做？",
    options: [
      { text: "核心功能代码重构", weight: 3 },
      { text: "编写设计文档与 API", weight: 2 },
      { text: "清理待办 Bug 与日志", weight: 2 },
      { text: "学习一项新技术点", weight: 1 }
    ],
    tags: ["职场", "效率"]
  }
];

// --- D3 Windfield Background Component ---
const D3Windfield = ({ isReducedMotion }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = isReducedMotion ? 20 : (width < 768 ? 45 : 90);
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.5 + Math.random() * 1.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.6 + 0.2,
        length: Math.random() * 25 + 10,
        color: Math.random() > 0.8 ? '#d93829' : (Math.random() > 0.6 ? '#f5a623' : '#a3a8b5')
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          p.vx += (dx / dist) * 0.05;
          p.vy += (dy / dist) * 0.05;
        }

        p.x += p.vx;
        p.y += p.vy;

        p.vx += (1.2 - p.vx) * 0.01;
        p.vy += (0 - p.vy) * 0.01;

        if (p.x > width + 50) p.x = -50;
        if (p.x < -50) p.x = width + 50;
        if (p.y > height + 50) p.y = -50;
        if (p.y < -50) p.y = height + 50;

        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * p.length * 0.3, p.y - p.vy * p.length * 0.3);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.alpha * 1.5);
        ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isReducedMotion]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0 opacity-70"
    />
  );
};

// --- D3 Fullscreen Ceremony Reveal Modal ---
const CeremonyRevealModal = ({ isOpen, decision, mode, onClose, onComplete }) => {
  const containerRef = useRef(null);
  const [stage, setStage] = useState('swirl'); // 'swirl' | 'scattering' | 'revealed'
  const [activeMode, setActiveMode] = useState(mode || 'roulette');
  const [replayCount, setReplayCount] = useState(0);

  useEffect(() => {
    if (mode) {
      setActiveMode(mode);
    }
  }, [mode]);

  useEffect(() => {
    if (!isOpen || !decision) return;

    const currentMode = activeMode || decision.mode || 'roulette';
    setStage('swirl');
    audioEngine.playWindChime();

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    d3.select(container).selectAll('*').remove();

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('position', 'absolute')
      .style('inset', 0);

    // Defs for gradients & filters
    const defs = svg.append('defs');

    // Gold Glow Filter
    const glowFilter = defs.append('filter')
      .attr('id', 'goldGlow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '10').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Bamboo Gradient
    const bambooGrad = defs.append('linearGradient')
      .attr('id', 'bambooGradient')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    bambooGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f2e6d0');
    bambooGrad.append('stop').attr('offset', '50%').attr('stop-color', '#d9c29c');
    bambooGrad.append('stop').attr('offset', '100%').attr('stop-color', '#b3986a');

    // Gold Bamboo Gradient for Winner
    const goldGrad = defs.append('linearGradient')
      .attr('id', 'goldGradient')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    goldGrad.append('stop').attr('offset', '0%').attr('stop-color', '#fff3cd');
    goldGrad.append('stop').attr('offset', '50%').attr('stop-color', '#ffd700');
    goldGrad.append('stop').attr('offset', '100%').attr('stop-color', '#d97706');

    const options = decision.options || [];
    const winnerId = decision.winner?.id || decision.winner_id;
    const winnerText = decision.winner?.text || decision.winner_text;

    let cleanup = () => {};

    if (currentMode === 'roulette') {
      // ==========================================
      // MODE 1: 🌪️ 风场漩涡 (D3 Jumping Sequential Roulette)
      // ==========================================
      const g = svg.append('g')
        .attr('transform', `translate(${width / 2}, ${height / 2})`);

      // Center Compass & Outer Rings
      const compassG = g.append('g').attr('class', 'compass-ring');
      
      compassG.append('circle')
        .attr('r', 190)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(217, 56, 41, 0.35)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '8 6');

      compassG.append('circle')
        .attr('r', 130)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(245, 166, 35, 0.25)')
        .attr('stroke-width', 1.5);

      compassG.append('circle')
        .attr('r', 44)
        .attr('fill', 'rgba(217, 56, 41, 0.2)')
        .attr('stroke', '#d93829')
        .attr('stroke-width', 2);

      // Pointer Line pointing from center to highlighted node
      const pointerG = compassG.append('g').attr('class', 'pointer-g');
      
      const pointerLine = pointerG.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', 0).attr('y2', -150)
        .attr('stroke', '#ffd700')
        .attr('stroke-width', 4)
        .attr('stroke-linecap', 'round')
        .style('filter', 'url(#goldGlow)');

      pointerG.append('polygon')
        .attr('points', '0,-165 -10,-145 10,-145')
        .attr('fill', '#ffd700')
        .style('filter', 'url(#goldGlow)');

      // Target winner index
      const winnerIndex = options.findIndex(opt => 
        (winnerId && opt.id === winnerId) || (winnerText && opt.text === winnerText)
      );
      const targetWinIdx = winnerIndex >= 0 ? winnerIndex : 0;

      const orbitRadius = Math.min(width, height) * 0.25 + 50;

      const nodes = options.map((opt, i) => {
        // Angles distributed evenly starting top (-PI/2)
        const angle = -Math.PI / 2 + (i / options.length) * Math.PI * 2;
        const isWinner = (i === targetWinIdx);
        return {
          id: opt.id || i,
          text: opt.text,
          isWinner,
          angle,
          x: Math.cos(angle) * orbitRadius,
          y: Math.sin(angle) * orbitRadius,
          radius: 46
        };
      });

      const nodeGroups = g.selectAll('.opt-node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'opt-node')
        .attr('transform', d => `translate(${d.x}, ${d.y})`);

      // All nodes start with neutral dark slate background (no winner revealed prematurely!)
      const nodeCircles = nodeGroups.append('circle')
        .attr('r', d => d.radius)
        .attr('fill', '#121624')
        .attr('stroke', '#3a4459')
        .attr('stroke-width', 2.5);

      const nodeTexts = nodeGroups.append('text')
        .text(d => d.text.length > 8 ? d.text.slice(0, 7) + '…' : d.text)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('fill', '#f4f0ea')
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('font-family', 'Noto Serif SC, serif');

      // Sequential Jumping Roulette State
      let jumpCount = 0;
      // We want ~3 full laps plus remaining steps to target winner
      const totalJumps = options.length * 3 + targetWinIdx;
      let timerId = null;

      const updateHighlight = (index, isFinalWinner = false) => {
        const activeNode = nodes[index];
        const rotDeg = (activeNode.angle * 180 / Math.PI) + 90;

        // Pointer rotates to target node angle
        pointerG
          .transition()
          .duration(70)
          .attr('transform', `rotate(${rotDeg})`);

        // Update node styles dynamically
        nodeCircles
          .transition()
          .duration(90)
          .attr('r', (d, i) => i === index ? (isFinalWinner ? 68 : 56) : 46)
          .attr('fill', (d, i) => i === index ? (isFinalWinner ? '#2d1a08' : '#3d161a') : '#121624')
          .attr('stroke', (d, i) => i === index ? (isFinalWinner ? '#ffd700' : '#d93829') : '#3a4459')
          .attr('stroke-width', (d, i) => i === index ? (isFinalWinner ? 5 : 3.5) : 2.5)
          .style('filter', (d, i) => i === index ? (isFinalWinner ? 'url(#goldGlow)' : 'drop-shadow(0 0 14px rgba(217,56,41,0.85))') : 'none');

        nodeTexts
          .transition()
          .duration(90)
          .attr('font-size', (d, i) => i === index ? (isFinalWinner ? '18px' : '15px') : '13px')
          .attr('font-weight', (d, i) => i === index ? 'bold' : 'normal')
          .attr('fill', (d, i) => i === index ? (isFinalWinner ? '#ffd700' : '#ffffff') : '#f4f0ea');

        if (isFinalWinner) {
          audioEngine.playGongSound();
        } else {
          audioEngine.playTick(700 + (jumpCount % 5) * 110);
        }
      };

      // Decelerating Jump Loop
      const stepJump = () => {
        const currentJumpIdx = jumpCount % options.length;
        const isLastStep = (jumpCount === totalJumps);

        updateHighlight(currentJumpIdx, isLastStep);

        if (isLastStep) {
          // Locked on winner! Trigger Wind Scatter phase after short pause
          setTimeout(() => {
            setStage('scattering');
            audioEngine.playWindSwish();

            // Non-winner options blow away with wind particle velocity
            nodeGroups.filter((d, i) => i !== targetWinIdx)
              .transition()
              .duration(1200)
              .ease(d3.easeCubicOut)
              .attr('transform', d => {
                const blowAngle = d.angle + (Math.random() - 0.5) * 0.8;
                const blowDist = width * 1.3;
                return `translate(${Math.cos(blowAngle) * blowDist}, ${Math.sin(blowAngle) * blowDist}) rotate(720)`;
              })
              .style('opacity', 0);

            // Winner option glides to dead center and blooms into Gold Sun Badge
            const winnerGroup = nodeGroups.filter((d, i) => i === targetWinIdx);
            
            winnerGroup.transition()
              .duration(1500)
              .ease(d3.easeBackOut)
              .attr('transform', 'translate(0, 0)')
              .select('circle')
              .attr('r', 92)
              .attr('fill', '#2d1a08')
              .attr('stroke', '#ffd700')
              .attr('stroke-width', 6)
              .style('filter', 'url(#goldGlow)');

            winnerGroup.select('text')
              .attr('font-size', '22px')
              .attr('font-weight', 'bold')
              .attr('fill', '#ffd700');

          }, 600);

          setTimeout(() => {
            setStage('revealed');
            try {
              confetti({
                particleCount: 100,
                spread: 90,
                origin: { y: 0.55 },
                colors: ['#d93829', '#ffd700', '#f5a623', '#ffffff']
              });
            } catch (e) {}

            onComplete && onComplete(decision);
          }, 2200);

        } else {
          jumpCount++;
          // Deceleration curve: starts at 50ms fast jump, ramps up to 450ms on final steps
          const progress = jumpCount / totalJumps;
          let delay = 50 + Math.pow(progress, 2.5) * 450;
          timerId = setTimeout(stepJump, delay);
        }
      };

      // Start jumping sequence
      stepJump();

      cleanup = () => {
        if (timerId) clearTimeout(timerId);
      };

    } else {
      // ==========================================
      // MODE 2: 🎋 竹签卜卦 (Eastern Bamboo Draw)
      // ==========================================
      const tubeCenterX = width / 2;
      const tubeCenterY = height - 130;

      const g = svg.append('g');

      // Fortune Stick Tube Container
      const tubeG = g.append('g')
        .attr('transform', `translate(${tubeCenterX}, ${tubeCenterY})`);

      // Tube Body Shape
      tubeG.append('path')
        .attr('d', 'M -50,-10 L 50,-10 L 40,110 Q 0,125 -40,110 Z')
        .attr('fill', '#7a1f1d')
        .attr('stroke', '#d93829')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 10px 20px rgba(0,0,0,0.8))');

      // Gold Trim on Tube
      tubeG.append('rect')
        .attr('x', -48)
        .attr('y', 0)
        .attr('width', 96)
        .attr('height', 8)
        .attr('fill', '#ffd700');

      // Calligraphy on Tube
      tubeG.append('text')
        .text('东风签筒')
        .attr('text-anchor', 'middle')
        .attr('x', 0)
        .attr('y', 60)
        .attr('fill', '#ffd700')
        .attr('font-size', '16px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'Noto Serif SC, serif');

      // Prepare Bamboo Sticks
      const sticks = options.map((opt, i) => {
        const isWinner = (winnerId && opt.id === winnerId) || (winnerText && opt.text === winnerText);
        const offsetAngle = ((i - (options.length - 1) / 2) * 12);
        return {
          id: opt.id || i,
          text: opt.text,
          isWinner,
          offsetAngle,
          startX: (i - (options.length - 1) / 2) * 14,
          startY: tubeCenterY - 30 + Math.sin(i) * 10
        };
      });

      const stickG = g.append('g').attr('class', 'sticks-group');

      const stickItems = stickG.selectAll('.bamboo-stick')
        .data(sticks)
        .enter()
        .append('g')
        .attr('class', 'bamboo-stick')
        .attr('transform', d => `translate(${tubeCenterX + d.startX}, ${d.startY}) rotate(${d.offsetAngle * 0.3})`);

      // Stick Body
      stickItems.append('rect')
        .attr('x', -14)
        .attr('y', -75)
        .attr('width', 28)
        .attr('height', 150)
        .attr('rx', 6)
        .attr('fill', 'url(#bambooGradient)')
        .attr('stroke', '#8c7047')
        .attr('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))');

      // Vermilion Tag Top
      stickItems.append('rect')
        .attr('x', -14)
        .attr('y', -75)
        .attr('width', 28)
        .attr('height', 24)
        .attr('rx', 4)
        .attr('fill', '#d93829');

      // Vertical Calligraphy Text
      stickItems.append('text')
        .text(d => d.text.length > 6 ? d.text.slice(0, 5) + '…' : d.text)
        .attr('text-anchor', 'middle')
        .attr('x', 0)
        .attr('y', -30)
        .attr('fill', '#2c2218')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'Noto Serif SC, serif')
        .style('writing-mode', 'vertical-rl');

      // Shake tube vibration timer with wooden stick rattling effect
      let tubeTime = 0;
      let lastTickStep = 0;
      const shakeTimer = d3.timer(() => {
        tubeTime += 0.15;
        const shakeX = Math.sin(tubeTime * 4) * 8;
        const shakeRot = Math.cos(tubeTime * 3) * 3;
        tubeG.attr('transform', `translate(${tubeCenterX + shakeX}, ${tubeCenterY}) rotate(${shakeRot})`);

        // Rattling wooden sticks jump up & down with ticks
        const currentStep = Math.floor(tubeTime * 2.5);
        if (currentStep !== lastTickStep) {
          lastTickStep = currentStep;
          audioEngine.playTick(600 + Math.random() * 400);

          const randomIdx = Math.floor(Math.random() * sticks.length);
          stickItems.filter((d, i) => i === randomIdx)
            .transition()
            .duration(100)
            .attr('transform', d => `translate(${tubeCenterX + d.startX}, ${d.startY - 22}) rotate(${d.offsetAngle * 0.3})`)
            .transition()
            .duration(100)
            .attr('transform', d => `translate(${tubeCenterX + d.startX}, ${d.startY}) rotate(${d.offsetAngle * 0.3})`);
        }
      });

      const scatterTimer = setTimeout(() => {
        shakeTimer.stop();
        setStage('scattering');
        audioEngine.playWindSwish();

        // Non-winner sticks float up and fade into white wind mist
        stickItems.filter(d => !d.isWinner)
          .transition()
          .duration(1400)
          .ease(d3.easeCubicOut)
          .attr('transform', (d, i) => {
            const spreadX = tubeCenterX + (d.offsetAngle * 25);
            const floatY = tubeCenterY - 450 - Math.random() * 200;
            return `translate(${spreadX}, ${floatY}) rotate(${d.offsetAngle * 2}) scale(0.6)`;
          })
          .style('opacity', 0);

        // Winner Stick shoots to top center and expands into Gold Crown Stick
        const winnerStick = stickItems.filter(d => d.isWinner);

        winnerStick.transition()
          .duration(1600)
          .ease(d3.easeBackOut)
          .attr('transform', `translate(${width / 2}, ${height / 2 - 40}) rotate(0) scale(2.2)`)
          .select('rect')
          .attr('fill', 'url(#goldGradient)')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .style('filter', 'url(#goldGlow)');

        winnerStick.select('text')
          .attr('fill', '#7a1f1d')
          .attr('font-size', '14px')
          .attr('font-weight', '900');

      }, 2200);

      const revealTimer = setTimeout(() => {
        setStage('revealed');
        audioEngine.playGongSound();

        try {
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#d93829', '#ffd700', '#f5a623', '#ffffff']
          });
        } catch (e) {}

        onComplete && onComplete(decision);
      }, 3800);

      cleanup = () => {
        shakeTimer.stop();
        clearTimeout(scatterTimer);
        clearTimeout(revealTimer);
      };
    }

    return cleanup;
  }, [isOpen, decision, activeMode, replayCount]);

  if (!isOpen || !decision) return null;

  const currentMode = activeMode || decision.mode || 'roulette';
  const winnerText = decision.winner?.text || decision.winner_text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060709]/95 backdrop-blur-xl transition-all duration-500">
      <div ref={containerRef} className="absolute inset-0 pointer-events-none" />

      {/* Top Header Mode Switcher Controls */}
      <div className="absolute top-3 sm:top-6 z-20 flex items-center space-x-1 sm:space-x-2 bg-slate-950/85 backdrop-blur-md p-1 rounded-full border border-slate-800/80 shadow-2xl max-w-[94vw]">
        <button
          onClick={() => {
            setActiveMode('roulette');
            setReplayCount(c => c + 1);
          }}
          className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-serif transition-all flex items-center space-x-1 ${
            currentMode === 'roulette'
              ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span>🌪️ <span className="hidden sm:inline">风场漩涡</span><span className="sm:hidden">风场</span></span>
        </button>
        <button
          onClick={() => {
            setActiveMode('tally');
            setReplayCount(c => c + 1);
          }}
          className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-serif transition-all flex items-center space-x-1 ${
            currentMode === 'tally'
              ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span>🎋 <span className="hidden sm:inline">竹签卜卦</span><span className="sm:hidden">竹签</span></span>
        </button>
        <button
          onClick={() => setReplayCount(c => c + 1)}
          className="p-1 sm:p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-amber-400 border border-slate-800 transition-colors ml-0.5"
          title="重新演练"
        >
          <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>

      {stage === 'swirl' && (
        <div className="absolute top-20 text-center pointer-events-none animate-pulse">
          <p className="font-serif text-2xl text-amber-400 font-bold tracking-widest">
            {currentMode === 'roulette' ? '东风浩荡 · 粒子漩涡寻抉择' : '朱漆签筒 · 灵签振响应天地'}
          </p>
          <p className="text-xs text-slate-400 mt-2 font-serif">沉心观候，等待东风抉择真定...</p>
        </div>
      )}

      {stage === 'scattering' && (
        <div className="absolute top-20 text-center pointer-events-none">
          <p className="font-serif text-2xl text-red-500 font-bold tracking-widest animate-bounce">
            {currentMode === 'roulette' ? '狂风拂余 · 真定将现' : '灵签出筒 · 胜者跃出'}
          </p>
        </div>
      )}

      {stage === 'revealed' && (
        <div className="relative z-10 max-w-lg w-full mx-4 p-8 rounded-2xl glass-panel-gold text-center animate-fade-in-up border border-amber-500/40">
          <div className="seal-stamp mb-4 text-sm">东风指引</div>
          
          <h3 className="text-xl text-slate-300 font-serif mb-2">{decision.title}</h3>
          
          <div className="my-6 p-6 rounded-xl bg-slate-950/80 border border-amber-500/30 animate-gold-pulse">
            <span className="text-xs text-amber-400 font-mono tracking-widest block mb-2">
              {currentMode === 'roulette' ? '🌪️ 漩涡风场判定胜出者' : '🎋 竹签卜卦签王领受'}
            </span>
            <div className="text-3xl md:text-4xl font-serif font-black text-amber-300 winner-glow tracking-wide">
              {winnerText}
            </div>
          </div>

          <p className="font-serif text-slate-300 italic text-sm my-4 px-4 py-2 rounded bg-amber-950/20 border-l-2 border-amber-500">
            “{POETIC_QUOTES[Math.floor(Math.random() * POETIC_QUOTES.length)]}”
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setReplayCount(c => c + 1)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-serif text-xs flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>再演练一次</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all shadow-lg shadow-red-900/40 btn-touch"
            >
              领受指引
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Proof Verification Drawer Modal ---
const VerificationModal = ({ isOpen, decisionId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !decisionId) return;
    setLoading(true);

    fetch(`./api/decisions/${decisionId}/verify`)
      .then(res => res.json())
      .then(res => {
        if (res.ok) {
          setData(res);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [isOpen, decisionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="max-w-xl w-full bg-[#12151e] border border-amber-500/30 rounded-2xl p-6 text-slate-200 glass-panel">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-serif font-bold text-amber-400">CSPRNG 真随机验真凭证</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">✕</button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-serif">计算密码学 SHA-256 签名校验中...</div>
        ) : data ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>算法验真通过：该抽取结果完全由服务端密码学安全伪随机数发生器生成，绝无人为作弊或可预测性。</span>
            </div>

            <div className="space-y-2 font-mono text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
              <div><span className="text-amber-500">决定 ID:</span> {data.details.id}</div>
              <div><span className="text-amber-500">抽取时间:</span> {new Date(data.details.created_at).toLocaleString()}</div>
              <div><span className="text-amber-500">胜出选项:</span> {data.details.winner_text}</div>
              <div><span className="text-amber-500">随机 Seed:</span> {data.details.seed}</div>
              <div className="break-all"><span className="text-amber-500">数据 Hash (SHA-256):</span> {data.details.stored_hash}</div>
            </div>

            <p className="text-xs text-slate-400 font-serif leading-relaxed">
              * 防作弊原理：在用户发起请求时，服务端利用 Web Crypto API 生成 CSPRNG 浮点数，对带有权重的选项列表进行数学判定，并结合随机 Seed 实时算得 SHA-256 指纹。前端与任何第三方均可对比计算，保障绝对公正。
            </p>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.details.stored_hash);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center space-x-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? '已复制 Hash' : '复制 Hash'}</span>
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white">
                确定
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-red-400">无法获取验真凭证</div>
        )}
      </div>
    </div>
  );
};

// --- Auth Modal (Login / Register) ---
const AuthModal = ({ isOpen, onClose, onAuthSuccess, avatars }) => {
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(avatars[0]?.icon || '🍃');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = tab === 'login' ? './api/auth/login' : './api/auth/register';
    const payload = tab === 'login' ? { username, password } : { username, email, password, avatar: selectedAvatar };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          onAuthSuccess(data.user);
          onClose();
        } else {
          setError(data.error || '操作失败');
        }
      })
      .catch(() => setError('网络请求异常'))
      .finally(() => setLoading(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-[#12151e] border border-amber-500/30 rounded-2xl p-6 glass-panel text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex space-x-4">
            <button
              onClick={() => { setTab('login'); setError(''); }}
              className={`font-serif text-lg font-bold pb-1 ${tab === 'login' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'}`}
            >
              账号登录
            </button>
            <button
              onClick={() => { setTab('register'); setError(''); }}
              className={`font-serif text-lg font-bold pb-1 ${tab === 'register' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400'}`}
            >
              注册新用户
            </button>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-slate-400 text-xs mb-1">用户名 / 邮箱</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-amber-500 outline-none text-slate-200"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-slate-400 text-xs mb-1">电子邮箱</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-amber-500 outline-none text-slate-200"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-xs mb-1">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-amber-500 outline-none text-slate-200"
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-slate-400 text-xs mb-2">选择专属风骨头像</label>
              <div className="grid grid-cols-4 gap-2">
                {avatars.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAvatar(a.icon)}
                    className={`p-2 rounded-lg border text-center text-xl transition-all ${selectedAvatar === a.icon ? 'border-amber-500 bg-amber-500/20' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}
                  >
                    <span>{a.icon}</span>
                    <span className="block text-[10px] text-slate-400 mt-1 font-serif">{a.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-serif transition-all mt-6 shadow-lg shadow-amber-500/20 btn-touch"
          >
            {loading ? '提交中...' : tab === 'login' ? '登 录' : '注 册 并 试 用'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Option List Preview Component for Decision Cards ---
const OptionListDisplay = ({ options, winnerId, winnerText }) => {
  const [expanded, setExpanded] = useState(false);
  if (!options || !Array.isArray(options) || options.length === 0) return null;

  const displayOptions = expanded ? options : options.slice(0, 3);
  const hasMore = options.length > 3;

  return (
    <div className="my-3 space-y-1.5 font-serif text-xs">
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
        <span className="flex items-center space-x-1 font-medium text-slate-300">
          <ScrollText className="w-3.5 h-3.5 text-amber-500" />
          <span>候选选项 ({options.length} 个)</span>
        </span>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-amber-500 hover:text-amber-400 transition-colors text-[11px]"
          >
            {expanded ? '收起选项 ▲' : `展开余下 ${options.length - 3} 项 ▼`}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {displayOptions.map((opt, idx) => {
          const isWinner = (winnerId && opt.id === winnerId) || (winnerText && opt.text === winnerText);

          return (
            <div
              key={opt.id || idx}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                isWinner
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 font-bold shadow-sm shadow-amber-950/50'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2 truncate min-w-0">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 font-mono ${
                  isWinner ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                }`}>
                  {idx + 1}
                </span>
                <span className="truncate">{opt.text}</span>
              </div>

              <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                {opt.weight && opt.weight > 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] text-amber-400 font-mono">
                    {opt.weight}x 权重
                  </span>
                )}
                {isWinner && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] text-amber-300 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>采纳</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Main Root Component ---
function App() {
  const [activeTab, setActiveTab] = useState('creator');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Guest / User state
  const [user, setUser] = useState(null);
  const [guestInfo, setGuestInfo] = useState({
    id: 'guest_' + Math.random().toString(36).substring(2, 9),
    nickname: '清风观云客',
    avatar: '🍃'
  });

  const [avatars, setAvatars] = useState([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Decision Creator Form State
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState([
    { id: '1', text: '选项 A', weight: 1 },
    { id: '2', text: '选项 B', weight: 1 }
  ]);
  const [mode, setMode] = useState('roulette');
  const [isPublic, setIsPublic] = useState(true);
  const [tagsInput, setTagsInput] = useState('日常, 决策');

  // Reveal Ceremony State
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const [currentDecision, setCurrentDecision] = useState(null);

  // Verification modal state
  const [verifyId, setVerifyId] = useState(null);

  // Public Pool State with Infinite Scroll
  const [publicDecisions, setPublicDecisions] = useState([]);
  const [publicSort, setPublicSort] = useState('latest');
  const [publicTag, setPublicTag] = useState('');
  const [publicPage, setPublicPage] = useState(1);
  const [publicHasMore, setPublicHasMore] = useState(true);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicLoadingMore, setPublicLoadingMore] = useState(false);
  const publicSentinelRef = useRef(null);

  // Private Pool State with Infinite Scroll
  const [privateDecisions, setPrivateDecisions] = useState([]);
  const [privatePage, setPrivatePage] = useState(1);
  const [privateHasMore, setPrivateHasMore] = useState(true);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateLoadingMore, setPrivateLoadingMore] = useState(false);
  const privateSentinelRef = useRef(null);

  // Pre-load Avatars and stored user
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsReducedMotion(true);
    }

    fetch('./api/avatars')
      .then(res => res.json())
      .then(d => d.ok && setAvatars(d.avatars))
      .catch(() => {});

    try {
      const savedUser = localStorage.getItem('dongfeng_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      const savedGuest = localStorage.getItem('dongfeng_guest');
      if (savedGuest) {
        setGuestInfo(JSON.parse(savedGuest));
      } else {
        localStorage.setItem('dongfeng_guest', JSON.stringify(guestInfo));
      }
    } catch (e) {}
  }, []);

  // Fetch Public Decisions with Pagination
  const fetchPublicPool = (pageToLoad = 1, append = false) => {
    if (pageToLoad === 1) {
      setPublicLoading(true);
    } else {
      setPublicLoadingMore(true);
    }

    const limit = 6;
    let url = `./api/decisions/public?page=${pageToLoad}&limit=${limit}&sort=${publicSort}`;
    if (publicTag) url += `&tag=${encodeURIComponent(publicTag)}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          if (append) {
            setPublicDecisions(prev => [...prev, ...data.items]);
          } else {
            setPublicDecisions(data.items);
          }
          setPublicPage(data.pagination.page);
          setPublicHasMore(data.pagination.page < data.pagination.totalPages);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        setPublicLoading(false);
        setPublicLoadingMore(false);
      });
  };

  // Reset & load page 1 when tab, sort, or tag changes
  useEffect(() => {
    if (activeTab === 'public') {
      setPublicPage(1);
      setPublicHasMore(true);
      fetchPublicPool(1, false);
    }
  }, [activeTab, publicSort, publicTag]);

  // Infinite Scroll Observer for Public Pool
  useEffect(() => {
    if (activeTab !== 'public' || publicLoading || publicLoadingMore || !publicHasMore) return;
    const sentinel = publicSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchPublicPool(publicPage + 1, true);
      }
    }, { rootMargin: '250px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, publicLoading, publicLoadingMore, publicHasMore, publicPage, publicSort, publicTag]);

  // Fetch Private Decisions with Pagination
  const fetchPrivatePool = (pageToLoad = 1, append = false) => {
    if (pageToLoad === 1) {
      setPrivateLoading(true);
    } else {
      setPrivateLoadingMore(true);
    }

    const limit = 6;
    let url = `./api/decisions/mine?page=${pageToLoad}&limit=${limit}&`;
    if (user) {
      url += `user_id=${user.id}`;
    } else {
      url += `guest_id=${guestInfo.id}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          if (append) {
            setPrivateDecisions(prev => [...prev, ...data.items]);
          } else {
            setPrivateDecisions(data.items);
          }
          setPrivatePage(data.pagination?.page || 1);
          setPrivateHasMore(data.pagination ? data.pagination.page < data.pagination.totalPages : false);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        setPrivateLoading(false);
        setPrivateLoadingMore(false);
      });
  };

  // Reset & load page 1 when tab or user/guest changes
  useEffect(() => {
    if (activeTab === 'private') {
      setPrivatePage(1);
      setPrivateHasMore(true);
      fetchPrivatePool(1, false);
    }
  }, [activeTab, user, guestInfo]);

  // Infinite Scroll Observer for Private Pool
  useEffect(() => {
    if (activeTab !== 'private' || privateLoading || privateLoadingMore || !privateHasMore) return;
    const sentinel = privateSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchPrivatePool(privatePage + 1, true);
      }
    }, { rootMargin: '250px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, privateLoading, privateLoadingMore, privateHasMore, privatePage, user, guestInfo]);

  // Handle Option Actions
  const handleAddOption = () => {
    if (options.length >= 12) return;
    setOptions([
      ...options,
      { id: Date.now().toString(), text: `选项 ${options.length + 1}`, weight: 1 }
    ]);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleUpdateOption = (index, field, val) => {
    const updated = [...options];
    updated[index][field] = val;
    setOptions(updated);
  };

  const handleMoveOption = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const updated = [...options];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setOptions(updated);
  };

  const handleApplyPreset = (preset) => {
    setTitle(preset.title);
    setOptions(preset.options.map((opt, i) => ({
      id: (i + 1).toString(),
      text: opt.text,
      weight: opt.weight
    })));
    setTagsInput(preset.tags.join(', '));
  };

  // Submit and Roll (问东风)
  const handleSubmitDecision = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('请填写决定标题');
      return;
    }

    const parsedTags = tagsInput.split(/[,，]/).map(t => t.trim()).filter(Boolean);

    const payload = {
      title,
      options,
      mode,
      is_public: isPublic,
      tags: parsedTags,
      user_id: user ? user.id : null,
      guest_id: guestInfo.id,
      guest_nickname: user ? user.username : guestInfo.nickname,
      guest_avatar: user ? user.avatar : guestInfo.avatar
    };

    fetch('./api/decisions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setCurrentDecision(data.decision);
          setCeremonyOpen(true);
        } else {
          alert(data.error || '创建请求失败');
        }
      })
      .catch(err => alert('网络故障: ' + err.message));
  };

  // Handle Like - Update local item state to preserve scroll position
  const handleLikeDecision = (id) => {
    const actorId = user ? user.id : guestInfo.id;
    fetch(`./api/decisions/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: actorId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setPublicDecisions(prev => prev.map(item => {
            if (item.id === id) {
              return { ...item, likes_count: data.likes_count };
            }
            return item;
          }));
        }
      });
  };

  // Handle Toggle Public
  const handleTogglePublic = (id) => {
    fetch(`./api/decisions/${id}/toggle-public`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setPrivateDecisions(prev => prev.map(item => {
            if (item.id === id) {
              return { ...item, is_public: data.is_public };
            }
            return item;
          }));
        }
      });
  };

  // Handle Delete
  const handleDeleteDecision = (id) => {
    if (!confirm('确定要删除该决定记录吗？')) return;
    fetch(`./api/decisions/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setPrivateDecisions(prev => prev.filter(item => item.id !== id));
        }
      });
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(privateDecisions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dongfeng_history_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="relative min-h-screen pb-20">
      <D3Windfield isReducedMotion={isReducedMotion} />

      {/* Glassmorphism Dynamic Navbar */}
      <nav className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-2.5 sm:px-4 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('creator')}>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center font-serif font-black text-white text-base sm:text-lg shadow-md shadow-red-900/40">
              风
            </div>
            <div>
              <span className="font-serif font-bold text-base sm:text-lg text-slate-100 tracking-wider">东风</span>
              <span className="hidden md:inline text-xs text-amber-500 font-serif ml-2">遇事不决，可问东风</span>
            </div>
          </div>

          {/* Center Minimalist Tabs */}
          <div className="flex items-center bg-slate-950/80 p-0.5 sm:p-1 rounded-full border border-slate-800/80 text-xs sm:text-sm font-serif backdrop-blur-md shadow-inner">
            <button
              onClick={() => setActiveTab('creator')}
              className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full transition-all duration-200 flex items-center space-x-1 ${
                activeTab === 'creator'
                  ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm shadow-amber-950/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>问东风</span>
            </button>
            <button
              onClick={() => setActiveTab('public')}
              className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full transition-all duration-200 flex items-center space-x-1 ${
                activeTab === 'public'
                  ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm shadow-amber-950/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>公开池</span>
            </button>
            <button
              onClick={() => setActiveTab('private')}
              className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full transition-all duration-200 flex items-center space-x-1 ${
                activeTab === 'private'
                  ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30 shadow-sm shadow-amber-950/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>私人池</span>
            </button>
          </div>

          {/* Right Controls & Profile */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            <button
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                audioEngine.enabled = next;
              }}
              title="声音音效"
              className="p-1.5 sm:p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />}
            </button>

            {user ? (
              <div className="flex items-center space-x-1.5 bg-slate-900/80 px-2 sm:px-2.5 py-1 rounded-full border border-amber-500/30 text-xs">
                <span>{user.avatar}</span>
                <span className="font-serif text-slate-200 hidden md:inline">{user.username}</span>
                <button
                  onClick={() => {
                    setUser(null);
                    localStorage.removeItem('dongfeng_user');
                  }}
                  className="text-slate-400 hover:text-red-400 ml-0.5"
                  title="退出"
                >
                  <LogOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="hidden lg:flex items-center space-x-1 text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded-full border border-slate-800">
                  <span>访客: {guestInfo.avatar} {guestInfo.nickname}</span>
                </div>
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-serif border border-red-800/50 flex items-center space-x-1 transition-colors"
                >
                  <LogIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Root Content Routing */}
      <main className="max-w-5xl mx-auto px-4 pt-6">

        {/* --- TAB 1: DECISION CREATOR & HERO --- */}
        {activeTab === 'creator' && (
          <div className="space-y-12">
            <div className="text-center py-10 space-y-4">
              <div className="inline-block seal-stamp mb-2 text-xs">遇事不决 · 问东风</div>
              <h1 className="text-4xl md:text-6xl font-serif font-black tracking-widest text-slate-100 title-glow">
                遇事不决，可问东风
              </h1>
              <p className="max-w-2xl mx-auto text-sm md:text-base text-slate-400 font-serif leading-relaxed">
                融汇 D3 算法风场粒子与密码学 CSPRNG 真随机验真。将犹疑交由东风，让抉择富有仪式与美感。
              </p>

              <div className="pt-4 flex flex-wrap justify-center gap-2">
                <span className="text-xs text-slate-500 font-serif self-center mr-1">快捷模板:</span>
                {PRESET_DECISIONS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyPreset(p)}
                    className="px-3 py-1 rounded-full bg-slate-900/80 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/40 text-xs text-slate-300 font-serif transition-all"
                  >
                    ✨ {p.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-w-2xl mx-auto glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-2xl relative">
              <form onSubmit={handleSubmitDecision} className="space-y-6">
                <div>
                  <label className="block text-sm font-serif text-amber-400 mb-2 flex items-center space-x-1">
                    <Compass className="w-4 h-4" />
                    <span>你的困惑或决定标题</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：今晚吃什么？/ 该选 Offer A 还是 Offer B？"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-amber-500 text-slate-100 placeholder-slate-600 font-serif text-base outline-none transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-serif text-slate-300 flex items-center space-x-1">
                      <ScrollText className="w-4 h-4 text-amber-500" />
                      <span>候选选项列表（2 - 12 个，支持权重）</span>
                    </label>
                    <span className="text-xs text-slate-500">{options.length} / 12 个选项</span>
                  </div>

                  <div className="space-y-3">
                    {options.map((opt, index) => (
                      <div key={opt.id} className="flex items-center space-x-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 group">
                        <span className="text-xs font-serif font-bold text-slate-500 w-5 text-center">{index + 1}</span>
                        
                        <input
                          type="text"
                          required
                          value={opt.text}
                          onChange={(e) => handleUpdateOption(index, 'text', e.target.value)}
                          placeholder={`选项 ${index + 1}`}
                          className="flex-1 bg-transparent text-sm text-slate-200 outline-none px-2 font-serif"
                        />

                        <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-xs">
                          <span className="text-slate-500">权重:</span>
                          <select
                            value={opt.weight}
                            onChange={(e) => handleUpdateOption(index, 'weight', parseInt(e.target.value))}
                            className="bg-transparent text-amber-400 font-bold outline-none cursor-pointer"
                          >
                            <option value={1} className="bg-slate-900">1x (等权)</option>
                            <option value={2} className="bg-slate-900">2x (双倍)</option>
                            <option value={3} className="bg-slate-900">3x (高权)</option>
                            <option value={5} className="bg-slate-900">5x (极高)</option>
                          </select>
                        </div>

                        <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleMoveOption(index, -1)}
                            disabled={index === 0}
                            className="p-1 hover:text-amber-400 disabled:opacity-20"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveOption(index, 1)}
                            disabled={index === options.length - 1}
                            className="p-1 hover:text-amber-400 disabled:opacity-20"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            disabled={options.length <= 2}
                            className="p-1 text-red-400/70 hover:text-red-400 disabled:opacity-20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {options.length < 12 && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-slate-800 hover:border-amber-500/50 text-slate-400 hover:text-amber-400 text-xs font-serif flex items-center justify-center space-x-1 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>增加候选选项</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-serif text-slate-400 mb-1">揭晓呈现模式</label>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setMode('roulette')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-serif transition-all ${mode === 'roulette' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold' : 'text-slate-400'}`}
                      >
                        🌪️ 风场漩涡 (D3 粒子)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('tally')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-serif transition-all ${mode === 'tally' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold' : 'text-slate-400'}`}
                      >
                        🎋 竹签卜卦 (散落)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-serif text-slate-400 mb-1">标签（用逗号分隔）</label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="例如: 美食, 灵感"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-amber-500 font-serif"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-amber-500" />
                    <div>
                      <span className="text-xs font-serif text-slate-200 block">同步公开至「公开决策池」</span>
                      <span className="text-[10px] text-slate-500">供全站用户参考与点赞灵感</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-500 hover:to-amber-500 text-white font-serif font-black text-lg tracking-widest shadow-xl shadow-red-900/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2 btn-touch"
                >
                  <Wind className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>问 东 风</span>
                </button>
              </form>
            </div>

            <div className="pt-12 border-t border-slate-800/60">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-serif font-bold text-amber-400 mb-2">遇事不决 · 为什么可问东风？</h2>
                <p className="text-xs text-slate-400 font-serif">兼具古典风骨仪式感与现代密码学算法验真的工具</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400 mb-4">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-slate-200 mb-2">1. CSPRNG 防作弊真随机</h3>
                  <p className="text-xs text-slate-400 font-serif leading-relaxed">
                    服务端采用 Web Crypto 密码学级伪随机数发生器计算，配有 SHA-256 签名哈希指纹，绝对透明无后台篡改风险。
                  </p>
                </div>

                <div className="glass-card p-6 rounded-2xl border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-slate-200 mb-2">2. D3 粒子力场揭晓仪式</h3>
                  <p className="text-xs text-slate-400 font-serif leading-relaxed">
                    基于 D3.js 物理模拟，粒子 swirls 漩涡碰撞，狂风吹散非选中项，胜者炽金发光，赋予决策极致仪式感。
                  </p>
                </div>

                <div className="glass-card p-6 rounded-2xl border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-teal-950/60 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-slate-200 mb-2">3. 双池沉淀与灵感互助</h3>
                  <p className="text-xs text-slate-400 font-serif leading-relaxed">
                    公开池汇聚大众生活灵感，私人池沉淀个人决策历史时间轴，支持标签筛选、编辑导出与真伪验证。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: PUBLIC POOL VIEW --- */}
        {activeTab === 'public' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-2">
                  <Globe className="w-6 h-6 text-amber-500" />
                  <span>公开决策池</span>
                </h2>
                <p className="text-xs text-slate-400 font-serif mt-1">所有人共享的众包决策流与生活灵感（支持滚动自动加载更多）</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-slate-950/80 p-0.5 rounded-full border border-slate-800 text-xs font-serif backdrop-blur-md">
                  <button
                    onClick={() => setPublicSort('latest')}
                    className={`px-3 py-1 rounded-full transition-all ${
                      publicSort === 'latest'
                        ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    最新时间
                  </button>
                  <button
                    onClick={() => setPublicSort('popular')}
                    className={`px-3 py-1 rounded-full transition-all ${
                      publicSort === 'popular'
                        ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    最热点赞
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={publicTag}
                    onChange={(e) => setPublicTag(e.target.value)}
                    placeholder="按标签过滤 (#美食)"
                    className="px-3 py-1.5 pl-8 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-amber-500 font-serif"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {publicLoading ? (
              <div className="py-20 text-center text-slate-400 font-serif flex flex-col items-center justify-center space-y-3">
                <Wind className="w-8 h-8 text-amber-500 animate-spin" />
                <span>东风正调阅公开池决策列表中...</span>
              </div>
            ) : publicDecisions.length === 0 ? (
              <div className="py-20 text-center glass-panel rounded-2xl border border-slate-800 p-8">
                <p className="font-serif text-slate-400 text-base mb-3">暂无匹配的公开决定</p>
                <button
                  onClick={() => setActiveTab('creator')}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-serif shadow-lg shadow-red-900/30"
                >
                  去发布第一个决定
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publicDecisions.map((item) => (
                    <div key={item.id} className="glass-card rounded-2xl p-5 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg">
                      <div>
                        {/* User Header */}
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-base">{item.guest_avatar || '🍃'}</span>
                            <span className="font-serif text-slate-300">{item.guest_nickname || '听风客'}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>

                        {/* Title */}
                        <h3 className="font-serif font-bold text-base text-slate-100 mb-2">{item.title}</h3>

                        {/* Winner Highlight Box */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 mb-2">
                          <span className="text-[10px] text-amber-500 font-mono block mb-1">东风指引结果</span>
                          <span className="font-serif font-bold text-amber-300 text-lg">{item.winner_text}</span>
                        </div>

                        {/* Candidate Options Breakdown */}
                        <OptionListDisplay
                          options={item.options}
                          winnerId={item.winner_id}
                          winnerText={item.winner_text}
                        />

                        {/* Tags */}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3 mb-2">
                            {item.tags.map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-serif">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 text-xs mt-2">
                        <button
                          onClick={() => handleLikeDecision(item.id)}
                          className="flex items-center space-x-1.5 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Heart className="w-3.5 h-3.5 text-red-500/80" />
                          <span>{item.likes_count || 0}</span>
                        </button>

                        <button
                          onClick={() => {
                            setCurrentDecision(item);
                            setMode(item.mode || 'roulette');
                            setCeremonyOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-[11px] font-serif flex items-center space-x-1"
                          title="播放 D3 全屏揭晓仪式动效"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>演练揭晓</span>
                        </button>

                        <button
                          onClick={() => setVerifyId(item.id)}
                          className="text-amber-500 hover:underline flex items-center space-x-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>验真</span>
                        </button>

                        <button
                          onClick={() => {
                            setTitle(item.title);
                            setOptions(item.options);
                            setActiveTab('creator');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-serif"
                        >
                          我也要问
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Infinite Scroll Sentinel & Loading Indicator */}
                <div ref={publicSentinelRef} className="py-6 text-center text-xs font-serif text-slate-500">
                  {publicLoadingMore && (
                    <div className="flex items-center justify-center space-x-2 text-amber-400">
                      <Wind className="w-4 h-4 animate-spin" />
                      <span>滑动到底部 · 东风正自动调阅更多公开决定...</span>
                    </div>
                  )}
                  {!publicHasMore && publicDecisions.length > 0 && !publicLoading && (
                    <div className="text-slate-600 font-serif">—— 广纳苍生疑虑 · 已加载全部公开决定 ——</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: PRIVATE POOL VIEW --- */}
        {activeTab === 'private' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-serif font-bold text-slate-100 flex items-center space-x-2">
                  <Lock className="w-6 h-6 text-amber-500" />
                  <span>私人历史决策时间轴</span>
                </h2>
                <p className="text-xs text-slate-400 font-serif mt-1">仅你自己可见的决策沉淀与归档（支持滚动自动加载更多）</p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleExportJSON}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-serif text-slate-300 flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出历史 JSON</span>
                </button>
              </div>
            </div>

            {privateLoading ? (
              <div className="py-20 text-center text-slate-400 font-serif flex flex-col items-center justify-center space-y-3">
                <Wind className="w-8 h-8 text-amber-500 animate-spin" />
                <span>正在加载私人历史决策记录...</span>
              </div>
            ) : privateDecisions.length === 0 ? (
              <div className="py-20 text-center glass-panel rounded-2xl border border-slate-800 p-8">
                <p className="font-serif text-slate-400 text-base mb-3">私人池尚无记录</p>
                <button
                  onClick={() => setActiveTab('creator')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold font-serif text-xs shadow-lg shadow-amber-500/20"
                >
                  立即问东风
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {privateDecisions.map((item) => (
                  <div key={item.id} className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-mono">{new Date(item.created_at).toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-serif ${item.is_public ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-400'}`}>
                          {item.is_public ? '已公开' : '私密'}
                        </span>
                      </div>

                      <h3 className="font-serif font-bold text-lg text-slate-100">{item.title}</h3>

                      <div className="flex items-center space-x-2 text-sm font-serif">
                        <span className="text-slate-400">指引胜出:</span>
                        <span className="font-bold text-amber-400 bg-amber-950/30 px-2.5 py-1 rounded border border-amber-500/30">
                          {item.winner_text}
                        </span>
                      </div>

                      {/* Candidate Options Breakdown */}
                      <OptionListDisplay
                        options={item.options}
                        winnerId={item.winner_id}
                        winnerText={item.winner_text}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800/60">
                      <button
                        onClick={() => {
                          setCurrentDecision(item);
                          setMode(item.mode || 'roulette');
                          setCeremonyOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-xs text-amber-300 font-serif flex items-center space-x-1"
                        title="播放 D3 全屏揭晓仪式动效"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>演练揭晓</span>
                      </button>

                      <button
                        onClick={() => setVerifyId(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-amber-400 font-serif flex items-center space-x-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>验真</span>
                      </button>

                      <button
                        onClick={() => handleTogglePublic(item.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-serif"
                      >
                        {item.is_public ? '设为私密' : '转为公开'}
                      </button>

                      <button
                        onClick={() => handleDeleteDecision(item.id)}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/40"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Infinite Scroll Sentinel & Loading Indicator */}
                <div ref={privateSentinelRef} className="py-6 text-center text-xs font-serif text-slate-500">
                  {privateLoadingMore && (
                    <div className="flex items-center justify-center space-x-2 text-amber-400">
                      <Wind className="w-4 h-4 animate-spin" />
                      <span>滑动到底部 · 正在加载更多历史决定...</span>
                    </div>
                  )}
                  {!privateHasMore && privateDecisions.length > 0 && !privateLoading && (
                    <div className="text-slate-600 font-serif">—— 独倚长轩听风 · 已加载全部历史记录 ——</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- MODALS & DRAWERS --- */}
      <CeremonyRevealModal
        isOpen={ceremonyOpen}
        decision={currentDecision}
        mode={mode}
        onClose={() => setCeremonyOpen(false)}
        onComplete={() => {}}
      />

      <VerificationModal
        isOpen={!!verifyId}
        decisionId={verifyId}
        onClose={() => setVerifyId(null)}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        avatars={avatars}
        onAuthSuccess={(userData) => {
          setUser(userData);
          localStorage.setItem('dongfeng_user', JSON.stringify(userData));
        }}
      />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
