"""Big Money - every model in the game is built here, in Blender.

Run:  blender --background --python bigmoney/blender/build_assets.py
Writes:
  bigmoney/www/assets/casino.glb   the whole building (static)
  bigmoney/www/assets/props.glb    things the game moves: avatar parts, clothes, rifle, rod, fish, targets
  bigmoney/www/assets/layout.json  where things are: walls, seats, machines, fishing spots, target spawns
  bigmoney/blender/bigmoney.blend  the scene, to open and edit in Blender

All coordinates in this file are the game's: x east, y up, z south (metres).
"""
import bpy, bmesh, math, json, os, random, sys
from mathutils import Matrix, Vector
from contextlib import contextmanager

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'www', 'assets'))
os.makedirs(OUT, exist_ok=True)
pi = math.pi
RND = random.Random(7)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # game (y up) -> Blender (z up)
ZY = Matrix.Rotation(-pi / 2, 4, 'X')  # primitives are built along z; stand them up along y

bpy.ops.wm.read_factory_settings(use_empty=True)

# ------------------------------------------------------------------ materials
MATS = {}


def hexrgb(h):
    h = h.lstrip('#')
    v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in v]


def mat(name, hexc, rough=0.7, metal=0.0, emit=None, es=1.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    b.inputs['Base Color'].default_value = (*hexrgb(hexc), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*hexrgb(emit), 1)
        b.inputs['Emission Strength'].default_value = es
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    m.diffuse_color = (*hexrgb(hexc), 1)
    MATS[name] = m


for a in [
    ('carpet', '#7a1626', .95), ('carpet_red', '#b0122a', .9), ('ceiling', '#140a12', .9),
    ('wall', '#571022', .85), ('wall_dark', '#2b0b16', .8), ('wood', '#7a4a28', .6), ('wood_dark', '#3a2214', .55),
    ('gold', '#d9a93a', .28, 1), ('chrome', '#c9ccd2', .2, 1), ('metal_dark', '#2c2f36', .45, .8),
    ('marble', '#e6dfd2', .25), ('marble_black', '#17171c', .15), ('black', '#101014', .5), ('white', '#f1efe9', .5),
    ('leather', '#35201a', .5), ('leather_red', '#8c1524', .45),
    ('felt_green', '#0e6a3a', .95), ('felt_blue', '#1a4c98', .95), ('felt_red', '#8a1a2a', .95), ('felt_purple', '#4b2a86', .95),
    ('neon_gold', '#ffcc55', .4, 0, '#ffc23a', 3.2), ('neon_pink', '#ff4fa3', .4, 0, '#ff2f92', 3.2),
    ('neon_cyan', '#55e6ff', .4, 0, '#2fd8ff', 3.2), ('neon_green', '#6cff8a', .4, 0, '#3dff6a', 3.0),
    ('neon_purple', '#b98cff', .4, 0, '#9a5cff', 3.2), ('neon_red', '#ff5a4a', .4, 0, '#ff3a2a', 3.0),
    ('light_warm', '#fff0d0', .4, 0, '#ffd9a0', 2.6), ('light_white', '#ffffff', .4, 0, '#eaf2ff', 2.4),
    ('bar_glow', '#ffb060', .4, 0, '#ff9a3c', 1.6), ('screen', '#20305a', .3, 0, '#3a6cff', 1.4),
    ('reel', '#fffbe8', .4, 0, '#fff2c0', 1.6),
    ('slot_red', '#b3182c', .35, .3), ('slot_purple', '#5b2aa8', .35, .3), ('slot_blue', '#1d54b8', .35, .3), ('slot_green', '#168a4a', .35, .3),
    ('glass', '#bfe6f2', .05, 0, None, 1, .28), ('water', '#1f86ad', .08, .2, None, 1, .8),
    ('waterfall', '#bfefff', .2, 0, '#9fe6ff', 1.2), ('foam', '#ffffff', .8),
    ('rock', '#636a72', .95), ('rock_dark', '#3f454c', .95), ('pond_floor', '#143a3c', .95), ('sand', '#c9b27a', .95),
    ('plant', '#2f8a3e', .8), ('pine', '#1f5f33', .85), ('reed', '#6c8f3a', .8), ('lily', '#3fa04a', .7), ('flower', '#ff8ac0', .6),
    ('sky', '#0c2244', .9, 0, '#0c2a5a', .7), ('star', '#ffffff', .5, 0, '#ffffff', 3), ('moon', '#fff6d8', .5, 0, '#fff0c0', 2.5),
    ('concrete', '#7c7f84', .9), ('rubber', '#1b1c20', .85), ('yellow', '#f2c21a', .6), ('red', '#c9202a', .5),
    ('blue', '#2255c4', .5), ('green', '#2a9a4a', .5), ('orange', '#e07a1a', .5), ('money', '#3fa85a', .7),
    ('bottle_green', '#2f9a55', .15, 0, '#1c6a38', .5), ('bottle_amber', '#d98a2a', .15, 0, '#a05a10', .5),
    ('bottle_blue', '#3f7ae0', .15, 0, '#2050b0', .5), ('bottle_red', '#d9304a', .15, 0, '#a01028', .5),
    ('bottle_clear', '#e8f4f8', .1, 0, '#a0c0d0', .4), ('awning_red', '#c9202a', .8), ('awning_white', '#f1efe9', .8),
    # avatar: the game recolours every av_* material per player
    ('av_skin', '#e0ac7e', .7), ('av_top', '#222228', .7), ('av_bottom', '#1b1b22', .75), ('av_shoes', '#111114', .5),
    ('av_hair', '#2a1a10', .8), ('av_accent', '#f1efe9', .6), ('av_eye', '#15151a', .3),
    ('cape_red', '#b0122a', .7), ('wing_gold', '#ffe08a', .35, .6, '#ffc23a', .6), ('ice', '#bff4ff', .1, .4, '#7fe8ff', 1.2),
    ('visor', '#55e6ff', .2, 0, '#2fd8ff', 2.5), ('hat_brown', '#7a4a22', .8), ('hat_grey', '#55585f', .8), ('hat_olive', '#5f6b36', .85),
    ('mohawk', '#ff4fa3', .5, 0, '#ff2f92', 1.5),
    ('gun_tan', '#8f8058', .6), ('gun_black', '#17171a', .45, .3), ('gun_metal', '#3c4046', .3, .9), ('lens', '#3050c0', .05, .5, '#2040ff', .6),
    ('cork', '#b98a56', .9), ('rod_blank', '#2a2a30', .35, .2), ('fish_body', '#7fa8c8', .35, .1), ('fish_fin', '#4f7a9a', .45), ('fish_eye', '#ffffff', .3),
    ('tgt_white', '#f4f1ea', .8), ('tgt_red', '#d9202a', .7), ('tgt_gold', '#ffd24a', .4, 0, '#ffb81a', .8),
    ('drink_liquid', '#ffb030', .2, 0, '#ff9a10', .8),
]:
    mat(*a)

# ------------------------------------------------------------------ layout written for the game
L = {'col': [], 'cir': [], 'slots': [], 'bj': [], 'pk': [], 'npcs': [], 'interact': [], 'lights': []}


def col(x1, z1, x2, z2, tall=0):
    L['col'].append([round(min(x1, x2), 2), round(min(z1, z2), 2), round(max(x1, x2), 2), round(max(z1, z2), 2), tall])


def cir(x, z, r, tall=0):
    L['cir'].append([round(x, 2), round(z, 2), r, tall])


def rot2(lx, lz, a):  # same turn the game applies for rotation about y
    return lx * math.cos(a) + lz * math.sin(a), -lx * math.sin(a) + lz * math.cos(a)


# ------------------------------------------------------------------ mesh builder
class B:
    def __init__(s, name):
        s.name = name
        s.bm = bmesh.new()
        s.uv = s.bm.loops.layers.uv.verify()
        s.mats = []
        s.st = [Matrix.Identity(4)]

    def mi(s, name):
        if name not in s.mats:
            s.mats.append(name)
        return s.mats.index(name)

    @contextmanager
    def at(s, x=0, y=0, z=0, ry=0, rx=0, rz=0, sc=1):
        m = s.st[-1] @ Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z')
        if sc != 1:
            m = m @ Matrix.Scale(sc, 4)
        s.st.append(m)
        yield
        s.st.pop()

    def _loc(s, x, y, z, ry=0, rx=0, rz=0, sx=1, sy=1, sz=1):
        return (C @ s.st[-1] @ Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
                @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Diagonal((sx, sy, sz, 1)))

    def _fin(s, verts, m, smooth=False, segs=0):
        i = s.mi(m)
        for f in set(f for v in verts for f in v.link_faces):
            f.material_index = i
            f.smooth = smooth and (segs == 0 or len(f.verts) != segs)

    def box(s, x, y, z, sx, sy, sz, m, ry=0, rx=0, rz=0):
        r = bmesh.ops.create_cube(s.bm, size=1, matrix=s._loc(x, y, z, ry, rx, rz, sx, sy, sz))
        s._fin(r['verts'], m)

    def cyl(s, x, y, z, r, h, m, segs=12, r2=None, ry=0, rx=0, rz=0, sx=1, sz=1, smooth=True):
        r2 = r if r2 is None else max(r2, 0.0005)
        r = max(r, 0.0005)
        res = bmesh.ops.create_cone(s.bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r2, depth=h,
                                    matrix=s._loc(x, y, z, ry, rx, rz, sx, 1, sz) @ ZY)
        s._fin(res['verts'], m, smooth and segs >= 8, segs)

    def sph(s, x, y, z, r, m, sx=1, sy=1, sz=1, u=10, v=7, ry=0, rx=0, rz=0, smooth=True):
        res = bmesh.ops.create_uvsphere(s.bm, u_segments=u, v_segments=v, radius=r, matrix=s._loc(x, y, z, ry, rx, rz, sx, sy, sz) @ ZY)
        s._fin(res['verts'], m, smooth)

    def ring(s, x, y, z, R, r, m, segs=18, tube=6, ry=0, rx=0, rz=0, sx=1, sz=1):
        M = s._loc(x, y, z, ry, rx, rz, sx, 1, sz)
        vs = [[s.bm.verts.new(M @ Vector(((R + r * math.cos(2 * pi * j / tube)) * math.cos(2 * pi * i / segs), r * math.sin(2 * pi * j / tube),
                                          (R + r * math.cos(2 * pi * j / tube)) * math.sin(2 * pi * i / segs)))) for j in range(tube)] for i in range(segs)]
        fs = [s.bm.faces.new((vs[i][j], vs[(i + 1) % segs][j], vs[(i + 1) % segs][(j + 1) % tube], vs[i][(j + 1) % tube]))
              for i in range(segs) for j in range(tube)]
        bmesh.ops.recalc_face_normals(s.bm, faces=fs)
        i = s.mi(m)
        for f in fs:
            f.material_index = i
            f.smooth = True

    def prism(s, pts, y0, y1, m, smooth=False):
        M = s._loc(0, 0, 0)
        bot = [s.bm.verts.new(M @ Vector((px, y0, pz))) for px, pz in pts]
        top = [s.bm.verts.new(M @ Vector((px, y1, pz))) for px, pz in pts]
        n = len(pts)
        caps = [s.bm.faces.new(top), s.bm.faces.new(bot[::-1])]
        sides = [s.bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i])) for i in range(n)]
        bmesh.ops.recalc_face_normals(s.bm, faces=caps + sides)
        i = s.mi(m)
        for f in caps + sides:
            f.material_index = i
            f.smooth = smooth and f in sides

    def plane(s, x1, z1, x2, z2, y, m, uvs=1.0, up=True):
        M = C @ s.st[-1]
        co = [(x1, z1), (x1, z2), (x2, z2), (x2, z1)]
        if not up:
            co = co[::-1]
        f = s.bm.faces.new([s.bm.verts.new(M @ Vector((px, y, pz))) for px, pz in co])
        f.material_index = s.mi(m)
        for l, (px, pz) in zip(f.loops, co):
            l[s.uv].uv = (px * uvs, pz * uvs)

    def text(s, txt, x, y, z, size, m, ry=0, rx=0, depth=0.04):
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = txt
        cu.align_x = 'CENTER'
        cu.align_y = 'CENTER'
        cu.size = size
        cu.extrude = depth / 2
        cu.resolution_u = 2
        ob = bpy.data.objects.new('t', cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.transform(s._loc(x, y, z, ry, rx))
        before = set(s.bm.faces)
        s.bm.from_mesh(me)
        i = s.mi(m)
        for f in s.bm.faces:
            if f not in before:
                f.material_index = i
                f.smooth = False
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        bpy.data.meshes.remove(me)

    def done(s, loc=None):
        me = bpy.data.meshes.new(s.name)
        s.bm.to_mesh(me)
        s.bm.free()
        for n in s.mats:
            me.materials.append(MATS[n])
        ob = bpy.data.objects.new(s.name, me)
        bpy.context.scene.collection.objects.link(ob)
        if loc:
            ob.location = C @ Vector(loc)
        return ob


WORLD, PROPS = [], []


def arc(cx, cz, R, a0, a1, n):
    return [(cx + R * math.sin(a0 + (a1 - a0) * i / (n - 1)), cz + R * math.cos(a0 + (a1 - a0) * i / (n - 1))) for i in range(n)]


# ------------------------------------------------------------------ shared furniture
def stool(b, x, z, seat='leather_red', h=0.7):
    b.cyl(x, 0.02, z, 0.22, 0.04, 'chrome')
    b.cyl(x, h / 2, z, 0.035, h, 'chrome', segs=8)
    b.cyl(x, h, z, 0.2, 0.1, seat)
    b.ring(x, 0.28, z, 0.15, 0.012, 'chrome', segs=12, tube=4)


def chair(b, x, z, rot):
    with b.at(x, 0, z, ry=rot):
        b.box(0, 0.5, 0, 0.5, 0.09, 0.5, 'leather_red')
        b.box(0, 0.88, -0.24, 0.5, 0.66, 0.08, 'leather_red')
        b.box(0, 1.22, -0.24, 0.54, 0.05, 0.1, 'gold')
        for dx in (-.21, .21):
            for dz in (-.21, .21):
                b.box(dx, 0.23, dz, 0.05, 0.46, 0.05, 'gold')


def plant(b, x, z):
    with b.at(x, 0, z):
        b.cyl(0, 0.28, 0, 0.24, 0.56, 'marble_black', r2=0.33)
        b.cyl(0, 0.57, 0, 0.31, 0.03, 'wood_dark')
        b.cyl(0, 1.1, 0, 0.05, 1.1, 'wood', segs=6)
        for i in range(7):
            with b.at(0, 1.65, 0, ry=i * 2 * pi / 7):
                b.sph(0.48, 0.06, 0, 0.5, 'plant', sx=1, sy=0.1, sz=0.3, rz=-0.45, u=6, v=4)
        b.sph(0, 1.75, 0, 0.14, 'plant', u=6, v=4)
    cir(x, z, 0.38)


def chandelier(b, x, z, y=5.3, R=1.0):
    b.cyl(x, (y + 7) / 2, z, 0.025, 7 - y, 'gold', segs=6)
    b.ring(x, y, z, R, 0.05, 'gold')
    b.ring(x, y - 0.45, z, R * 0.55, 0.04, 'gold', segs=12)
    b.sph(x, y - 0.75, z, 0.16, 'light_warm', u=8, v=5)
    for i in range(8):
        a = i * pi / 4
        b.sph(x + math.cos(a) * R, y + 0.12, z + math.sin(a) * R, 0.1, 'light_warm', u=6, v=4)
        b.cyl(x + math.cos(a) * R * 0.5, y - 0.1, z + math.sin(a) * R * 0.5, 0.012, R, 'gold', segs=4, ry=-a, rz=pi / 2 - 0.5)


def pillar(b, x, z):
    b.box(x, 3.5, z, 0.8, 7, 0.8, 'marble')
    b.box(x, 0.3, z, 1.05, 0.6, 1.05, 'gold')
    b.box(x, 6.75, z, 1.05, 0.5, 1.05, 'gold')
    b.box(x, 3.0, z, 0.86, 0.1, 0.86, 'neon_pink')
    b.box(x, 3.4, z, 0.86, 0.05, 0.86, 'neon_gold')
    col(x - .53, z - .53, x + .53, z + .53, 1)


# ================================================================== SHELL
W, D, H = 22, 18, 7
sh = B('shell')
sh.plane(-W, -D, W, D, 0, 'carpet', 0.25)
sh.plane(-W, -D, W, D, H, 'ceiling', 1, up=False)


def wall(b, x1, z1, x2, z2, y0=0, y1=H, m='wall', t=0.5, c=True):
    if x1 == x2:
        b.box(x1, (y0 + y1) / 2, (z1 + z2) / 2, t, y1 - y0, abs(z2 - z1), m)
        if c and y0 <= 0:
            col(x1 - t / 2, z1, x1 + t / 2, z2, 1)
    else:
        b.box((x1 + x2) / 2, (y0 + y1) / 2, z1, abs(x2 - x1), y1 - y0, t, m)
        if c and y0 <= 0:
            col(x1, z1 - t / 2, x2, z1 + t / 2, 1)


wall(sh, -W - .5, D + .25, W + .5, D + .25)
wall(sh, -W - .5, -D - .25, W + .5, -D - .25)
wall(sh, -W - .25, -7, -W - .25, D)
wall(sh, -W - .25, -D, -W - .25, -7, y0=4)      # above the way through to the pond
wall(sh, W + .25, -8, W + .25, D)
wall(sh, W + .25, -D, W + .25, -8, y0=3.2)      # above the range windows


def trim(axis, c, a, b_, sgn, lights=True):
    """Wainscot, gold rail, neon line and wall lights along the inside of a wall."""
    mid, ln = (a + b_) / 2, abs(b_ - a)
    def bx(y, sy, th, m, off=0.0, at=None, l=None):
        p = at if at is not None else mid
        l = ln if l is None else l
        if axis == 'x':
            sh.box(p, y, c + sgn * (th / 2 + off), l, sy, th, m)
        else:
            sh.box(c + sgn * (th / 2 + off), y, p, th, sy, l, m)
    bx(0.55, 1.1, 0.08, 'wood_dark')
    bx(1.13, 0.07, 0.14, 'gold')
    bx(0.08, 0.16, 0.12, 'gold')
    bx(6.45, 0.07, 0.06, 'neon_gold')
    bx(6.75, 0.5, 0.2, 'wall_dark')
    if lights:
        n = int(ln // 4)
        for i in range(n):
            p = a + (i + 0.5) * ln / n
            bx(3.7, 2.6, 0.07, 'light_warm', at=p, l=0.22)
            bx(3.7, 3.0, 0.05, 'gold', at=p, l=0.4)


trim('x', D, -W, W, -1)
trim('x', -D, -W, W, 1, lights=False)
trim('z', -W, -7, D, 1)
trim('z', W, -8, D, -1)

# ceiling light panels and coffers
for x in (-16, -8, 0, 8, 16):
    for z in (-12, -4, 4, 12):
        sh.box(x, 6.96, z, 2.2, 0.06, 2.2, 'light_warm')
        sh.box(x, 6.9, z, 2.6, 0.06, 2.6, 'gold')
for x in (-12, -4, 4, 12):
    sh.box(x, 6.85, 0, 0.3, 0.3, 36, 'wall_dark')
for p in [(-6.5, -9.5), (6.5, -9.5), (-6.5, 12), (6.5, 12), (-17.5, 1.8), (17.5, 1.8)]:
    pillar(sh, *p)
for p in [(-11, -2), (-11, 6), (11, -2), (11, 6), (0, -8)]:
    chandelier(sh, *p)
for p in [(-5.4, 12), (5.4, 12), (-21, 9), (21, 10.6), (-12.2, -8.6), (11.2, -9.2), (21, -6.6), (-21, -5.6), (-7.8, 17), (7.8, 17)]:
    plant(sh, *p)

# entrance: doors, red carpet, velvet ropes
sh.plane(-1.6, 9.5, 1.6, D, 0.02, 'carpet_red')
for sx in (-1, 1):
    sh.box(sx * 1.6, 0.025, (9.5 + D) / 2, 0.08, 0.03, D - 9.5, 'gold')
    sh.box(sx * 0.95, 1.7, D - 0.06, 1.8, 3.4, 0.12, 'wood_dark')
    sh.box(sx * 0.95, 2.0, D - 0.14, 1.2, 2.0, 0.04, 'glass')
    sh.cyl(sx * 0.18, 1.5, D - 0.2, 0.03, 0.9, 'gold', segs=6)
    sh.box(sx * 2.0, 1.9, D - 0.1, 0.3, 3.8, 0.3, 'gold')
    for z in (10.2, 12.6, 15, 17.2):
        sh.cyl(sx * 1.9, 0.5, z, 0.05, 1.0, 'gold', segs=8)
        sh.cyl(sx * 1.9, 0.02, z, 0.18, 0.04, 'gold')
        sh.sph(sx * 1.9, 1.03, z, 0.08, 'gold', u=6, v=4)
    for z in (11.4, 13.8, 16.1):
        sh.box(sx * 1.9, 0.82, z, 0.05, 0.05, 2.3, 'leather_red')
    col(sx * 1.9 - .1, 10.1, sx * 1.9 + .1, 17.3)
sh.box(0, 3.9, D - 0.1, 4.3, 0.3, 0.3, 'gold')
sh.text('WELCOME', 0, 4.5, D - 0.06, 0.6, 'neon_gold', ry=pi)

# the big sign over the slots, both faces
sh.box(0, 5.3, 4.25, 9.6, 2.0, 0.24, 'wall_dark')
for sz, ry in ((1, 0), (-1, pi)):
    sh.text('BIG MONEY', 0, 5.3, 4.25 + sz * 0.14, 1.5, 'neon_gold', ry=ry, depth=0.08)
    sh.box(0, 6.22, 4.25 + sz * 0.13, 9.3, 0.07, 0.05, 'neon_pink')
    sh.box(0, 4.38, 4.25 + sz * 0.13, 9.3, 0.07, 0.05, 'neon_pink')
for sx in (-4.4, 4.4):
    sh.cyl(sx, 6.65, 4.25, 0.03, 0.7, 'gold', segs=6)
# zone signs
sh.text('BAR', 0, 5.6, -D + 0.5, 1.3, 'neon_pink', depth=0.08)
sh.text('FISHING', -W + 0.08, 5.4, -12.5, 0.9, 'neon_cyan', ry=pi / 2, depth=0.08)
sh.text('QUICKSCOPE RANGE', W - 0.08, 4.9, -13, 0.75, 'neon_green', ry=-pi / 2, depth=0.08)
sh.text('STYLE', -17.5, 5.2, D - 0.08, 1.1, 'neon_purple', ry=pi, depth=0.08)
sh.text('CASHIER', 18.5, 5.2, D - 0.08, 0.9, 'neon_gold', ry=pi, depth=0.08)
for x, txt, ry, m in ((-11, 'BLACKJACK', pi / 2, 'neon_green'), (11, 'POKER', -pi / 2, 'neon_cyan')):
    sh.box(x, 4.3, 2, 0.16, 0.9, 4.4, 'wall_dark')
    sh.text(txt, x + (0.1 if ry > 0 else -0.1), 4.3, 2, 0.6, m, ry=ry)
    sh.text(txt, x - (0.1 if ry > 0 else -0.1), 4.3, 2, 0.6, m, ry=-ry)
    for dz in (-2, 2):
        sh.cyl(x, 5.85, 2 + dz, 0.02, 2.3, 'gold', segs=5)
# framed art down the long walls
for i, z in enumerate((-4.5, -0.5, 4, 8)):
    for sx in (-1, 1):
        if sx < 0 and z > 7:
            continue
        sh.box(sx * (W - 0.1), 3.9, z + (2 if i % 2 else -0.2) * 0, 0.08, 1.5, 1.1, 'gold')
        sh.box(sx * (W - 0.15), 3.9, z, 0.06, 1.3, 0.9, ['neon_purple', 'neon_cyan', 'neon_pink', 'neon_green'][(i + (sx > 0)) % 4])
# prize pedestal for the spinning dollar
sh.cyl(0, 0.2, -6.2, 1.1, 0.4, 'marble_black', segs=20)
sh.cyl(0, 0.45, -6.2, 0.9, 0.1, 'gold', segs=20)
sh.ring(0, 0.42, -6.2, 1.1, 0.04, 'neon_gold', segs=24, tube=4)
cir(0, -6.2, 1.15)
L['dollar'] = [0, 1.75, -6.2]
WORLD.append(sh.done())

# ================================================================== SLOTS
sl = B('slots')
SLOT_COLS = ['slot_red', 'slot_purple', 'slot_blue', 'slot_green']
SLOT_NEON = ['neon_gold', 'neon_pink', 'neon_cyan', 'neon_green']


def slot_machine(b, x, z, rot, k):
    body, neon = SLOT_COLS[k % 4], SLOT_NEON[k % 4]
    with b.at(x, 0, z, ry=rot):
        b.box(0, 0.4, 0, 0.86, 0.8, 0.7, 'black')
        b.box(0, 0.86, 0.14, 0.86, 0.1, 0.5, body, rx=0.3)
        b.box(0, 1.38, -0.08, 0.86, 1.0, 0.5, body)
        b.box(0, 1.36, 0.18, 0.7, 0.62, 0.03, 'screen')
        for dx in (-.21, 0, .21):
            b.box(dx, 1.38, 0.2, 0.18, 0.36, 0.02, 'reel')
        b.box(0, 1.38, 0.215, 0.7, 0.02, 0.01, 'neon_red')
        b.box(0, 2.06, -0.08, 0.92, 0.4, 0.4, 'black')
        b.box(0, 2.06, 0.13, 0.8, 0.3, 0.02, neon)
        b.text('777', 0, 2.06, 0.15, 0.24, 'black', depth=0.02)
        b.cyl(0, 2.3, -0.08, 0.16, 0.1, neon, segs=10)
        for dx, m in ((-.25, 'neon_green'), (-.08, 'neon_gold'), (.09, 'neon_cyan')):
            b.cyl(dx, 0.93, 0.2, 0.05, 0.03, m, segs=8, rx=0.3)
        b.box(0.28, 0.93, 0.2, 0.14, 0.035, 0.09, 'neon_red', rx=0.3)
        b.box(0, 0.3, 0.37, 0.5, 0.12, 0.08, 'gold')
        for sx in (-.43, .43):
            b.box(sx, 1.1, 0.19, 0.03, 1.6, 0.03, neon)
        b.cyl(0.5, 1.2, 0.0, 0.025, 0.7, 'chrome', segs=6, rx=-0.25)
        b.sph(0.5, 1.56, -0.09, 0.07, 'red', u=8, v=5)
        b.box(0.46, 0.9, 0.0, 0.08, 0.12, 0.12, 'chrome')


k = 0
for z0 in (1.5, 7.0):
    sl.box(0, 0.04, z0, 6.9, 0.08, 2.1, 'wall_dark')
    sl.box(0, 0.09, z0, 6.7, 0.02, 1.9, 'gold')
    for sgn, rot in ((1, 0), (-1, pi)):
        for x in (-2.6, -1.3, 0, 1.3, 2.6):
            z = z0 + sgn * 0.42
            slot_machine(sl, x, z, rot, k)
            L['slots'].append({'x': x, 'z': round(z, 2), 'rot': rot, 'k': k % 4})
            L['interact'].append({'t': 'slot', 'i': k, 'x': x, 'z': round(z + sgn * 1.0, 2), 'r': 0.95})
            k += 1
    col(-3.15, z0 - 0.85, 3.15, z0 + 0.85)
WORLD.append(sl.done())

# ================================================================== TABLES
tb = B('tables')


def bj_table(b, tid, x, z, rot, felt, mn, mx):
    seats = []
    with b.at(x, 0, z, ry=rot):
        b.prism(arc(0, 0, 1.7, -pi / 2, pi / 2, 15) + [(1.7, -0.6), (-1.7, -0.6)], 0.82, 0.95, 'leather')
        b.prism(arc(0, 0, 1.5, -pi / 2, pi / 2, 15) + [(1.5, -0.48), (-1.5, -0.48)], 0.86, 0.965, felt)
        b.box(0, 0.41, 0.25, 1.7, 0.82, 0.55, 'wood_dark')
        b.box(0, 0.05, 0.25, 2.0, 0.1, 0.8, 'gold')
        b.box(0, 0.98, -0.25, 0.7, 0.03, 0.2, 'black')
        for i, m in enumerate(('red', 'green', 'blue', 'white', 'black', 'gold')):
            b.cyl(-0.27 + i * 0.108, 1.01, -0.25, 0.045, 0.05, m, segs=8)
        b.box(1.0, 1.02, -0.2, 0.22, 0.12, 0.3, 'black', ry=0.3)
        b.box(-1.05, 0.99, -0.2, 0.2, 0.05, 0.28, 'red')
        b.text('BLACKJACK PAYS 3 TO 2', 0, 0.968, 0.42, 0.11, 'gold', rx=-pi / 2, depth=0.006)
        for a in (-64, -32, 0, 32, 64):
            a = math.radians(a)
            b.ring(math.sin(a) * 1.12, 0.967, math.cos(a) * 1.12, 0.13, 0.008, 'gold', segs=12, tube=4)
            lx, lz = math.sin(a) * 2.08, math.cos(a) * 2.08
            stool(b, lx, lz)
            wx, wz = rot2(lx, lz, rot)
            seats.append({'x': round(x + wx, 2), 'z': round(z + wz, 2), 'rot': round(math.atan2(-wx, -wz), 3)})
    dx, dz = rot2(0, -1.15, rot)
    L['bj'].append({'id': tid, 'x': x, 'z': z, 'rot': rot, 'min': mn, 'max': mx, 'seatH': 0.75, 'seats': seats})
    L['npcs'].append({'x': round(x + dx, 2), 'z': round(z + dz, 2), 'rot': rot, 'look': 'dealer', 'name': 'Dealer'})
    L['interact'].append({'t': 'bj', 'id': tid, 'x': x, 'z': z, 'r': 3.5})
    cir(x, z, 2.3)


def pk_table(b, tid, x, z, felt, sb, bb, mn, mx):
    a = 0.9
    def stad(R):
        return arc(a, 0, R, 0, pi, 9) + arc(-a, 0, R, pi, 2 * pi, 9)
    seats = []
    with b.at(x, 0, z):
        b.prism(stad(1.08), 0.7, 0.82, 'leather')
        b.prism(stad(0.9), 0.74, 0.835, felt)
        for sx in (-.85, .85):
            b.cyl(sx, 0.36, 0, 0.22, 0.72, 'wood_dark')
            b.cyl(sx, 0.04, 0, 0.5, 0.08, 'gold', segs=14)
        b.text('BIG MONEY', 0, 0.838, 0.48, 0.16, 'gold', rx=-pi / 2, depth=0.006)
        b.box(0, 0.85, -0.62, 0.5, 0.03, 0.16, 'black')
        for i, m in enumerate(('red', 'green', 'blue', 'white')):
            b.cyl(-0.17 + i * 0.113, 0.875, -0.62, 0.045, 0.04, m, segs=8)
        for lx, lz in ((2.42, 0), (0.8, 1.55), (-0.8, 1.55), (-2.42, 0), (-0.8, -1.55), (0.8, -1.55)):
            r = math.atan2(-lx if abs(lz) < .1 else 0, -lz if abs(lz) > .1 else 0)
            chair(b, lx, lz, r)
            seats.append({'x': round(x + lx, 2), 'z': round(z + lz, 2), 'rot': round(r, 3)})
    L['pk'].append({'id': tid, 'x': x, 'z': z, 'rot': 0, 'sb': sb, 'bb': bb, 'min': mn, 'max': mx, 'seatH': 0.56, 'seats': seats})
    L['interact'].append({'t': 'pk', 'id': tid, 'x': x, 'z': z, 'r': 3.9})
    col(x - 2.75, z - 1.9, x + 2.75, z + 1.9)


bj_table(tb, 'bj1', -11, -2, pi / 2, 'felt_green', 10, 500)
bj_table(tb, 'bj2', -11, 6, pi / 2, 'felt_red', 100, 5000)
pk_table(tb, 'pk1', 11, -2, 'felt_blue', 5, 10, 200, 2000)
pk_table(tb, 'pk2', 11, 6, 'felt_purple', 50, 100, 2000, 20000)
WORLD.append(tb.done())

# ================================================================== BAR
br = B('bar')
br.box(0, 2.4, -D + 0.2, 15, 4.8, 0.3, 'wood_dark')
br.box(0, 2.3, -D + 0.38, 13.4, 2.5, 0.05, 'bar_glow')
BOT = ['bottle_green', 'bottle_amber', 'bottle_blue', 'bottle_red', 'bottle_clear']
for sy in (1.35, 2.1, 2.85):
    br.box(0, sy, -D + 0.6, 13.4, 0.05, 0.36, 'gold')
    x = -6.4
    while x < 6.45:
        m = RND.choice(BOT)
        hgt = RND.uniform(0.22, 0.32)
        br.cyl(x, sy + 0.025 + hgt / 2, -D + 0.6, 0.055, hgt, m, segs=7)
        br.cyl(x, sy + 0.025 + hgt + 0.05, -D + 0.6, 0.02, 0.1, m, segs=5)
        x += RND.uniform(0.3, 0.42)
for sx in (-7.2, 7.2):
    br.box(sx, 2.4, -D + 0.45, 0.4, 4.8, 0.5, 'gold')
br.box(0, 4.9, -D + 0.45, 14.8, 0.3, 0.5, 'gold')
# counter
br.box(0, 0.55, -14.4, 13, 1.1, 0.8, 'wood_dark')
br.box(0, 1.14, -14.4, 13.4, 0.08, 1.1, 'marble_black')
br.box(0, 1.0, -13.97, 13, 0.05, 0.04, 'neon_pink')
br.box(0, 0.3, -13.98, 13, 0.5, 0.03, 'gold')
br.cyl(0, 0.2, -13.82, 0.03, 13, 'gold', segs=6, rz=pi / 2)
for sx in (-1, 1):
    br.box(sx * 6.55, 0.55, -15.95, 0.8, 1.1, 2.9, 'wood_dark')
    br.box(sx * 6.55, 1.14, -15.95, 1.0, 0.08, 3.1, 'marble_black')
col(-7.05, -17.75, 7.05, -13.9)
for i in range(8):
    x = -5.25 + i * 1.5
    stool(br, x, -13.25, 'leather_red', 0.78)
    cir(x, -13.25, 0.24)
for x in (-3, 0.6, 3.6):
    br.cyl(x, 1.36, -14.55, 0.03, 0.36, 'chrome', segs=6)
    br.box(x, 1.56, -14.45, 0.05, 0.05, 0.25, 'chrome')
    br.box(x, 1.66, -14.36, 0.04, 0.16, 0.04, 'black')
for x, m in ((-4.4, 'bottle_amber'), (-1.7, 'bottle_red'), (1.9, 'bottle_blue'), (4.9, 'bottle_green')):
    br.cyl(x, 1.25, -14.2, 0.04, 0.14, 'glass', segs=7, r2=0.05)
    br.cyl(x, 1.23, -14.2, 0.033, 0.08, m, segs=7)
br.box(5.6, 1.33, -14.55, 0.4, 0.3, 0.35, 'metal_dark')
br.box(5.6, 1.5, -14.5, 0.3, 0.12, 0.05, 'screen')
for x in (-5, -2.5, 0, 2.5, 5):
    br.cyl(x, 5.3, -14.3, 0.012, 3.4, 'black', segs=4)
    br.cyl(x, 3.5, -14.3, 0.08, 0.3, 'gold', r2=0.26, segs=10)
    br.sph(x, 3.36, -14.3, 0.1, 'light_warm', u=6, v=4)
L['npcs'].append({'x': 0, 'z': -15.7, 'rot': 0, 'look': 'bartender', 'name': 'Bartender'})
for x in (-4, 0, 4):
    L['interact'].append({'t': 'bar', 'x': x, 'z': -12.9, 'r': 2.3})
WORLD.append(br.done())

# ================================================================== STYLE SHOP
sp = B('shop')
sp.plane(-21.9, 10, -13, 17.9, 0.02, 'marble')
sp.box(-13, 0.03, 14, 0.1, 0.04, 8, 'gold')
sp.box(-17.5, 0.03, 10, 9, 0.04, 0.1, 'gold')
sp.box(-17.5, 0.5, 12.2, 3.2, 1.0, 0.8, 'white')
sp.box(-17.5, 1.03, 12.2, 3.4, 0.06, 1.0, 'gold')
sp.box(-18.5, 1.2, 12.2, 0.35, 0.28, 0.3, 'metal_dark')
sp.box(-16.6, 1.12, 12.2, 0.5, 0.12, 0.4, 'neon_purple')
col(-19.2, 11.75, -15.8, 12.65)
# shelves of hats on the back wall
for sy in (1.2, 2.1, 3.0):
    sp.box(-17.5, sy, 17.72, 7.5, 0.06, 0.45, 'gold')
    for i in range(9):
        x = -20.9 + i * 0.85
        m = RND.choice(['black', 'hat_brown', 'red', 'hat_grey', 'white', 'blue', 'neon_purple'])
        sp.cyl(x, sy + 0.05, 17.7, 0.2, 0.03, m, segs=10)
        sp.cyl(x, sy + 0.16, 17.7, 0.12, 0.2, m, segs=10)
sp.box(-17.5, 2.1, 17.9, 7.9, 3.0, 0.1, 'wall_dark')


def rack(b, x, z, rot):
    with b.at(x, 0, z, ry=rot):
        for sx in (-1.1, 1.1):
            b.cyl(sx, 0.85, 0, 0.03, 1.7, 'chrome', segs=6)
            b.box(sx, 0.03, 0, 0.08, 0.06, 0.6, 'chrome')
        b.cyl(0, 1.68, 0, 0.025, 2.2, 'chrome', segs=6, rz=pi / 2)
        for i in range(8):
            m = ['red', 'blue', 'gold', 'white', 'neon_purple', 'black', 'green', 'orange'][i]
            b.box(-0.92 + i * 0.26, 1.22, 0, 0.07, 0.8, 0.48, m)
            b.box(-0.92 + i * 0.26, 1.66, 0, 0.02, 0.08, 0.3, 'chrome')
    ex = (1.2, 0.35) if abs(math.sin(rot)) < .5 else (0.35, 1.2)
    col(x - ex[0], z - ex[1], x + ex[0], z + ex[1])


rack(sp, -21.2, 14.4, pi / 2)
rack(sp, -14.0, 14.6, pi / 2)
L['shop'] = {'mannequins': []}
for x, z, r in ((-20.7, 10.9, 0.5), (-15.2, 16.4, pi), (-19.6, 16.4, pi)):
    sp.cyl(x, 0.12, z, 0.6, 0.24, 'gold', segs=16)
    sp.ring(x, 0.25, z, 0.6, 0.03, 'neon_purple', segs=18, tube=4)
    cir(x, z, 0.66)
    L['shop']['mannequins'].append({'x': x, 'z': z, 'rot': r})
sp.box(-21.8, 2.0, 12.4, 0.06, 2.6, 1.3, 'chrome')
sp.box(-21.85, 2.0, 12.4, 0.06, 2.8, 1.5, 'gold')
L['npcs'].append({'x': -17.5, 'z': 13.2, 'rot': pi, 'look': 'stylist', 'name': 'Stylist'})
L['interact'].append({'t': 'shop', 'x': -17.5, 'z': 11.2, 'r': 2.2})
WORLD.append(sp.done())

# ================================================================== CASHIER
cs = B('cashier')
cs.box(17.5, 0.55, 15.25, 0.4, 1.1, 5.5, 'wood_dark')
cs.box(17.5, 1.14, 15.25, 0.7, 0.08, 5.6, 'marble')
cs.box(19.75, 0.55, 12.5, 4.5, 1.1, 0.4, 'wood_dark')
cs.box(19.75, 1.14, 12.5, 4.6, 0.08, 0.5, 'marble')
z = 12.6
while z < 17.9:
    if not 14.7 < z < 15.8:
        cs.cyl(17.5, 1.95, z, 0.025, 1.55, 'gold', segs=5)
    z += 0.22
x = 17.7
while x < 21.9:
    cs.cyl(x, 1.95, 12.5, 0.025, 1.55, 'gold', segs=5)
    x += 0.22
cs.box(17.5, 2.8, 15.25, 0.3, 0.3, 5.6, 'gold')
cs.box(19.75, 2.8, 12.5, 4.6, 0.3, 0.3, 'gold')
cs.text('CASHIER', 17.32, 2.8, 15.25, 0.22, 'neon_gold', ry=-pi / 2, depth=0.03)
cs.box(21.1, 1.0, 16.6, 1.3, 2.0, 1.3, 'metal_dark')
cs.cyl(20.43, 1.1, 16.6, 0.3, 0.06, 'gold', rz=pi / 2)
cs.ring(20.4, 1.1, 16.6, 0.22, 0.025, 'chrome', rz=pi / 2, segs=12, tube=4)
for i in range(5):
    for j in range(3 - i // 2):
        cs.box(19.2 + i * 0.36, 0.06 + j * 0.11, 17.3, 0.3, 0.1, 0.16, 'gold')
for i in range(6):
    cs.box(20.0 + (i % 3) * 0.3, 0.06 + (i // 3) * 0.1, 13.2, 0.26, 0.09, 0.14, 'money')
col(17.2, 12.25, 22, 18)
L['npcs'].append({'x': 18.7, 'z': 15.25, 'rot': -pi / 2, 'look': 'cashier', 'name': 'Cashier'})
L['interact'].append({'t': 'cashier', 'x': 16.5, 'z': 15.25, 'r': 1.9})
WORLD.append(cs.done())

# ================================================================== QUICKSCOPE RANGE
rg = B('range')
rg.plane(12.5, -17.9, 21.5, -8.2, 0.02, 'rubber')
for z in (-8.25, -17.85):
    rg.box(17, 0.03, z, 9, 0.03, 0.12, 'yellow')
rg.box(12.5, 0.03, -13, 0.12, 0.03, 9.7, 'yellow')
rg.box(17.8, 0.55, -8.0, 8.4, 1.1, 0.3, 'concrete')
rg.box(17.8, 1.85, -8.0, 8.4, 1.5, 0.06, 'glass')
rg.box(17.8, 2.63, -8.0, 8.4, 0.08, 0.2, 'metal_dark')
col(13.6, -8.17, 22, -7.83)
rg.box(21.95, 0.52, -13, 0.9, 1.04, 10, 'metal_dark')
rg.box(21.95, 1.06, -13, 1.0, 0.05, 10, 'rubber')
col(21.45, -18, 22.5, -8)
BZ = [-16.4, -13.0, -9.6]
for z in (-18.0, -14.7, -11.3, -8.0):
    rg.box(21.0, 1.3, z, 2.0, 2.6, 0.1, 'metal_dark')
    rg.box(20.0, 1.3, z, 0.06, 2.6, 0.14, 'yellow')
    col(20.0, z - 0.07, 22, z + 0.07)
for i, z in enumerate(BZ):
    rg.text(str(i + 1), 21.95, 3.0, z, 0.35, 'neon_green', ry=-pi / 2)
    L['interact'].append({'t': 'range', 'i': i, 'x': 20.6, 'z': z, 'r': 1.5})
# rifle rack and bench on the north wall
rg.box(16.5, 1.9, -17.85, 4.2, 1.6, 0.1, 'wood')
for i in range(3):
    y = 1.4 + i * 0.5
    rg.box(16.5, y, -17.74, 1.3, 0.07, 0.05, 'gun_tan')
    rg.cyl(15.55, y + 0.01, -17.74, 0.014, 0.7, 'gun_metal', segs=5, rz=pi / 2)
    rg.cyl(16.5, y + 0.09, -17.74, 0.03, 0.34, 'gun_black', segs=6, rz=pi / 2)
    rg.box(17.3, y - 0.02, -17.74, 0.3, 0.13, 0.04, 'gun_black')
rg.box(14.2, 0.45, -17.4, 1.6, 0.9, 0.7, 'metal_dark')
for i in range(4):
    rg.box(13.7 + i * 0.32, 0.98, -17.4, 0.24, 0.14, 0.34, ['green', 'gun_tan', 'green', 'red'][i])
# the annex the bullets fly down
RX1, RX2, RZ1, RZ2, RH = 22.5, 60, -18, -8, 5
rg.plane(RX1, RZ1, RX2, RZ2, 0, 'concrete', 0.5)
rg.plane(RX1, RZ1, RX2, RZ2, RH, 'ceiling', 1, up=False)
wall(rg, RX1, RZ1 - .25, RX2 + .5, RZ1 - .25, y1=RH, m='concrete')
wall(rg, RX1, RZ2 + .25, RX2 + .5, RZ2 + .25, y1=RH, m='concrete')
wall(rg, RX2 + .25, RZ1, RX2 + .25, RZ2, y1=RH, m='concrete')
rg.box(58.6, 1.0, -13, 2.2, 2.6, 10, 'sand', rz=0.5)
for x in (27, 35, 43, 51, 58):
    rg.box(x, RH - 0.05, -13, 0.3, 0.06, 8, 'light_white')
for x in (31, 41, 51):
    rg.box(x, RH - 0.5, -13, 0.15, 0.9, 10, 'metal_dark')
for x, t in ((32, '10M'), (42, '20M'), (52, '30M')):
    rg.text(t, x, 3.4, RZ1 + 0.02, 0.6, 'yellow')
    rg.box(x, 0.01, -13, 0.12, 0.02, 10, 'yellow')
for z in (-14.7, -11.3):
    rg.box(41, 0.01, z, 37, 0.02, 0.08, 'white')
SP = []


def crate(x, y, z, s=1.0, ry=0):
    rg.box(x, y + s / 2, z, s, s, s, 'wood', ry=ry)
    rg.box(x, y + s / 2, z, s * 1.02, s * 0.12, s * 1.02, 'wood_dark', ry=ry)


def barrel(x, z, m='red'):
    rg.cyl(x, 0.5, z, 0.32, 1.0, m, segs=10)
    for y in (0.25, 0.75):
        rg.cyl(x, y, z, 0.335, 0.05, 'metal_dark', segs=10)


crate(30, 0, -10.6); crate(30, 0, -9.5, 1.0, 0.2); crate(30, 1, -10.1, 0.8, 0.4)
SP += [[30.6, 2.3, -10.1], [30.6, 1.3, -11.7]]
barrel(32, -15.6); barrel(32.7, -15.9, 'blue'); barrel(32.3, -16.4, 'yellow')
SP += [[32.8, 1.6, -15.9], [33.2, 1.1, -14.4]]
for zz, w in ((-14.2, 1.0), (-11.8, 1.0)):   # plywood wall with a window
    rg.box(36, 1.1, zz, 0.1, 2.2, w, 'wood')
rg.box(36, 0.45, -13, 0.1, 0.9, 1.4, 'wood')
rg.box(36, 2.0, -13, 0.1, 0.4, 1.4, 'wood')
SP += [[36.6, 1.4, -13], [36.6, 1.3, -10.6], [36.6, 1.3, -15.4]]
for i in range(5):
    for j in range(3 - (i % 2)):
        rg.sph(40, 0.16 + j * 0.28, -10.6 + i * 0.5 + (j % 2) * 0.2, 0.3, 'sand', sx=0.7, sy=0.5, sz=1, u=6, v=4)
SP += [[40.5, 1.35, -9.6], [39.5, 1.0, -16.2]]
# pickup truck
rg.box(44.5, 0.75, -15.2, 1.9, 0.7, 4.4, 'blue')
rg.box(44.5, 1.5, -14.5, 1.8, 0.8, 1.7, 'blue')
rg.box(44.5, 1.55, -14.5, 1.84, 0.5, 1.4, 'glass')
for sx in (-.95, .95):
    for zz in (-16.6, -13.8):
        rg.cyl(44.5 + sx, 0.4, zz, 0.4, 0.3, 'rubber', rz=pi / 2, segs=10)
SP += [[45.0, 2.5, -14.5], [45.2, 1.3, -11.9], [43.2, 1.6, -16.6]]
# watch tower
for sx in (-.9, .9):
    for sz in (-.9, .9):
        rg.box(50 + sx, 1.1, -10.4 + sz, 0.14, 2.2, 0.14, 'wood_dark')
rg.box(50, 2.25, -10.4, 2.2, 0.12, 2.2, 'wood')
for sz in (-1.05, 1.05):
    rg.box(50, 2.8, -10.4 + sz, 2.2, 0.08, 0.08, 'wood_dark')
rg.box(51.05, 2.8, -10.4, 0.08, 0.08, 2.2, 'wood_dark')
SP += [[50.3, 3.3, -10.4], [50.3, 1.1, -10.4]]
crate(48, 0, -16.2, 1.2); crate(48.1, 1.2, -16.3, 0.9, 0.3)
SP += [[48.7, 2.7, -16.3], [48.6, 1.2, -14.6]]
barrel(54, -12.2, 'yellow'); barrel(54.6, -11.6)
SP += [[54.6, 1.6, -12.0], [55.5, 1.4, -15.5], [56, 2.6, -13.4], [56, 1.3, -9.6], [53, 1.2, -17.0], [46.5, 1.1, -9.3], [34, 1.1, -12.4]]
L['range'] = {'booths': [{'x': 20.9, 'z': z} for z in BZ], 'spawns': SP}
L['lights'] += [[40, 4.4, -13, '#fff2e0', 30, 40]]
WORLD.append(rg.done())

# ================================================================== FISHING POND
pd = B('pond')
PX1, PX2, PZ1, PZ2, PH, WY = -47, -22, -20.5, -4.5, 9, -0.35
pd.plane(-21.9, -17.9, -13, -7, 0.02, 'wood', 0.5)
for i in range(18):
    pd.box(-17.45, 0.025, -17.6 + i * 0.6, 8.9, 0.012, 0.035, 'wood_dark')
pd.box(-13, 0.03, -12.45, 0.1, 0.04, 10.9, 'gold')
pd.box(-17.45, 0.03, -7, 9, 0.04, 0.1, 'gold')
# tackle stall
pd.box(-15.5, 0.5, -16.3, 3.6, 1.0, 0.7, 'wood')
pd.box(-15.5, 1.03, -16.3, 3.8, 0.06, 0.9, 'wood_dark')
for sx in (-1.8, 1.8):
    pd.box(-15.5 + sx, 1.5, -16.0, 0.12, 3.0, 0.12, 'wood_dark')
for i in range(8):
    pd.box(-17.08 + i * 0.45, 3.0, -15.9, 0.45, 0.06, 1.5, 'awning_red' if i % 2 else 'awning_white', rx=0.3)
pd.text('TACKLE', -15.5, 3.55, -16.3, 0.45, 'neon_cyan', depth=0.05)
for i in range(5):
    pd.cyl(-17.0 + i * 0.2, 1.9, -17.6, 0.012, 2.0, ['rod_blank', 'red', 'gold', 'blue', 'green'][i], segs=4, rx=0.06)
for i, m in enumerate(('red', 'yellow', 'neon_green', 'orange')):
    pd.sph(-14.6 + i * 0.25, 1.12, -16.2, 0.06, m, u=6, v=4)
pd.box(-16.3, 1.16, -16.3, 0.45, 0.2, 0.3, 'green')
col(-17.4, -17.75, -13.6, -15.85)
L['npcs'].append({'x': -15.5, 'z': -17.1, 'rot': 0, 'look': 'angler', 'name': 'Old Salt'})
L['interact'].append({'t': 'tackle', 'x': -15.5, 'z': -15.0, 'r': 1.9})
# railings where the deck meets the water
for z1, z2 in ((-17.9, -13.2), (-10.8, -7.1)):
    n = int((z2 - z1) / 1.15)
    for i in range(n + 1):
        pd.box(-22, 0.55, z1 + (z2 - z1) * i / n, 0.12, 1.1, 0.12, 'wood_dark')
    for y in (0.55, 1.05):
        pd.box(-22, y, (z1 + z2) / 2, 0.07, 0.08, z2 - z1, 'wood')
# annex: night sky room
wall(pd, PX1 - .5, PZ1 - .25, PX2, PZ1 - .25, y1=PH, m='sky')
wall(pd, PX1 - .5, PZ2 + .25, PX2 - .5, PZ2 + .25, y1=PH, m='sky')
wall(pd, PX1 - .25, PZ1, PX1 - .25, PZ2, y1=PH, m='sky')
wall(pd, PX2 - .25, PZ1, PX2 - .25, -D - .5, y1=PH, m='sky')
pd.box(PX2 - .25, 8, -12.5, 0.5, 2, 16, 'sky')
pd.plane(PX1, PZ1, PX2, PZ2, PH, 'sky', 1, up=False)
for i in range(90):
    s = RND.uniform(0.04, 0.1)
    w = RND.random()
    if w < 0.5:
        pd.box(RND.uniform(PX1, PX2), PH - 0.03, RND.uniform(PZ1, PZ2), s, 0.02, s, 'star')
    elif w < 0.8:
        pd.box(PX1 + 0.03, RND.uniform(3.5, PH), RND.uniform(PZ1, PZ2), 0.02, s, s, 'star')
    else:
        pd.box(RND.uniform(PX1, PX2), RND.uniform(3.5, PH), RND.choice((PZ1 + 0.03, PZ2 - 0.03)), s, s, 0.02, 'star')
pd.sph(-46.4, 7.2, -8.5, 0.9, 'moon', u=14, v=9)
pd.plane(PX1, PZ1, PX2, PZ2, -1.7, 'pond_floor')
pd.plane(PX1, PZ1, PX2, PZ2, WY, 'water', 0.25)
pd.box(-21.95, -0.9, -12.5, 0.3, 1.8, 16, 'rock_dark')
# pier
pd.box(-25, -0.04, -12, 6.2, 0.12, 2.4, 'wood')
pd.box(-29, -0.04, -12, 2, 0.12, 8, 'wood')
for i in range(10):
    pd.box(-27.8 + i * 0.62, 0.025, -12, 0.03, 0.012, 2.4, 'wood_dark')
for i in range(13):
    pd.box(-29, 0.025, -15.7 + i * 0.62, 2, 0.012, 0.03, 'wood_dark')
for x, z in ((-22.4, -13.1), (-22.4, -10.9), (-25, -13.1), (-25, -10.9), (-28.1, -15.9), (-29.9, -15.9), (-28.1, -8.1), (-29.9, -8.1), (-29.9, -12)):
    pd.cyl(x, -0.8, z, 0.11, 1.9, 'wood_dark', segs=7)
for z in (-15.9, -8.1):
    pd.cyl(-29.9, 0.9, z, 0.05, 1.8, 'wood_dark', segs=6)
    pd.box(-29.9, 1.95, z, 0.26, 0.34, 0.26, 'light_warm')
    pd.box(-29.9, 2.15, z, 0.32, 0.06, 0.32, 'black')
for z1, z2 in ((-16, -13.2), (-10.8, -8)):
    pd.box(-28.05, 0.5, (z1 + z2) / 2, 0.06, 0.06, z2 - z1, 'wood')
pd.box(-29.2, 0.2, -8.7, 0.5, 0.4, 0.4, 'blue')
pd.cyl(-28.6, 0.18, -15.3, 0.2, 0.36, 'metal_dark', segs=8, r2=0.24)
col(-28, PZ1, -22, -13.2); col(-28, -10.8, -22, PZ2); col(-30, PZ1, -28, -16); col(-30, -8, -28, PZ2); col(PX1, PZ1, -30, PZ2)
# rocks, reeds, lilies, trees, waterfall, boat
for i in range(46):
    side = RND.random()
    if side < 0.4:
        x, z = RND.uniform(PX1 + .5, PX2 - 1), RND.choice((PZ1 + RND.uniform(.2, 1.4), PZ2 - RND.uniform(.2, 1.4)))
    else:
        x, z = PX1 + RND.uniform(.3, 2.2), RND.uniform(PZ1 + 1, PZ2 - 1)
    r = RND.uniform(0.5, 1.4)
    pd.sph(x, WY + RND.uniform(-.2, .4), z, r, RND.choice(('rock', 'rock', 'rock_dark')), sx=RND.uniform(.8, 1.3), sy=RND.uniform(.5, .9), sz=RND.uniform(.8, 1.3),
           u=6, v=4, ry=RND.uniform(0, 3), smooth=False)
for i in range(9):
    x, z = RND.uniform(-46, -34), RND.choice((PZ1 + RND.uniform(.6, 1.3), PZ2 - RND.uniform(.6, 1.3)))
    hgt = RND.uniform(2.5, 4.5)
    pd.cyl(x, 0.6, z, 0.14, 1.6, 'wood_dark', segs=6)
    for j in range(3):
        pd.cyl(x, 1.2 + j * hgt * 0.26 + hgt * 0.15, z, 1.2 - j * 0.33, hgt * 0.4, 'pine', segs=7, r2=0.05, smooth=False)
for i in range(16):
    x, z = RND.uniform(-45, -31.5), RND.uniform(PZ1 + 1.5, PZ2 - 1.5)
    if RND.random() < 0.55:
        r = RND.uniform(0.25, 0.5)
        pd.cyl(x, WY + 0.012, z, r, 0.02, 'lily', segs=9)
        if RND.random() < 0.5:
            pd.sph(x + .05, WY + 0.08, z, 0.09, 'flower', u=6, v=4)
    else:
        for j in range(5):
            dx, dz = RND.uniform(-.3, .3), RND.uniform(-.3, .3)
            hh = RND.uniform(0.8, 1.5)
            pd.cyl(x + dx, WY + hh / 2, z + dz, 0.015, hh, 'reed', segs=4)
            pd.cyl(x + dx, WY + hh, z + dz, 0.035, 0.22, 'wood_dark', segs=5)
for i, (y, r) in enumerate(((0.8, 2.6), (2.4, 2.1), (3.9, 1.6), (5.0, 1.2))):
    pd.sph(-45.8 + i * 0.15, y, -13, r, 'rock' if i % 2 else 'rock_dark', sx=0.8, sy=0.7, sz=1.2, u=7, v=5, smooth=False)
pd.box(-44.55, 2.5, -13, 0.15, 5.6, 1.6, 'waterfall', rz=-0.12)
for i in range(6):
    pd.sph(-44.0 + RND.uniform(-.3, .3), WY + 0.05, -13 + RND.uniform(-1, 1), RND.uniform(.25, .5), 'foam', sy=0.4, u=6, v=4)
with pd.at(-38, WY - 0.05, -7.6, ry=0.5):
    pd.prism([(-1.3, 0), (-0.8, 0.5), (0.8, 0.5), (1.4, 0), (0.8, -0.5), (-0.8, -0.5)], 0, 0.45, 'wood')
    pd.prism([(-1.1, 0), (-0.7, 0.4), (0.7, 0.4), (1.2, 0), (0.7, -0.4), (-0.7, -0.4)], 0.12, 0.46, 'wood_dark')
    pd.box(0, 0.36, 0, 0.3, 0.05, 0.9, 'wood')
L['fish'] = {'spots': [{'x': -29.5, 'z': z, 'rot': round(-pi / 2, 3)} for z in (-15, -13, -11, -9)],
             'water': {'x1': -45, 'x2': -31.5, 'z1': -19, 'z2': -6, 'y': WY}}
for z in (-15, -13, -11, -9):
    L['interact'].append({'t': 'fish', 'x': -29.3, 'z': z, 'r': 1.0})
L['lights'] += [[-36, 4, -12, '#7fd0ff', 26, 34], [0, 4.5, -14.5, '#ff9a5c', 22, 22], [0, 5, 4, '#ffd27a', 20, 26]]
WORLD.append(pd.done())

# ================================================================== PROPS (the game moves these)
def prop(name, fn):
    b = B(name)
    fn(b)
    PROPS.append(b.done(loc=(len(PROPS) * 1.4 - 20, 0, 30)))


# avatar (faces +z). Each part is modelled around its joint.
RIG = {'hip': 0.86, 'legX': 0.11, 'neck': 0.72, 'shX': 0.31, 'shY': 0.58, 'hand': 0.6, 'rodTip': 2.27}


def av_torso(b):
    b.box(0, 0.08, 0, 0.44, 0.2, 0.25, 'av_bottom')
    b.box(0, 0.42, 0, 0.5, 0.5, 0.28, 'av_top')
    b.box(0, 0.62, 0, 0.56, 0.12, 0.26, 'av_top')
    b.cyl(0, 0.71, 0, 0.07, 0.1, 'av_skin', segs=8)
    b.box(0, 0.47, 0.142, 0.12, 0.38, 0.01, 'av_accent')
    b.box(0, 0.18, 0.13, 0.46, 0.04, 0.02, 'av_shoes')


def av_head(b):
    b.sph(0, 0.17, 0, 0.21, 'av_skin', sy=1.08, u=12, v=8)
    for sx in (-1, 1):
        b.sph(sx * 0.078, 0.2, 0.185, 0.03, 'av_eye', u=6, v=4)
        b.sph(sx * 0.21, 0.17, 0, 0.04, 'av_skin', u=6, v=4, sx=0.5)
    b.sph(0, 0.14, 0.205, 0.025, 'av_skin', u=6, v=4)
    b.box(0, 0.075, 0.19, 0.07, 0.012, 0.02, 'av_eye')


def av_arm(b):
    b.box(0, -0.13, 0, 0.14, 0.3, 0.16, 'av_top')
    b.box(0, -0.4, 0, 0.12, 0.28, 0.14, 'av_top')
    b.sph(0, -0.6, 0, 0.075, 'av_skin', u=7, v=5)


def av_leg(b):
    b.box(0, -0.4, 0, 0.18, 0.78, 0.2, 'av_bottom')
    b.box(0, -0.8, 0.045, 0.19, 0.12, 0.31, 'av_shoes')


for n, f in (('av_torso', av_torso), ('av_head', av_head), ('av_arm', av_arm), ('av_leg', av_leg)):
    prop(n, f)


# clothes, modelled where they sit on the head or torso
def hat(crown_r, crown_h, brim_r, m, band=None, r2=None, y0=0.3):
    def f(b):
        b.cyl(0, y0, 0, brim_r, 0.025, m, segs=16)
        b.cyl(0, y0 + crown_h / 2, 0, crown_r, crown_h, m, segs=14, r2=r2)
        if band:
            b.cyl(0, y0 + 0.035, 0, crown_r + 0.004, 0.05, band, segs=14)
    return f


prop('hat_top', hat(0.2, 0.32, 0.31, 'black', 'red'))
prop('hat_fedora', hat(0.215, 0.18, 0.3, 'hat_grey', 'black', 0.18))
prop('hat_bucket', lambda b: (b.cyl(0, 0.3, 0, 0.34, 0.12, 'hat_olive', segs=14, r2=0.22), b.cyl(0, 0.41, 0, 0.22, 0.14, 'hat_olive', segs=14, r2=0.19),
                              b.sph(0.12, 0.4, 0.17, 0.025, 'red', u=5, v=4)))


def hat_cowboy(b):
    b.cyl(0, 0.3, 0, 0.4, 0.03, 'hat_brown', segs=16, sz=0.82)
    for sx in (-1, 1):
        b.box(sx * 0.36, 0.34, 0, 0.1, 0.03, 0.5, 'hat_brown', rz=sx * 0.7)
    b.cyl(0, 0.41, 0, 0.21, 0.22, 'hat_brown', segs=14, r2=0.17)
    b.cyl(0, 0.335, 0, 0.214, 0.04, 'gold', segs=14)


def hat_cap(b):
    b.sph(0, 0.22, 0, 0.225, 'red', sy=0.85, u=12, v=7)
    b.box(0, 0.25, 0.26, 0.26, 0.02, 0.2, 'red', rx=0.15)
    b.sph(0, 0.415, 0, 0.025, 'white', u=5, v=4)


def hat_crown(b):
    b.cyl(0, 0.36, 0, 0.19, 0.1, 'gold', segs=12)
    for i in range(6):
        a = i * pi / 3
        b.cyl(math.sin(a) * 0.18, 0.46, math.cos(a) * 0.18, 0.04, 0.13, 'gold', segs=5, r2=0.0)
        b.sph(math.sin(a + pi / 6) * 0.19, 0.36, math.cos(a + pi / 6) * 0.19, 0.022, ['neon_red', 'neon_cyan'][i % 2], u=5, v=4)


prop('hat_cowboy', hat_cowboy)
prop('hat_cap', hat_cap)
prop('hat_crown', hat_crown)
prop('hat_halo', lambda b: b.ring(0, 0.56, 0, 0.17, 0.022, 'neon_gold', segs=18, tube=5))
prop('hair_short', lambda b: b.sph(0, 0.225, -0.028, 0.222, 'av_hair', sy=0.93, u=12, v=7))
prop('hair_long', lambda b: (b.sph(0, 0.225, -0.028, 0.222, 'av_hair', sy=0.93, u=12, v=7), b.box(0, 0.02, -0.15, 0.38, 0.4, 0.12, 'av_hair')))
prop('hair_mohawk', lambda b: [b.box(0, 0.36 - abs(i) * 0.012, i * 0.055, 0.035, 0.16 - abs(i) * 0.02, 0.05, 'mohawk', rx=i * 0.22) for i in range(-3, 4)])


def eye_shades(b):
    for sx in (-1, 1):
        b.box(sx * 0.08, 0.2, 0.205, 0.12, 0.065, 0.02, 'black')
        b.box(sx * 0.19, 0.205, 0.1, 0.012, 0.015, 0.22, 'black')
    b.box(0, 0.215, 0.205, 0.05, 0.015, 0.015, 'black')


def eye_gold(b):
    for sx in (-1, 1):
        b.ring(sx * 0.08, 0.2, 0.21, 0.045, 0.008, 'gold', segs=12, tube=4, rx=pi / 2)
        b.cyl(sx * 0.08, 0.2, 0.208, 0.042, 0.006, 'lens', segs=10, rx=pi / 2)
        b.box(sx * 0.19, 0.205, 0.1, 0.01, 0.01, 0.22, 'gold')
    b.box(0, 0.21, 0.21, 0.04, 0.01, 0.01, 'gold')


def eye_visor(b):
    b.box(0, 0.2, 0.2, 0.36, 0.06, 0.03, 'visor')
    for sx in (-1, 1):
        b.box(sx * 0.19, 0.2, 0.1, 0.015, 0.05, 0.22, 'metal_dark')


prop('eye_shades', eye_shades)
prop('eye_gold', eye_gold)
prop('eye_visor', eye_visor)


def chain(m, pend):
    def f(b):
        for i in range(-5, 6):
            t = i / 5
            b.sph(t * 0.14, 0.64 - (1 - abs(t)) * 0.2, 0.148 + (1 - abs(t)) * 0.004, 0.017, m, u=5, v=4)
        if pend == '$':
            b.text('$', 0, 0.39, 0.155, 0.12, m, depth=0.02)
        else:
            b.sph(0, 0.39, 0.155, 0.05, m, sy=1.3, u=4, v=3, smooth=False)
    return f


prop('neck_chain', chain('gold', '$'))
prop('neck_ice', chain('ice', 'gem'))
prop('neck_bowtie', lambda b: (b.cyl(-0.05, 0.64, 0.15, 0.045, 0.1, 'red', segs=4, r2=0.01, rz=-pi / 2), b.cyl(0.05, 0.64, 0.15, 0.045, 0.1, 'red', segs=4, r2=0.01, rz=pi / 2),
                               b.box(0, 0.64, 0.155, 0.03, 0.035, 0.03, 'red')))
prop('back_cape', lambda b: (b.box(0, 0.16, -0.2, 0.56, 1.0, 0.03, 'cape_red', rx=-0.12), b.box(0, 0.66, -0.13, 0.6, 0.06, 0.1, 'gold')))


def wings(b):
    for sx in (-1, 1):
        for i in range(4):
            b.box(sx * (0.2 + i * 0.14), 0.52 - i * 0.07, -0.19, 0.16, 0.5 - i * 0.07, 0.025, 'wing_gold', rz=sx * (-0.35 - i * 0.2))


prop('back_wings', wings)


def rifle(b):   # points along -z, origin at the grip
    b.box(0, 0.06, -0.12, 0.06, 0.078, 0.44, 'gun_tan')
    b.cyl(0, 0.065, -0.5, 0.032, 0.34, 'gun_black', segs=8, rx=pi / 2)
    b.cyl(0, 0.065, -0.92, 0.014, 0.52, 'gun_metal', segs=8, rx=pi / 2)
    b.box(0, 0.065, -1.21, 0.055, 0.036, 0.1, 'gun_black')
    for z in (-1.235, -1.2, -1.165):
        b.box(0, 0.065, z, 0.058, 0.02, 0.012, 'gun_metal')
    b.box(0, 0.105, -0.13, 0.03, 0.014, 0.32, 'gun_black')
    for z in (-0.04, -0.22):
        b.box(0, 0.125, z, 0.024, 0.04, 0.03, 'gun_black')
    b.cyl(0, 0.158, -0.13, 0.024, 0.36, 'gun_black', segs=10, rx=pi / 2)
    b.cyl(0, 0.158, -0.345, 0.036, 0.1, 'gun_black', segs=10, rx=pi / 2)
    b.cyl(0, 0.158, 0.075, 0.03, 0.07, 'gun_black', segs=10, rx=pi / 2)
    b.cyl(0, 0.158, -0.397, 0.031, 0.004, 'lens', segs=10, rx=pi / 2)
    b.cyl(0, 0.195, -0.13, 0.016, 0.03, 'gun_black', segs=8)
    b.cyl(0.036, 0.158, -0.13, 0.016, 0.03, 'gun_black', segs=8, rz=pi / 2)
    b.cyl(0.05, 0.072, 0.03, 0.01, 0.07, 'gun_metal', segs=6, rz=pi / 2)
    b.sph(0.09, 0.062, 0.03, 0.017, 'gun_metal', u=6, v=4)
    b.box(0, -0.03, -0.14, 0.04, 0.12, 0.09, 'gun_black', rx=0.08)
    b.box(0, -0.04, 0.045, 0.04, 0.12, 0.05, 'gun_black', rx=0.3)
    b.box(0, 0.0, -0.03, 0.012, 0.012, 0.09, 'gun_black')
    for sx in (-.02, .02):
        b.cyl(sx, 0.06, 0.24, 0.008, 0.3, 'gun_metal', segs=5, rx=pi / 2)
    b.box(0, 0.045, 0.4, 0.05, 0.15, 0.03, 'gun_black')
    b.box(0, 0.108, 0.26, 0.04, 0.03, 0.15, 'gun_tan')
    b.cyl(0, -0.05, 0.37, 0.01, 0.07, 'gun_metal', segs=5)
    b.box(0, 0.13, -0.42, 0.02, 0.05, 0.14, 'gun_black')
    for sx in (-.03, .03):
        b.cyl(sx, 0.025, -0.55, 0.008, 0.28, 'gun_metal', segs=5, rx=pi / 2)
        b.box(sx, 0.022, -0.7, 0.018, 0.012, 0.03, 'gun_black')


prop('rifle', rifle)


def rod(b):  # stands up along +y, origin in the hand
    b.cyl(0, 0.1, 0, 0.02, 0.36, 'cork', segs=7)
    b.cyl(0, 0.3, 0, 0.016, 0.06, 'chrome', segs=7)
    b.cyl(0, 0.24, 0.05, 0.045, 0.035, 'chrome', segs=10, rz=pi / 2)
    b.box(0.035, 0.24, 0.085, 0.01, 0.01, 0.06, 'black')
    b.cyl(0, 1.3, 0, 0.011, 1.94, 'rod_blank', segs=6, r2=0.003)
    for y in (0.7, 1.2, 1.7, 2.2):
        b.ring(0, y, 0.02, 0.012, 0.003, 'chrome', segs=8, tube=3, rx=pi / 2)


prop('rod', rod)
prop('bobber', lambda b: (b.sph(0, 0.025, 0, 0.06, 'red', u=8, v=5), b.sph(0, -0.02, 0, 0.058, 'white', u=8, v=5), b.cyl(0, 0.1, 0, 0.006, 0.14, 'black', segs=4)))


def fish_eyes(b, x, y, z, r=0.018):
    for sx in (-1, 1):
        b.sph(sx * x, y, z, r, 'fish_eye', u=6, v=4)
        b.sph(sx * (x + r * 0.5), y, z + r * 0.2, r * 0.55, 'av_eye', u=5, v=4)


def fish_a(b):
    b.sph(0, 0, 0, 0.25, 'fish_body', sx=0.3, sy=0.46, sz=1, u=10, v=7, rx=pi / 2)
    b.cyl(0, 0, -0.3, 0.12, 0.16, 'fish_fin', segs=6, r2=0.02, rx=pi / 2, sx=0.12)
    b.box(0, 0.115, -0.02, 0.012, 0.08, 0.16, 'fish_fin', rx=-0.3)
    for sx in (-1, 1):
        b.box(sx * 0.07, -0.03, 0.06, 0.07, 0.01, 0.06, 'fish_fin', rz=sx * -0.5)
    fish_eyes(b, 0.05, 0.03, 0.17)


def fish_b(b):
    b.sph(0, 0, 0, 0.42, 'fish_body', sx=0.11, sy=0.15, sz=1, u=10, v=7, rx=pi / 2)
    b.cyl(0, 0, -0.45, 0.08, 0.14, 'fish_fin', segs=6, r2=0.015, rx=pi / 2, sx=0.12)
    b.box(0, 0.06, -0.12, 0.01, 0.05, 0.3, 'fish_fin')
    fish_eyes(b, 0.032, 0.02, 0.33, 0.014)


def fish_c(b):
    b.sph(0, 0, 0, 0.17, 'fish_body', u=10, v=7)
    for i in range(14):
        a, e = RND.uniform(0, 2 * pi), RND.uniform(-1.1, 1.1)
        d = Vector((math.cos(a) * math.cos(e), math.sin(e), math.sin(a) * math.cos(e)))
        b.sph(d.x * 0.17, d.y * 0.17, d.z * 0.17, 0.03, 'fish_fin', u=4, v=3, smooth=False)
    b.cyl(0, 0, -0.2, 0.07, 0.1, 'fish_fin', segs=6, r2=0.015, rx=pi / 2, sx=0.15)
    fish_eyes(b, 0.085, 0.06, 0.125, 0.03)


def fish_d(b):
    b.sph(0, 0, 0, 0.4, 'fish_body', sx=0.25, sy=0.28, sz=1, u=10, v=7, rx=pi / 2)
    b.cyl(0, 0.16, 0, 0.11, 0.2, 'fish_fin', segs=4, r2=0.0, sx=0.12, rx=-0.4)
    for sy in (-1, 1):
        b.cyl(0, sy * 0.09, -0.44, 0.06, 0.24, 'fish_fin', segs=4, r2=0.0, sx=0.12, rx=pi / 2 + sy * 2.2)
    for sx in (-1, 1):
        b.box(sx * 0.13, -0.05, 0.08, 0.16, 0.012, 0.09, 'fish_fin', rz=sx * -0.5, ry=sx * -0.4)
    b.box(0, -0.04, 0.33, 0.1, 0.012, 0.08, 'fish_eye')
    fish_eyes(b, 0.07, 0.03, 0.29, 0.016)


def boot(b):
    b.box(0, 0.12, -0.03, 0.12, 0.3, 0.14, 'leather')
    b.box(0, -0.02, 0.05, 0.12, 0.1, 0.3, 'leather')
    b.box(0, -0.075, 0.05, 0.13, 0.03, 0.32, 'black')


def chest(b):
    b.box(0, 0, 0, 0.42, 0.22, 0.28, 'wood')
    b.cyl(0, 0.11, 0, 0.14, 0.42, 'wood', segs=10, rz=pi / 2)
    for sx in (-.15, .15):
        b.box(sx, 0.02, 0, 0.04, 0.27, 0.3, 'gold')
    b.box(0, 0.06, 0.145, 0.07, 0.08, 0.02, 'gold')


for n, f in (('fish_a', fish_a), ('fish_b', fish_b), ('fish_c', fish_c), ('fish_d', fish_d), ('item_boot', boot), ('item_chest', chest)):
    prop(n, f)


def target(b):  # faces +z
    for i, (r, m) in enumerate(((0.5, 'tgt_white'), (0.4, 'tgt_red'), (0.3, 'tgt_white'), (0.2, 'tgt_red'), (0.09, 'tgt_gold'))):
        b.cyl(0, 0, i * 0.006, r, 0.04, m, segs=20, rx=pi / 2)
    b.cyl(0, -1.1, -0.03, 0.03, 1.3, 'metal_dark', segs=6)


prop('target', target)
prop('dollar', lambda b: b.text('$', 0, 0, 0, 2.2, 'gold', depth=0.35))
prop('drink', lambda b: (b.cyl(0, 0.05, 0, 0.03, 0.11, 'glass', segs=8, r2=0.04), b.cyl(0, 0.04, 0, 0.027, 0.07, 'drink_liquid', segs=8, r2=0.033),
                         b.cyl(0.015, 0.1, 0, 0.004, 0.14, 'red', segs=4, rz=-0.2)))
L['rig'] = RIG

# ------------------------------------------------------------------ export
def export(objs, path):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                              export_cameras=False, export_lights=False, export_animations=False)


export(WORLD, os.path.join(OUT, 'casino.glb'))
export(PROPS, os.path.join(OUT, 'props.glb'))
with open(os.path.join(OUT, 'layout.json'), 'w') as f:
    json.dump(L, f, separators=(',', ':'))
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in WORLD + PROPS)
print('BIGMONEY built: %d objects, %d triangles' % (len(WORLD) + len(PROPS), tris))

# a lit camera so the .blend opens on something worth looking at, and a preview render
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera'))
cam.data.lens = 20
bpy.context.scene.collection.objects.link(cam)
eye, look = C @ Vector((3, 5.6, 17)), C @ Vector((-2, 1.2, -4))
cam.location = eye
cam.rotation_euler = (look - eye).to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam
for p in ((0, 6, 8), (0, 6, -8), (-12, 6, 2), (12, 6, 2), (-34, 6, -12), (40, 4, -13)):
    ld = bpy.data.lights.new('L', 'POINT')
    ld.energy = 3000
    lo = bpy.data.objects.new('Light', ld)
    lo.location = C @ Vector(p)
    bpy.context.scene.collection.objects.link(lo)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'bigmoney.blend'))
if '--preview' in sys.argv:
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
        try:
            sc.render.engine = eng
            break
        except Exception:
            pass
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.filepath = os.path.join(HERE, 'preview.png')
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as e:
        print('preview render skipped:', e)
