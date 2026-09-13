// Distinct audio cues per alert type (spec §51), generated with the
// Web Audio API rather than requiring external sound files — closes
// the "supply your own .mp3" gap from the first draft. Swap in real
// files later by replacing playPatternOnce()'s body if you want a more
// polished sound; the event wiring below doesn't need to change.
import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

// [frequencyHz, durationMs] pairs per alert type — boundary/rescue
// alerts use a fast two-tone siren, weather uses a slower single tone
// so they're distinguishable by ear, not just by toast text.
const TONE_PATTERNS = {
  'out-of-bounds': [[880, 180], [660, 180]],
  'rescue-alert': [[880, 180], [660, 180]],
  'weather-emergency': [[440, 400], [0, 150]],
};

export function useAudioAlertManager({ muted = false } = {}) {
  const audioCtxRef = useRef(null);
  const loopHandlesRef = useRef({});

  const getContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    return audioCtxRef.current;
  };

  // Browsers suspend AudioContext until a user gesture. Without this,
  // the very first alert tone would silently fail to play if no one
  // has clicked anywhere on the page yet.
  useEffect(() => {
    const unlock = () => {
      const ctx = getContext();
      if (ctx.state === 'suspended') ctx.resume();
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playPatternOnce = (pattern) => {
    const ctx = getContext();
    let t = ctx.currentTime;
    for (const [freq, durationMs] of pattern) {
      if (freq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = 0.15;
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + durationMs / 1000);
      }
      t += durationMs / 1000;
    }
    return (t - ctx.currentTime) * 1000; // total pattern duration in ms
  };

  const play = (event) => {
    if (muted) return;
    const pattern = TONE_PATTERNS[event];
    if (!pattern) return;
    if (loopHandlesRef.current[event]) return; // already looping

    const cycle = () => {
      const durationMs = playPatternOnce(pattern);
      loopHandlesRef.current[event] = setTimeout(cycle, durationMs + 400);
    };
    cycle();
  };

  const stop = (event) => {
    const handle = loopHandlesRef.current[event];
    if (handle) {
      clearTimeout(handle);
      delete loopHandlesRef.current[event];
    }
  };

  const stopAll = () => Object.keys(loopHandlesRef.current).forEach(stop);

  useEffect(() => {
    const flightAlerts = supabase.channel('flight-alerts', { config: { private: true } });
    flightAlerts
      .on('broadcast', { event: 'out-of-bounds' }, () => play('out-of-bounds'))
      .on('broadcast', { event: 'rescue-alert' }, () => play('rescue-alert'))
      .subscribe();

    const weatherAlerts = supabase.channel('weather-alerts', { config: { private: true } });
    weatherAlerts.on('broadcast', { event: 'weather-emergency' }, () => play('weather-emergency')).subscribe();

    return () => {
      supabase.removeChannel(flightAlerts);
      supabase.removeChannel(weatherAlerts);
      stopAll();
      audioCtxRef.current?.close();
    };
  }, [muted]);

  return { stop, stopAll };
}
