#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera los modelos GLB de las armas del juego (pistola y escopeta).
Cada arma se compone de primitivas (cajas, cilindros) agrupadas por material
para que el GLB tenga un numero reducido de nodos: arma / cargador (mag) /
cañon (slide) / boca (muzzle).
Uso:  python3 build_models.py <carpeta_destino>
"""
import json, struct, math, sys, os

# ---------------------------------------------------------------- geometria
def box(w, h, d, center=(0, 0, 0)):
    x, y, z = center
    hw, hh, hd = w / 2, h / 2, d / 2
    p = [(x - hw, y - hh, z - hd), (x + hw, y - hh, z - hd), (x + hw, y + hh, z - hd), (x - hw, y + hh, z - hd),
         (x - hw, y - hh, z + hd), (x + hw, y - hh, z + hd), (x + hw, y + hh, z + hd), (x - hw, y + hh, z + hd)]
    q = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)]
    tris = []
    for a, b, c, e in q:
        tris += [a, b, c, a, c, e]
    return [p[i] for i in tris]

def cyl(r, h, seg=16, axis='z', center=(0, 0, 0)):
    cx, cy, cz = center
    tris = []
    def pt(i, t):
        a = 2 * math.pi * i / seg
        u, v = r * math.cos(a), r * math.sin(a)
        if axis == 'z':
            return (cx + u, cy + v, cz + t)
        if axis == 'y':
            return (cx + u, cy + t, cz + v)
        return (cx + t, cy + u, cz + v)
    for i in range(seg):
        a0, a1 = pt(i, -h / 2), pt(i, h / 2)
        b0, b1 = pt((i + 1) % seg, -h / 2), pt((i + 1) % seg, h / 2)
        tris += [a0, b0, b1, a0, b1, a1]                      # lateral
        c0, c1 = pt(0, -h / 2), pt(0, h / 2)
        tris += [c0, a0, b0, c1, b1, a1]                      # tapas
    return tris

# ---------------------------------------------------------------- GLB writer
class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.j = {"asset": {"version": "2.0", "generator": "OperacionExtraccion/build_models.py"},
                  "scenes": [{"nodes": [0]}], "scene": 0, "nodes": [], "meshes": [],
                  "materials": [], "accessors": [], "bufferViews": [{"buffer": 0, "byteLength": 0}],
                  "buffers": [{"byteLength": 0}]}

    def material(self, name, color, metal=0.0, rough=0.6):
        self.j["materials"].append({"name": name, "pbrMetallicRoughness": {
            "baseColorFactor": [color[0], color[1], color[2], 1.0],
            "metallicFactor": metal, "roughnessFactor": rough}, "doubleSided": True})
        return len(self.j["materials"]) - 1

    def node(self, name, translation=(0, 0, 0), parent=None):
        idx = len(self.j["nodes"])
        self.j["nodes"].append({"name": name, "translation": list(translation)})
        if parent is None:
            self.j["nodes"][0].setdefault("children", []).append(idx)
        else:
            self.j["nodes"][parent].setdefault("children", []).append(idx)
        return idx

    def mesh(self, name, parts, node):
        """parts: lista de (triangulos, material_index) ya en coordenadas del nodo"""
        prims = []
        for tris, mat in parts:
            pos = []
            nrm = []
            for tri in range(0, len(tris), 3):
                a, b, c = tris[tri], tris[tri + 1], tris[tri + 2]
                u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
                n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
                ln = math.sqrt(sum(x * x for x in n)) or 1.0
                n = [x / ln for x in n]
                for p in (a, b, c):
                    pos += list(p); nrm += n
            acc = []
            for data, kind in ((pos, "VEC3"), (nrm, "VEC3")):
                while len(self.bin) % 4:
                    self.bin.append(0)
                off = len(self.bin)
                self.bin += struct.pack('<%df' % len(data), *data)
                self.j["bufferViews"].append({"buffer": 0, "byteOffset": off, "byteLength": len(data) * 4,
                                              "target": 34962})
                bv = len(self.j["bufferViews"]) - 1
                mn = [min(data[i::3]) for i in range(3)]; mx = [max(data[i::3]) for i in range(3)]
                self.j["accessors"].append({"bufferView": bv, "componentType": 5126, "count": len(data) // 3,
                                            "type": kind, "min": mn, "max": mx})
                acc.append(len(self.j["accessors"]) - 1)
            prims.append({"attributes": {"POSITION": acc[0], "NORMAL": acc[1]}, "material": mat, "mode": 4})
        self.j["meshes"].append({"name": name, "primitives": prims})
        self.j["nodes"][node]["mesh"] = len(self.j["meshes"]) - 1

    def save(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j["bufferViews"][0]["byteLength"] = len(self.bin)
        self.j["buffers"][0]["byteLength"] = len(self.bin)
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack('<II', len(self.bin), 0x004E4942)); f.write(bytes(self.bin))
        print('%-14s %6d bytes' % (os.path.basename(path), total))

# ---------------------------------------------------------------- armas
# Eje del arma: +Z = hacia donde apunta el cañon, +Y = arriba.
def build_pistol(dst):
    g = Glb(); g.node("Pistola")
    dark = g.material("Acero", (0.12, 0.13, 0.15), 0.9, 0.35)
    poly = g.material("Polimero", (0.16, 0.16, 0.16), 0.1, 0.8)
    grip = g.material("Empunadura", (0.09, 0.07, 0.06), 0.0, 1.0)

    body = g.node("cuerpo", (0, 0, 0))
    g.mesh("cuerpo_mesh", [
        (box(0.052, 0.052, 0.22, (0, 0, 0.02)), poly),                 # corredera
        (box(0.046, 0.040, 0.16, (0, -0.045, 0.00)), poly),            # armazon
        (box(0.050, 0.030, 0.13, (0, -0.088, -0.055)), grip),          # empunadura
        (box(0.016, 0.016, 0.030, (0, -0.052, 0.045)), dark),          # guardamonte
        (cyl(0.010, 0.055, 12, 'z', (0, 0.0, 0.115)), dark),           # boca del cañon
        (box(0.010, 0.014, 0.020, (0, 0.032, -0.075)), dark),          # martillo
        (box(0.008, 0.020, 0.010, (0, 0.040, 0.070)), dark),           # mira
    ], body)

    slide = g.node("corredera", (0, 0, 0), parent=body)
    g.mesh("corredera_mesh", [
        (box(0.054, 0.014, 0.20, (0, 0.031, 0.02)), dark),
        (box(0.006, 0.030, 0.040, (-0.028, 0.000, -0.060)), dark),     # estrías
        (box(0.006, 0.030, 0.040, (0.028, 0.000, -0.060)), dark),
    ], slide)

    mag = g.node("cargador", (0, -0.09, -0.05), parent=body)
    g.mesh("cargador_mesh", [(box(0.038, 0.10, 0.055, (0, -0.10, -0.01)), dark)], mag)

    muz = g.node("boca", (0, 0.0, 0.145), parent=body)
    g.save(os.path.join(dst, 'pistola.glb'))

def build_shotgun(dst):
    g = Glb(); g.node("Escopeta")
    steel = g.material("Acero", (0.10, 0.11, 0.12), 0.95, 0.30)
    wood = g.material("Madera", (0.36, 0.20, 0.09), 0.05, 0.75)
    rubber = g.material("Goma", (0.10, 0.09, 0.08), 0.0, 0.95)

    body = g.node("cuerpo", (0, 0, 0))
    g.mesh("cuerpo_mesh", [
        (cyl(0.017, 0.62, 14, 'z', (0, 0.012, 0.30)), steel),          # cañon
        (cyl(0.020, 0.26, 14, 'z', (0, -0.016, 0.22)), steel),         # tubo de carga
        (box(0.060, 0.070, 0.20, (0, -0.005, 0.02)), steel),           # cajon de mecanismos
        (box(0.052, 0.055, 0.26, (0, -0.010, -0.14)), wood),           # culata
        (box(0.048, 0.090, 0.11, (0, -0.060, -0.075)), wood),          # empunadura
        (box(0.050, 0.050, 0.16, (0, -0.020, 0.20)), wood),            # guardamanos
        (box(0.062, 0.014, 0.055, (0, -0.060, 0.02)), rubber),         # empunadura de goma
        (box(0.012, 0.014, 0.012, (0, 0.033, 0.53)), steel),           # punto de mira
    ], body)

    pump = g.node("corredera", (0, 0, 0), parent=body)
    g.mesh("corredera_mesh", [
        (box(0.056, 0.036, 0.10, (0, -0.022, 0.22)), rubber),
    ], pump)

    mag = g.node("cargador", (0, 0, 0), parent=body)
    g.mesh("cargador_mesh", [
        (cyl(0.020, 0.05, 12, 'z', (0, -0.016, 0.33)), steel),
    ], mag)

    g.save(os.path.join(dst, 'escopeta.glb'))

if __name__ == '__main__':
    dst = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(dst, exist_ok=True)
    build_pistol(dst)
    build_shotgun(dst)
