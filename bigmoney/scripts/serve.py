"""Local test server for Big Money. Run from anywhere:  python bigmoney/scripts/serve.py
Then open http://localhost:8141 . Files are never cached, so a refresh always shows the latest code."""
import http.server, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'www')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8141
print('Big Money is at http://localhost:%d' % port)
http.server.ThreadingHTTPServer(('', port), Handler).serve_forever()
