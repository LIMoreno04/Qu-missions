import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Box, Button, Typography, Container, Grid, Paper, FormControl, InputLabel, Select, MenuItem, TextField, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import logo from "./assets/logo.svg";
// Channel component: renders a track and animates 'packets' moving along it.
// Exposes sendPacket({id?, content, color?, start: 'left' | 'right', duration?}) via ref
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

export default function App() {
  const [running, setRunning] = useState(false);
  const ch1 = useRef();
  const ch2 = useRef();

  const [payload, setPayload] = useState('DATA');
  const [startSide, setStartSide] = useState('left');
  const [packetColor, setPacketColor] = useState('#1976d2');
  const [durationMs, setDurationMs] = useState(2000);

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
          <Typography variant="caption" color="text.secondary">demo for Quantum Hackathon Latam 2025</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {!running && (
          <Box/>
        )}
        {running && (
          <Button variant="outlined" color="error" onClick={() => setRunning(false)}>Stop</Button>
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
              <Paper sx={{ width: 180, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }} elevation={4}>
                <Typography variant="h6">Factory (ALICE)</Typography>
              </Paper>
            </Grid>

            {/* Canales de comunicacion */}
            <Grid item xs={6} sx={{ px: 2, width:480 }}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Channel ref={ch1} name="Classical Channel" color="#1976d2" />
                <Box sx={{ height: 24 }} />
                <Channel ref={ch2} name="Quantum Channel" color="#9c27b0" />
              </Box>
            </Grid>

            {/* Bob */}
            <Grid item xs={3} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Paper sx={{ width: 180, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection:'column' }} elevation={4}>
                <Typography variant="h6">Regulator (BOB)</Typography>
                <Typography variant="h6">SKG</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Controles */}
          <Paper sx={{ mt: 3, p: 2, display:'inline' }} elevation={5}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField fullWidth label="Payload (component)" value={payload} onChange={(e) => setPayload(e.target.value)} />
              </Grid>
              <Grid item xs={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel id="start-side-label">Start side</InputLabel>
                  <Select labelId="start-side-label" value={startSide} label="Start side" onChange={(e) => setStartSide(e.target.value)}>
                    <MenuItem value="left">Left → Right</MenuItem>
                    <MenuItem value="right">Right → Left</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth label="Color (hex)" value={packetColor} onChange={(e) => setPacketColor(e.target.value)} />
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField fullWidth label="Duration (ms)" type="number" value={durationMs} onChange={(e) => setDurationMs(Number(e.target.value))} />
              </Grid>

              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={2}>
                  <Button variant="contained" onClick={() => sendToChannel(ch1)}>Send → Classical Channel</Button>
                  <Button variant="contained" onClick={() => sendToChannel(ch2)}>Send → Quantum Channel</Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
    </Container>
  );
}
