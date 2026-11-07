"""E-Diary: a small web server for the diary folder on this computer only (http://localhost:PORT/).
Used by the Mac and Linux starters.  python3 ediary_serve.py 47812 /path/to/diary"""
import functools, http.server, os, sys
port = int(sys.argv[1]) if len(sys.argv) > 1 else 47812
root = os.path.realpath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml'}
    def do_GET(self):
        if self.path.split('?')[0] == '/__ediary_root':
            b = root.encode('utf-8'); self.send_response(200); self.send_header('Content-Type', 'text/plain; charset=utf-8'); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        return super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache'); super().end_headers()
    def log_message(self, *a): pass

http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
