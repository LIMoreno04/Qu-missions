// App.js (replace your existing file with this)
// Note: keeps your Channel component, and the new App implements the QKD simulation flow.

import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Box, Button, Typography, Container, Grid, Paper, FormControl, InputLabel, Select, MenuItem, TextField, Stack, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import logo from "./assets/logo.svg";

/* ------------------------
   Channel component (unchanged core behavior)
   exposes sendPacket({content, color, start, duration})
   ------------------------ */
const Channel = forwardRef(({ name = 'Channel', color = '#4caf50', trackHeight = 16 }, ref) => {
  const [packets, setPackets] = useState([]);

  // expose sendPacket
  useImperativeHandle(ref, () => ({
    sendPacket(packet) {
      const pkt = {
        id: `${Date.now()}-${Math.random()}`,
        content: packet.content ?? 'DATA',
        color: packet.color ?? color,
        start: packet.start ?? 'left',
        duration: packet.duration ?? 2000,
      };
      setPackets((p) => [...p, pkt]);
    }
  }), [color]);

  function removePacket(id) {
    setPackets((p) => p.filter(x => x.id !== id));
  }

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, justifySelf:'center' }}>{name}</Typography>
      <Box sx={{ position: 'relative', height: `${trackHeight}px`, borderRadius: 2 }}>
        <Box sx={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, bgcolor: '#e0e0e0', borderRadius: 2 }} />

        {packets.map((pkt, idx) => {
          const startLeft = pkt.start === 'left' ? '0%' : '100%';
          const endLeft = pkt.start === 'left' ? '100%' : '0%';
          // small offset per packet so they don't overlap exactly
          const verticalOffset = -(idx * 6);

          return (
            <motion.div
              key={pkt.id}
              initial={{ left: startLeft }}
              animate={{ left: endLeft }}
              transition={{ duration: pkt.duration / 1000, ease: 'linear' }}
              onAnimationComplete={() => removePacket(pkt.id)}
              style={{
                position: 'absolute',
                top: '50%',
                transform: `translate(-50%, calc(-50% + ${verticalOffset}px))`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 10px',
                borderRadius: 12,
                background: pkt.color,
                color: '#fff',
                minWidth: 48,
                zIndex: 20,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}
            >
              <span style={{ pointerEvents: 'none', userSelect: 'none' }}>{pkt.content}</span>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
});

/* ------------------------
   Helper utilities
   ------------------------ */
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function randBit() {
  return Math.random() < 0.5 ? 0 : 1;
}
function randBasis() {
  return Math.random() < 0.5 ? 'Z' : 'X';
}
function makeRandomKey(len = 16) {
  // return hex string of len bytes
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------
   Main App
   ------------------------ */
export default function App() {
  const [running, setRunning] = useState(false);
  const [qkdRunning, setQkdRunning] = useState(false);
  const [qkdDone, setQkdDone] = useState(false);

  const classicalCh = useRef();
  const quantumCh = useRef();

  // UI controls (kept for manual sending/debug if you want)
  const [payload, setPayload] = useState('DATA');
  const [startSide, setStartSide] = useState('left');
  const [packetColor, setPacketColor] = useState('#1976d2');
  const [durationMs, setDurationMs] = useState(2000);

  // QKD demo internal state (visible to user)
  const [aliceState, setAliceState] = useState({
    bits: [],            // x_i
    bases: [],           // bA_i
    text: 'idle',
    memoryVisible: true,
  });
  const [bobState, setBobState] = useState({
    bases: [],           // bB_i
    results: [],         // y_i or null if no detection
    text: 'idle',
    memoryVisible: true,
  });
  const [sifted, setSifted] = useState({ indices: [], aliceBits: [], bobBits: [] });
  const [revealedSample, setRevealedSample] = useState([]); // indices revealed and values
  const [qber, setQber] = useState(null);

  // generated shared key (fake)
  const [sharedKey, setSharedKey] = useState(null);

  // ensure safe state updates if unmounted
  useEffect(() => {
    let mounted = true;
    return () => { mounted = false; };
  }, []);

  // re-use channel send functions
  function sendClassical(content, duration = 1800) {
    if (!classicalCh.current) return;
    classicalCh.current.sendPacket({ content, color: '#1976d2', start: 'left', duration });
  }
  function sendQuantum(content, duration = 1400) {
    if (!quantumCh.current) return;
    quantumCh.current.sendPacket({ content, color: '#9c27b0', start: 'left', duration });
  }

  /* ------------------------
     Main QKD simulation sequence (BB84 prepare-and-measure, simplified)
     - purely a visual demo: doesn't compute a secure key, just simulates the steps
     ------------------------ */
  async function runQKDDemo() {
    if (qkdRunning) return;
    setQkdRunning(true);
    setQkdDone(false);
    setSharedKey(null);

    // parameters for demo
    const N = 12;                 // number of pulses to send (small for demo)
    const pulseInterval = 600;    // ms between quantum pulses
    const afterPulsePause = 500;  // small pause for readability
    const sampleSize = 4;         // how many sifted bits to reveal for QBER estimation

    // reset states
    setAliceState({ bits: [], bases: [], text: 'Preparing pulses...', memoryVisible: true });
    setBobState({ bases: [], results: [], text: 'Waiting for pulses...', memoryVisible: true });
    setSifted({ indices: [], aliceBits: [], bobBits: [] });
    setRevealedSample([]);
    setQber(null);

    // Step 1: Alice prepares pulses (generate random bits and bases)
    await sleep(700);
    setAliceState(prev => ({ ...prev, text: 'Choosing random bits & bases' }));
    const aliceBits = [];
    const aliceBases = [];
    for (let i = 0; i < N; i++) {
      aliceBits.push(randBit());
      aliceBases.push(randBasis());
    }
    // update memory
    setAliceState(prev => ({ ...prev, bits: aliceBits, bases: aliceBases }));

    await sleep(900);
    setAliceState(prev => ({ ...prev, text: `Sending ${N} quantum pulses (BB84 states)...` }));
    setBobState(prev => ({ ...prev, text: 'Randomly choosing measurement bases...' }));

    // Step 2: send quantum pulses one by one; Bob measures
    const bobBases = [];
    const bobResults = [];
    for (let i = 0; i < N; i++) {
      // Bob chooses a basis now (we show it)
      const bB = randBasis();
      bobBases.push(bB);
      setBobState(prev => ({ ...prev, bases: [...prev.bases, bB], text: `Measuring pulse ${i+1} in ${bB}` }));

      // Visual quantum packet on screen
      const content = `ψ${i+1}:${aliceBases[i]}${aliceBits[i]}`;
      sendQuantum(content, pulseInterval - 100);

      // Simulate measurement outcome: if same basis, Bob gets Alice's bit (ideal); else random
      await sleep(pulseInterval - 80);
      let y;
      if (bB === aliceBases[i]) {
        y = aliceBits[i]; // ideal channel for demo
      } else {
        y = randBit();
      }
      bobResults.push(y);
      setBobState(prev => ({ ...prev, results: [...prev.results, y], text: `Measured pulse ${i+1} → ${y}` }));

      // show small classical acknowledgment of detection (Bob -> Alice)
      sendClassical(`DET ${i+1}`, 800);
      await sleep(afterPulsePause);
    }

    // finished sending
    setAliceState(prev => ({ ...prev, text: 'All pulses sent' }));
    setBobState(prev => ({ ...prev, text: 'All pulses measured' }));
    await sleep(700);

    // Step 3: Bob sends detection + basis info (classical)
    setBobState(prev => ({ ...prev, text: 'Reporting detected indices & bases (classical)' }));
    const detectedIndices = Array.from({ length: N }, (_, i) => i); // demo: assume all detected
    sendClassical(`REPORT indices:${detectedIndices.join(',')}`, 1400);
    // We'll also show Bob sending his bases
    await sleep(600);
    sendClassical(`REPORT bases:${bobBases.join('')}`, 1400);
    await sleep(900);

    // Step 4: Sifting — reveal bases and keep matching-basis indices
    setAliceState(prev => ({ ...prev, text: 'Receiving report, revealing my bases for sifting...' }));
    // Alice reveals bases (classical)
    await sleep(700);
    sendClassical(`ALICE bases:${aliceBases.join('')}`, 1400);

    // compute sifted indices
    const keepIndices = [];
    const aBitsSifted = [];
    const bBitsSifted = [];
    for (let i = 0; i < N; i++) {
      if (aliceBases[i] === bobBases[i]) {
        keepIndices.push(i);
        aBitsSifted.push(aliceBits[i]);
        bBitsSifted.push(bobResults[i]);
      }
    }
    setSifted({ indices: keepIndices, aliceBits: aBitsSifted, bobBits: bBitsSifted });
    setAliceState(prev => ({ ...prev, text: `Sifting done. Kept ${keepIndices.length} bits.` }));
    setBobState(prev => ({ ...prev, text: `Sifting done. Kept ${keepIndices.length} bits.` }));
    await sleep(1000);

    // Step 5: Parameter estimation — reveal a random sample of sifted bits to estimate QBER
    setAliceState(prev => ({ ...prev, text: 'Selecting sample bits for QBER estimation...' }));
    setBobState(prev => ({ ...prev, text: 'Preparing sample reveal...' }));
    await sleep(600);

    const sampleCount = Math.min(sampleSize, Math.max(0, Math.floor(sifted.indices.length / 2) || sampleSize));
    const sampleIndices = [];
    for (let s = 0; s < sampleCount; s++) {
      // pick first sampleCount sifted indices (deterministic for demo)
      if (sifted.indices[s] !== undefined) sampleIndices.push(sifted.indices[s]);
    }
    const sampleReveal = sampleIndices.map(i => ({ index: i, alice: aliceBits[i], bob: bobResults[i] }));
    setRevealedSample(sampleReveal);

    // show classical reveal messages
    if (sampleReveal.length > 0) {
      sendClassical(`SAMPLE reveal indices:${sampleReveal.map(x => x.index).join(',')}`, 1200);
      await sleep(500);
      sendClassical(`SAMPLE alice:${sampleReveal.map(x => x.alice).join('')}`, 1200);
      await sleep(500);
      sendClassical(`SAMPLE bob:${sampleReveal.map(x => x.bob).join('')}`, 1200);
      await sleep(800);

      // compute QBER
      const errors = sampleReveal.filter(s => s.alice !== s.bob).length;
      const q = sampleReveal.length > 0 ? (errors / sampleReveal.length) : 0;
      setQber(q);
      setAliceState(prev => ({ ...prev, text: `QBER sample shows ${(q*100).toFixed(1)}%` }));
      setBobState(prev => ({ ...prev, text: `QBER sample shows ${(q*100).toFixed(1)}%` }));
    } else {
      setQber(0);
      setAliceState(prev => ({ ...prev, text: 'Not enough sifted bits for sample — assuming 0% QBER (demo)' }));
      setBobState(prev => ({ ...prev, text: 'Not enough sifted bits for sample — assuming 0% QBER (demo)' }));
      await sleep(800);
    }

    await sleep(900);

    // Step 6: Information reconciliation (simulated) - fix mismatches in sifted bits
    setAliceState(prev => ({ ...prev, text: 'Running (simulated) error correction...' }));
    setBobState(prev => ({ ...prev, text: 'Applying corrections (simulated)...' }));
    await sleep(900);

    // For demo: force Bob's sifted bits to match Alice's sifted bits (simulate successful error correction)
    const correctedBobBits = [...sifted.aliceBits];
    setSifted(prev => ({ ...prev, bobBits: correctedBobBits }));
    sendClassical(`EC: syndrome exchanged (simulated)`, 1200);
    await sleep(900);

    // Step 7: Privacy amplification (simulated) -> generate fake shared key
    setAliceState(prev => ({ ...prev, text: 'Privacy amplification: deriving final key (simulated)...' }));
    setBobState(prev => ({ ...prev, text: 'Privacy amplification: deriving final key (simulated)...' }));
    await sleep(800);

    const fakeKey = makeRandomKey(8); // 8 bytes -> 16 hex chars
    setSharedKey(fakeKey);

    // Final: show the final state in boxes and enable Start QIBS
    setAliceState(prev => ({ ...prev, text: `Key established. Ti = ${fakeKey}`, bits: [], bases: [] }));
    setBobState(prev => ({ ...prev, text: `Key established. Ti = ${fakeKey}`, bases: [], results: [] }));
    setSifted({ indices: [], aliceBits: [], bobBits: [] });
    setRevealedSample([]);
    setQber(null);

    // Visual final classical notification
    sendClassical(`KEY_ESTABLISHED Ti:${fakeKey}`, 1600);

    setQkdRunning(false);
    setQkdDone(true);
  }

  // helper small manual sending (retain your manual controls)
  function sendToChannel(ref) {
    if (!ref?.current) return;
    ref.current.sendPacket({ content: payload, color: packetColor, start: startSide, duration: durationMs });
  }

  return (
    <Container maxWidth="lg" sx={{ height: '100vh', display: 'flex', flexDirection: 'column', py: 4 }}>
      {/* logo + titulo */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <div>
          <img src={logo} width={100} height={100} alt="Logo" />
        </div>
        <Box>
          <Typography variant="h5">Quantum green reporting simulator</Typography>
          <Typography variant="caption" color="text.secondary">demo for Quantum Hackathon Latam 2025 — QKD (BB84) visual demo</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {!running && (
          <Box/>
        )}
        {running && (
          <Button variant="outlined" color="error" onClick={() => { setRunning(false); setQkdRunning(false); setQkdDone(false); }}>Stop</Button>
        )}
      </Box>

      {!running ? (
        // Main menu
        <Paper sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} elevation={3}>
          <Typography variant="h4" sx={{ mb: 2 }}>Ready to simulate</Typography>
          <Typography sx={{ mb: 3 }} color="text.secondary">Click "Start Simulation" to open the network view</Typography>
          <Button variant="contained" size="large" onClick={() => setRunning(true)}>Start Simulation</Button>
        </Paper>
      ) : (
        // Simulation view
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems:'center' }}>
          <Grid container sx={{ flex: 1, alignItems: 'center' }}>
            {/* Alice */}
            <Grid item xs={3} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paper sx={{ width: 220, minHeight: 180, p:1.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', flexDirection: 'column' }} elevation={4}>
                <Typography variant="h6">Factory (ALICE)</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{aliceState.text}</Typography>

                <Box sx={{ fontSize: 12, mt: 1 }}>
                  <Typography variant="subtitle2">Memory (visible)</Typography>
                  <Typography variant="caption">Bits: {aliceState.bits.length ? aliceState.bits.join('') : <em>—</em>}</Typography><br />
                  <Typography variant="caption">Bases: {aliceState.bases.length ? aliceState.bases.join('') : <em>—</em>}</Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Channels */}
            <Grid item xs={6} sx={{ px: 2, width:480 }}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Channel ref={classicalCh} name="Classical Channel (C, authenticated)" color="#1976d2" />
                <Box sx={{ height: 24 }} />
                <Channel ref={quantumCh} name="Quantum Channel (Q)" color="#9c27b0" />
              </Box>
            </Grid>

            {/* Bob (SKG) */}
            <Grid item xs={3} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paper sx={{ width: 220, minHeight: 180, p:1.5, display: 'flex', alignItems:'flex-start', justifyContent:'flex-start', flexDirection:'column' }} elevation={4}>
                <Typography variant="h6">Regulator (BOB) / SKG</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{bobState.text}</Typography>

                <Box sx={{ fontSize: 12, mt: 1 }}>
                  <Typography variant="subtitle2">Memory (visible)</Typography>
                  <Typography variant="caption">Bases: {bobState.bases.length ? bobState.bases.join('') : <em>—</em>}</Typography><br />
                  <Typography variant="caption">Results: {bobState.results.length ? bobState.results.join('') : <em>—</em>}</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Controls & status */}
          <Paper
            sx={{
              mt: 3,
              p: 2,
              display: 'flex',
              width: '97%',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            elevation={5}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                justifyContent: 'center', // <-- ensure children are centered
                width: '100%',            // <-- take full width so centering is visible
                flexWrap: 'wrap',        // optional: wrap on small screens
              }}
            >
              {!qkdRunning && !qkdDone && (
                <Button variant="contained" color="primary" onClick={() => runQKDDemo()}>
                  Start QKD
                </Button>
              )}

              {qkdRunning && (
                <Button variant="contained" color="warning" disabled>
                  QKD running...
                </Button>
              )}

              <Button variant="contained" color="secondary" disabled={!qkdDone}>
                Start QIBS
              </Button>
            </Box>
          </Paper>


          {/* bottom: show sifted bits, sample reveal, and final key */}
          <Box sx={{ width: '100%', mt: 2, display: 'flex', gap: 2 }}>
            <Paper sx={{ p: 2, flex: 1 }} elevation={2}>
              <Typography variant="subtitle1">Sifted Bits</Typography>
              <Typography variant="body2" color="text.secondary">Indices: {sifted.indices.length ? sifted.indices.join(',') : <em>—</em>}</Typography>
              <Typography variant="body2" color="text.secondary">Alice: {sifted.aliceBits.length ? sifted.aliceBits.join('') : <em>—</em>}</Typography>
              <Typography variant="body2" color="text.secondary">Bob: {sifted.bobBits.length ? sifted.bobBits.join('') : <em>—</em>}</Typography>
            </Paper>

            <Paper sx={{ p: 2, width: 320 }} elevation={2}>
              <Typography variant="subtitle1">Sample Reveal (QBER)</Typography>
              {revealedSample.length ? (
                <>
                  <Typography variant="body2">Indices: {revealedSample.map(r => r.index).join(',')}</Typography>
                  <Typography variant="body2">Alice: {revealedSample.map(r => r.alice).join('')}</Typography>
                  <Typography variant="body2">Bob: {revealedSample.map(r => r.bob).join('')}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>QBER: {qber !== null ? `${(qber*100).toFixed(1)}%` : <em>—</em>}</Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">— no sample revealed yet —</Typography>
              )}
            </Paper>

            <Paper sx={{ p: 2, width: 320 }} elevation={2}>
              <Typography variant="subtitle1">Final key (simulated)</Typography>
              <Typography variant="body1" sx={{ fontFamily: 'monospace', mt:1 }}>{sharedKey ? sharedKey : <em>(not established)</em>}</Typography>
            </Paper>
          </Box>

        </Box>
      )}
    </Container>
  );
}
