"""Toolkit for building Hourfall's models in Blender from code.

Models are authored in the game's own axes (Y up, +Z forward) and exported with export_yup=False,
so numbers here are the numbers the game sees. Materials carry no textures: a material named
c_rrggbb is a fixed sRGB colour; one named r_ROLE is tinted by the game (skin, roof, cloth...).
Each model is an empty named after the model with one child object per moving part.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler

PI = math.pi
TMP = None
MATS = {}


def reset():
    global TMP
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    TMP = bpy.data.meshes.new('tmp')


def material(key):
    name = ('c_' + key[1:].lower()) if key.startswith('#') else 'r_' + key
    m = MATS.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        if key.startswith('#'):
            c = [int(key[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            m.diffuse_color = (*[(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c], 1)
        MATS[name] = m
    return m


def _xf(a):
    s = a.get('s', 1)
    return (Matrix.Translation((a.get('x', 0), a.get('y', 0), a.get('z', 0)))
            @ Euler((a.get('rx', 0), a.get('ry', 0), a.get('rz', 0)), 'XYZ').to_matrix().to_4x4()
            @ Matrix.Diagonal((a.get('sx', s), a.get('sy', s), a.get('sz', s), 1)))


def _ring(bm, r, y, n, off=0.0):
    return [bm.verts.new((math.cos(i / n * 2 * PI + off) * r, y, math.sin(i / n * 2 * PI + off) * r)) for i in range(n)]


def _lathe(bm, prof, n, cap_lo=True, cap_hi=True):
    """Surface of revolution around Y from a list of (radius, height)."""
    rings = []
    for r, y in prof:
        rings.append([bm.verts.new((0, y, 0))] if r <= 1e-5 else _ring(bm, r, y, n))
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_lo and len(rings[0]) > 2:
        bm.faces.new(list(reversed(rings[0])))
    if cap_hi and len(rings[-1]) > 2:
        bm.faces.new(rings[-1])


class Part:
    def __init__(self, name, origin=(0, 0, 0), parent=None):
        self.name, self.o, self.parent = name, Vector(origin), parent
        self.bm, self.mats = bmesh.new(), []

    def _mi(self, key):
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)

    def _put(self, bm, color, a, round_, axis=None):
        bm.normal_update()
        sm = a.get('smooth', round_)
        for f in bm.faces:
            f.smooth = sm and not (axis is not None and abs(f.normal.dot(axis)) > 0.97 and not a.get('smoothcap'))
            f.material_index = self._mi(color)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(-self.o) @ _xf(a), verts=bm.verts)
        bm.normal_update()
        bm.to_mesh(TMP)
        bm.free()
        self.bm.from_mesh(TMP)
        return self

    # ---- primitives. Every one takes x y z rx ry rz s sx sy sz smooth ----
    def box(self, c, w, h, d, bev=0.0, seg=1, **a):
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, vec=(w, h, d), verts=bm.verts)
        if bev:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bev, min(w, h, d) * 0.45), offset_type='OFFSET',
                            segments=seg, profile=0.5, affect='EDGES', clamp_overlap=True)
        return self._put(bm, c, a, False)

    def cyl(self, c, rt, rb, h, n=12, **a):
        bm = bmesh.new()
        if rt <= 1e-5:
            _lathe(bm, [(rb, -h / 2), (0, h / 2)], n)
        else:
            _lathe(bm, [(rb, -h / 2), (rt, h / 2)], n)
        return self._put(bm, c, a, True, Vector((0, 1, 0)))

    def cone(self, c, r, h, n=12, **a):
        return self.cyl(c, 0, r, h, n, **a)

    def sph(self, c, r, n=16, m=10, **a):
        bm = bmesh.new()
        _lathe(bm, [(0, -r)] + [(math.sin(i / m * PI) * r, -math.cos(i / m * PI) * r) for i in range(1, m)] + [(0, r)], n)
        return self._put(bm, c, a, True)

    def ico(self, c, r, sub=1, **a):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
        return self._put(bm, c, a, True)

    def cap(self, c, r, l, n=12, m=8, **a):
        """Capsule along Y: two half-spheres joined by a tube of length l."""
        bm = bmesh.new()
        half = m // 2
        prof = [(0, -r - l / 2)] + [(math.sin(i / m * PI) * r, -math.cos(i / m * PI) * r - l / 2) for i in range(1, half + 1)]
        prof += [(math.sin(i / m * PI) * r, -math.cos(i / m * PI) * r + l / 2) for i in range(half, m)] + [(0, r + l / 2)]
        _lathe(bm, prof, n)
        return self._put(bm, c, a, True)

    def dome(self, c, r, n=16, m=6, **a):
        bm = bmesh.new()
        _lathe(bm, [(r, 0)] + [(math.cos(i / m * PI / 2) * r, math.sin(i / m * PI / 2) * r) for i in range(1, m)] + [(0, r)], n)
        return self._put(bm, c, a, True, Vector((0, 1, 0)))

    def lathe(self, c, prof, n=12, **a):
        bm = bmesh.new()
        _lathe(bm, prof, n)
        return self._put(bm, c, a, True, Vector((0, 1, 0)))

    def tor(self, c, R, t, n=24, m=8, **a):
        """Torus in the XY plane (axis Z), like three.js TorusGeometry."""
        bm = bmesh.new()
        rings = []
        for i in range(n):
            u = i / n * 2 * PI
            rings.append([bm.verts.new(((R + t * math.cos(v)) * math.cos(u), (R + t * math.cos(v)) * math.sin(u), t * math.sin(v)))
                          for v in (j / m * 2 * PI for j in range(m))])
        for i in range(n):
            A, B = rings[i], rings[(i + 1) % n]
            for j in range(m):
                k = (j + 1) % m
                bm.faces.new((A[j], B[j], B[k], A[k]))
        return self._put(bm, c, a, True)

    def prism(self, c, w, h, d, **a):
        """Gable shape: triangle of width w and height h in XY, extruded d along Z."""
        bm = bmesh.new()
        f = [bm.verts.new((-w / 2, 0, -d / 2)), bm.verts.new((w / 2, 0, -d / 2)), bm.verts.new((0, h, -d / 2))]
        b = [bm.verts.new((-w / 2, 0, d / 2)), bm.verts.new((w / 2, 0, d / 2)), bm.verts.new((0, h, d / 2))]
        bm.faces.new((f[0], f[2], f[1])); bm.faces.new((b[0], b[1], b[2]))
        bm.faces.new((f[0], f[1], b[1], b[0])); bm.faces.new((f[1], f[2], b[2], b[1])); bm.faces.new((f[2], f[0], b[0], b[2]))
        return self._put(bm, c, a, False)

    def ell(self, c, ex, ey, ez, n=16, m=10, **a):
        """Ellipsoid with radii ex, ey, ez."""
        a = dict(a); a['sx'], a['sy'], a['sz'] = ex, ey, ez
        a.pop('s', None)
        return self.sph(c, 1, n, m, **a)


def model(name, parts):
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    made = {}
    for p in parts:
        me = bpy.data.meshes.new(name + '.' + p.name)
        p.bm.to_mesh(me)
        p.bm.free()
        for k in p.mats:
            me.materials.append(material(k))
        ob = bpy.data.objects.new(name + '.' + p.name, me)
        bpy.context.scene.collection.objects.link(ob)
        par = made.get(p.parent) if p.parent else None
        ob.parent = par.ob if par else root
        ob.location = p.o - (par.o if par else Vector())
        p.ob = ob
        made[p.name] = p
    return root


def one(name, build):
    """A model with a single part called body."""
    b = Part('body')
    build(b)
    return model(name, [b])


def export(path):
    kw = dict(filepath=path, export_format='GLB', export_yup=False, export_texcoords=False, export_apply=True,
              export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
              export_draco_position_quantization=14, export_draco_normal_quantization=8)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError as e:
        print('export option problem, retrying plainly:', e)
        for k in list(kw):
            if k.startswith('export_draco'):
                kw.pop(k)
        bpy.ops.export_scene.gltf(**kw)
