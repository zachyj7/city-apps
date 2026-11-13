"""Builds every model in Hourfall and writes hourfall/www/models/assets.glb.

Run:  blender -b --factory-startup --python hourfall/blender/build_assets.py -- hourfall/www/models/assets.glb

Naming:  K.* character kit parts   C.* creatures   O.* objects and the mount
         B.* houses by culture     L.* city landmarks   F.* street furniture   P.* scenery
Roles the game tints: SKIN TOP BOT TRIM HAIR HAT CAPE BOOT METAL (people)
                      M1 M2 M3 EYE (creatures)   WALL ROOF TRIM CLOTH (buildings)  BLOOM GEM WOOD (objects)
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import Part, model, one, PI

kit.reset()
R = random.Random(7)
DOOR, GLOW, DARK, WHITE, GOLD, STONE, STONE2, IRON = '#5a3a24', '#ffe08a', '#1c1a2a', '#fbf8f0', '#e0b85a', '#a49a94', '#8a807a', '#4a4a55'
WOOD, WOOD2, ROPE = '#8a5a34', '#6a4630', '#c8b080'

# =====================================================================  PEOPLE
# Body heights: hip 0.7, shoulder 1.4, head centre 1.76. Limbs hang from their joint.
def head():
    b = Part('body')
    b.cyl('SKIN', 0.1, 0.12, 0.2, 10, y=1.47)
    b.sph('SKIN', 0.34, 24, 14, y=1.76, sy=0.97)
    b.ell('SKIN', 0.075, 0.06, 0.07, 10, 6, y=1.70, z=0.325)                        # nose
    for s in (-1, 1):
        b.ell('SKIN', 0.06, 0.11, 0.05, 10, 6, x=s * 0.335, y=1.75, rz=s * 0.2)       # ears
        b.ell(WHITE, 0.085, 0.1, 0.05, 14, 8, x=s * 0.125, y=1.79, z=0.29, ry=s * 0.35)
        b.ell(DARK, 0.05, 0.065, 0.03, 12, 8, x=s * 0.122, y=1.785, z=0.322, ry=s * 0.35)
        b.sph(WHITE, 0.016, 6, 4, x=s * 0.11 + 0.015, y=1.81, z=0.343)
        b.box('HAIR', 0.12, 0.03, 0.04, bev=0.012, x=s * 0.125, y=1.9, z=0.3, rz=-s * 0.18, ry=s * 0.35)
        b.ell('#f2a0a0', 0.06, 0.035, 0.02, 8, 5, x=s * 0.2, y=1.68, z=0.26, ry=s * 0.6)  # blush
    b.box('#a0504a', 0.1, 0.025, 0.03, bev=0.01, y=1.615, z=0.318)
    return b


def torso(kind):
    b = head()
    if kind in ('tunic', 'armor', 'bare'):
        top = 'SKIN' if kind == 'bare' else 'TOP'
        b.lathe(top, [(0.22, 0.78), (0.3, 0.84), (0.31, 1.06), (0.34, 1.3), (0.26, 1.44), (0.11, 1.5)], 16, smoothcap=True)
        b.cyl('BOT', 0.3, 0.27, 0.22, 16, y=0.72)
        b.tor('TRIM', 0.305, 0.045, 18, 6, y=0.83, rx=PI / 2)
        b.box(GOLD, 0.11, 0.09, 0.05, bev=0.015, y=0.83, z=0.31)
        if kind != 'bare':
            b.tor('TRIM', 0.15, 0.04, 14, 6, y=1.46, rx=PI / 2)
            b.box('TRIM', 0.04, 0.42, 0.02, y=1.15, z=0.315, rx=0.07)
        else:
            b.cyl('BOT', 0.315, 0.29, 0.12, 16, y=0.86)
    if kind == 'armor':
        b.lathe('METAL', [(0.24, 0.92), (0.34, 1.0), (0.36, 1.28), (0.27, 1.43), (0.14, 1.47)], 16, smoothcap=True)
        b.tor(GOLD, 0.25, 0.025, 16, 5, y=1.18, z=0.12, rx=PI / 2 - 0.3)
        for s in (-1, 1):
            b.dome('METAL', 0.17, 12, 4, x=s * 0.38, y=1.4, rz=-s * 0.4)
    if kind in ('robe', 'dress'):
        flare = 0.52 if kind == 'robe' else 0.45
        b.lathe('TOP', [(flare, 0.08), (0.42, 0.4), (0.31, 0.82), (0.31, 1.06), (0.34, 1.3), (0.26, 1.44), (0.11, 1.5)], 18, smoothcap=True)
        b.tor('TRIM', flare - 0.01, 0.04, 22, 6, y=0.1, rx=PI / 2)
        b.tor('TRIM', 0.32, 0.05, 18, 6, y=0.86, rx=PI / 2)
        b.tor('TRIM', 0.15, 0.04, 14, 6, y=1.46, rx=PI / 2)
        if kind == 'robe':
            b.box('TRIM', 0.12, 0.8, 0.03, y=0.48, z=0.34, rx=-0.2)
    return b


def arm(s):
    p = Part('arm' + ('0' if s < 0 else '1'), (s * 0.4, 1.4, 0))
    x = s * 0.4
    p.sph('TOP', 0.115, 12, 8, x=x, y=1.4)
    p.cap('TOP', 0.095, 0.22, 10, 6, x=x, y=1.24)
    p.tor('TRIM', 0.09, 0.03, 12, 5, x=x, y=1.1, rx=PI / 2)
    p.cap('SKIN', 0.08, 0.16, 10, 6, x=x, y=0.98)
    p.sph('SKIN', 0.1, 12, 8, x=x, y=0.82, sz=0.8)
    p.sph('SKIN', 0.04, 8, 5, x=x - s * 0.06, y=0.85, z=0.06)
    return p


def leg(s):
    p = Part('leg' + ('0' if s < 0 else '1'), (s * 0.15, 0.7, 0))
    x = s * 0.15
    p.cap('BOT', 0.11, 0.2, 10, 6, x=x, y=0.52)
    p.cap('BOT', 0.095, 0.16, 10, 6, x=x, y=0.3)
    p.lathe('BOOT', [(0.11, 0.0), (0.12, 0.05), (0.105, 0.24), (0.115, 0.27)], 12, x=x)
    p.ell('BOOT', 0.11, 0.08, 0.16, 12, 6, x=x, y=0.06, z=0.07)
    p.tor('BOOT', 0.11, 0.025, 12, 4, x=x, y=0.26, rx=PI / 2)
    return p


for k in ('tunic', 'armor', 'bare', 'robe', 'dress'):
    model('K.torso_' + k, [torso(k)])
model('K.limbs', [arm(-1), arm(1), leg(-1), leg(1)])

HH = 1.76
def hair(i, b):
    if i == 1:   # short with fringe
        b.dome('HAIR', 0.365, 20, 7, y=HH - 0.02, z=-0.03, rx=-0.3)
        for k in range(5):
            b.ell('HAIR', 0.1, 0.07, 0.06, 8, 5, x=(k - 2) * 0.1, y=HH + 0.19 - abs(k - 2) * 0.02, z=0.27, rx=0.4)
    elif i == 2:  # spiky
        b.dome('HAIR', 0.36, 18, 6, y=HH - 0.02, z=-0.03, rx=-0.3)
        for k in range(9):
            a = k / 9 * 2 * PI
            b.cone('HAIR', 0.1, 0.34, 6, x=math.cos(a) * 0.2, y=HH + 0.33, z=math.sin(a) * 0.2 - 0.05, rz=-math.cos(a) * 0.8, rx=math.sin(a) * 0.8)
        b.cone('HAIR', 0.1, 0.38, 6, y=HH + 0.42, z=-0.04)
    elif i == 3:  # long
        b.dome('HAIR', 0.37, 20, 7, y=HH - 0.02, z=-0.03, rx=-0.3)
        b.box('HAIR', 0.66, 0.78, 0.2, bev=0.08, y=HH - 0.4, z=-0.25, rx=0.12)
        for s in (-1, 1):
            b.box('HAIR', 0.14, 0.5, 0.16, bev=0.06, x=s * 0.31, y=HH - 0.25, z=0.08)
    elif i == 4:  # bun
        b.dome('HAIR', 0.365, 20, 7, y=HH - 0.02, z=-0.03, rx=-0.32)
        b.sph('HAIR', 0.18, 12, 8, y=HH + 0.34, z=-0.16)
        b.tor(GOLD, 0.11, 0.025, 12, 4, y=HH + 0.27, z=-0.12, rx=PI / 2 - 0.4)
    elif i == 5:  # ponytail
        b.dome('HAIR', 0.365, 20, 7, y=HH - 0.02, z=-0.03, rx=-0.3)
        b.cap('HAIR', 0.09, 0.5, 10, 6, y=HH - 0.15, z=-0.43, rx=0.45)
        b.tor('TRIM', 0.08, 0.025, 10, 4, y=HH + 0.08, z=-0.36, rx=PI / 2 + 0.4)
    elif i == 6:  # crest
        b.dome('HAIR', 0.345, 18, 6, y=HH - 0.04, z=-0.03, rx=-0.3, sx=0.92)
        for k in range(6):
            b.cone('HAIR', 0.08, 0.36, 5, y=HH + 0.32 + (0.04 if k in (1, 2) else 0), z=0.22 - k * 0.11, rx=-0.3 + k * 0.15, sx=0.5)
    elif i == 7:  # bob
        b.dome('HAIR', 0.39, 20, 7, y=HH - 0.05, z=-0.03, rx=-0.25, sy=1.2)
        b.lathe('HAIR', [(0.4, HH - 0.27), (0.4, HH - 0.05)], 20, z=-0.04, smoothcap=True)


for i in range(1, 8):
    one('K.hair%d' % i, lambda b, i=i: hair(i, b))

HATS = {}
def hat(name):
    def deco(f):
        HATS[name] = f
        return f
    return deco
@hat('straw')
def _(b):
    b.lathe('HAT', [(0.74, HH + 0.24), (0.7, HH + 0.28), (0.3, HH + 0.32), (0.27, HH + 0.5), (0, HH + 0.55)], 20)
    b.tor('#c8443a', 0.29, 0.035, 18, 4, y=HH + 0.34, rx=PI / 2)
@hat('hood')
def _(b):
    b.sph('HAT', 0.41, 18, 10, y=HH + 0.01, z=-0.07)
    b.cone('HAT', 0.2, 0.45, 10, y=HH + 0.38, z=-0.25, rx=-0.7)
    b.tor('HAT', 0.3, 0.07, 18, 6, y=HH, z=0.24, sy=1.15)
@hat('turban')
def _(b):
    for k in range(3):
        b.tor('HAT', 0.29 - k * 0.04, 0.1, 18, 6, y=HH + 0.16 + k * 0.09, rx=PI / 2 + (k - 1) * 0.15)
    b.sph('HAT', 0.24, 12, 8, y=HH + 0.25)
    b.ell('#7fe6d6', 0.07, 0.09, 0.04, 10, 6, y=HH + 0.2, z=0.37)
    b.cone(GOLD, 0.05, 0.3, 6, y=HH + 0.38, z=0.3, rx=-0.4)
@hat('fur')
def _(b):
    b.sph('HAT', 0.43, 18, 10, y=HH + 0.02, z=-0.09)
    b.tor('#f4f0e6', 0.33, 0.1, 18, 7, y=HH, z=0.17)
    for s in (-1, 1):
        b.ell('#f4f0e6', 0.12, 0.2, 0.1, 8, 6, x=s * 0.36, y=HH - 0.2)
@hat('helm')
def _(b):
    b.dome('METAL', 0.39, 20, 7, y=HH - 0.02)
    b.tor('METAL', 0.38, 0.04, 20, 5, y=HH - 0.01, rx=PI / 2)
    b.box('HAT', 0.07, 0.36, 0.56, bev=0.03, y=HH + 0.42, z=-0.06)
    b.box('METAL', 0.06, 0.2, 0.06, y=HH - 0.04, z=0.36)
@hat('horns')
def _(b):
    b.dome('#8a8a96', 0.39, 20, 7, y=HH - 0.02)
    b.tor(GOLD, 0.38, 0.035, 20, 5, y=HH, rx=PI / 2)
    for s in (-1, 1):
        for k in range(4):
            b.cyl('#f2ead8', 0.09 - k * 0.022, 0.1 - k * 0.022, 0.16, 8, x=s * (0.4 + k * 0.1), y=HH + 0.12 + k * 0.11, rz=-s * (0.6 + k * 0.25))
@hat('feather')
def _(b):
    b.tor(GOLD, 0.35, 0.05, 20, 6, y=HH + 0.13, rx=PI / 2)
    for k, c in enumerate(('#ff5a5a', 'HAT', '#4ad0b0', 'HAT', '#ffd24a')):
        b.ell(c, 0.07, 0.36, 0.025, 8, 6, x=(k - 2) * 0.12, y=HH + 0.48 - abs(k - 2) * 0.05, z=-0.24, rz=-(k - 2) * 0.25)
@hat('goggles')
def _(b):
    b.tor('#5a4030', 0.355, 0.035, 20, 5, y=HH + 0.12, rx=PI / 2)
    for s in (-1, 1):
        b.tor(GOLD, 0.085, 0.03, 14, 5, x=s * 0.13, y=HH + 0.16, z=0.31)
        b.cyl('#9fe6ff', 0.07, 0.07, 0.02, 14, x=s * 0.13, y=HH + 0.16, z=0.315, rx=PI / 2)
@hat('mask')
def _(b):
    b.ell('#3a3644', 0.3, 0.17, 0.2, 14, 8, y=HH - 0.12, z=0.15)
    for s in (-1, 1):
        b.cyl('#ff8a3a', 0.07, 0.07, 0.12, 12, x=s * 0.12, y=HH - 0.14, z=0.36, rx=PI / 2)
@hat('fin')
def _(b):
    b.ell('HAT', 0.06, 0.32, 0.3, 10, 8, y=HH + 0.3, z=-0.08)
    for s in (-1, 1):
        b.ell('HAT', 0.05, 0.16, 0.2, 8, 6, x=s * 0.38, y=HH, rz=-s * 1.0, ry=s * 0.4)
@hat('crown')
def _(b):
    b.cyl('#f2c84a', 0.27, 0.25, 0.16, 18, y=HH + 0.31)
    for k in range(7):
        a = k / 7 * 2 * PI
        b.cone('#f2c84a', 0.055, 0.17, 6, x=math.cos(a) * 0.26, y=HH + 0.47, z=math.sin(a) * 0.26)
        b.sph('#c8443a' if k % 2 else '#3d6fd0', 0.03, 6, 4, x=math.cos(a) * 0.27, y=HH + 0.31, z=math.sin(a) * 0.27)
@hat('wizard')
def _(b):
    b.lathe('HAT', [(0.62, HH + 0.22), (0.6, HH + 0.26), (0.3, HH + 0.27)], 20)
    b.lathe('HAT', [(0.3, HH + 0.27), (0.2, HH + 0.6), (0.08, HH + 0.85), (0, HH + 0.95)], 14, rz=0.15)
    b.tor(GOLD, 0.3, 0.035, 18, 5, y=HH + 0.3, rx=PI / 2)
@hat('bandana')
def _(b):
    b.dome('HAT', 0.375, 18, 6, y=HH + 0.02, sy=0.75, rx=-0.15)
    b.sph('HAT', 0.07, 8, 5, y=HH + 0.04, z=-0.38)
    b.box('HAT', 0.1, 0.3, 0.04, bev=0.02, x=0.07, y=HH - 0.12, z=-0.4, rz=0.3)
@hat('cap')
def _(b):
    b.dome('HAT', 0.375, 18, 6, y=HH + 0.04, sy=0.8, rx=-0.15)
    b.ell('HAT', 0.24, 0.03, 0.22, 14, 4, y=HH + 0.18, z=0.36)
    b.sph(GOLD, 0.04, 8, 5, y=HH + 0.33)
for name, f in HATS.items():
    one('K.hat_' + name, f)

ACC = {
    'cape': lambda b: (b.box('CAPE', 0.62, 0.5, 0.07, bev=0.03, y=1.22, z=-0.33, rx=0.12), b.box('CAPE', 0.74, 0.62, 0.07, bev=0.03, y=0.74, z=-0.41, rx=0.12),
                       b.ell('CAPE', 0.34, 0.1, 0.2, 12, 6, y=1.44, z=-0.12), [b.sph(GOLD, 0.05, 8, 5, x=s * 0.2, y=1.44, z=0.12) for s in (-1, 1)]),
    'pack': lambda b: (b.box('#8a6a4a', 0.46, 0.52, 0.26, bev=0.06, y=1.12, z=-0.4), b.cyl(ROPE, 0.13, 0.13, 0.56, 10, y=1.46, z=-0.4, rz=PI / 2), b.box('#6a4a33', 0.3, 0.2, 0.06, bev=0.02, y=1.2, z=-0.55)),
    'scarf': lambda b: (b.tor('HAT', 0.2, 0.09, 16, 7, y=1.47, rx=PI / 2), b.box('HAT', 0.12, 0.36, 0.06, bev=0.03, x=0.1, y=1.3, z=0.26, rz=0.15)),
    'collar': lambda b: [b.ico('#f4f0e6', 0.12, 1, x=math.cos(k / 9 * 2 * PI) * 0.26, y=1.45, z=math.sin(k / 9 * 2 * PI) * 0.26) for k in range(9)],
    'pads': lambda b: [b.ell('HAT', 0.2, 0.12, 0.2, 12, 6, x=s * 0.42, y=1.48, rz=-s * 0.35) for s in (-1, 1)],
    'wings': lambda b: [b.ell(WHITE, 0.08, 0.5, 0.26, 10, 6, x=s * 0.36, y=1.42, z=-0.32, rz=s * 2.2, ry=-s * 0.3) for s in (-1, 1)],
    'apron': lambda b: (b.box('#f2ead8', 0.46, 0.62, 0.04, bev=0.015, y=0.9, z=0.31), b.box('#f2ead8', 0.3, 0.2, 0.04, bev=0.015, y=1.28, z=0.33)),
    'leaf': lambda b: [b.ell('#4fae4a' if k % 2 else '#62c258', 0.1, 0.24, 0.03, 8, 5, x=math.cos(k * 0.6) * 0.32, y=0.62, z=math.sin(k * 0.6) * 0.32, ry=-k * 0.6 + PI / 2, rx=0.2) for k in range(11)],
    'halo': lambda b: (b.tor('#fff0c0', 0.62, 0.04, 28, 5, y=1.62, z=-0.38), [b.sph('#fff0c0', 0.05, 6, 4, x=math.cos(k * PI / 6) * 0.62, y=1.62 + math.sin(k * PI / 6) * 0.62, z=-0.38) for k in range(12)]),
}
for name, f in ACC.items():
    one('K.acc_' + name, f)

# =====================================================================  CREATURES
def eyes(b, x, y, z, r=0.07, c='EYE'):
    for s in (-1, 1):
        b.sph(c, r, 10, 6, x=s * x, y=y, z=z)


def quad(name, kind):
    b = Part('body')
    big = kind in ('boar', 'ram', 'stag')
    L = 0.85 if kind == 'cat' else 1.0
    b.cap('M1', 0.44 if big else 0.38, L, 14, 8, y=0.98, rx=PI / 2)
    b.sph('M1', 0.46 if big else 0.4, 14, 8, y=1.06, z=0.45)
    b.cap('M1', 0.22, 0.3, 12, 6, y=1.22, z=0.82, rx=-0.7)
    hz, hy = 1.08, 1.42
    b.sph('M1', 0.31, 16, 10, y=hy, z=hz)
    snout = 0.22 if kind in ('wolf', 'hound', 'cat') else 0.26
    b.cap('M2' if kind != 'boar' else 'M1', 0.14, snout, 12, 6, y=hy - 0.1, z=hz + 0.27, rx=PI / 2)
    b.sph(DARK if kind != 'boar' else 'M2', 0.07 if kind != 'boar' else 0.12, 10, 6, y=hy - 0.08, z=hz + 0.27 + snout / 2 + 0.1, sz=0.6 if kind == 'boar' else 1)
    eyes(b, 0.14, hy + 0.08, hz + 0.24)
    b.box(DARK, 0.1, 0.03, 0.02, x=0.0, y=hy - 0.18, z=hz + 0.35)
    if kind in ('wolf', 'hound', 'cat'):
        for s in (-1, 1):
            b.cone('M1', 0.11, 0.3 if kind != 'cat' else 0.24, 6, x=s * 0.18, y=hy + 0.3, z=hz - 0.05, rz=-s * 0.25)
            b.cone('M3' if kind == 'hound' else '#f2c0c0', 0.06, 0.18, 6, x=s * 0.18, y=hy + 0.28, z=hz - 0.02, rz=-s * 0.25)
        tail = 1.0 if kind == 'cat' else 0.55
        b.cap('M1', 0.09 if kind == 'cat' else 0.13, tail, 10, 6, y=1.1 + (0.2 if kind == 'cat' else 0), z=-0.95 - tail * 0.3, rx=-1.0 if kind != 'cat' else -0.4)
        b.sph('M2', 0.12, 10, 6, y=1.32, z=-1.3)
        for k in range(5):
            b.cone('M2', 0.12, 0.26, 6, y=1.36 - k * 0.01, z=0.55 - k * 0.24, rx=-0.5)
    if kind == 'hound':
        for k in range(6):
            b.cone('M3', 0.1, 0.5, 5, x=(k % 2 - 0.5) * 0.2, y=1.45, z=0.5 - k * 0.22, rx=-0.4)
    if kind == 'boar':
        for s in (-1, 1):
            b.lathe('#f2ead8', [(0.06, 0), (0.04, 0.2), (0, 0.32)], 8, x=s * 0.17, y=hy - 0.2, z=hz + 0.42, rx=-0.9, rz=-s * 0.3)
            b.ell('M1', 0.08, 0.14, 0.04, 8, 5, x=s * 0.22, y=hy + 0.26, z=hz - 0.05, rz=-s * 0.6)
        for k in range(8):
            b.cone('M2', 0.1, 0.36, 5, y=1.48 - k * 0.02, z=0.75 - k * 0.2, rx=-0.6)
        b.cap('M1', 0.05, 0.3, 6, 4, y=1.0, z=-1.05, rx=-1.2)
    if kind == 'ram':
        for k in range(14):
            b.ico('M2', 0.22, 1, x=R.uniform(-0.3, 0.3), y=1.15 + R.uniform(-0.1, 0.25), z=R.uniform(-0.6, 0.7))
        for s in (-1, 1):
            b.tor('#e9e2c8', 0.17, 0.07, 14, 6, x=s * 0.3, y=hy + 0.12, z=hz - 0.08, ry=PI / 2, sx=1.2)
            b.cone('#e9e2c8', 0.06, 0.2, 6, x=s * 0.32, y=hy - 0.06, z=hz + 0.08, rx=1.3)
    if kind == 'stag':
        for s in (-1, 1):
            b.cyl('#e9e2c8', 0.035, 0.055, 1.1, 6, x=s * 0.38, y=hy + 0.62, z=hz - 0.05, rz=-s * 0.45)
            for k in range(4):
                b.cyl('#e9e2c8', 0.025, 0.04, 0.5, 5, x=s * (0.44 + k * 0.12), y=hy + 0.5 + k * 0.22, z=hz - 0.05 + (k % 2) * 0.1, rz=-s * 1.1 - k * 0.1 * s)
            b.ell('M1', 0.07, 0.15, 0.04, 8, 5, x=s * 0.27, y=hy + 0.2, z=hz - 0.1, rz=-s * 1.1)
        b.ico('M3', 0.4, 2, y=1.25, z=0.5, sy=1.2)
        b.cone('M1', 0.12, 0.3, 8, y=1.12, z=-1.0, rx=-2.2)
    parts = [b]
    for i, (x, z) in enumerate(((-0.24, 0.5), (0.24, -0.5), (0.24, 0.5), (-0.24, -0.5))):
        p = Part('leg%d' % i, (x, 0.75, z))
        thick = 0.13 if big else 0.105
        p.cap('M1', thick, 0.3, 10, 6, x=x, y=0.55, z=z)
        p.cap('M2', thick * 0.8, 0.22, 10, 6, x=x, y=0.28, z=z + (0.03 if z > 0 else -0.03))
        p.ell('M2' if kind != 'stag' else DARK, thick * 1.05, 0.08, thick * 1.2, 10, 5, x=x, y=0.06, z=z + 0.03)
        parts.append(p)
    model(name, parts)


for k in ('wolf', 'boar', 'cat', 'ram', 'stag', 'hound'):
    quad('C.' + k, k)

def bird():
    f = Part('float', (0, 1.6, 0))
    f.ell('M1', 0.42, 0.42, 0.56, 16, 10, y=1.6)
    f.ell('M3', 0.3, 0.3, 0.4, 12, 8, y=1.5, z=0.12)
    f.sph('M1', 0.3, 14, 10, y=1.95, z=0.48)
    f.cone('#f2b040', 0.11, 0.38, 10, y=1.9, z=0.85, rx=PI / 2)
    eyes(f, 0.15, 2.02, 0.7, 0.065)
    for k in range(3):
        f.ell('M2', 0.14, 0.04, 0.42, 8, 5, x=(k - 1) * 0.14, y=1.62, z=-0.72, ry=(k - 1) * 0.35, rx=-0.15)
    for k in range(3):
        f.cone('M3', 0.06, 0.28, 6, y=2.28 - k * 0.02, z=0.42 - k * 0.12, rx=-0.6 - k * 0.2)
    for s in (-1, 1):
        f.cap('#f2b040', 0.04, 0.3, 6, 4, x=s * 0.15, y=1.18, z=0.05)
    parts = [f]
    for i, s in enumerate((-1, 1)):
        w = Part('flap%d' % i, (s * 0.35, 1.7, 0), parent='float')
        for k in range(4):
            w.ell('M2' if k % 2 else 'M1', 0.38, 0.05, 0.22 - k * 0.03, 10, 5, x=s * (0.55 + k * 0.28), y=1.7 - k * 0.02, z=-0.05 - k * 0.07)
        parts.append(w)
    model('C.bird', parts)


def wisp():
    f = Part('float', (0, 1.5, 0))
    f.lathe('M1', [(0, 0.55), (0.22, 0.7), (0.42, 1.0), (0.46, 1.3), (0.38, 1.6), (0.3, 1.8)], 16, smoothcap=True)
    f.sph('M1', 0.36, 16, 10, y=1.98)
    eyes(f, 0.14, 2.02, 0.3, 0.08)
    for k in range(6):
        a = k / 6 * 2 * PI
        f.cone('M3', 0.06, 0.32, 6, x=math.cos(a) * 0.24, y=2.36, z=math.sin(a) * 0.24, rz=-math.cos(a) * 0.3, rx=math.sin(a) * 0.3)
    for k in range(5):
        a = k / 5 * 2 * PI
        f.cap('M2', 0.07, 0.4, 8, 4, x=math.cos(a) * 0.2, y=0.42, z=math.sin(a) * 0.2, rz=math.cos(a) * 0.3)
    parts = [f]
    for i, s in enumerate((-1, 1)):
        w = Part('wing%d' % i, (s * 0.3, 1.7, -0.15), parent='float')
        w.ell('M3', 0.6, 0.75, 0.04, 14, 8, x=s * 0.8, y=1.95, z=-0.2, rz=-s * 0.4)
        w.ell('M2', 0.4, 0.45, 0.05, 12, 6, x=s * 0.65, y=1.35, z=-0.2, rz=s * 0.5)
        w.sph(WHITE, 0.1, 8, 5, x=s * 0.85, y=2.0, z=-0.17, sz=0.3)
        parts.append(w)
    model('C.wisp', parts)


def golem():
    b = Part('body')
    b.ico('M1', 1.0, 2, y=1.85, sy=0.85, sz=0.8)
    b.ico('M2', 0.55, 1, y=1.15, sy=0.6)
    for k in range(7):
        b.box('M2', R.uniform(0.3, 0.55), R.uniform(0.2, 0.4), 0.2, bev=0.06, x=R.uniform(-0.6, 0.6), y=R.uniform(1.5, 2.3), z=0.7, rx=R.uniform(-0.3, 0.3), rz=R.uniform(-0.4, 0.4))
    b.ico('M1', 0.42, 1, y=2.75, z=0.18)
    b.box(DARK, 0.5, 0.12, 0.1, bev=0.03, y=2.72, z=0.5)
    eyes(b, 0.15, 2.74, 0.52, 0.08)
    for k in range(5):
        b.cone('M3', 0.22, 0.95, 6, x=-0.7 + k * 0.35, y=2.65, z=-0.45, rz=(2 - k) * 0.28, rx=-0.3)
    b.ico('M2', 0.45, 1, x=0.45, y=2.45, z=-0.15, sy=0.5)
    parts = [b]
    for i, s in enumerate((-1, 1)):
        a = Part('arm%d' % i, (s * 1.1, 2.3, 0))
        a.ico('M1', 0.4, 1, x=s * 1.15, y=2.3)
        a.cap('M1', 0.26, 0.6, 10, 6, x=s * 1.2, y=1.75)
        a.ico('M2', 0.45, 1, x=s * 1.22, y=1.1, sy=0.9)
        for k in range(3):
            a.cone('M2', 0.1, 0.3, 5, x=s * 1.22 + (k - 1) * 0.18, y=0.68, z=0.25, rx=PI)
        parts.append(a)
        l = Part('leg%d' % i, (s * 0.42, 1.05, 0))
        l.cap('M2', 0.28, 0.45, 10, 6, x=s * 0.45, y=0.6)
        l.box('M1', 0.62, 0.3, 0.75, bev=0.1, x=s * 0.45, y=0.15, z=0.08)
        parts.append(l)
    model('C.golem', parts)


def crab():
    b = Part('body')
    b.dome('M1', 0.95, 20, 7, y=0.45, sy=0.6)
    b.cyl('M2', 0.95, 0.82, 0.22, 20, y=0.4)
    for k in range(7):
        a = k / 7 * 2 * PI
        b.cone('M3', 0.13, 0.42, 6, x=math.cos(a) * 0.5, y=0.95, z=math.sin(a) * 0.5)
    for s in (-1, 1):
        b.cyl('M2', 0.04, 0.05, 0.4, 6, x=s * 0.22, y=1.0, z=0.62)
        b.sph('EYE', 0.1, 10, 6, x=s * 0.22, y=1.22, z=0.62)
        for k in range(3):
            b.cap('M2', 0.07, 0.4, 8, 4, x=s * (0.95 + k * 0.05), y=0.32, z=-0.4 + k * 0.38, rz=s * 0.9)
            b.cap('M2', 0.06, 0.35, 8, 4, x=s * (1.25 + k * 0.05), y=0.12, z=-0.4 + k * 0.38, rz=-s * 0.4)
    parts = [b]
    for i, s in enumerate((-1, 1)):
        c = Part('claw%d' % i, (s * 0.85, 0.55, 0.45))
        c.cap('M2', 0.1, 0.35, 8, 4, x=s * 0.95, y=0.55, z=0.65, rx=PI / 2 - 0.3)
        c.ell('M1', 0.3, 0.26, 0.48, 14, 8, x=s * 1.0, y=0.6, z=1.1)
        c.cone('M1', 0.14, 0.45, 8, x=s * 0.88, y=0.66, z=1.6, rx=PI / 2)
        c.cone('M3', 0.1, 0.38, 8, x=s * 1.12, y=0.56, z=1.55, rx=PI / 2 + 0.15)
        parts.append(c)
    model('C.crab', parts)


def slime():
    b = Part('bounce')
    b.lathe('M1', [(0.82, 0.05), (0.88, 0.3), (0.78, 0.75), (0.5, 1.12), (0.18, 1.3), (0, 1.33)], 20)
    b.ell(WHITE, 0.22, 0.16, 0.1, 10, 6, x=-0.32, y=0.96, z=0.45, rx=-0.5)
    eyes(b, 0.26, 0.72, 0.7, 0.11, DARK)
    for s in (-1, 1):
        b.sph(WHITE, 0.035, 6, 4, x=s * 0.26 + 0.04, y=0.78, z=0.8)
    b.box(DARK, 0.22, 0.04, 0.04, bev=0.015, y=0.52, z=0.82)
    for k in range(6):
        a = k / 6 * 2 * PI
        b.cone('M3', 0.11, 0.38, 6, x=math.cos(a) * 0.45, y=1.18, z=math.sin(a) * 0.45, rz=-math.cos(a) * 0.5, rx=math.sin(a) * 0.5)
    model('C.slime', [b])


def fish(name, long=False, lure=False):
    f = Part('float', (0, 1.5, 0))
    L = 2.4 if long else 1.3
    f.lathe('M1', [(0, -L * 0.5), (0.22, -L * 0.4), (0.42, -L * 0.1), (0.46, L * 0.12), (0.34, L * 0.38), (0, L * 0.52)], 16, y=1.5, rx=PI / 2, sx=0.75 if long else 1)
    f.ell('M3', 0.36, 0.3, L * 0.38, 12, 8, y=1.38, z=L * 0.02, sx=0.3 if long else 0.36)
    f.ell('M2', 0.04, 0.5, 0.4, 8, 6, y=1.5, z=-L * 0.55, rx=0.2)
    f.ell('M2', 0.04, 0.35, 0.55 if long else 0.35, 8, 6, y=1.95, z=-0.1)
    for s in (-1, 1):
        f.ell('M2', 0.04, 0.16, 0.28, 8, 5, x=s * 0.38, y=1.35, z=L * 0.12, ry=s * 0.5)
    eyes(f, 0.25 if long else 0.32, 1.62, L * 0.32, 0.1)
    for k in range(-2, 3):
        f.cone(WHITE, 0.035, 0.14, 4, x=k * 0.07, y=1.36, z=L * 0.46, rx=PI)
    if lure:
        f.lathe('M2', [(0.02, 0), (0.02, 0.7)], 5, y=1.85, z=L * 0.25, rx=0.9)
        f.sph('#fff0a0', 0.13, 10, 6, y=2.32, z=L * 0.6)
    model(name, [f])


def jelly():
    f = Part('float', (0, 1.8, 0))
    f.lathe('M1', [(0.82, 1.7), (0.8, 1.9), (0.6, 2.3), (0.3, 2.5), (0, 2.55)], 20, smoothcap=True)
    f.tor('M3', 0.82, 0.07, 24, 6, y=1.72, rx=PI / 2)
    eyes(f, 0.22, 2.1, 0.7, 0.09, DARK)
    for k in range(9):
        a = k / 9 * 2 * PI
        f.cap('M3', 0.045, 1.2 + (k % 3) * 0.3, 6, 4, x=math.cos(a) * 0.5, y=1.0 - (k % 3) * 0.15, z=math.sin(a) * 0.5, rz=math.cos(a) * 0.12)
    for k in range(4):
        f.ell('M2', 0.1, 0.5, 0.05, 8, 5, x=math.cos(k * 1.57 + 0.4) * 0.2, y=1.35, z=math.sin(k * 1.57 + 0.4) * 0.2, ry=k * 1.57)
    model('C.jelly', [f])


bird(); wisp(); golem(); crab(); slime(); jelly()
fish('C.fish'); fish('C.eel', long=True); fish('C.angler', lure=True)

# The mount: a clockwork strider. Brass and teal, with a saddle.
def strider():
    b = Part('body')
    b.cap('#d9a84a', 0.42, 1.1, 16, 8, y=1.45, rx=PI / 2)
    b.sph('#d9a84a', 0.48, 16, 10, y=1.52, z=0.55)
    b.tor('#2f8f86', 0.43, 0.06, 20, 6, y=1.45, z=-0.2, ry=PI / 2, rz=0)
    b.tor('#2f8f86', 0.45, 0.06, 20, 6, y=1.48, z=0.25, ry=PI / 2)
    for s in (-1, 1):
        b.cyl(GOLD, 0.26, 0.26, 0.06, 14, x=s * 0.44, y=1.45, rz=PI / 2)
        for k in range(8):
            a = k / 8 * 2 * PI
            b.box(GOLD, 0.06, 0.1, 0.06, x=s * 0.45, y=1.45 + math.cos(a) * 0.29, z=math.sin(a) * 0.29, rx=a)
    b.cap('#d9a84a', 0.2, 0.55, 12, 6, y=2.0, z=0.85, rx=-0.55)
    b.ell('#d9a84a', 0.24, 0.26, 0.42, 14, 8, y=2.42, z=1.18, rx=0.3)
    b.sph('#7fe6d6', 0.08, 10, 6, x=-0.17, y=2.5, z=1.3)
    b.sph('#7fe6d6', 0.08, 10, 6, x=0.17, y=2.5, z=1.3)
    for s in (-1, 1):
        b.cone('#d9a84a', 0.08, 0.26, 6, x=s * 0.12, y=2.7, z=1.08, rz=-s * 0.2)
    for k in range(6):
        b.box('#2f8f86', 0.06, 0.22, 0.12, bev=0.02, y=2.25 - k * 0.07, z=0.95 - k * 0.12, rx=0.6)
    b.lathe('#8a3a55', [(0.4, 1.86), (0.42, 1.92), (0.3, 1.98)], 16, z=0.05, sx=0.9)
    b.box('#5a3a24', 0.6, 0.12, 0.7, bev=0.05, y=1.93, z=0.0)
    b.box('#5a3a24', 0.5, 0.3, 0.1, bev=0.04, y=2.08, z=-0.32)
    for s in (-1, 1):
        b.box('#5a3a24', 0.06, 0.6, 0.12, x=s * 0.33, y=1.6, z=0.05)
        b.tor(GOLD, 0.08, 0.025, 10, 4, x=s * 0.36, y=1.28, z=0.05, ry=PI / 2)
    for k in range(3):
        b.box(['#2f8f86', '#8a3a55', GOLD][k], 0.08, 0.7, 0.05, bev=0.02, x=(k - 1) * 0.1, y=1.35, z=-1.05, rx=0.5)
    parts = [b]
    for i, (x, z) in enumerate(((-0.25, 0.55), (0.25, -0.55), (0.25, 0.55), (-0.25, -0.55))):
        p = Part('leg%d' % i, (x, 1.35, z))
        p.sph(GOLD, 0.14, 10, 6, x=x, y=1.32, z=z)
        p.cap('#d9a84a', 0.09, 0.5, 10, 6, x=x, y=0.98, z=z)
        p.sph(GOLD, 0.1, 10, 6, x=x, y=0.66, z=z)
        p.cap('#2f8f86', 0.07, 0.42, 10, 6, x=x, y=0.38, z=z)
        p.lathe('#3a3a48', [(0.12, 0), (0.13, 0.06), (0.09, 0.14)], 12, x=x, z=z)
        parts.append(p)
    model('O.strider', parts)


def glider():
    b = Part('body')
    for k in range(-4, 5):
        x = k * 0.55
        b.box('CLOTH' if k % 2 else WHITE, 0.56, 0.04, 1.5 - abs(k) * 0.12, x=x, y=2.9 - abs(k) * 0.06 - (k * k) * 0.012, z=0.1, rz=-k * 0.06)
    b.cyl('#6a4630', 0.03, 0.03, 4.9, 6, y=2.95, z=0.82, rz=PI / 2)
    b.cyl('#6a4630', 0.03, 0.03, 1.6, 6, y=2.94, z=0.1, rx=PI / 2)
    for s in (-1, 1):
        b.cyl(ROPE, 0.012, 0.012, 1.5, 4, x=s * 0.55, y=2.2, z=0.25, rz=s * 0.35)
    b.cyl('#6a4630', 0.025, 0.025, 1.0, 6, y=1.55, z=0.25, rz=PI / 2)
    model('O.glider', [b])
strider(); glider()

# =====================================================================  OBJECTS
def chest():
    b = Part('body'); l = Part('lid', (0, 0.62, -0.38))
    b.box('WOOD', 1.12, 0.62, 0.78, bev=0.04, y=0.31)
    for x in (-0.42, 0.42):
        b.box(GOLD, 0.1, 0.66, 0.82, bev=0.02, x=x, y=0.32)
    b.box(GOLD, 1.16, 0.08, 0.82, bev=0.02, y=0.06)
    l.cyl('WOOD', 0.39, 0.39, 1.12, 16, y=0.62, z=0.0, rz=PI / 2, sy=0.6, sx=1)
    for x in (-0.42, 0.42):
        l.cyl(GOLD, 0.41, 0.41, 0.1, 16, x=x, y=0.62, rz=PI / 2, sy=0.62)
    l.box(GOLD, 0.2, 0.26, 0.08, bev=0.03, y=0.6, z=0.41)
    l.cyl(DARK, 0.03, 0.03, 0.04, 8, y=0.58, z=0.45, rx=PI / 2)
    model('O.chest', [b, l])


def waystone():
    b = Part('body')
    b.cyl('#77728a', 1.25, 1.45, 0.35, 14, y=0.17)
    b.cyl('#8d8a9a', 1.0, 1.15, 0.25, 14, y=0.45)
    b.lathe('#8d8a9a', [(0.62, 0.55), (0.5, 1.2), (0.42, 2.6), (0.55, 2.75), (0.5, 2.85)], 8)
    for k in range(4):
        b.box('#7fe6d6', 0.06, 1.2, 0.04, x=math.sin(k * PI / 2) * 0.47, y=1.8, z=math.cos(k * PI / 2) * 0.47, ry=k * PI / 2)
    r = Part('ring', (0, 3.4, 0)); r.tor('#555a66', 1.15, 0.1, 30, 8, y=3.4)
    d = Part('dot', (1.15, 3.4, 0)); d.sph('#555a66', 0.2, 12, 8, x=1.15, y=3.4)
    model('O.waystone', [b, r, d])


one('O.crate', lambda b: (b.box('#a8743e', 1, 1, 1, bev=0.05, y=0.5), [b.box('#7a5234', 1.04, 0.12, 1.04, bev=0.02, y=y) for y in (0.12, 0.88)],
                          [b.box('#7a5234', 0.12, 1.0, 1.04, bev=0.02, x=x, y=0.5) for x in (-0.44, 0.44)], b.box('#c86a4a', 0.5, 0.3, 0.02, y=0.55, z=0.51)))
one('O.herb', lambda b: ([b.ell('#4b8a45', 0.1, 0.32, 0.04, 8, 5, x=math.cos(k * 1.26) * 0.12, y=0.28, z=math.sin(k * 1.26) * 0.12, ry=-k * 1.26 + PI / 2, rx=0.4) for k in range(5)],
                         b.cyl('#4b8a45', 0.02, 0.03, 0.6, 5, y=0.35), [b.ell('BLOOM', 0.12, 0.05, 0.08, 8, 5, x=math.cos(k * 1.26) * 0.1, y=0.68, z=math.sin(k * 1.26) * 0.1, ry=-k * 1.26) for k in range(5)],
                         b.sph('#ffe08a', 0.06, 8, 5, y=0.7)))
one('O.ore', lambda b: (b.ico('#6a6a78', 0.75, 1, y=0.35, sy=0.7), b.ico('#7a7a88', 0.45, 1, x=0.55, y=0.25, z=0.2, sy=0.7),
                        [b.cyl('GEM', 0, 0.16, 0.7, 6, x=x, y=0.75, z=z, rz=rz, rx=rx) for x, z, rz, rx in ((0.15, 0, -0.3, 0), (-0.3, 0.1, 0.5, 0.2), (0.05, 0.35, 0.1, 0.6), (0.5, 0.3, -0.6, 0.3))]))
one('O.page', lambda b: (b.box('#f4ead0', 0.5, 0.66, 0.03, y=1.1, rx=-0.3), [b.box('#8a7a6a', 0.36, 0.02, 0.035, y=1.1 + k * 0.1, z=0.005 + k * 0.03, rx=-0.3) for k in range(-2, 3)],
                         b.cyl('#8d8a9a', 0.5, 0.6, 0.5, 8, y=0.25), b.cyl('#8d8a9a', 0.35, 0.45, 0.35, 8, x=1.5, y=0.2, z=0.5), b.box('#77728a', 0.7, 2.2, 0.7, bev=0.06, x=1.6, y=1.1, z=-1.0, rz=0.1),
                         b.box('#77728a', 0.6, 1.2, 0.6, bev=0.06, x=-1.5, y=0.6, z=-0.6, rz=-0.15), b.box('#77728a', 2.8, 0.4, 0.6, bev=0.05, x=0.1, y=2.2, z=-1.0, rz=0.06)))


def bell():
    b = Part('body')
    for x in (-1.0, 1.0):
        b.box(WOOD2, 0.26, 3.2, 0.26, bev=0.04, x=x, y=1.6)
        b.box(WOOD2, 0.6, 0.2, 0.6, bev=0.04, x=x, y=0.1)
    b.box(WOOD2, 2.6, 0.26, 0.32, bev=0.05, y=3.2)
    b.prism('#5a5a66', 2.9, 0.5, 0.7, y=3.33)
    bb = Part('bell', (0, 2.95, 0))
    bb.lathe(GOLD, [(0.62, 1.95), (0.6, 2.05), (0.42, 2.3), (0.36, 2.75), (0.2, 2.9), (0, 2.92)], 18, smoothcap=True)
    bb.tor(GOLD, 0.6, 0.05, 20, 5, y=1.97, rx=PI / 2)
    bb.sph(IRON, 0.12, 10, 6, y=2.0)
    model('O.bell', [b, bb])


def beacon():
    b = Part('body')
    b.cyl(STONE, 1.4, 1.7, 1.2, 10, y=0.6)
    b.cyl(STONE2, 1.1, 1.2, 1.4, 10, y=1.8)
    b.cyl(IRON, 1.3, 0.9, 0.6, 12, y=2.8)
    for k in range(8):
        a = k / 8 * 2 * PI
        b.box(IRON, 0.12, 0.8, 0.12, x=math.cos(a) * 1.25, y=3.4, z=math.sin(a) * 1.25)
    b.ico('#5a4a44', 0.6, 1, y=3.1, sy=0.5)
    f = Part('flame', (0, 3.3, 0))
    f.lathe('#ffa040', [(0.7, 3.1), (0.5, 3.8), (0.2, 4.4), (0, 4.6)], 10)
    f.lathe('#ffe08a', [(0.4, 3.1), (0.25, 3.7), (0, 4.0)], 8)
    model('O.beacon', [b, f])


def rift():
    b = Part('body'); r = Part('ring', (0, 2.4, 0))
    b.cyl('#77728a', 1.1, 1.3, 0.4, 12, y=0.2)
    for k in range(5):
        a = k / 5 * 2 * PI
        b.cone('#b48aff', 0.18, 0.9, 5, x=math.cos(a) * 1.0, y=0.6, z=math.sin(a) * 1.0, rz=-math.cos(a) * 0.4, rx=math.sin(a) * 0.4)
    r.tor('#b48aff', 1.7, 0.14, 36, 8, y=2.4)
    r.tor('#e6d0ff', 1.45, 0.05, 32, 5, y=2.4)
    r.ell('#3a2a6a', 1.5, 1.5, 0.04, 24, 6, y=2.4)
    model('O.rift', [b, r])


def minute():
    c = Part('core', (0, 1.2, 0)); r = Part('ring', (0, 1.2, 0))
    c.ico('#fff0c0', 0.26, 0, y=1.2, sy=1.4)
    r.tor('#ffc66a', 0.5, 0.035, 24, 5, y=1.2)
    for k in range(12):
        a = k / 12 * 2 * PI
        r.box('#ffc66a', 0.03, 0.09, 0.03, x=math.cos(a) * 0.5, y=1.2 + math.sin(a) * 0.5, rz=a)
    model('O.minute', [c, r])


def lift():
    b = Part('body'); r = Part('ring', (0, 1, 0))
    b.cyl(GOLD, 3.4, 3.6, 0.4, 24, y=0.2)
    b.cyl('#faf6ee', 2.8, 2.8, 0.1, 24, y=0.42)
    for k in range(6):
        a = k / 6 * 2 * PI
        b.cyl('#faf6ee', 0.18, 0.22, 2.4, 8, x=math.cos(a) * 3.2, y=1.4, z=math.sin(a) * 3.2)
        b.sph(GOLD, 0.25, 10, 6, x=math.cos(a) * 3.2, y=2.7, z=math.sin(a) * 3.2)
    r.tor('#bff4ff', 2.2, 0.12, 32, 6, y=1, rx=PI / 2)
    model('O.lift', [b, r])


chest(); waystone(); bell(); beacon(); rift(); minute(); lift()

# =====================================================================  BUILDINGS
def window(b, x, y, z, ry=0, w=1.0, h=1.1, frame='TRIM', shutters=None, box=None):
    a = dict(x=x, y=y, z=z, ry=ry)
    b.box(GLOW, w, h, 0.12, **a)
    dx, dz = math.cos(ry), -math.sin(ry)
    fx, fz = math.sin(ry) * 0.07, math.cos(ry) * 0.07
    b.box(frame, w + 0.24, 0.14, 0.2, bev=0.03, x=x + fx, y=y + h / 2 + 0.05, z=z + fz, ry=ry)
    b.box(frame, w + 0.3, 0.14, 0.3, bev=0.03, x=x + fx * 1.5, y=y - h / 2 - 0.05, z=z + fz * 1.5, ry=ry)
    b.box(frame, 0.08, h, 0.15, x=x + fx, y=y, z=z + fz, ry=ry)
    b.box(frame, w, 0.07, 0.15, x=x + fx, y=y + 0.05, z=z + fz, ry=ry)
    if shutters:
        for s in (-1, 1):
            b.box(shutters, w * 0.5, h + 0.1, 0.08, bev=0.02, x=x + dx * s * (w * 0.75 + 0.05) + fx, y=y, z=z + dz * s * (w * 0.75 + 0.05) + fz, ry=ry)
    if box:
        b.box(WOOD2, w + 0.2, 0.3, 0.35, bev=0.03, x=x + fx * 4, y=y - h / 2 - 0.3, z=z + fz * 4, ry=ry)
        for k in range(4):
            b.sph(box[k % len(box)], 0.13, 8, 5, x=x + fx * 4 + dx * (k - 1.5) * 0.28, y=y - h / 2 - 0.08, z=z + fz * 4 + dz * (k - 1.5) * 0.28)


def door(b, x, y, z, ry=0, w=1.3, h=2.3, frame='TRIM', arch=False, color=DOOR):
    fx, fz = math.sin(ry), math.cos(ry)
    b.box(color, w, h, 0.14, x=x, y=y + h / 2, z=z, ry=ry)
    for k in range(3):
        b.box('#4a2e1c', 0.05, h - 0.2, 0.05, x=x + math.cos(ry) * (k - 1) * w * 0.3 + fx * 0.07, y=y + h / 2, z=z - math.sin(ry) * (k - 1) * w * 0.3 + fz * 0.07, ry=ry)
    b.box(frame, w + 0.3, 0.2, 0.26, bev=0.04, x=x + fx * 0.06, y=y + h + 0.1, z=z + fz * 0.06, ry=ry)
    for s in (-1, 1):
        b.box(frame, 0.16, h, 0.24, bev=0.03, x=x + math.cos(ry) * s * (w / 2 + 0.07) + fx * 0.06, y=y + h / 2, z=z - math.sin(ry) * s * (w / 2 + 0.07) + fz * 0.06, ry=ry)
    if arch:
        b.cyl(color, w / 2, w / 2, 0.14, 14, x=x, y=y + h, z=z, rx=PI / 2, ry=ry)
    b.sph(GOLD, 0.06, 8, 5, x=x + math.cos(ry) * w * 0.32 + fx * 0.12, y=y + h * 0.45, z=z - math.sin(ry) * w * 0.32 + fz * 0.12)
    b.box(STONE2, w + 0.6, 0.18, 0.7, bev=0.04, x=x + fx * 0.4, y=y + 0.09, z=z + fz * 0.4, ry=ry)


def gable(b, w, d, y, h, color, over=0.6, thick=0.25):
    """Pitched roof: two sloped slabs meeting at a ridge along Z."""
    run = w / 2 + over
    ang = math.atan2(h, w / 2)
    L = math.hypot(run, h * run / (w / 2))
    for s in (-1, 1):
        b.box(color, L, thick, d + over * 2, bev=0.06, x=s * run / 2, y=y + h * 0.5 * (run / (w / 2)) - h * (over / (w / 2)) * 0.5 + 0.05, rz=-s * ang)
    b.prism('WALL', w, h, d - 0.05, y=y)
    b.box(color, 0.4, 0.35, d + over * 2 + 0.1, bev=0.1, y=y + h + 0.12)


def chimney(b, x, z, y, h=2.2, c=STONE):
    b.box(c, 0.8, h, 0.8, bev=0.05, x=x, y=y + h / 2, z=z)
    b.box(STONE2, 1.0, 0.25, 1.0, bev=0.05, x=x, y=y + h + 0.1, z=z)


H = {}
def house(name):
    def deco(f):
        H[name] = f
        return f
    return deco


@house('vale_a')
def _(b):
    b.box(STONE, 7.4, 0.9, 6.4, bev=0.12, y=0.45)
    b.box('WALL', 7, 3.2, 6, bev=0.06, y=2.4)
    for x in (-3.45, 3.45):
        for z in (-2.95, 2.95):
            b.box('TRIM', 0.3, 3.3, 0.3, bev=0.04, x=x, y=2.45, z=z)
    for z in (-2.95, 2.95):
        b.box('TRIM', 7.1, 0.28, 0.3, bev=0.04, y=3.95, z=z)
        b.box('TRIM', 7.1, 0.24, 0.26, bev=0.04, y=1.0, z=z)
        for x in (-1.9, 1.9):
            b.box('TRIM', 0.22, 3.1, 0.22, x=x, y=2.45, z=z + (0.06 if z > 0 else -0.06), rz=0.5 if x < 0 else -0.5)
    gable(b, 7, 6, 4.0, 2.8, 'ROOF', 0.7, 0.35)
    door(b, 0, 0.9, 3.05)
    window(b, -2.3, 2.6, 3.05, shutters='TRIM', box=('#ff7aa8', '#ffd24a', '#ffffff'))
    window(b, 2.3, 2.6, 3.05, shutters='TRIM', box=('#b48aff', '#ff7aa8', '#ffd24a'))
    window(b, 3.55, 2.6, 0, ry=PI / 2, shutters='TRIM')
    window(b, 0, 5.0, 3.0, w=0.8, h=0.8)
    chimney(b, 2.0, -1.5, 5.0)
    b.cyl('#9a6a3a', 0.4, 0.4, 0.9, 10, x=-3.0, y=0.45, z=3.6)


@house('vale_b')
def _(b):
    b.box(STONE, 9.4, 0.7, 5.4, bev=0.12, y=0.35)
    b.box('WALL', 9, 3.0, 5, bev=0.06, y=2.1)
    b.box('WALL', 4.2, 3.0, 4.4, bev=0.06, x=-2.4, y=2.1, z=-4.4)
    gable(b, 9.0, 5, 3.6, 2.5, 'ROOF', 0.6, 0.3)
    b.box('ROOF', 5.6, 0.3, 4.8, bev=0.06, x=-2.4, y=4.0, z=-4.4, rx=0.25)
    for x in (-3.5, 0, 3.5):
        b.box('TRIM', 0.24, 3.0, 0.24, x=x, y=2.1, z=2.55)
    b.box('TRIM', 9.1, 0.24, 0.26, y=3.5, z=2.55)
    b.box('#c8a070', 4.4, 0.18, 2.2, x=2.2, y=0.8, z=3.6)
    for x in (0.4, 4.0):
        b.box('TRIM', 0.2, 2.6, 0.2, x=x, y=2.0, z=4.6)
    b.box('ROOF', 4.8, 0.2, 2.6, bev=0.05, x=2.2, y=3.4, z=3.75, rx=-0.25)
    door(b, 2.2, 0.7, 2.55)
    window(b, -1.6, 2.3, 2.55, shutters='TRIM', box=('#ffd24a', '#ffffff'))
    window(b, -3.6, 2.3, 2.55, shutters='TRIM')
    chimney(b, -3.2, -1, 4.2, 2.6)
    for k in range(3):
        b.cyl('#9a6a3a', 0.38, 0.38, 0.85, 10, x=4.4 + k * 0.1, y=0.42 + (k == 2) * 0.85, z=3.9 - (k % 2) * 0.8)


@house('crown_a')
def _(b):
    b.box(STONE, 6.8, 2.8, 6.2, bev=0.08, y=1.4)
    b.box('WALL', 7.4, 3.2, 6.8, bev=0.06, y=4.4)
    b.box('WALL', 7.0, 2.4, 6.4, bev=0.06, y=7.0)
    for y in (2.8, 6.0, 8.2):
        b.box('TRIM', 7.6, 0.3, 7.0, bev=0.05, y=y)
    gable(b, 7.2, 6.6, 8.3, 4.0, 'ROOF', 0.6, 0.35)
    door(b, -1.4, 0, 3.12, frame=STONE2, arch=True)
    window(b, 1.6, 1.6, 3.12, w=1.6, h=1.2, frame=STONE2)
    b.box('CLOTH', 2.4, 0.12, 1.4, x=1.6, y=2.55, z=3.7, rx=0.35)
    for x in (-2.2, 0, 2.2):
        window(b, x, 4.4, 3.42, w=0.9, h=1.4, shutters='TRIM')
        window(b, x, 7.0, 3.22, w=0.9, h=1.2)
    b.box('ROOF', 1.6, 1.5, 1.4, bev=0.06, y=10.0, z=1.9)
    window(b, 0, 10.0, 2.62, w=0.7, h=0.8)
    chimney(b, -2.4, -1.6, 9.5, 2.6)


@house('crown_b')
def _(b):
    crown_a = H['crown_a']
    b.box(STONE, 6.4, 2.8, 6.2, bev=0.08, y=1.4)
    b.box('WALL', 6.8, 4.4, 6.6, bev=0.06, y=5.0)
    gable(b, 6.6, 6.4, 7.2, 3.4, 'ROOF', 0.55, 0.32)
    door(b, 0, 0, 3.12, frame=STONE2, arch=True)
    for x in (-2, 2):
        window(b, x, 1.6, 3.12, w=1.0, h=1.0, frame=STONE2)
        window(b, x, 4.6, 3.32, w=0.9, h=1.3, shutters='TRIM', box=('#ff7aa8', '#ffffff'))
    b.cyl('WALL', 1.5, 1.6, 10, 14, x=3.6, y=5.0, z=2.8)
    b.tor('TRIM', 1.55, 0.12, 18, 5, x=3.6, y=6.8, z=2.8, rx=PI / 2)
    b.cone('ROOF', 2.1, 3.6, 14, x=3.6, y=11.8, z=2.8)
    b.sph(GOLD, 0.2, 8, 6, x=3.6, y=13.7, z=2.8)
    window(b, 3.6, 8.2, 4.35, w=0.6, h=1.0)


@house('coast_a')
def _(b):
    for x in (-2.8, 2.8):
        for z in (-2.4, 2.4):
            b.cyl('#8a6a4a', 0.2, 0.24, 2.2, 8, x=x, y=1.1, z=z)
    b.box('#b08a5a', 6.8, 0.3, 6.0, bev=0.04, y=2.2)
    b.box('WALL', 5.6, 2.8, 4.6, bev=0.08, y=3.75, z=-0.2)
    for z in (-2.4, 0, 2.4):
        b.box('#d9c07a', 0.15, 2.8, 0.15, x=-2.85, y=3.75, z=z * 0.85)
    b.box('ROOF', 7.2, 0.3, 6.6, bev=0.08, y=5.4, rx=0.14)
    for x in (-3.2, -1.6, 0, 1.6, 3.2):
        b.box('#f2ead8', 0.1, 0.9, 0.1, x=x, y=2.8, z=2.95)
    b.box('#f2ead8', 6.6, 0.12, 0.12, y=3.25, z=2.95)
    door(b, -1.0, 2.35, 2.1, w=1.1, h=2.0, frame='TRIM')
    window(b, 1.5, 3.9, 2.12, w=1.2, h=1.0, frame='TRIM', shutters='#ffffff')
    for k in range(7):
        b.box('#b08a5a', 1.4, 0.12, 0.4, x=1.6, y=0.25 + k * 0.3, z=3.3 + k * 0.32)
    b.cap('#3fc0c0', 0.38, 1.9, 12, 6, x=-3.5, y=1.6, z=3.1, rz=0.25, sz=0.18)
    b.box('#ff5a5a', 0.06, 2.2, 0.08, x=-3.5, y=1.6, z=3.2, rz=0.25)


@house('coast_b')
def _(b):
    b.box('#b08a5a', 6.4, 0.4, 5.4, bev=0.05, y=0.2)
    b.box('WALL', 5.2, 2.8, 3.8, bev=0.08, y=1.8, z=-0.6)
    for k in range(6):
        b.box('#9ad06a' if k % 2 else '#7ab84a', 6.6, 0.18, 1.0, bev=0.05, y=3.5 - k * 0.04, z=-2.7 + k * 0.85, rx=0.18)
    for x in (-2.8, 2.8):
        b.cyl('#8a6a4a', 0.14, 0.14, 2.9, 6, x=x, y=1.65, z=2.3)
    for k in range(6):
        b.box('CLOTH' if k % 2 else WHITE, 1.0, 0.08, 1.4, x=-2.5 + k * 1.0, y=2.95, z=2.6, rx=0.3)
    door(b, -1.2, 0.4, 1.32, w=1.2, h=2.0)
    window(b, 1.2, 2.0, 1.32, w=1.6, h=1.0, frame='TRIM')
    b.box('#c8a070', 2.6, 0.9, 0.7, bev=0.05, x=1.2, y=0.85, z=2.0)
    for k in range(3):
        b.sph(['#ff5a5a', '#ffd24a', '#3fc0c0'][k], 0.17, 8, 5, x=0.5 + k * 0.6, y=1.42, z=2.0)


@house('jungle_a')
def _(b):
    for k in range(5):
        a = k / 5 * 2 * PI + 0.3
        b.cyl('#5a4030', 0.24, 0.3, 3.4, 8, x=math.cos(a) * 2.8, y=1.7, z=math.sin(a) * 2.8)
    b.cyl('#8a6a4a', 3.9, 3.9, 0.35, 16, y=3.4)
    for k in range(16):
        a = k / 16 * 2 * PI
        b.cyl('#6a4630', 0.06, 0.06, 1.0, 5, x=math.cos(a) * 3.75, y=4.0, z=math.sin(a) * 3.75)
    b.tor(ROPE, 3.75, 0.05, 32, 4, y=4.45, rx=PI / 2)
    b.cyl('WALL', 2.8, 3.0, 2.6, 16, y=4.9)
    for k in range(4):
        b.cone('ROOF', 4.4 - k * 0.7, 1.5, 16, y=6.9 + k * 0.85)
    b.cone('#ffd24a', 0.2, 0.8, 6, y=10.4)
    door(b, 0, 3.6, 2.95, w=1.2, h=2.0)
    for s in (-1, 1):
        b.cyl('#6a4630', 0.07, 0.07, 3.6, 5, x=s * 0.45, y=1.8, z=4.6, rx=-0.35)
    for k in range(8):
        b.box('#6a4630', 1.0, 0.08, 0.14, y=0.3 + k * 0.42, z=5.2 - k * 0.15, rx=-0.35)
    b.sph('#ffb040', 0.32, 10, 6, x=2.4, y=5.4, z=1.8)


@house('jungle_b')
def _(b):
    for x in (-3.2, 0, 3.2):
        for z in (-2.2, 2.2):
            b.cyl('#5a4030', 0.2, 0.25, 1.4, 8, x=x, y=0.7, z=z)
    b.box('#8a6a4a', 8, 0.3, 5.4, bev=0.05, y=1.4)
    b.box('WALL', 7.4, 2.4, 4.4, bev=0.12, y=2.8)
    for k in range(3):
        gable(b, 7.0 - k * 0.6, 8.6 - k * 0.6, 4.0 + k * 0.5, 2.6, 'ROOF', 0.7, 0.3)
    door(b, 0, 1.55, 2.25, w=1.3, h=2.0)
    for x in (-2.4, 2.4):
        window(b, x, 3.0, 2.25, w=1.0, h=0.9, frame='#5a4030')
    b.ico('#4fae4a', 0.8, 1, x=4.4, y=0.6, z=2.0)


@house('desert_a')
def _(b):
    b.box('WALL', 7, 4.2, 6, bev=0.45, seg=3, y=2.1)
    b.box('WALL', 7.4, 0.6, 6.4, bev=0.2, y=4.3)
    for x in (-2.4, -0.8, 0.8, 2.4):
        b.cyl('#8a5a34', 0.14, 0.14, 1.0, 6, x=x, y=3.6, z=3.2, rx=PI / 2)
    door(b, 0, 0, 3.02, w=1.4, h=2.6, frame='#d0a870', arch=True, color='#3a2a24')
    window(b, -2.3, 2.6, 3.02, w=0.9, h=1.1, frame='#d0a870')
    window(b, 2.3, 2.6, 3.02, w=0.9, h=1.1, frame='#d0a870')
    b.box('CLOTH', 3.4, 0.08, 1.8, x=-1.3, y=3.0, z=3.9, rx=0.3)
    for x in (-2.9, 0.3):
        b.cyl('#8a5a34', 0.05, 0.05, 1.3, 5, x=x, y=2.3, z=4.7)
    b.box('WALL', 2.6, 2.0, 2.6, bev=0.3, x=1.9, y=5.4, z=-1.4)
    b.dome('CLOTH', 1.3, 14, 5, x=1.9, y=6.4, z=-1.4)
    for k in range(3):
        b.lathe('#c86a4a', [(0.25, 0), (0.35, 0.3), (0.2, 0.6), (0.22, 0.7)], 10, x=-3.8 + k * 0.7, z=2.4 + (k % 2) * 0.6)


@house('desert_b')
def _(b):
    b.cyl('WALL', 3.6, 3.8, 4, 16, y=2)
    b.tor('#d0a870', 3.65, 0.18, 24, 5, y=4.0, rx=PI / 2)
    b.dome('ROOF', 3.4, 18, 7, y=4.0, sy=1.15)
    b.cone(GOLD, 0.18, 1.2, 8, y=8.4)
    b.sph(GOLD, 0.25, 8, 5, y=7.9)
    door(b, 0, 0, 3.6, w=1.5, h=2.4, frame='#d0a870', arch=True, color='#3a2a24')
    for a in (-0.9, 0.9):
        window(b, math.sin(a) * 3.7, 2.4, math.cos(a) * 3.7, ry=a, w=0.8, h=1.0, frame='#d0a870')
    b.cyl('WALL', 0.8, 0.9, 7, 10, x=3.6, y=3.5, z=-1.6)
    b.cyl('#d0a870', 1.1, 1.0, 0.4, 10, x=3.6, y=7.2, z=-1.6)
    b.dome('ROOF', 0.9, 10, 4, x=3.6, y=7.4, z=-1.6)


@house('crag_a')
def _(b):
    b.box(STONE2, 6.2, 1.6, 6.2, bev=0.15, y=0.8)
    b.box('WALL', 5.4, 9, 5.4, bev=0.12, y=5.5)
    for y in (3.2, 6.4, 9.6):
        b.box(STONE2, 5.7, 0.35, 5.7, bev=0.06, y=y)
    for k in range(10):
        b.box(STONE2, R.uniform(0.6, 1.0), R.uniform(0.4, 0.6), 0.2, bev=0.05, x=R.uniform(-2.3, 2.3), y=R.uniform(1.5, 9), z=2.72)
    b.cone('ROOF', 4.4, 4.2, 4, y=12.1, ry=PI / 4)
    b.box('#7a5234', 6.2, 0.25, 1.8, bev=0.05, y=6.5, z=3.4)
    for x in (-2.8, -1.4, 0, 1.4, 2.8):
        b.box('#7a5234', 0.12, 1.0, 0.12, x=x, y=7.1, z=4.2)
    b.box('#7a5234', 6.0, 0.12, 0.12, y=7.6, z=4.2)
    for x in (-2.8, 2.8):
        b.box('#7a5234', 0.2, 1.4, 0.2, x=x, y=5.8, z=4.2, rx=0.6)
    door(b, 0, 1.6, 2.72, w=1.3, h=2.2, frame=STONE2, arch=True)
    door(b, 0, 6.6, 2.72, w=1.1, h=1.9, frame=STONE2)
    window(b, -1.6, 4.5, 2.72, w=0.8, h=1.1, frame=STONE2)
    window(b, 1.6, 4.5, 2.72, w=0.8, h=1.1, frame=STONE2)
    window(b, 0, 8.6, 2.72, w=0.8, h=1.0, frame=STONE2)
    chimney(b, 1.8, -1.8, 10.5, 2.4, STONE2)


@house('crag_b')
def _(b):
    b.ico(STONE2, 4.2, 1, x=-2.6, y=1.2, z=-2.4, sy=0.9)
    b.box('WALL', 7, 4.2, 5, bev=0.12, y=2.1)
    for x in (-3.6, 3.6):
        b.box(STONE2, 0.9, 4.4, 1.2, bev=0.1, x=x, y=2.2, z=2.2, rx=-0.12)
    b.box('ROOF', 8.0, 0.4, 3.6, bev=0.08, y=4.8, z=1.2, rx=0.42)
    b.box('ROOF', 8.0, 0.4, 3.4, bev=0.08, y=4.8, z=-1.4, rx=-0.42)
    door(b, 0, 0, 2.52, w=1.4, h=2.4, frame=STONE2, arch=True)
    window(b, -2.1, 2.4, 2.52, w=0.9, h=1.0, frame=STONE2, shutters='TRIM')
    window(b, 2.1, 2.4, 2.52, w=0.9, h=1.0, frame=STONE2, shutters='TRIM')
    b.box('#5a4a3a', 0.2, 2.0, 1.4, x=0, y=6.4, z=-0.1)
    b.cyl('#c8443a', 0.04, 0.04, 2.6, 5, x=3.2, y=6.0, z=1.6)
    b.box('#c8443a', 1.2, 0.8, 0.05, x=3.8, y=6.8, z=1.6)


@house('frost_a')
def _(b):
    b.dome('#f2f7fc', 3.8, 22, 8, sy=0.85)
    for k in range(4):
        b.tor('#dfe9f5', 3.8 * math.cos(k * 0.35), 0.06, 26, 4, y=3.2 * math.sin(k * 0.35) + 0.05, rx=PI / 2)
    b.cyl('#e0eaf4', 1.3, 1.3, 2.4, 14, y=1.1, z=3.6, rx=PI / 2)
    b.dome('#e0eaf4', 1.3, 14, 5, y=1.1, z=3.6, rx=PI / 2, sy=0.01)
    b.cyl('#3a3a48', 0.95, 0.95, 0.1, 14, y=1.0, z=4.82, rx=PI / 2)
    b.box('#b08a6a', 1.6, 1.0, 0.1, y=1.6, z=4.86)
    b.cyl('#5a5a66', 0.25, 0.3, 1.2, 8, x=1.0, y=3.4, z=-1.0)
    for k in range(3):
        b.box('#9a7a5a', 2.0, 0.2, 0.2, x=-3.0, y=0.4 + k * 0.25, z=2.6 + k * 0.05, ry=0.6)


@house('frost_b')
def _(b):
    b.box(STONE2, 9, 0.8, 6, bev=0.12, y=0.4)
    b.box('WALL', 8.4, 3.0, 5.4, bev=0.1, y=2.2)
    gable(b, 8.4, 5.4, 3.7, 3.2, 'ROOF', 0.5, 0.35)
    for s in (-1, 1):
        b.box('#f4f0e6', 0.6, 0.25, 6.6, bev=0.1, x=s * 4.6, y=3.75, rz=-s * 0.6)
    for z in (-2.7, 2.7):
        for s in (-1, 1):
            b.cyl('TRIM', 0.25, 0.3, 4.5, 8, x=s * 4.2, y=2.25, z=z)
            b.cone('TRIM', 0.3, 0.8, 8, x=s * 4.2, y=4.9, z=z)
    b.box('TRIM', 0.25, 1.4, 0.3, x=-0.5, y=7.3, z=2.75, rz=0.6)
    b.box('TRIM', 0.25, 1.4, 0.3, x=0.5, y=7.3, z=2.75, rz=-0.6)
    door(b, 0, 0.8, 2.75, w=1.5, h=2.1, frame='TRIM')
    for x in (-2.6, 2.6):
        window(b, x, 2.6, 2.75, w=0.9, h=0.8, frame='TRIM', shutters='#f4f0e6')
    b.cyl('#5a5a66', 0.3, 0.35, 1.4, 8, y=7.0, z=-1.2)
    for k in range(4):
        b.box('#9a7a5a', 1.6, 0.4, 0.4, bev=0.08, x=3.6 + (k % 2) * 0.3, y=0.2 + (k // 2) * 0.4, z=4.0, rx=PI / 2 * (k % 2) * 0.05)


@house('sky_a')
def _(b):
    b.cyl('#faf6ee', 2.0, 2.8, 9, 16, y=4.5)
    for y in (2.8, 6.2):
        b.tor(GOLD, 2.6 - y * 0.08, 0.14, 24, 5, y=y, rx=PI / 2)
    b.lathe('ROOF', [(2.6, 9.0), (2.3, 9.6), (1.4, 11.0), (0.6, 12.4), (0, 13.2)], 16)
    b.ico('#9fe6ff', 0.5, 1, y=13.6)
    b.tor(GOLD, 3.4, 0.1, 30, 5, y=7.5, rx=PI / 2 + 0.25)
    for k in range(3):
        a = k / 3 * 2 * PI
        b.box('CLOTH', 0.08, 2.6, 1.6, x=math.cos(a) * 3.0, y=7.2, z=math.sin(a) * 3.0, ry=-a, rz=0.15)
        b.cyl(GOLD, 0.04, 0.04, 3.0, 5, x=math.cos(a) * 2.4, y=7.4, z=math.sin(a) * 2.4, rz=PI / 2, ry=-a)
    door(b, 0, 0, 2.62, w=1.2, h=2.3, frame=GOLD, arch=True, color='#6a8ad0')
    window(b, 0, 5.0, 2.32, w=0.8, h=1.2, frame=GOLD)
    window(b, 2.2, 3.4, 0, ry=PI / 2, w=0.7, h=1.0, frame=GOLD)


@house('sky_b')
def _(b):
    b.cyl('#faf6ee', 4.2, 4.4, 0.6, 20, y=0.3)
    for k in range(8):
        a = k / 8 * 2 * PI
        b.cyl('#faf6ee', 0.3, 0.35, 4.2, 10, x=math.cos(a) * 3.6, y=2.7, z=math.sin(a) * 3.6)
        b.box(GOLD, 0.8, 0.3, 0.8, x=math.cos(a) * 3.6, y=4.85, z=math.sin(a) * 3.6)
    b.cyl('#faf6ee', 4.0, 4.0, 0.5, 20, y=5.2)
    b.dome('ROOF', 3.9, 20, 7, y=5.4)
    b.tor(GOLD, 4.0, 0.12, 30, 5, y=5.45, rx=PI / 2)
    b.cone(GOLD, 0.2, 1.4, 8, y=9.8)
    b.cyl('CLOTH', 1.6, 1.6, 0.6, 16, y=0.9)


@house('volcano_a')
def _(b):
    b.box('#2e2a36', 7.4, 1.0, 6.4, bev=0.15, y=0.5)
    b.box('WALL', 7, 4.0, 6, bev=0.1, y=3.0)
    for x in (-3.3, 3.3):
        b.box('#2e2a36', 0.8, 4.4, 0.8, bev=0.1, x=x, y=2.8, z=2.9)
    b.box('#2e2a36', 7.8, 0.6, 6.8, bev=0.15, y=5.2)
    b.box('WALL', 5.0, 0.8, 4.0, bev=0.1, y=5.9)
    door(b, 0, 1.0, 3.02, w=1.4, h=2.3, frame='#2e2a36', color='#3a2a24')
    for x in (-2.0, 2.0):
        b.box('#ff8a3a', 1.0, 1.0, 0.12, x=x, y=3.4, z=3.02)
        b.box(IRON, 1.2, 0.1, 0.16, x=x, y=3.4, z=3.06)
        b.box(IRON, 0.1, 1.1, 0.16, x=x, y=3.4, z=3.06)
    b.cyl('#5a5460', 0.55, 0.65, 4, 10, x=2.3, y=7.2, z=-1.4)
    b.cyl('#ff7a2a', 0.45, 0.45, 0.2, 10, x=2.3, y=9.2, z=-1.4)
    b.box('#ff7a2a', 0.4, 0.12, 0.4, x=-2.8, y=1.05, z=3.6)


@house('volcano_b')
def _(b):
    b.box('#2e2a36', 8.4, 0.8, 6.4, bev=0.15, y=0.4)
    b.box('WALL', 8, 3.6, 4.6, bev=0.1, y=2.6, z=-0.8)
    b.box('ROOF', 8.6, 0.4, 6.6, bev=0.1, y=4.6, rx=-0.1)
    for x in (-3.8, 0, 3.8):
        b.box('#2e2a36', 0.6, 3.8, 0.6, bev=0.08, x=x, y=2.6, z=2.8)
    b.box('#3a3036', 2.2, 1.2, 1.6, bev=0.1, x=-1.8, y=1.4, z=1.8)
    b.box('#ff7a2a', 1.4, 0.2, 1.0, x=-1.8, y=2.05, z=1.8)
    b.box(IRON, 1.6, 0.9, 0.8, bev=0.08, x=1.8, y=1.25, z=1.9)
    b.box(IRON, 0.5, 0.5, 1.4, bev=0.08, x=1.8, y=1.85, z=1.9)
    for k in range(3):
        b.cyl('#5a5460', 0.3, 0.35, 2.4, 8, x=-3 + k * 1.2, y=5.6, z=-2.2)
        b.sph('#ff9a3c', 0.25, 8, 5, x=-3 + k * 1.2, y=6.9, z=-2.2)


@house('reef_a')
def _(b):
    b.lathe('WALL', [(3.6, 0), (3.7, 0.8), (3.4, 2.2), (2.6, 3.4), (1.5, 4.2), (0, 4.5)], 22)
    for k in range(5):
        b.tor('ROOF', 3.5 - k * 0.6, 0.18, 26, 6, y=0.9 + k * 0.75, rx=PI / 2)
    b.lathe('ROOF', [(0.6, 4.3), (0.3, 5.5), (0, 6.2)], 10, rz=0.2)
    b.cyl('#2a3a5a', 1.0, 1.0, 0.25, 16, y=1.2, z=3.55, rx=PI / 2)
    b.tor(WHITE, 1.0, 0.12, 18, 5, y=1.2, z=3.62)
    for k in range(3):
        b.cone('#ff7a8a', 0.4, 2.6 - k * 0.6, 8, x=3.8 + k * 0.5, y=1.2 - k * 0.3, z=-1 + k * 0.8)
    b.sph('#fff6f0', 0.4, 12, 8, x=-2.2, y=3.4, z=1.4)
    b.sph('#fff6f0', 0.3, 10, 6, x=2.2, y=3.0, z=1.8)


@house('reef_b')
def _(b):
    for k in range(4):
        b.cyl('WALL', 2.2 - k * 0.35, 2.5 - k * 0.35, 2.6, 16, y=1.3 + k * 2.5)
        b.tor('ROOF', 2.4 - k * 0.35, 0.2, 22, 6, y=2.6 + k * 2.5, rx=PI / 2)
    b.ico('#fff6f0', 0.8, 1, y=10.8)
    for k in range(4):
        b.cyl('#2a3a5a', 0.5, 0.5, 0.2, 12, y=1.4 + k * 2.5, z=2.3 - k * 0.35, rx=PI / 2)
    for k in range(6):
        a = k / 6 * 2 * PI
        b.cone('ROOF', 0.3, 1.8, 6, x=math.cos(a) * 2.6, y=0.9, z=math.sin(a) * 2.6, rz=-math.cos(a) * 0.3, rx=math.sin(a) * 0.3)


for name, f in H.items():
    one('B.' + name, f)

# =====================================================================  LANDMARKS
def windmill(b):
    b.lathe('WALL', [(3.6, 0), (3.4, 1.0), (2.6, 9), (2.8, 9.2)], 12)
    b.cone('ROOF', 3.3, 3.4, 12, y=10.8)
    door(b, 0, 0, 3.55, w=1.3, h=2.4)
    window(b, 0, 5.2, 3.0, w=0.8, h=1.0)
    for k in range(4):
        a = k * PI / 2 + 0.4
        b.box('TRIM', 0.3, 8.5, 0.2, x=math.sin(a) * 4.2, y=8.8 + math.cos(a) * 4.2, z=3.3, rz=-a)
        b.box('#f6ecd6', 1.4, 6.6, 0.08, x=math.sin(a) * 4.6 + math.cos(a) * 0.8, y=8.8 + math.cos(a) * 4.6 - math.sin(a) * 0.8, z=3.35, rz=-a)
    b.cyl(WOOD2, 0.5, 0.5, 0.8, 10, y=8.8, z=3.0, rx=PI / 2)
    return 4.5


def lighthouse(b):
    b.cyl(STONE, 6, 6.5, 2, 16, y=1)
    b.lathe(WHITE, [(3.2, 2), (2.4, 16), (2.6, 16.4)], 16)
    for y in (5, 10, 14):
        b.lathe('#ff5a5a', [(3.2 - y * 0.05, y), (3.2 - (y + 1.4) * 0.05, y + 1.4)], 16, smoothcap=False)
    b.cyl(IRON, 3.0, 3.0, 0.4, 16, y=16.6)
    b.cyl('#ffe08a', 1.8, 1.8, 2.2, 12, y=17.9)
    for k in range(8):
        a = k / 8 * 2 * PI
        b.box(IRON, 0.12, 2.2, 0.12, x=math.cos(a) * 1.9, y=17.9, z=math.sin(a) * 1.9)
    b.cone('#ff5a5a', 2.4, 2.4, 16, y=20.2)
    door(b, 0, 2, 3.1, w=1.3, h=2.2, frame=STONE2, arch=True)
    b.box('#b08a5a', 3, 0.4, 26, x=10, y=1.0, z=-6)
    for z in range(-18, 8, 4):
        b.cyl('#8a6a4a', 0.2, 0.2, 3, 6, x=8.6, y=-0.3, z=z); b.cyl('#8a6a4a', 0.2, 0.2, 3, 6, x=11.4, y=-0.3, z=z)
    return 6.5


def greattree(b):
    b.lathe('#5a4030', [(7, 0), (5.2, 1.5), (4.0, 6), (3.4, 18), (4.2, 26)], 14)
    for k in range(6):
        a = k / 6 * 2 * PI
        b.cap('#5a4030', 0.9, 6, 10, 6, x=math.cos(a) * 5, y=1.2, z=math.sin(a) * 5, rz=math.cos(a) * 1.1, rx=-math.sin(a) * 1.1)
    for y, r, c in ((27, 16, '#2f8f4a'), (31, 14, '#3fa858'), (35, 10, '#56bf62'), (38, 5.5, '#6fd06a')):
        b.lathe(c, [(r * 0.55, y - 2.2), (r, y - 0.6), (r * 0.95, y + 0.6), (r * 0.4, y + 2.2)], 18)
    for y, r in ((8, 7.2), (16, 6.6)):
        b.cyl('#8a6a4a', r, r, 0.4, 18, y=y)
        b.tor(ROPE, r, 0.06, 36, 4, y=y + 1.0, rx=PI / 2)
        for k in range(14):
            a = k / 14 * 2 * PI
            b.cyl('#6a4630', 0.07, 0.07, 1.0, 5, x=math.cos(a) * r, y=y + 0.5, z=math.sin(a) * r)
            if k % 3 == 0:
                b.sph('#ffb040', 0.35, 8, 6, x=math.cos(a) * (r - 0.2), y=y - 0.8, z=math.sin(a) * (r - 0.2))
    b.box('#2a1c14', 2.2, 3.2, 0.5, x=0, y=1.6, z=6.0)
    return 7


def casino(b):
    b.cyl('#f6e4c0', 13, 13.5, 7, 24, y=3.5)
    b.tor('#ff5aa0', 13.2, 0.5, 40, 6, y=7.0, rx=PI / 2)
    b.dome('#e0b03a', 12, 26, 9, y=7)
    for k in range(12):
        a = k / 12 * 2 * PI
        b.box('#ffe08a', 1.0, 1.6, 0.3, x=math.cos(a) * 13.2, y=4.5, z=math.sin(a) * 13.2, ry=-a + PI / 2)
    b.tor('#5af0e0', 8.5, 0.4, 34, 6, y=14.6, rx=PI / 2)
    b.cyl('#e0b03a', 1.0, 1.4, 4, 10, y=19.2)
    b.sph('#ff5aa0', 1.6, 14, 10, y=22.2)
    b.box('#3a1c34', 4.4, 5, 0.6, y=2.5, z=12.9)
    b.box('#e0b03a', 6.4, 1.6, 0.8, bev=0.2, y=6.0, z=13.1)
    for x in (-4.5, 4.5):
        b.cyl(WHITE, 0.7, 0.85, 7.4, 12, x=x, y=3.7, z=13.6)
        b.sph('#ffe08a', 1.0, 12, 8, x=x, y=8.2, z=13.6)
    for k in range(9):
        b.sph(['#ff5aa0', '#5af0e0', '#ffe08a'][k % 3], 0.3, 8, 5, x=(k - 4) * 0.7, y=7.0, z=13.6)
    b.box('#c8443a', 5.0, 0.1, 9.0, y=0.06, z=17.6)
    return 13.5


def crag_hall(b):
    b.box(STONE, 14, 7, 10, bev=0.2, y=3.5)
    gable(b, 14, 10, 7, 5.5, '#4a5a6a', 0.8, 0.45)
    b.cyl(STONE2, 2, 2.6, 20, 12, x=8, y=10)
    b.cone('#4a5a6a', 2.8, 4, 12, x=8, y=22)
    b.sph('#ffb040', 1.4, 12, 8, x=8, y=18)
    door(b, 0, 0, 5.08, w=2.6, h=4.0, frame=STONE2, arch=True)
    for x in (-4.5, 4.5):
        window(b, x, 4.2, 5.08, w=1.2, h=1.8, frame=STONE2)
        b.box('#c8443a', 1.4, 3.6, 0.1, x=x, y=1.9, z=5.12)
    for k in range(10):
        b.box(STONE2, 3.0, 0.5, 1.0, bev=0.05, y=0.25 - k * 0.5, z=5.6 + k * 1.0)
    return 9


def frost_hall(b):
    b.box(STONE2, 16, 1.2, 10, bev=0.2, y=0.6)
    b.box('#8a7a6a', 15, 5, 9, bev=0.15, y=3.6)
    gable(b, 15, 9, 6.1, 4.5, '#6a5a4a', 0.8, 0.45)
    for s in (-1, 1):
        b.box('#f4f0e6', 1.0, 0.3, 10.8, bev=0.12, x=s * 8.2, y=6.3, rz=-s * 0.55)
        b.box('#6a4630', 0.4, 2.2, 0.4, x=s * 0.8, y=11.6, z=4.6, rz=s * 0.6)
    for k in range(5):
        for z in (-4.5, 4.5):
            b.cyl('#6a4630', 0.4, 0.45, 6, 8, x=-6 + k * 3, y=3.6, z=z)
    b.cyl('#5a5a66', 1.6, 2.0, 10, 10, x=-4.5, y=6, z=-2)
    b.cyl('#ff7a2a', 1.3, 1.3, 0.4, 10, x=-4.5, y=11.1, z=-2)
    door(b, 0, 1.2, 4.55, w=3.0, h=3.2, frame='#6a4630', color='#ff8a3a')
    b.box(IRON, 2.4, 1.4, 1.4, bev=0.1, x=5.8, y=1.9, z=6.2)
    b.box(IRON, 0.8, 0.8, 2.2, bev=0.1, x=5.8, y=3.0, z=6.2)
    return 9


def observatory(b):
    b.cyl('#faf6ee', 7, 8, 8, 20, y=4)
    for k in range(12):
        a = k / 12 * 2 * PI
        b.cyl('#faf6ee', 0.4, 0.5, 8.4, 10, x=math.cos(a) * 8.1, y=4.2, z=math.sin(a) * 8.1)
    b.dome('#6a8ad0', 7.2, 24, 8, y=8)
    b.box('#3a4a7a', 2.2, 8, 0.3, y=11.5, z=4.6, rx=-0.65)
    b.cyl(GOLD, 0.7, 1.0, 9, 10, x=2.4, y=13.6, z=1.2, rz=-0.7)
    b.tor(GOLD, 9.6, 0.18, 40, 5, y=10.5, rx=1.2)
    b.tor(GOLD, 9.0, 0.14, 40, 5, y=10.5, rx=1.6, ry=0.8)
    door(b, 0, 0, 7.6, w=2.2, h=3.2, frame=GOLD, arch=True, color='#3a4a7a')
    return 9


def palace(b):
    b.lathe('#ffd0e0', [(10, 0), (9.6, 2), (7.8, 5), (4.4, 7.4), (0, 8)], 26)
    b.lathe('#fff0f6', [(10.2, 2), (9.4, 5.8), (5, 9.6), (0, 10.2)], 26, rx=-0.55, z=-4, sy=0.8)
    for k in range(9):
        b.tor('#ffb0c8', 9.6 - k * 0.6, 0.2, 30, 5, y=2.4 + k * 0.5, z=-4 - k * 0.3, rx=PI / 2 - 0.55)
    b.sph('#fffafa', 2.6, 18, 12, y=3.2, z=2)
    for x, h, c in ((11, 8, '#ff7a8a'), (-11, 6, '#9fe6d6'), (8, 5, '#c0b0ff'), (-8, 7, '#ff9aa4')):
        b.cone(c, 1.1, h, 8, x=x, y=h / 2, z=4)
    b.cyl('#2a3a5a', 2.0, 2.0, 0.3, 16, y=2.2, z=9.2, rx=PI / 2 - 0.3)
    return 10


def crucible(b):
    b.cyl('#4a4450', 18, 18.5, 0.6, 30, y=0.3)
    b.cyl('#ff7a2a', 15, 15, 0.1, 30, y=0.64)
    b.cyl('#3a3644', 13.5, 13.5, 0.2, 30, y=0.7)
    for k in range(12):
        a = k / 12 * 2 * PI
        h = 8 + (k % 3) * 2
        b.cyl('#2e2a36', 1.3, 1.6, h, 8, x=math.cos(a) * 16.5, y=h / 2, z=math.sin(a) * 16.5)
        b.cyl(IRON, 1.6, 1.0, 0.8, 10, x=math.cos(a) * 16.5, y=h + 0.4, z=math.sin(a) * 16.5)
        b.sph('#ff8a3a', 0.9, 10, 6, x=math.cos(a) * 16.5, y=h + 1.2, z=math.sin(a) * 16.5)
    return 0


def keep(b):
    b.box('#dcd6cc', 56, 20, 34, bev=0.4, y=10)
    b.box('#b8b0a6', 58, 2, 36, bev=0.3, y=20.6)
    for x in range(-27, 28, 3):
        for z in (-17.5, 17.5):
            b.box('#b8b0a6', 1.5, 1.6, 1.2, x=x, y=22.2, z=z)
    for x in (-28, 28):
        for z in (-17, 17):
            b.cyl('#d6d0c6', 5, 5.6, 32, 16, x=x, y=16, z=z)
            b.tor('#b8b0a6', 5.3, 0.4, 20, 5, x=x, y=26, z=z, rx=PI / 2)
            b.cone('#3d5fb0', 6.4, 10, 16, x=x, y=37, z=z)
            b.cone(GOLD, 0.2, 2, 6, x=x, y=43, z=z)
            for y in (10, 20):
                window(b, x, y, z + (5.4 if z > 0 else -5.4), w=1.0, h=2.0, frame='#b8b0a6')
    for x in range(-20, 21, 8):
        window(b, x, 13, 17.05, w=1.6, h=3.4, frame='#b8b0a6')
        b.box('#3d5fb0', 2.4, 6, 0.2, x=x, y=6.5, z=17.2)
        b.tor(GOLD, 0.7, 0.12, 14, 4, x=x, y=7.5, z=17.35)
    b.lathe('#8a84a0', [(13, 20), (11.5, 60), (9.5, 110), (8, 160), (8.6, 162)], 14, z=-4)
    for y, r in ((40, 12.6), (80, 10.6), (120, 8.9), (160, 8.3)):
        b.tor('#e0b85a', r, 0.9, 30, 6, y=y, z=-4, rx=PI / 2)
    b.lathe('#3d5fb0', [(9, 162), (5, 172), (0, 182)], 14, z=-4)
    b.box('#1c1a2a', 8, 11, 1, y=5.5, z=17.2)
    b.tor('#7fe6d6', 2.6, 0.3, 26, 6, y=7, z=17.9)
    for k in range(9):
        a = k / 9 * 2 * PI
        b.cyl('#3a3a48', 0.45, 0.45, 0.2, 12, x=math.cos(a) * 1.8, y=7 + math.sin(a) * 1.8, z=17.8, rx=PI / 2)
    for k in range(10):
        b.box('#cfc8be', 16 - k * 0.4, 0.5, 1.2, bev=0.05, y=0.25 - k * 0.5 + 0.0, z=18.2 + k * 1.2)
    return 0


def wall(b):
    b.box('#cfc8be', 2.6, 13, 20, bev=0.15, y=6.5)
    b.box('#b8b0a6', 3.2, 1, 20, bev=0.1, y=13.4)
    for z in range(-9, 10, 2):
        b.box('#b8b0a6', 0.8, 1.4, 1.1, x=1.2, y=14.5, z=z)
        b.box('#b8b0a6', 0.8, 1.4, 1.1, x=-1.2, y=14.5, z=z)
    for k in range(12):
        b.box('#bdb6ac', R.uniform(1, 2), R.uniform(0.6, 1), 0.2, bev=0.05, x=1.35, y=R.uniform(1, 12), z=R.uniform(-9, 9))


def tower(b):
    b.cyl('#d6d0c6', 3.6, 4.0, 18, 14, y=9)
    b.cyl('#b8b0a6', 4.2, 4.2, 1.2, 14, y=18.6)
    for k in range(10):
        a = k / 10 * 2 * PI
        b.box('#b8b0a6', 1.0, 1.4, 0.8, x=math.cos(a) * 3.9, y=19.9, z=math.sin(a) * 3.9, ry=-a)
    b.cone('#3d5fb0', 4.4, 6, 14, y=23.6)
    b.cyl('#c8443a', 0.05, 0.05, 3, 5, y=27.6)
    b.box('#c8443a', 1.6, 0.9, 0.05, x=0.8, y=28.6)
    window(b, 0, 12, 3.75, w=0.6, h=1.4, frame='#b8b0a6')


def gatehouse(b):
    for s in (-1, 1):
        b.box('#d6d0c6', 9, 20, 12, bev=0.2, x=s * 9, y=10)
        b.cone('#3d5fb0', 7.5, 8, 4, x=s * 9, y=24, ry=PI / 4)
    b.box('#cfc8be', 9, 6, 12, bev=0.2, y=17)
    for k in range(6):
        b.box('#b8b0a6', 1.4, 1.4, 1.4, x=-8 + k * 3.2, y=21, z=6)
    b.box('#3d5fb0', 5, 8, 0.3, x=-9, y=12, z=6.2)
    b.box('#3d5fb0', 5, 8, 0.3, x=9, y=12, z=6.2)
    b.tor(GOLD, 2.0, 0.3, 22, 6, x=-9, y=13, z=6.4)
    b.tor(GOLD, 2.0, 0.3, 22, 6, x=9, y=13, z=6.4)
    for k in range(5):
        b.box(IRON, 0.25, 4, 0.25, x=-2 + k, y=12.4, z=5.8)


def arena(b):
    b.cyl('#e6d0a0', 17, 17, 0.4, 32, y=0.2)
    for k in range(20):
        a = k / 20 * 2 * PI
        if k == 15:
            continue
        b.box('#cfc8be', 5.6, 5, 2.4, bev=0.12, x=math.cos(a) * 19.5, y=2.5, z=math.sin(a) * 19.5, ry=-a + PI / 2)
        b.box('#cfc8be', 5.6, 3, 2.4, bev=0.12, x=math.cos(a) * 21.5, y=6.5, z=math.sin(a) * 21.5, ry=-a + PI / 2)
        b.box('#c8443a' if k % 2 else '#3d5fb0', 1.2, 3.2, 0.2, x=math.cos(a) * 18.2, y=5.4, z=math.sin(a) * 18.2, ry=-a + PI / 2)
        b.cyl('#7a5234', 0.08, 0.08, 4, 5, x=math.cos(a) * 22.8, y=10, z=math.sin(a) * 22.8)
        b.box('#c8443a' if k % 2 else '#3d5fb0', 1.4, 0.9, 0.05, x=math.cos(a) * 22.8, y=11.4, z=math.sin(a) * 22.8, ry=-a)


def sunk_clock(b):
    b.tor('#d9b45a', 15, 1.4, 40, 10, y=3, z=-8, rx=-1.2)
    b.cyl('#efe6cc', 14, 14, 0.4, 40, y=3, z=-8, rx=-1.2 + PI / 2)
    for k in range(12):
        a = k / 12 * 2 * PI
        b.box('#5a4030', 0.8, 2.4, 0.4, x=math.cos(a) * 11, y=3 + math.sin(a) * 11 * math.cos(-1.2), z=-8 - math.sin(a) * 11 * math.sin(-1.2) * -1, rz=a + PI / 2, rx=-1.2 + PI / 2)
    b.box('#3a2a24', 1.0, 10, 0.5, x=2, y=5, z=-6, rz=-0.6, rx=0.37)


for nm, f in (('dawnmere', windmill), ('saltcrest', lighthouse), ('canopy', greattree), ('mirage', casino), ('highcrag', crag_hall), ('hearthhold', frost_hall),
              ('aerie', observatory), ('pearlreach', palace), ('emberdeep', crucible), ('keep', keep), ('wall', wall), ('tower', tower), ('gate', gatehouse),
              ('arena', arena), ('sunkclock', sunk_clock)):
    one('L.' + nm, f)

# =====================================================================  STREET FURNITURE
one('F.stall', lambda b: ([b.cyl(WOOD2, 0.08, 0.09, 2.7, 6, x=x, y=1.35, z=z) for x in (-1.4, 1.4) for z in (-0.8, 0.8)],
                          b.box('#9a7a4a', 3.0, 0.9, 1.2, bev=0.05, y=0.45, z=0.5), b.box('#7a5a30', 3.2, 0.12, 1.4, bev=0.03, y=0.95, z=0.5),
                          [b.box('CLOTH' if k % 2 else WHITE, 0.58, 0.1, 2.3, x=-1.45 + k * 0.58, y=2.75, rx=0.16) for k in range(6)],
                          [b.box('CLOTH' if k % 2 else WHITE, 0.58, 0.45, 0.06, x=-1.45 + k * 0.58, y=2.35, z=1.2) for k in range(6)],
                          [b.sph(c, 0.17, 8, 5, x=-1.0 + k * 0.4, y=1.14, z=0.5 + (k % 2) * 0.3) for k, c in enumerate(('#ff5a5a', '#ffd24a', '#7fd05a', '#ff9a3c', '#b48aff', '#ff5a5a'))],
                          b.box('#c8a070', 0.6, 0.5, 0.5, bev=0.04, x=1.9, y=0.25, z=0.8)))
one('F.lamp', lambda b: (b.cyl('#3a3a48', 0.1, 0.14, 3.4, 8, y=1.7), b.cyl('#3a3a48', 0.25, 0.3, 0.3, 10, y=0.15), b.box('#3a3a48', 0.06, 0.06, 0.6, y=3.3, z=0.25),
                         b.lathe('#3a3a48', [(0.25, 3.0), (0.32, 3.1), (0.2, 3.6), (0, 3.75)], 6, z=0.5), b.cyl('#ffe08a', 0.2, 0.15, 0.4, 6, y=2.95, z=0.5)))
one('F.banner', lambda b: (b.cyl(WOOD2, 0.08, 0.1, 6.5, 6, y=3.25), b.sph(GOLD, 0.15, 8, 5, y=6.6), b.cyl(WOOD2, 0.04, 0.04, 1.6, 5, x=0.8, y=6.0, rz=PI / 2),
                           b.box('CLOTH', 1.4, 2.3, 0.05, x=0.8, y=4.7), b.prism('CLOTH', 1.4, 0.5, 0.05, x=0.8, y=3.55, rz=PI), b.tor(GOLD, 0.3, 0.05, 14, 4, x=0.8, y=5.0, z=0.04)))


def fountain(b, s=1.0):
    b.cyl('#b8b4c0', 3.6 * s, 3.8 * s, 0.9, 24, y=0.45)
    b.tor('#d6d2dc', 3.6 * s, 0.2, 30, 5, y=0.92, rx=PI / 2)
    b.cyl('#5fc4e6', 3.4 * s, 3.4 * s, 0.1, 24, y=0.8)
    b.lathe('#b8b4c0', [(0.9 * s, 0.9), (0.5 * s, 1.6), (0.45 * s, 2.6), (1.5 * s, 3.1), (1.4 * s, 3.3)], 16)
    b.cyl('#5fc4e6', 1.3 * s, 1.3 * s, 0.05, 16, y=3.25)
    b.lathe('#b8b4c0', [(0.3 * s, 3.3), (0.2 * s, 4.2), (0.6 * s, 4.6), (0, 4.8)], 12)
    b.tor(GOLD, 1.0 * s, 0.1, 22, 5, y=5.8 * (1 + (s - 1) * 0.3))
    b.sph('#ffe08a', 0.25, 10, 6, x=1.0 * s, y=5.8 * (1 + (s - 1) * 0.3))
    for k in range(6):
        a = k / 6 * 2 * PI
        b.cyl('#9fe6ff', 0.06, 0.12, 1.2, 6, x=math.cos(a) * 0.8 * s, y=3.6, z=math.sin(a) * 0.8 * s, rz=math.cos(a) * 0.8, rx=-math.sin(a) * 0.8)
one('F.fountain', fountain)
one('F.fountain_big', lambda b: fountain(b, 1.8))
one('F.well', lambda b: (b.cyl(STONE, 1.5, 1.7, 1.1, 14, y=0.55), b.cyl('#3a5a7a', 1.2, 1.2, 0.05, 14, y=1.05), [b.box(WOOD2, 0.2, 2.6, 0.2, x=s * 1.5, y=1.6) for s in (-1, 1)],
                         b.prism('ROOF', 3.6, 1.2, 2.4, y=2.8), b.cyl(WOOD2, 0.15, 0.15, 3.0, 8, y=2.4, rz=PI / 2), b.lathe('#8a6a4a', [(0.25, 1.6), (0.3, 2.0)], 8)))
one('F.bench', lambda b: (b.box(WOOD, 2.2, 0.12, 0.6, bev=0.03, y=0.5), b.box(WOOD, 2.2, 0.5, 0.1, bev=0.03, y=0.85, z=-0.28, rx=-0.15), [b.box(IRON, 0.1, 0.5, 0.6, x=x, y=0.25) for x in (-0.9, 0.9)]))
one('F.barrels', lambda b: [b.lathe(WOOD, [(0.38, 0), (0.45, 0.45), (0.38, 0.9)], 12, x=x, y=y, z=z) or b.tor(IRON, 0.43, 0.03, 14, 4, x=x, y=y + 0.25, z=z, rx=PI / 2)
                            for x, y, z in ((0, 0, 0), (0.85, 0, 0.1), (0.42, 0.9, 0.05))])
one('F.cart', lambda b: (b.box(WOOD, 2.4, 0.7, 1.5, bev=0.05, y=1.0), [b.cyl(WOOD2, 0.6, 0.6, 0.12, 12, x=x, y=0.6, z=s * 0.8, rx=PI / 2) for x in (-0.7, 0.7) for s in (-1, 1)],
                         [b.cyl(WOOD2, 0.04, 0.04, 2.2, 5, x=1.9, y=0.9, z=s * 0.5, rz=PI / 2 - 0.2) for s in (-1, 1)], [b.sph(c, 0.3, 8, 5, x=-0.6 + k * 0.5, y=1.5, z=0.2 * (k % 2)) for k, c in enumerate(('#7fd05a', '#ffd24a', '#ff9a3c'))]))
one('F.planter', lambda b: (b.cyl('#b8b4c0', 1.1, 1.0, 0.6, 12, y=0.3), b.lathe(WOOD2, [(0.3, 0.5), (0.22, 2.6)], 8), b.ico('#5fae45', 1.8, 2, y=3.8, sy=0.9), b.ico('#74c254', 1.0, 1, x=1.0, y=3.4, z=0.6)))
one('F.statue', lambda b: (b.box('#b8b4c0', 2.6, 1.8, 2.6, bev=0.1, y=0.9), b.box('#d6d2dc', 3.0, 0.3, 3.0, bev=0.08, y=1.9), b.cyl('#9a9ab0', 0.4, 0.5, 2.4, 10, y=3.2),
                           b.sph('#9a9ab0', 0.45, 12, 8, y=4.8), b.tor('#9a9ab0', 0.8, 0.08, 22, 5, y=4.6, z=-0.3), b.cyl('#9a9ab0', 0.1, 0.1, 1.8, 6, x=0.6, y=4.5, rz=-0.6),
                           b.lathe('#9a9ab0', [(0.75, 2.0), (0.55, 3.4), (0.3, 4.1)], 12)))
one('F.dock', lambda b: (b.box('#b08a5a', 4, 0.3, 14, bev=0.04, y=1.2), [b.cyl('#8a6a4a', 0.2, 0.2, 3.4, 6, x=x, y=-0.3, z=z) for x in (-1.8, 1.8) for z in range(-6, 7, 3)],
                         [b.box('#8a6a4a', 0.12, 0.08, 14, x=x, y=1.4) for x in (-1.6, 0, 1.6)]))

# =====================================================================  SCENERY
def oak(b):
    b.lathe('#7a5234', [(0.75, 0), (0.45, 0.4), (0.36, 2.0), (0.4, 3.2)], 9)
    for s in (-1, 1):
        b.cap('#7a5234', 0.14, 1.4, 6, 4, x=s * 0.6, y=3.5, rz=-s * 0.8)
    for x, y, z, r, c in ((0, 5.0, 0, 2.3, '#5fae45'), (1.6, 4.3, 0.5, 1.6, '#74c254'), (-1.5, 4.4, -0.6, 1.6, '#4f9a3f'), (0.3, 6.3, 0.4, 1.4, '#86cf5e'), (-0.4, 4.6, 1.5, 1.4, '#62b24a'), (0.6, 4.4, -1.5, 1.3, '#5aa842')):
        b.ico(c, r, 2, x=x, y=y, z=z, sy=0.85)
def birch(b):
    b.lathe('#f2ece0', [(0.3, 0), (0.22, 0.4), (0.16, 6.5), (0, 7.2)], 8)
    for k in range(6):
        b.box('#3a3a40', 0.18, 0.05, 0.3, y=0.8 + k * 0.9, ry=k * 1.1, z=0.0)
    for x, y, z, r, c in ((0, 6.0, 0, 1.4, '#a8d05a'), (0.8, 5.2, 0.3, 1.0, '#b8da6a'), (-0.7, 5.0, -0.2, 1.0, '#98c04a'), (0, 7.0, 0, 0.9, '#c0e070')):
        b.ico(c, r, 2, x=x, y=y, z=z, sy=1.2)
def pine(b, snow=False):
    b.lathe('#6a4630', [(0.5, 0), (0.3, 0.4), (0.25, 2.4)], 8)
    for k, (y, r, h) in enumerate(((2.6, 2.4, 2.6), (4.2, 2.0, 2.4), (5.7, 1.6, 2.2), (7.1, 1.1, 2.0))):
        b.lathe('#2f7a48' if k % 2 else '#378a50', [(r, y), (r * 1.05, y + 0.25), (r * 0.25, y + h * 0.75), (0, y + h)], 12)
        if snow:
            b.lathe('#f2f7fc', [(r * 0.75, y + h * 0.25), (r * 0.6, y + h * 0.42), (0.01, y + h + 0.05)], 12)
def palm(b):
    for k in range(7):
        b.cyl('#b08a5a', 0.22 - k * 0.012, 0.26 - k * 0.012, 0.95, 8, x=k * k * 0.012, y=0.5 + k * 0.9, rz=-0.03 * k)
        b.tor('#9a7448', 0.24 - k * 0.012, 0.04, 12, 4, x=k * k * 0.012, y=0.95 + k * 0.9, rx=PI / 2)
    top = (0.6, 6.5)
    for k in range(8):
        a = k / 8 * 2 * PI
        for j in range(4):
            b.ell('#4fae4a' if (k + j) % 2 else '#62c258', 0.24 - j * 0.03, 0.035, 0.62, 8, 4, x=top[0] + math.cos(a) * (0.55 + j * 0.95), y=top[1] + 0.15 - j * j * 0.2, z=math.sin(a) * (0.55 + j * 0.95), ry=-a + PI / 2, rx=0.15 + j * 0.25)
    for k in range(3):
        b.sph('#7a5a30', 0.24, 8, 6, x=top[0] + math.cos(k * 2.1) * 0.3, y=top[1] - 0.25, z=math.sin(k * 2.1) * 0.3)
def jtree(b):
    b.lathe('#5a4030', [(1.3, 0), (0.7, 0.8), (0.55, 8), (0.8, 10)], 10)
    for k in range(4):
        a = k / 4 * 2 * PI + 0.4
        b.cap('#5a4030', 0.2, 1.4, 6, 4, x=math.cos(a) * 0.9, y=0.4, z=math.sin(a) * 0.9, rz=math.cos(a) * 1.0, rx=-math.sin(a) * 1.0)
    for y, r, c in ((10.2, 4.0, '#2f8f4a'), (11.6, 3.4, '#3fa858'), (12.8, 2.2, '#56bf62')):
        b.lathe(c, [(r * 0.5, y - 0.8), (r, y - 0.2), (r * 0.9, y + 0.5), (r * 0.3, y + 1.0)], 14)
    for k in range(5):
        b.cyl('#4f9a4a', 0.05, 0.05, 4 + k % 2, 4, x=math.cos(k * 1.3) * 2.6, y=7.4, z=math.sin(k * 1.3) * 2.6)
        b.ell('#62c258', 0.3, 0.1, 0.18, 6, 4, x=math.cos(k * 1.3) * 2.6, y=5.3 - (k % 2), z=math.sin(k * 1.3) * 2.6)
def fern(b):
    for k in range(7):
        a = k / 7 * 2 * PI
        b.ell('#4fae4a' if k % 2 else '#3f9a4a', 0.25, 0.05, 0.9, 8, 4, x=math.cos(a) * 0.7, y=0.55, z=math.sin(a) * 0.7, ry=-a + PI / 2, rx=-0.5)
def cactus(b):
    b.cap('#4f9a58', 0.45, 2.6, 12, 6, y=1.8)
    for k in range(8):
        b.box('#3f8a48', 0.06, 3.0, 0.06, x=math.cos(k * 0.785) * 0.44, y=1.8, z=math.sin(k * 0.785) * 0.44)
    for s, h in ((1, 2.2), (-1, 2.6)):
        b.cap('#58a862', 0.27, 0.6, 10, 6, x=s * 0.55, y=h - 0.5, rz=s * PI / 2)
        b.cap('#58a862', 0.26, 0.8, 10, 6, x=s * 0.85, y=h, z=0)
    b.sph('#ff7aa8', 0.18, 8, 5, y=3.6)
    b.sph('#ffd24a', 0.12, 8, 5, x=0.85, y=2.8)
def dead(b):
    b.lathe('#5a4a44', [(0.4, 0), (0.22, 0.4), (0.15, 3.6)], 7)
    for x, y, rz, l in ((0.5, 3.0, -0.9, 1.6), (-0.4, 2.6, 1.0, 1.4), (0.2, 3.6, -0.4, 1.0), (-0.6, 3.4, 0.8, 0.8)):
        b.cap('#5a4a44', 0.08, l, 5, 4, x=x, y=y, rz=rz)
def shard(b):
    for x, z, h, r, c in ((0, 0, 3.4, 0.7, '#9ff0e0'), (0.7, 0.2, 2.0, 0.45, '#c8fff4'), (-0.6, -0.1, 1.6, 0.4, '#7fd8c8'), (0.2, -0.6, 1.3, 0.35, '#c8fff4')):
        b.cyl(c, 0, r, h, 6, x=x, y=h / 2, z=z, rz=-x * 0.5, rx=z * 0.5, smooth=False)
def ice(b):
    for x, z, h, r in ((0, 0, 4, 0.8), (0.8, 0.3, 2.2, 0.5), (-0.7, -0.2, 2.8, 0.55)):
        b.cyl('#bfe6ff', 0, r, h, 6, x=x, y=h / 2, z=z, rz=-x * 0.35, smooth=False)
def basalt(b):
    for x, z, h in ((0, 0, 3.4), (1.1, 0.2, 2.2), (-0.9, 0.5, 1.4), (0.3, -1.0, 2.8), (-0.6, -0.8, 1.8)):
        b.cyl('#2e2a36' if h > 2 else '#3a3644', 0.6, 0.65, h, 6, x=x, y=h / 2, z=z, smooth=False)
    b.box('#ff8a3a', 0.4, 0.06, 0.3, x=0.6, y=0.03, z=0.8)
def rock(b):
    b.ico('#8f8e98', 1, 1, y=0.4, sy=0.7, smooth=False)
    b.ico('#a3a2ac', 0.6, 1, x=0.9, y=0.25, z=0.3, sy=0.7, smooth=False)
    b.ico('#7fbb4c', 0.5, 1, x=-0.3, y=0.75, z=0.1, sy=0.3)
def boulder(b):
    b.ico('#8b8a96', 2.4, 2, y=1.2, sy=0.75, sx=1.2, smooth=False)
    b.ico('#9a99a4', 1.4, 1, x=1.8, y=0.6, z=0.8, sy=0.7, smooth=False)
    b.ico('#6fae45', 1.2, 2, y=2.5, z=-0.4, sy=0.35)
def bush(b):
    for x, y, z, r, c in ((0, 0.55, 0, 0.9, '#58a848'), (0.7, 0.4, 0.2, 0.6, '#6cbc54'), (-0.6, 0.45, -0.2, 0.65, '#4f9a3f')):
        b.ico(c, r, 2, x=x, y=y, z=z, sy=0.8)
    for k in range(4):
        b.sph('#ff6a6a', 0.08, 6, 4, x=math.cos(k * 1.6) * 0.75, y=0.7, z=math.sin(k * 1.6) * 0.75)
def tuft(b):
    for k in range(7):
        b.cone('#8fcf5a' if k % 2 else '#74b84a', 0.07, 0.75 + (k % 3) * 0.15, 4, x=math.cos(k * 2.4) * 0.22, y=0.35, z=math.sin(k * 2.4) * 0.22, rz=math.cos(k * 2.4) * 0.3, rx=math.sin(k) * 0.3)
def flower(b):
    for k in range(5):
        x, z = math.cos(k * 1.3) * 0.4, math.sin(k * 1.3) * 0.4
        c = ('#ffd24a', '#ff7aa8', '#ffffff', '#b48aff', '#ff9a3c')[k]
        b.cyl('#5fa84a', 0.025, 0.025, 0.55, 4, x=x, y=0.27, z=z)
        for j in range(5):
            b.ell(c, 0.08, 0.025, 0.05, 6, 4, x=x + math.cos(j * 1.26) * 0.07, y=0.56, z=z + math.sin(j * 1.26) * 0.07, ry=-j * 1.26)
        b.sph('#ffe08a', 0.04, 6, 4, x=x, y=0.58, z=z)
def shroom(b):
    b.lathe('#f2ead8', [(0.5, 0), (0.32, 0.3), (0.28, 2.0), (0.35, 2.3)], 10)
    b.lathe('#e0508a', [(1.6, 2.1), (1.5, 2.4), (1.0, 2.9), (0, 3.1)], 16)
    for k in range(6):
        b.ell('#fff0f6', 0.2, 0.06, 0.2, 8, 4, x=math.cos(k * 1.05) * 0.8, y=2.72, z=math.sin(k * 1.05) * 0.8, rz=-math.cos(k * 1.05) * 0.5, rx=math.sin(k * 1.05) * 0.5)
def coral(b):
    b.cyl('#ff7a8a', 0.18, 0.3, 2, 8, y=1)
    for x, rz, l in ((0.5, -0.7, 1.4), (-0.45, 0.8, 1.2), (0.1, 0.2, 1.0)):
        b.cyl('#ff9aa4', 0.12, 0.18, l, 8, x=x, y=1.6, rz=rz)
        b.sph('#ffc2c8', 0.22, 8, 5, x=x * 2, y=1.6 + l * 0.45)
    b.ico('#ffb0c0', 0.5, 1, x=1.0, y=0.4, z=0.6, sy=0.6)
def kelp(b):
    for k in range(5):
        b.ell('#3f9a6a' if k % 2 else '#58b47a', 0.3, 0.9, 0.05, 8, 5, x=math.sin(k * 1.7) * 0.3, y=0.8 + k * 1.5, rz=math.sin(k * 2.1) * 0.3, ry=k)
        b.sph('#7fd08a', 0.12, 6, 4, x=math.sin(k * 1.7) * 0.3, y=1.5 + k * 1.5)
def reeds(b):
    for k in range(9):
        x, z = math.cos(k * 2.3) * 0.5, math.sin(k * 2.3) * 0.5
        b.cyl('#7a9a4a', 0.025, 0.03, 1.8 + (k % 3) * 0.3, 4, x=x, y=0.95, z=z, rz=x * 0.15)
        if k % 2:
            b.cap('#7a5a30', 0.06, 0.25, 6, 4, x=x, y=1.9 + (k % 3) * 0.3, z=z)
def log(b):
    b.cyl('#7a5234', 0.45, 0.45, 4, 10, y=0.4, rz=PI / 2, ry=0.4)
    b.cyl('#c8a070', 0.4, 0.4, 0.04, 10, x=2.0 * math.cos(0.4), y=0.4, z=-2.0 * math.sin(0.4), rz=PI / 2, ry=0.4)
    b.ico('#6fae45', 0.4, 1, y=0.8, sy=0.4)
def stump(b):
    b.lathe('#7a5234', [(0.9, 0), (0.6, 0.3), (0.55, 0.9)], 10)
    b.cyl('#c8a070', 0.53, 0.53, 0.04, 10, y=0.92)
    b.ell('#e0b05a', 0.3, 0.1, 0.25, 8, 4, x=0.5, y=0.6, z=0.2)
def cliffrock(b):
    for x, z, h, r in ((0, 0, 9, 3.2), (3, 1, 6, 2.4), (-2.6, -0.6, 7, 2.6), (1, -2.6, 5, 2.0)):
        b.cyl('#9a8f88', r * 0.8, r, h, 7, x=x, y=h / 2, z=z, smooth=False)
        b.ico('#7dbb4c', r * 0.85, 1, x=x, y=h, z=z, sy=0.25)
def lavarock(b):
    b.ico('#2e2a36', 1.4, 1, y=0.6, sy=0.6, smooth=False)
    for k in range(3):
        b.box('#ff7a2a', 0.8, 0.05, 0.1, x=math.cos(k * 2) * 0.6, y=0.95, z=math.sin(k * 2) * 0.6, ry=k * 2)

for nm, f in (('oak', oak), ('birch', birch), ('pine', pine), ('spine', lambda b: pine(b, True)), ('palm', palm), ('jtree', jtree), ('fern', fern), ('cactus', cactus),
              ('dead', dead), ('shard', shard), ('ice', ice), ('basalt', basalt), ('rock', rock), ('boulder', boulder), ('bush', bush), ('tuft', tuft), ('flower', flower),
              ('shroom', shroom), ('coral', coral), ('kelp', kelp), ('reeds', reeds), ('log', log), ('stump', stump), ('cliffrock', cliffrock), ('lavarock', lavarock)):
    one('P.' + nm, f)

kit.export(sys.argv[sys.argv.index('--') + 1])
print('MODELS', len([o for o in __import__('bpy').data.objects if o.parent is None]))
