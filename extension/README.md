# YouTube Knowledge Miner Extension

This is an unpaid, sideloaded browser extension for Brave, Chrome, Edge, and other Chromium browsers.

It talks to the local backend at `http://127.0.0.1:8000`. Transcript extraction runs from the user's own machine/network.

## Install In Brave, Chrome, Or Edge

1. Start the local app from the repo root:

   ```bash
   python3 setup_and_run.py
   ```

2. Open your browser extension page:

   ```text
   brave://extensions
   chrome://extensions
   edge://extensions
   ```

3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this repo's `extension` folder.
6. Pin/open **YouTube Knowledge Miner** from the toolbar.

## Notes

- No extension store account is required.
- No paid proxy is required.
- The local backend must be running before search or download will work.
- Safari is not targeted in this unpaid sideloading flow because Safari extension distribution generally requires Apple's developer tooling/signing path.
