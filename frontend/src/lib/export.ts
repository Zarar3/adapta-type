import type { TestResults } from '../types';

export function shareCard(results: TestResults): Promise<string> {
  return new Promise(resolve => {
    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0f1a');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, W, 4);

    // Logo
    ctx.font = 'bold 32px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText('adapta', 60, 80);
    ctx.fillStyle = '#6b7280';
    ctx.fillText('type', 60 + ctx.measureText('adapta').width, 80);

    // Giant WPM
    ctx.font = 'bold 180px monospace';
    ctx.fillStyle = '#facc15';
    ctx.fillText(String(results.wpm), 60, 320);

    // "WPM" label
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = '#374151';
    ctx.fillText('WPM', 60, 360);

    // Right-side stats
    const statsX = W - 320;
    const drawStat = (label: string, value: string, y: number) => {
      ctx.font = '16px monospace';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(label.toUpperCase(), statsX, y);
      ctx.font = 'bold 48px monospace';
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(value, statsX, y + 50);
    };
    drawStat('raw', String(results.rawWpm), 180);
    drawStat('acc', `${results.accuracy}%`, 290);
    drawStat('time', `${results.duration}s`, 400);

    // Struggled patterns
    const struggled = Object.keys(results.ngramMistakes).slice(0, 8);
    if (struggled.length > 0) {
      ctx.font = '16px monospace';
      ctx.fillStyle = '#374151';
      ctx.fillText('struggled with', 60, 430);
      let px = 60;
      for (const ng of struggled) {
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#f87171';
        ctx.fillText(ng, px, 460);
        px += ctx.measureText(ng).width + 24;
      }
    }

    // Watermark
    ctx.font = '16px monospace';
    ctx.fillStyle = '#1f2937';
    ctx.fillText('adaptatype.com', W - 220, H - 24);

    canvas.toBlob(blob => {
      if (!blob) { resolve(''); return; }
      resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

export function downloadShareCard(url: string, wpm: number): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = `adaptatype-${wpm}wpm.png`;
  a.click();
}
