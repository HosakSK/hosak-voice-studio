#!/usr/bin/env python3
"""
Piper Voice-Over Studio - Local HTTP Server
Runs a local static server on http://localhost:3000.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class StudioHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Allow cross-origin access and remove restrictive require-corp that blocks HuggingFace model downloads
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cross-Origin-Resource-Policy', 'cross-origin')
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), format % args))

def run():
    handler = StudioHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print(f"[STUDIO] Piper Voice-Over Studio running at: {url}")
        print(f"[DIRECTORY] {DIRECTORY}")
        print("[BROWSER] Opening web browser...")
        print("[STOP] Press Ctrl + C to stop server")
        print("=" * 60)
        
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[STOP] Studio server stopped.")

if __name__ == '__main__':
    run()