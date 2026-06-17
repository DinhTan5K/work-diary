import math
r_out = 46
r_in = 39
cx, cy = 50, 50
points = 16
path = []
for i in range(points * 2):
    angle = i * math.pi / points
    r = r_out if i % 2 == 0 else r_in
    x = cx + r * math.cos(angle)
    y = cy + r * math.sin(angle)
    path.append(f'{x:.1f},{y:.1f}')
print(f'<polygon points="{" ".join(path)}" fill="#fff" stroke="#000" stroke-width="4" stroke-linejoin="miter"/>')
