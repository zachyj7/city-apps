import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import Part, model, one, PI
kit.reset()
one('P.test', lambda b: b.box('#ff0000', 1, 2, 1, bev=0.1).cyl('r_ROOF', 0.3, 0.5, 2, x=2).tor('#00ff00', 1, 0.1, y=3).cap('#0000ff', 0.3, 1, x=-2).dome('#ffff00', 1, z=3).prism('#ff00ff', 2, 1, 2, z=-3))
b = Part('body'); l = Part('leg0', (0.2, 0.7, 0)); f = Part('foot', (0.2, 0.1, 0), parent='leg0')
b.sph('#ffffff', 0.5, y=1.2); l.cap('#333333', 0.1, 0.4, x=0.2, y=0.4); f.box('#222222', 0.2, 0.1, 0.3, x=0.2, y=0.05)
model('C.test', [b, l, f])
kit.export(sys.argv[sys.argv.index('--') + 1])
print('OK')
