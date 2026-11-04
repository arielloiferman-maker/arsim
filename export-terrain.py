import bpy
import json
import sys
import numpy as np
from mathutils import Vector, noise
from pathlib import Path

out = Path(sys.argv[sys.argv.index("--") + 1])
scene = bpy.context.scene
terrain = [bpy.data.objects[name] for name in ("Dry beach", "Wet sand", "Seabed")]

# Sample Blender noise into small, tileable texture maps for the browser.
size = 256
height = np.zeros((size, size), dtype=np.float32)
for y in range(size):
    for x in range(size):
        u, v = x / size, y / size
        a = (1-u)*noise.noise(Vector((u*35,v*35,.31))) + u*noise.noise(Vector(((u-1)*35,v*35,.31)))
        b = (1-u)*noise.noise(Vector((u*35,(v-1)*35,.31))) + u*noise.noise(Vector(((u-1)*35,(v-1)*35,.31)))
        height[y,x] = (1-v)*a + v*b + .11*noise.noise(Vector((x*.47,y*.47,2.1)))

def image(name, values, non_color=False):
    img = bpy.data.images.new(name, width=size, height=size, alpha=False)
    if non_color: img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(values.astype(np.float32).ravel())
    img.file_format = 'PNG'
    img.pack()
    return img

rgba = np.ones((size,size,4), dtype=np.float32)
rgba[:,:,:3] = np.clip(.91 + height[:,:,None]*.13, .70, 1)
albedo = image("Blender sand grain", rgba)
dx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*.48
dy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*.48
norm = np.stack([-dx,-dy,np.ones_like(dx)],axis=-1)
rgba[:,:,:3] = norm/np.linalg.norm(norm,axis=-1,keepdims=True)*.5+.5
normal = image("Blender sand grain normal", rgba, True)
for obj in terrain:
    uv = obj.data.uv_layers.new(name="Sand tile")
    for loop in obj.data.loops:
        co = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv = (co.x/2.8, co.y/2.8)
    mat = obj.active_material.copy()
    obj.active_material = mat
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for link in list(bsdf.inputs["Normal"].links): nt.links.remove(link)
    base = list(bsdf.inputs["Base Color"].default_value)
    # Bake material tint into the image so glTF exporters need no mix nodes.
    tint = np.ones((size,size,4),dtype=np.float32)
    tint[:,:,:3] = np.clip(.91+height[:,:,None]*.13, .70, 1)*np.array(base[:3])
    color_node = nt.nodes.new("ShaderNodeTexImage")
    color_node.image = image(obj.name+" albedo", tint)
    normal_node = nt.nodes.new("ShaderNodeTexImage")
    normal_node.image = normal
    normal_map = nt.nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = .38
    nt.links.new(color_node.outputs["Color"],bsdf.inputs["Base Color"])
    nt.links.new(normal_node.outputs["Color"],normal_map.inputs["Color"])
    nt.links.new(normal_map.outputs["Normal"],bsdf.inputs["Normal"])

def xyz(v):
    return [v.x,v.z,-v.y]

sun = bpy.data.objects["Late afternoon sun"]
sun_direction = sun.matrix_world.to_quaternion() @ Vector((0,0,1))
world = scene.world.node_tree.nodes.get("Background")
water = bpy.data.materials["Mediterranean water"].node_tree.nodes.get("Principled BSDF")
look = {
    "sunDirection": xyz(sun_direction),
    "sunColor": list(sun.data.color),
    "sunEnergy": sun.data.energy,
    "worldColor": list(world.inputs[0].default_value)[:3],
    "worldStrength": world.inputs[1].default_value,
    "waterColor": list(water.inputs["Base Color"].default_value)[:3],
    "waterRoughness": water.inputs["Roughness"].default_value,
    "exposure": scene.view_settings.exposure,
    "viewTransform": scene.view_settings.view_transform,
}
(out/"blender-look.json").write_text(json.dumps(look,indent=2)+"\n",encoding="utf-8")
bpy.ops.object.select_all(action="DESELECT")
for obj in terrain: obj.select_set(True)
bpy.context.view_layer.objects.active = terrain[0]
bpy.ops.export_scene.gltf(filepath=str(out/"terrain.blend.glb"),export_format="GLB",use_selection=True,export_animations=False)
