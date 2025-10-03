import React, { useRef, useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Box, Button, Typography, Container, Grid, Paper, Slider, Divider, TextField } from '@mui/material';
import { motion } from 'framer-motion';
import logo from "./assets/logo.svg";
import factory from "./assets/factory.svg";
import house from "./assets/house.svg";

/* ------------------------
   Channel component
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
   Display/truncation helpers
   ------------------------ */
const MAX_DISPLAY_CHARS = 20;

function formatArrayDisplay(arr, sep = '') {
  const full = (arr && arr.length) ? arr.join(sep) : '';
  if (!full) return <em>—</em>;
  const display = full.length > MAX_DISPLAY_CHARS ? full.slice(0, MAX_DISPLAY_CHARS) + '…' : full;
  return (
    <span
      title={full}
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle'
      }}
    >
      {display}
    </span>
  );
}

function formatStringDisplay(s, emptyPlaceholder = <em>(not established)</em>) {
  if (!s) return emptyPlaceholder;
  const display = s.length > MAX_DISPLAY_CHARS ? s.slice(0, MAX_DISPLAY_CHARS) + '…' : s;
  return (
    <span
      title={s}
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: 'monospace'
      }}
    >
      {display}
    </span>
  );
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

  // UI controls
  const [payload, setPayload] = useState('DATA');
  const [startSide, setStartSide] = useState('left');
  const [packetColor, setPacketColor] = useState('#1976d2');
  const [durationMs, setDurationMs] = useState(2000);

  // Channel selection & noise
  const [channelMode, setChannelMode] = useState(null); // 'perfect' | 'noisy' | null
  const [noiseIndex, setNoiseIndex] = useState(0.1); // 0..1
  const [noiseLocked, setNoiseLocked] = useState(false);

  // QKD demo internal state (visible to user)
  const [aliceState, setAliceState] = useState({
    bits: [],            // x_i
    bases: [],           // bA_i
    text: 'idle',
    memoryVisible: true,
    phi: ''
  });
  const [bobState, setBobState] = useState({
    bases: [],           // bB_i
    results: [],         // y_i or null if no detection
    text: 'idle',
    memoryVisible: true,
    phi: ''
  });
  const [sifted, setSifted] = useState({ indices: [], aliceBits: [], bobBits: [] });
  const [revealedSample, setRevealedSample] = useState([]); // indices revealed and values
  const [qber, setQber] = useState(null);

  // generated shared key (bitstring from Alice's sifted bits, simulated)
  const [sharedKey, setSharedKey] = useState(null);

  // NEW: user-configurable QKD parameters
  const [qkdN, setQkdN] = useState(5); // number of qubits
  const [pulseIntervalMs, setPulseIntervalMs] = useState(1000); // ms between quantum pulses
  const [qberSampleSize, setQberSampleSize] = useState(2); // how many sifted bits to reveal

  // tamper/eavesdrop state
  const [tampering, setTampering] = useState(false); // true once the tamper button pressed

  // sign (QIBS) running state (so tamper button can be disabled while signing)
  const [signRunning, setSignRunning] = useState(false);

  // current status shown under buttons (important events)
  const [currentStatus, setCurrentStatus] = useState('Not started');

  // event logs (top -> bottom)
  const [logs, setLogs] = useState([]);

  // ensure safe state updates if unmounted
  useEffect(() => {
    let mounted = true;
    return () => { mounted = false; };
  }, []);

  // logging helpers
  function timeNow() {
    return new Date().toLocaleTimeString();
  }
  function addLog(text) {
    const ts = timeNow();
    setLogs(prev => [...prev, `${ts} — ${text}`]);
  }
  // unified status updater that optionally logs (and optionally injects fictional details)
  function updateStatus(text, shouldLog = false, fakeDetails = null) {
    setCurrentStatus(text);
    if (shouldLog) {
      if (fakeDetails && fakeDetails.type === 'phi') {
        // fakeDetails: { rawPhi: number, encrypted: string }
        addLog(`Selected φ ≈ ${fakeDetails.rawPhi} — encrypted φ = |${fakeDetails.encrypted}⟩`);
      } else if (fakeDetails && fakeDetails.type === 'preP') {
        // fakeDetails: { preimage }
        addLog(`Data collected = ${fakeDetails.preimage} (tons of CO2)`);
        addLog(`Encoded data into |P⟩ (simulated)`);
      } else if (fakeDetails && fakeDetails.type === 'key') {
        addLog(`Simulated shared key established (length = ${fakeDetails.length} bits)`);
      } else {
        addLog(text);
      }
    }
  }

  // re-use channel send functions
  function sendClassical(content, sender, duration = 3800) {
    if (!classicalCh.current) return;
    classicalCh.current.sendPacket({ content, color: '#1976d2', start: sender==='alice' ? 'left' : 'right', duration });
  }
  function sendQuantum(content, duration = 5400) {
    if (!quantumCh.current) return;
    quantumCh.current.sendPacket({ content, color: '#9c27b0', start: 'left', duration });
  }

  // tamper button handler
  function handleTamperClick() {
    // enabled only as a parameter before starting initialization or before starting QIBS:
    if (!running || tampering || qkdRunning || signRunning) return;
    setTampering(true);
    updateStatus('Eavesdropping...', true);
    addLog('Tamper/Eavesdrop engaged — attacker active (50% flip probability per bit during QKD).');
  }

  /* ------------------------
     Main Initialization simulation (formerly QKD)
     - purely a visual demo: doesn't compute a secure key, just simulates the steps
     - produces a simulated sharedKey with length >= 2 * N bits
     - generates phi and sends it to SKG/Bob (with a small fictional raw-phi logged)
     - if tampering active, flips 50% of measured bits and reacts accordingly
     ------------------------ */
  async function runInitialization() {
    if (qkdRunning) return;
    setQkdRunning(true);
    setQkdDone(false);
    setSharedKey(null);
    setLogs([]); // clear logs for a fresh run
    // don't automatically reset tampering here (it stays until Stop); but ensure status
    updateStatus('Initialization started', true);

    // lock noiseIndex (can't be changed while QKD runs)
    setNoiseLocked(true);

    // snapshot noise for this run (locked)
    const noise = channelMode === 'noisy' ? noiseIndex : 0;

    // parameters for demo (now using user-configurable values)
    const N = Math.max(1, parseInt(qkdN, 10) || 5);                 // number of qubits
    const pulseInterval = Math.max(100, parseInt(pulseIntervalMs, 10) || 1000);    // ms between quantum pulses (min 100ms)
    const afterqubitPause = pulseInterval/2;  // small pause for readability
    const sampleSize = Math.max(0, parseInt(qberSampleSize, 10) || 2);         // how many sifted bits to reveal for QBER estimation

    // reset states
    setAliceState({ bits: [], bases: [], text: 'Preparing qubits...', memoryVisible: true, phi: '' });
    setBobState({ bases: [], results: [], text: 'Waiting for qubits...', memoryVisible: true, phi: '' });
    setSifted({ indices: [], aliceBits: [], bobBits: [] });
    setRevealedSample([]);
    setQber(null);

    // Step 1: Alice prepares qubits (generate random bits and bases)
    updateStatus('Choosing random bits & bases', false);
    const aliceBits = [];
    const aliceBases = [];
    for (let i = 0; i < N; i++) {
      aliceBits.push(randBit());
      aliceBases.push(randBasis());
    }
    // update memory
    setAliceState(prev => ({ ...prev, bits: aliceBits, bases: aliceBases }));

    await sleep(700);
    updateStatus(`Sending ${N} qubits (BB84 states)...`, false);
    setBobState(prev => ({ ...prev, text: 'Randomly choosing measurement bases...' }));

    // Step 2: send qubits one by one; Bob measures
    const bobBases = [];
    const bobResults = [];
    let tamperIntroducedCount = 0;
    for (let i = 0; i < N; i++) {
      // Bob chooses a basis now (we show it)
      const bB = randBasis();
      bobBases.push(bB);
      setBobState(prev => ({ ...prev, bases: [...prev.bases, bB], text: `Measuring qubit ${i+1} in ${bB}` }));

      // Visual quantum packet on screen (represent state compactly)
      const content =  `| ${aliceBases[i] === 'Z' ? (aliceBits[i] === 0 ? '0' : '1') : (aliceBits[i] === 0 ? '+' : '-')} ⟩`;
      sendQuantum(content, Math.max(100, pulseInterval - 100));

      // Simulate measurement outcome with noise model:
      // with probability 'noise' the outcome is fully random (channel noise)
      // otherwise behave as ideal BB84: if same basis -> alice bit, else random.
      await sleep(pulseInterval - 80);
      let y;
      if (Math.random() < noise) {
        // noise dominates -> random outcome independent of alice
        y = randBit();
      } else {
        if (bB === aliceBases[i]) {
          y = aliceBits[i];
        } else {
          y = randBit();
        }
      }

      // If tampering is active, introduce 50% chance to flip this measured bit
      if (tampering) {
        if (Math.random() < 0.5) {
          y = 1 - y; // flip
          tamperIntroducedCount++;
        }
      }

      bobResults.push(y);
      setBobState(prev => ({ ...prev, results: [...prev.results, y], text: `Measured qubit ${i+1} → ${y}` }));
      await sleep(afterqubitPause);
    }

    // finished sending
    setAliceState(prev => ({ ...prev, text: 'All qubits sent' }));
    setBobState(prev => ({ ...prev, text: 'All qubits measured' }));
    await sleep(700);

    // Step 3: Bob sends detection + basis info (classical)
    setBobState(prev => ({ ...prev, text: 'Reporting detected indices & bases' }));
    const detectedIndices = Array.from({ length: N }, (_, i) => i); // demo: assume all detected
    sendClassical(`Detected: ${detectedIndices.join(',')}`,'bob', pulseInterval);
    // We'll also show Bob sending his bases
    await sleep(afterqubitPause);
    sendClassical(`Bases: ${bobBases.join('')}`,'bob', pulseInterval);

    // Step 4: Sifting — reveal bases and keep matching-basis indices
    updateStatus('Revealing bases for sifting', false);
    await sleep(afterqubitPause);
    sendClassical(`Bases: ${aliceBases.join('')}`,'alice', pulseInterval);

    // compute sifted indices (locally)
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

    // set sifted state for UI
    setSifted({ indices: keepIndices, aliceBits: aBitsSifted, bobBits: bBitsSifted });
    updateStatus(`Sifting done — kept ${keepIndices.length} bits`, false);
    setBobState(prev => ({ ...prev, text: `Sifting done. Kept ${keepIndices.length} bits.` }));
    await sleep(afterqubitPause);

    // Step 5: Parameter estimation (simulated)
    updateStatus('Selecting sample bits for QBER estimation', false);
    setBobState(prev => ({ ...prev, text: 'Preparing sample reveal...' }));
    await sleep(afterqubitPause);

    // pick up to sampleSize indices from keepIndices (deterministic: first ones)
    const sampleIndices = keepIndices.slice(0, sampleSize);
    const sampleReveal = sampleIndices.map(i => ({ index: i, alice: aliceBits[i], bob: bobResults[i] }));
    setRevealedSample(sampleReveal);

    // show classical reveal messages
    if (sampleReveal.length > 0) {
      sendClassical(`SAMPLE indices:${sampleReveal.map(x => x.index).join(',')}`,'alice', Math.round(pulseInterval));
      await sleep(afterqubitPause);
      sendClassical(`SAMPLE alice:${sampleReveal.map(x => x.alice).join('')}`,'alice', pulseInterval);
      await sleep(afterqubitPause);
      sendClassical(`SAMPLE bob:${sampleReveal.map(x => x.bob).join('')}`,'bob', pulseInterval);
      await sleep(afterqubitPause);

      // compute QBER from sample (this is our simulated estimate shown to user)
      const errors = sampleReveal.filter(s => s.alice !== s.bob).length;
      const q = sampleReveal.length > 0 ? (errors / sampleReveal.length) : 0;
      setQber(q);
      updateStatus(`QBER sample (simulated) ≈ ${(q*100).toFixed(1)}%`, false);

      // If tampering was active, log theoretical detection probability for N qubits
      if (tampering) {
        const pDetect = 1 - Math.pow(0.5, N);
        addLog(`Probability to detect eavesdropper over ${N} qubits ≈ ${(pDetect*100).toFixed(3)}%`);
      }

      // If tampering was active, decide whether to abort and log proof
      if (tampering) {
        // If QBER <= 45% treat as a detectable eavesdrop (log proof and abort)
        if (q <= 0.45) {
          addLog(`Eavesdropping detected: sample QBER ${(q*100).toFixed(1)}% — proof of an eavesdropper (tamper flips introduced: ${tamperIntroducedCount})`);
          updateStatus('Eavesdrop detected — aborting initialization', true);
          setAliceState(prev => ({ ...prev, text: 'Initialization aborted due to detected eavesdropping' }));
          setBobState(prev => ({ ...prev, text: 'Initialization aborted due to detected eavesdropping' }));
          setNoiseLocked(false);
          setQkdRunning(false);
          setQkdDone(false);
          return; // abort rest of init
        } else {
          // QBER extremely high — log and abort (channel compromised)
          addLog(`High QBER after tampering: ${(q*100).toFixed(1)}% — channel severely compromised (abort)`);
          updateStatus('High QBER (>45%) — aborting initialization', true);
          setAliceState(prev => ({ ...prev, text: 'Initialization aborted — channel compromised (high QBER)' }));
          setBobState(prev => ({ ...prev, text: 'Initialization aborted — channel compromised (high QBER)' }));
          setNoiseLocked(false);
          setQkdRunning(false);
          setQkdDone(false);
          return;
        }
      }
    } else {
      setQber(0);
      updateStatus('Not enough sifted bits for sample — assuming 0% QBER', false);
      await sleep(afterqubitPause/2);
    }

    await sleep(600);

    // Step 6: Information reconciliation (simulated) - fix mismatches in sifted bits
    updateStatus('Running simulated error correction', false);
    setBobState(prev => ({ ...prev, text: 'Applying corrections (simulated)...' }));
    await sleep(afterqubitPause);

    // For demo: simulate successful error correction by forcing Bob's bits to match Alice's sifted bits
    const correctedBobBits = [...aBitsSifted];
    setSifted(prev => ({ ...prev, bobBits: correctedBobBits }));
    sendClassical(`EC (simulated)`,'alice' , pulseInterval);
    await sleep(afterqubitPause);

    // Step 7: Privacy amplification (simulated)
    updateStatus('Deriving final key (simulated)', false);
    await sleep(afterqubitPause);

    // Simulate final key as a random bitstring of length >= 2 * N (explicitly requested)
    const desiredLen = Math.max(2 * N, Math.max(0, aBitsSifted.length));
    const simulatedKeyBits = Array.from({ length: desiredLen }, () => randBit()).join('');
    setSharedKey(simulatedKeyBits);

    // Important: log key creation as an important event (no real key revealed, only length)
    updateStatus(`Key derived (simulated) — length ${simulatedKeyBits.length} bits`, true, { type: 'key', length: simulatedKeyBits.length });

    setAliceState(prev => ({ ...prev, text: `Key (simulated) = ${simulatedKeyBits ? (simulatedKeyBits.length>20 ? `${simulatedKeyBits.slice(0,20)}...` : simulatedKeyBits) : '(empty)'}`}));
    setBobState(prev => ({ ...prev, text: `Key (simulated) = ${simulatedKeyBits ? (simulatedKeyBits.length>20 ? `${simulatedKeyBits.slice(0,20)}...` : simulatedKeyBits) : '(empty)'}`}));

    await sleep(500);

    // Now: generate random phi and send it to SKG/Bob (simulated)
    // We'll create a fictional raw phi (0..2π) and an encrypted/transport token (hex)
    if (!tampering) {
      updateStatus('generating random phi', true);
      await sleep(800);
      const rawPhi = (Math.random() * 2 * Math.PI).toFixed(4);
      const phiEncrypted = `${Math.random() < 0.5 ? '0' : '1'}${Math.random() < 0.5 ? '0' : '1'}${Math.random() < 0.5 ? '0' : '1'}${Math.random() < 0.5 ? '0' : '1'}${Math.random() < 0.5 ? '0' : '1'}${Math.random() < 0.5 ? '0' : '1'}`; // short hex token used in simulation
      // log raw & encrypted via updateStatus's fakeDetails
      updateStatus(`φ selected and encrypted`, true, { type: 'phi', rawPhi: rawPhi, encrypted: phiEncrypted });

      // set local phi
      setAliceState(prev => ({ ...prev, phi: phiEncrypted, text: `Sending ENC(φ) = ${phiEncrypted} to SKG/Bob` }));
      // send the 'encrypted' phi on the classical channel visually as a quantum-like packet (for demo)
      sendQuantum(`φ: ${phiEncrypted}`, pulseInterval*2);
      await sleep(2200);
      setBobState(prev => ({ ...prev, phi: phiEncrypted, text: `Received ENC(φ) = ${phiEncrypted}` }));
      addLog(`φ (encrypted) delivered to SKG/Bob: ${phiEncrypted}`);

      await sleep(400);

      // Initialization complete
      updateStatus('Initialization complete', true);
      setAliceState(prev => ({ ...prev, text: 'Initialization complete' }));
      setBobState(prev => ({ ...prev, text: 'Initialization complete (SKG/Bob)' }));
      setNoiseLocked(false);
      setQkdRunning(false);
      setQkdDone(true);
    } else {
      // when tampering: phi is intentionally not shown/sent; log the detection probability as above (already logged)
      updateStatus('Initialization complete (tampering active — φ withheld)', true);
      setAliceState(prev => ({ ...prev, text: 'Initialization aborted/finished with tampering — φ withheld' }));
      setBobState(prev => ({ ...prev, text: 'Initialization aborted/finished with tampering — φ withheld' }));
      setNoiseLocked(false);
      setQkdRunning(false);
      setQkdDone(false);
    }
  }

  /* ------------------------
     Signing simulation (pure simulation, no noise, no seal)
     - On click: simulate computing S = ENC(P) (Alice shows message),
       then send quantum packets (|P⟩, |S⟩, |ID⟩) to Bob (SKG/Bob).
     - Bob shows reception and simulated verification messages.
     - If tampering active, logs mismatched P and computed P (tampering)
     ------------------------ */
  async function signAndSend() {
    if (!qkdDone || qkdRunning || signRunning) return;

    setSignRunning(true);

    const P_label = '|P⟩';
    const S_label = '|S⟩';
    const ID_label = '|ID⟩';

    // Make a fictional preimage for P (human-friendly number)
    const preimage = Math.floor(Math.random() * 1_000_000);
    updateStatus('Converting classical message to |P⟩ (simulated)', true, { type: 'preP', preimage: preimage });
    // also add a dedicated log entry (updateStatus already logged)
    await sleep(900);

    setAliceState(prev => ({ ...prev, text: 'Computing |S⟩ from |P⟩ using ENC (from OTP) and φ (simulated)...' }));
    updateStatus('Computing |S⟩ from |P⟩ using ENC (from OTP) and φ (simulated)', true);
    await sleep(900);

    addLog(`Computed |S⟩ (simulated)`);

    setAliceState(prev => ({ ...prev, text: 'Computed |S⟩ (simulated). Sending signed quantum packet to Bob...' }));
    await sleep(400);

    // Send the three quantum systems as separate packets (label-only)
    sendQuantum(P_label, 2500);
    addLog('Sent |P⟩ over Q');
    // small gap
    await sleep(450);
    sendQuantum(S_label, 2500);
    addLog('Sent |S⟩ over Q');
    await sleep(450);
    sendQuantum(ID_label, 2500);
    addLog('Sent |ID⟩ over Q');

    // Update Bob's state as they arrive (timed to match durations)
    await sleep(1600);
    setBobState(prev => ({ ...prev, text: 'Received |P⟩ (stored)' }));
    await sleep(1600);
    setBobState(prev => ({ ...prev, text: 'Received |S⟩ and |ID⟩ — verifying (simulated)...' }));
    updateStatus('Bob computes his own |S⟩ from ENC, φ and |P⟩ (simulated)', true);
    await sleep(1600);

    // Simulate verification flow inside SKG/Bob
    setBobState(prev => ({ ...prev, text: 'Decrypting |S⟩ with shared key and phi (simulated)...' }));
    await sleep(2000);

    // If tampering active during QIBS, show mismatch and log tampering
    if (tampering) {
      setBobState(prev => ({ ...prev, text: 'Verification failed — tampering detected (|P⟩ mismatch)' }));
      setAliceState(prev => ({ ...prev, text: 'Signature sent — but tampering detected (simulated)' }));
      addLog('Tampering detected in QIBS: Bob\'s computed P != received P — message integrity compromised');
      updateStatus('Tampering detected during QIBS — signature invalid', true);
      setSignRunning(false);
      return;
    }

    // Normal (no tamper) acceptance
    setBobState(prev => ({ ...prev, text: 'Verification complete — signature accepted' }));
    setAliceState(prev => ({ ...prev, text: 'Signature sent — awaiting confirmation' }));
    updateStatus('Signature accepted by SKG/Bob', true);
    addLog('Bob computed P matches received P — message accepted (simulated)');
    setSignRunning(false);
  }


  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100vh', p: 3, boxSizing: 'border-box' }}>
      {/* Main simulation column */}
      <Container maxWidth="lg" sx={{ flex: 1, display: 'flex', flexDirection: 'column', py: 0 }}>
        {/* logo + titulo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <div>
            <img src={logo} width={80} height={80} alt="Logo" />
          </div>
          <Box>
            <Typography variant="h5">Quantum green reporting simulator</Typography>
            <Typography variant="caption" color="text.secondary">demo for Quantum Hackathon Latam 2025 — QKD (BB84) + QIBS simulator</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          {running && (
            <Button variant="outlined" color="error" disabled={qkdRunning} onClick={() => {
              // Stop/reset: clear states and reset tampering
              setRunning(false);
              setQkdRunning(false);
              setQkdDone(false);
              setChannelMode(null);
              setNoiseLocked(false);
              setNoiseIndex(0.1);
              setSharedKey(null);
              setQber(null);
              setAliceState({ bits: [], bases: [], text: 'idle', memoryVisible: true, phi: '' });
              setBobState({ bases: [], results: [], text: 'idle', memoryVisible: true, phi: '' });
              setSifted({ indices: [], aliceBits: [], bobBits: [] });
              setRevealedSample([]);
              setCurrentStatus('Stopped');
              setLogs([]);
              setTampering(false);
            }}>Stop</Button>
          )}
        </Box>

        {!running ? (
          // Main menu now with two start buttons: Perfect and Noisy
          <Paper sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} elevation={3}>
            <Typography variant="h4" sx={{ mb: 2 }}>Ready to simulate</Typography>
            <Typography sx={{ mb: 3 }} color="text.secondary">Choose channel type and open the network view</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" size="large" onClick={() => { setChannelMode('perfect'); setNoiseIndex(0); setRunning(true); setTampering(false); }}>
                Start Simulation (Perfect channel)
              </Button>
              <Button variant="contained" size="large" color="secondary" onClick={() => { setChannelMode('noisy'); setNoiseIndex(0.1); setRunning(true); setTampering(false); }}>
                Start Simulation (Noisy channel)
              </Button>
            </Box>
          </Paper>
        ) : (
          // Simulation view
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems:'center', gap: 2 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', gap: 2 }}>

              {/* Buttons row (centered) */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, width: '100%' }}>
                <Button variant="contained" onClick={runInitialization} disabled={qkdRunning} >
                  {qkdRunning ? 'Initializing...' : qkdDone ? 'Re-run Initialization' : 'Start Initialization (QKD)'}
                </Button>
                <Button variant="contained" color="success" onClick={signAndSend} disabled={!qkdDone || qkdRunning || signRunning}>
                  Sign & Send Message (QIBS)
                </Button>
              </Box>

              {/* Current status centered */}
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">Current status:</Typography>
                <Typography variant="body2" color="text.primary"><strong>{currentStatus}</strong></Typography>
              </Box>

              {/* Main simulation row: Alice | Channels (flex) | Bob */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'stretch',
                  width: '100%',
                  gap: 2,
                  flex: 1,
                  minHeight: 240,
                }}
              >
                {/* Alice panel (left) */}
                <Paper
                  elevation={4}
                  sx={{
                    width: 260,
                    minHeight: 220,
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                  }}
                >
                  <Typography variant="h6">Factory (ALICE)</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{aliceState.text}</Typography>

                  <Box sx={{ fontSize: 12, mt: 1 }}>
                    <Typography variant="subtitle2">Memory</Typography>
                    <Typography variant="caption">Bits: {formatArrayDisplay(aliceState.bits, '')}</Typography><br />
                    <Typography variant="caption">Bases: {formatArrayDisplay(aliceState.bases, '')}</Typography><br />
                    <Typography variant="caption">Key: {!!sharedKey ? (sharedKey.length>20 ? `${sharedKey.slice(0,20)}...` : sharedKey) : '—'}</Typography><br />
                    <Typography variant="caption">φ (encrypted): {!!aliceState.phi ? (aliceState.phi.length>15 ? `${aliceState.phi.slice(0,15)}...` : aliceState.phi) : '—'}</Typography>
                  </Box>
                  <div style={{ flex: 1, alignContent:'center', textAlign:'center' }} >
                    <img src={factory} alt="Factory" style={{ width: '100%', marginTop: 8, opacity: 0.5 }} />
                  </div>
                </Paper>

                {/* Channels column (flexible) */}
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    py: 1,
                  }}
                >
                  <Box sx={{ width: '100%', maxWidth: 760 }}>
                    <Channel ref={classicalCh} name="Classical Channel (C)" color="#1976d2" />
                  </Box>
                  <Box sx={{ height: 12 }} />
                  <Box sx={{ width: '100%', maxWidth: 760 }}>
                    <Channel ref={quantumCh} name="Quantum Channel (Q)" color="#9c27b0" />
                  </Box>

                  {/* Tamper / Eavesdrop button placed just below the quantum channel */}
                  <Box sx={{ mt: 1 }}>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={handleTamperClick}
                      disabled={!running || tampering || qkdRunning || signRunning}
                    >
                      {tampering ? 'Eavesdropping...' : 'Tamper / Eavesdrop'}
                    </Button>
                  </Box>
                </Box>

                {/* Bob panel (right) */}
                <Paper
                  elevation={4}
                  sx={{
                    width: 260,
                    minHeight: 220,
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                  }}
                >
                  <Typography variant="h6">Regulator (BOB) / SKG</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{bobState.text}</Typography>

                  <Box sx={{ fontSize: 12, mt: 1 }}>
                    <Typography variant="subtitle2">Memory</Typography>
                    <Typography variant="caption">Bases: {formatArrayDisplay(bobState.bases, '')}</Typography><br />
                    <Typography variant="caption">Measured: {formatArrayDisplay(bobState.results, '')}</Typography><br />
                    <Typography variant="caption">Key: {!!sharedKey ? (sharedKey.length>20 ? `${sharedKey.slice(0,20)}...` : sharedKey) : '—'}</Typography><br />
                    <Typography variant="caption">φ (encrypted): {!!bobState.phi ? (bobState.phi.length>15 ? `${bobState.phi.slice(0,15)}...` : bobState.phi) : '—'}</Typography>
                  </Box>
                  <div style={{ flex: 1, alignContent:'center', textAlign:'center' }} >
                    <img src={house} alt="Regulator" style={{ width: '60%', marginTop: 8, opacity: 0.5 }} />
                    <Box sx={{ backgroundColor:'black',opacity:0.25, width:'50%', margin:'12px auto 0 auto', borderRadius:2, paddingY:1 }} >
                      <Typography variant="subtitle2" color="white">SKG</Typography>
                    </Box>
                  </div>
                </Paper>
              </Box>

              {/* Controls & parameters area (single full-width paper) */}
              <Paper elevation={5} sx={{ width: '97.25%', p: 2 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Channel: <strong>{channelMode === 'noisy' ? 'Noisy' : channelMode === 'perfect' ? 'Perfect' : '—'}</strong>
                    </Typography>

                    {channelMode === 'noisy' && (
                      <Box sx={{ width: 280 }}>
                        <Typography variant="caption" display="block">Noise index {noiseLocked ? '(locked)' : '(editable)'}</Typography>
                        <Slider
                          value={noiseIndex}
                          min={0}
                          max={1}
                          step={0.01}
                          disabled={noiseLocked || qkdRunning}
                          onChange={(e, v) => setNoiseIndex(typeof v === 'number' ? v : v[0])}
                          valueLabelDisplay="auto"
                          aria-labelledby="noise-slider"
                        />
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      label="Transmission duration (ms)"
                      size="small"
                      variant="outlined"
                      type="number"
                      value={pulseIntervalMs}
                      onChange={(e) => setPulseIntervalMs(Number(e.target.value))}
                      disabled={qkdRunning}
                      inputProps={{ min: 50, step: 50 }}
                    />

                    <TextField
                      label="N (qubits)"
                      size="small"
                      variant="outlined"
                      type="number"
                      value={qkdN}
                      onChange={(e) => setQkdN(Number(e.target.value))}
                      disabled={qkdRunning}
                      inputProps={{ min: 1, step: 1 }}
                    />

                    <TextField
                      label="Sample size for QBER"
                      size="small"
                      variant="outlined"
                      type="number"
                      value={qberSampleSize}
                      onChange={(e) => setQberSampleSize(Number(e.target.value))}
                      disabled={qkdRunning}
                      inputProps={{ min: 0, step: 1 }}
                    />
                  </Box>
                </Box>
              </Paper>

              {/* Bottom info row: Sifted | Sample | Key */}
              <Box sx={{ display: 'flex', gap: 2, width: '100%', alignItems: 'stretch' }}>
                <Paper sx={{ p: 2, flex: 1 }} elevation={5}>
                  <Typography variant="subtitle1">Sifted Bits (matching bases)</Typography>
                  <Typography variant="body2" color="text.secondary">Indices: {formatArrayDisplay(sifted.indices, ',')}</Typography>
                  <Typography variant="body2" color="text.secondary">Alice: {formatArrayDisplay(sifted.aliceBits, '')}</Typography>
                  <Typography variant="body2" color="text.secondary">Bob: {formatArrayDisplay(sifted.bobBits, '')}</Typography>
                </Paper>

                <Paper sx={{ p: 2, width: 320 }} elevation={5}>
                  <Typography variant="subtitle1">Sample Revealed (QBER)</Typography>
                  {revealedSample.length ? (
                    <>
                      <Typography variant="body2">Indices: {formatArrayDisplay(revealedSample.map(r => r.index), ',')}</Typography>
                      <Typography variant="body2">Alice: {formatArrayDisplay(revealedSample.map(r => r.alice), '')}</Typography>
                      <Typography variant="body2">Bob: {formatArrayDisplay(revealedSample.map(r => r.bob), '')}</Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>QBER: {qber !== null ? `${(qber*100).toFixed(1)}%` : <em>—</em>}</Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">— no sample revealed yet —</Typography>
                  )}
                </Paper>

                <Paper sx={{ p: 2, width: 320 }} elevation={5}>
                  <Typography variant="subtitle1">Final key</Typography>
                  <Typography variant="caption" color="text.secondary">Simulated shared key (length ≥ 2·N)</Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', mt:1 }}>
                    {formatStringDisplay(sharedKey, <em>(not established)</em>)}
                  </Typography>
                </Paper>
              </Box>
            </Box>

          </Box>
        )}
      </Container>

      {/* Right column: Event Log */}
      <Paper sx={{ width: 360, p: 2, display: 'flex', flexDirection: 'column', gap: 1, boxSizing: 'border-box' }} elevation={6}>
        <Typography variant="h6">Event Log</Typography>
        <Divider />
        <Box sx={{ mt: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 140px)', pr: 1 }}>
          {logs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">— no important events yet —</Typography>
          ) : (
            logs.map((line, idx) => (
              <Typography key={idx} variant="body2" sx={{ mb: 0.7, whiteSpace: 'pre-wrap' }}>{line}</Typography>
            ))
          )}
        </Box>
      </Paper>
    </Box>
  );
}
