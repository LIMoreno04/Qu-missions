# Qu-missions

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![Qiskit](https://img.shields.io/badge/Qiskit-%236929C4.svg?style=for-the-badge&logo=Qiskit&logoColor=white)

> Ensuring fair-play and transparency in climate impact reporting with quantum communication.

**Guiding question:** How do we confirm that climate impact reports are valid, untampered, and secure, both in their physical origin and in their digital transmission?

**Context:** Trillions of dollars are being mobilized through green economic mechanisms like carbon trading markets and sustainability loans[^1]. Uruguay itself pioneered a world-first [sovereign sustainability-linked bond](https://www.mef.gub.uy/30687/20/areas/uruguays-sovereign-sustainability-linked-bond-sslb.html), tying the country’s debt interest rates directly to verified emissions performance. Transparent metric validation can boost investor trust, open science and policy impact, all essential for comprehensive and effective climate action. 

These instruments only function if the underlying measurements are accurate and transparent. At the same time, weak points in reporting open the door for manipulation: bad actors could exploit loopholes, alter data, or under-report emissions[^2]. Assuring the integrity of both the measurements and their transmission is therefore critical. 

**Technical solution:** We propose an end-to-end quantum-enabled system for trustworthy climate reporting, combining three complementary components:

1. *Quantum Key Distribution* — secures data in transit, validating unmediated provenance and detecting interception attempts.
2. *Quantum Digital Signatures* — coupled with QKD, provides non-repudiation and source identification, preventing disputes about the report’s origin.
3. *Physical Quantum Seals* — protects the measurement infrastructure, ensuring sensors and devices cannot be tampered with or manipulated.

**Scale & Feasibility:** Foundational theory on quantum signatures have outlined an approach to quantum-enabled authentication[^3].  Identity-based quantum protocols have been demonstrated in the context of a secure QKD communication[^4] and a 280-km signatured has been achieved[^5]. As well, advancements in practical QKD have been shown, like a satellite-to-ground linkage[^6], showcasing practical viability. In addition, schematic quantum seals using entangled photon sources have been proposed[^7].

## Bibliography

[^1]: United Nations Conference on Trade & Development, *Sustainable Finance Trends*, https://unctad.org/system/files/official-document/wir2025_ch03_en.pdf

[^2]: The Guardian, *Ex-carbon offsetting boss charged in New York with multimillion-dollar fraud*, https://www.theguardian.com/environment/2024/oct/04/ex-carbon-offsetting-boss-kenneth-newcombe-charged-in-new-york-with-multimillion-dollar

[^3]: Chuang, Gottesman, *Quantum Digital Signatures*, https://arxiv.org/abs/quant-ph/0105032

[^4]: Mohanty, Srivastava, et al, *An Experimentally Validated Feasible Quantum Protocol for Identity-Based Signature with Application to Secure Email Communication*, https://arxiv.org/abs/2403.18247v1

[^5]: Ding, Chen, et al, *280-km experimental demonstration of quantum digital signature with one decoy state*, https://arxiv.org/abs/2003.00420

[^6]: Sheng-Kai, Wen-Qi, et al, *Satellite-to-ground quantum key distribution*, https://arxiv.org/abs/1707.00542 

[^7]: Williams, Britt, Humble, *A tamper-indicating quantum seal*, https://www.researchgate.net/publication/281227483_A_tamper-indicating_quantum_seal