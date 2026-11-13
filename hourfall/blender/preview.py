"""Renders a contact sheet of models whose names start with a prefix, for checking by eye.
blender -b --factory-startup --python preview.py -- assets.glb out.png PREFIX [columns]"""
import bpy, sys, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
src, out, prefix = args[0], args[1], args[2]
cols = int(args[3]) if len(args) > 3 else 6
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
roots = sorted([o for o in bpy.data.objects if o.parent is None and o.name.startswith(prefix)], key=lambda o: o.name)
for o in bpy.data.objects:
    if o.parent is None and o not in roots:
        for c in [o] + list(o.children_recursive):
            c.hide_render = True
# materials named c_rrggbb carry their colour in the name; roles get a stand-in colour
ROLE = {'SKIN': 'e8b48e', 'TOP': '2f8f86', 'BOT': '3a3344', 'TRIM': '8a5a34', 'HAIR': '5a3a24', 'HAT': 'd9b45a', 'CAPE': '8a3a55', 'BOOT': '4a3628', 'METAL': 'b8bcc8',
        'M1': '77738c', 'M2': '3a3848', 'M3': 'ffb040', 'EYE': '8ff6ff', 'WALL': 'f2e6c8', 'ROOF': 'c8763a', 'CLOTH': 'c8443a', 'BLOOM': 'ffd24a', 'GEM': '7fe6d6', 'WOOD': '9a6a3a'}
for m in bpy.data.materials:
    h = m.name[2:8] if m.name.startswith('c_') else ROLE.get(m.name[2:].split('.')[0], 'ff00ff')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    m.diffuse_color = (*[(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c], 1)
size = []
for r in roots:
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for c in r.children_recursive:
        if c.type == 'MESH':
            for v in c.bound_box:
                w = c.matrix_world @ Vector(v)
                lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    size.append(max((hi - lo).length, 0.5))
cell = max(size) * 1.1
for i, r in enumerate(roots):
    s = cell / size[i] * 0.8
    r.scale = (s, s, s)
    r.location = ((i % cols) * cell, -(i // cols) * cell, 0)
    bpy.context.view_layer.update()
    lo = Vector((1e9,) * 3)
    for c in r.children_recursive:
        if c.type == 'MESH':
            for v in c.bound_box:
                lo = Vector(map(min, lo, c.matrix_world @ Vector(v)))
    r.location.z -= lo.z - 0  # stand on the floor (after import, Z is up)
rows = (len(roots) + cols - 1) // cols
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_shadows = True
sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 300 * cols, 300 * rows
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = max(cols, rows) * cell * 1.05
cx, cy = (cols - 1) * cell / 2, -(rows - 1) * cell / 2
cam.location = (cx + cell * 8 * math.sin(0.5), cy - cell * 8, cell * 4.5)
d = Vector((cx, cy, cell * 0.3)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('RENDERED', len(roots))
