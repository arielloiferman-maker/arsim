"""Blender source for the inland alpine/coastal world. Run blender -b -P this.py -- outputs."""
import bpy, bmesh, math, json, random, sys
from pathlib import Path
from mathutils import Vector
import numpy as np

out=Path(sys.argv[-1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
rng=random.Random(4040)
materials={}
buckets={}
group='mountain'

def material(name,color,rough=.7,metal=0,texture=False):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if texture:
        # Packed image textures survive glTF export, unlike procedural-only shader nodes.
        size=256;yy,xx=np.mgrid[:size,:size];prng=np.random.default_rng(len(name)*71)
        h=.23*np.sin(xx*.18+np.sin(yy*.055)*2)+.14*np.cos(yy*.21)+prng.normal(0,.16,(size,size))
        dx=(np.roll(h,-1,1)-np.roll(h,1,1))*.45;dy=(np.roll(h,-1,0)-np.roll(h,1,0))*.45
        normals=np.stack([-dx,-dy,np.ones_like(dx)],-1);normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
        for typ in ['color','normal']:
            pix=np.ones((size,size,4),dtype=np.float32)
            pix[:,:,:3]=normals*.5+.5 if typ=='normal' else np.clip(np.array(color)[None,None,:]*(.90+h[:,:,None]*.14),0,1)
            img=bpy.data.images.new(name+' '+typ,width=size,height=size,alpha=False)
            if typ=='normal':img.colorspace_settings.name='Non-Color'
            img.pixels.foreach_set(pix.ravel());img.file_format='PNG';img.pack()
            node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=img
            if typ=='normal':
                normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.28
                m.node_tree.links.new(node.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
            else:m.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
    materials[name]=m
    return name

snow=material('Powder snow',(.83,.90,.96),.83,texture=True)
trailmat=material('Groomed snow',(.69,.82,.91),.62,texture=True)
rock=material('Layered alpine granite',(.23,.27,.29),.94,texture=True)
grass=material('Meadow',(.23,.29,.15),.96,texture=True)
wood=material('Warm cedar',(.32,.17,.082),.62,texture=True)
stone=material('Travertine',(.68,.60,.45),.88,texture=True)
pine=material('Pine foliage',(.045,.15,.10),.9)
leaf=material('Palm leaves',(.13,.29,.09),.8)
steel=material('Graphite steel',(.055,.085,.105),.36,.55)
glass=material('Blue reflective glazing',(.12,.29,.37),.19,.3)
amber=material('Brass',(.77,.49,.15),.38,.55)
red=material('Vermilion',(.73,.13,.07),.5)
blue=material('Azure',(.08,.38,.62),.45)
white=material('Ivory plaster',(.86,.82,.71),.82)
green=material('Green trail',(.04,.56,.27),.55)
warm=material('Warm lantern',(.97,.62,.23),.45)
materials[warm].node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.47,.12,1)
materials[warm].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.6

def mesh(name,verts,faces,mat):
    key=(group,name,mat)
    dest=buckets.setdefault(key,[[],[]]);start=len(dest[0]);dest[0].extend(verts)
    dest[1].extend([tuple(start+i for i in f) for f in faces])

def box(name,x,y,z,w,h,d,m):
    pts=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]]
    mesh(name,pts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],m)

def beam(name,a,b,r,m,r2=None,n=8,caps=True):
    a=Vector(a);b=Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,1,0)))
    if u.length<.01:u=axis.cross(Vector((1,0,0)))
    u.normalize();v=axis.cross(u);r2=r if r2 is None else r2
    pts=[tuple(p+(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))*radius) for p,radius in [(a,r),(b,r2)] for i in range(n)]
    mesh(name,pts,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]+([tuple(reversed(range(n))),tuple(range(n,2*n))] if caps else []),m)

def flush():
    result=[]
    for (g,name,mat),(verts,faces) in buckets.items():
        data=bpy.data.meshes.new(name);data.from_pydata([(x,-z,y) for x,y,z in verts],[],faces);data.update()
        bm=bmesh.new();bm.from_mesh(data)
        if name in ['Terrain','Piste']:bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        if name in ['Terrain','Piste','Snowpark ramps','Open water slide','Lodge pitched roof','Pier roof','Sea preview']:
            bm.normal_update()
            for face in bm.faces:
                if face.normal.z<0:face.normal_flip()
        bm.to_mesh(data);bm.free();data.update()
        obj=bpy.data.objects.new(g+' · '+name,data);bpy.context.collection.objects.link(obj);obj.data.materials.append(materials[mat]);obj['region']=g
        uv=data.uv_layers.new(name='World detail')
        for loop in data.loops:
            co=data.vertices[loop.vertex_index].co;normal=data.polygons[0].normal
            uv.data[loop.index].uv=(co.x/8,(co.y+co.z)/8)
        if name in ['Terrain','Piste','Palm fronds','Evergreens']:
            for p in data.polygons:p.use_smooth=True
        result.append(obj)
    buckets.clear();return result

g={'x':-1000,'z':110,'step':10,'cols':181,'rows':174}
def terrain_formula(x,z):
    t=max(0,min(1,(z-130)/1320))
    rear=max(0,min(1,(1840-z)/310))
    side=max(0,min(1,(900-abs(x+100))/250))
    h=640*t**1.24*rear*side**1.3
    relief=(math.sin(x*.018+z*.009)*math.cos(z*.019)*24+math.sin(x*.045-z*.023)*8)
    peaks=210*math.exp(-((x+720)/160)**2-((z-1200)/240)**2)+260*math.exp(-((x-520)/170)**2-((z-1310)/230)**2)+190*math.exp(-((x+30)/230)**2-((z-1590)/150)**2)
    return max(0,h+(relief*t+peaks)*rear*side*min(1,max(.45,abs(x+100)/600)))
g['heights']=[round(terrain_formula(g['x']+i*10,g['z']+j*10),3) for j in range(g['rows']) for i in range(g['cols'])]
def height(x,z):
    fx=(x-g['x'])/10;fz=(z-g['z'])/10
    if not(0<=fx<g['cols']-1 and 0<=fz<g['rows']-1):return 0
    i=int(fx);j=int(fz);u=fx-i;v=fz-j;k=j*g['cols']+i
    a,b,c,d=[g['heights'][p] for p in [k,k+1,k+g['cols'],k+g['cols']+1]]
    return a+(b-a)*u+(d-b)*v if u>=v else a+(d-c)*u+(c-a)*v

trails=[]
names=['דרך היער','עמק האורנים','הנוף הכחול','הקרחון','מסלול הנשרים','קו הפסגה','סנופארק','הקניון','הסלאלום','דרך העננים','רכס השקיעה','המסלול הארוך']
for i,name in enumerate(names):
    pts=[];amplitude=(i-5.5)*91
    for k in range(281):
        t=k/280;z=1440-t*1300
        x=-100+amplitude*math.sin(math.pi*t)+(i-5.5)*10*(1-t)**5+math.sin(t*math.pi*4+i*.23)*25*math.sin(math.pi*t)
        pts.append([round(x,3),round(z,3)])
    length=sum(math.hypot(b[0]-a[0],b[1]-a[1],height(*b)-height(*a)) for a,b in zip(pts,pts[1:]))
    trails.append({'id':i,'name':name,'difficulty':['בינוני','קל','בינוני','מתקדם','מתקדם','קל','פריסטייל','מתקדם','בינוני','קל','בינוני','בינוני'][i],
        'color':['#3089de','#26b879','#3089de','#243849','#243849','#26b879','#e8a23e','#243849','#3089de','#26b879','#3089de','#3089de'][i],
        'width':18 if i in [3,4,7] else 26,'length':round(length),'points':pts})
ramps=[]
for i in [2,4,6,8,10]:
    for k in [62,112,164,213]:
        a=trails[i]['points'][k];b=trails[i]['points'][k+1];l=math.dist(a,b)
        ramps.append({'x':a[0],'z':a[1],'dx':(b[0]-a[0])/l,'dz':(b[1]-a[1])/l,'length':17,'height':3.8 if i==6 else 2.6,'width':12})
layout={'terrain':g,'trails':trails,'ramps':ramps,'base':{'x':-178,'z':155},'summit':{'x':-178,'z':1440},'shop':{'x':-188,'z':1458},'finishZ':140,'shuttle':{'x':-44,'z':17}}
(out/'alpine-layout.json').write_text(json.dumps(layout,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

for j in range(g['rows']-1):
    for i in range(g['cols']-1):
        x=g['x']+i*10;z=g['z']+j*10
        pts=[(xx,height(xx,zz),zz) for xx,zz in [(x,z),(x+10,z),(x+10,z+10),(x,z+10)]]
        y=sum(p[1] for p in pts)/4
        slope=(max(p[1] for p in pts)-min(p[1] for p in pts))/10
        snowline=135+math.sin(x*.025+z*.008)*30+math.cos(z*.019-x*.014)*20
        mat=snow if y>snowline else rock if y>snowline-20 else grass
        if slope>1.1 or (abs(x+100)>680 and y>100):mat=rock
        mesh('Terrain',pts,[(0,2,1),(0,3,2)],mat)

for trail in trails:
    pts=trail['points'];w=trail['width']*.5
    for a,b in zip(pts,pts[1:]):
        ribbon=[(x+offset,height(x+offset,z)+.15,z) for x,z in [a,b] for offset in [-w,0,w]]
        mesh('Piste',ribbon,[(0,3,4,1),(1,4,5,2)],trailmat)
    for k in range(12,264,18):
        x,z=pts[k];m=green if trail['difficulty']=='קל' else steel if trail['difficulty']=='מתקדם' else blue
        for side in [-1,1]:
            xx=x+side*(w+1.5);y=height(xx,z)
            beam('Piste marker',(xx,y,z),(xx,y+2,z),.08,steel)
            box('Trail marker panel',xx,y+1.7,z,.55,.55,.10,m)

for r in ramps:
    pts=[]
    for j in range(10):
        forward=r['length']*j/9
        for side in [-r['width']/2,0,r['width']/2]:
            x=r['x']+r['dx']*forward-r['dz']*side;z=r['z']+r['dz']*forward+r['dx']*side
            pts.append((x,height(x,z)+forward/r['length']*r['height']+.025,z))
    mesh('Snowpark ramps',pts,[(j*3+i,(j+1)*3+i,(j+1)*3+i+1,j*3+i+1) for j in range(9) for i in range(2)],trailmat)
    for j in range(9):
        for side in [0,2]:beam('Ramp edges',pts[j*3+side],pts[(j+1)*3+side],.13,amber)

def fir(x,z,h):
    y=height(x,z);beam('Evergreen trunks',(x,y,z),(x,y+h*.85,z),h*.035,wood,r2=h*.013)
    for k in range(4):
        bottom=y+h*(.12+k*.15);top=y+h*(.65+k*.115);r=h*(.28-k*.05)
        beam('Evergreens',(x,bottom,z),(x,top,z),r,pine,0,10)
        if y>180:beam('Snow on branches',(x,bottom+h*.13,z),(x,top+.04,z),r*.76,snow,0,10)

for n in range(2700):
    x=rng.uniform(-910,700);z=rng.uniform(240,1510)
    k=min(280,max(0,round((1440-z)/1300*280)))
    if any(abs(x-t['points'][k][0])<t['width']*.8+7 for t in trails):continue
    if abs(x+178)<25 or height(x,z)<4:continue
    fir(x,z,rng.uniform(7,16))
for n in range(260):
    x=rng.choice([-1,1])*rng.uniform(610,810)-100;z=rng.uniform(600,1510);y=height(x,z)
    h=rng.uniform(6,23)
    beam('Exposed crags',(x,y-2,z),(x+rng.uniform(-3,3),y+h,z),h*.6,rock,h*.2,7)

def lodge(x,z,w=16,d=12):
    y=height(x,z)
    box('Lodge stone plinth',x,y+.7,z,w+1,1.4,d+1,stone)
    box('Lodge cedar',x,y+3.3,z,w,5.2,d,wood)
    for xx in [-.32,0,.32]:
        box('Lodge windows',x+xx*w,y+3.1,z-d/2-.05,w*.23,2.2,.13,glass)
        box('Lodge sill',x+xx*w,y+1.96,z-d/2-.15,w*.26,.16,.4,stone)
    mesh('Lodge pitched roof',[(x-w*.57,y+6,z-d*.58),(x+w*.57,y+6,z-d*.58),(x+w*.57,y+6,z+d*.58),(x-w*.57,y+6,z+d*.58),(x,y+9,z-d*.58),(x,y+9,z+d*.58)],[(0,4,5,3),(4,1,2,5)],steel)
    box('Lodge chimney',x+w*.24,y+7.7,z+2,1.2,4,1.2,stone)
    box('Lodge terrace',x,y+.14,z-d*.8,w+5,.28,6,wood)

lodge(-188,1468,24,17);lodge(-185,179,18,13);lodge(48,860,20,13)
for p in [layout['base'],layout['summit']]:
    x,z=p['x'],p['z'];y=height(x,z)
    for dx in [-5,5]:box('Lift terminal pillar',x+dx,y+5,z,1,10,1,stone)
    box('Lift terminal canopy',x,y+10,z,13,.8,10,steel)
    box('Lift terminal fascia',x,y+9.5,z-5.1,12,1.1,.15,red)
for z in range(155,1441,107):
    y=height(-178,z);box('Gondola pylon',-178,y+10,z,1.1,20,1.1,steel)
    beam('Gondola cross arm',(-183,y+20,z),(-173,y+20,z),.3,steel)
for z in range(155,1439,5):
    for x in [-181,-175]:beam('Lift cable',(x,height(-178,z)+20,z),(x,height(-178,min(z+5,1440))+20,min(z+5,1440)),.075,steel,n=5)
mountain_objects=flush()

# Replace the old static scenery, retaining movable props and gameplay anchors.
group='coast'
before=set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=str(out/'coast.blend.glb'))
imported=set(bpy.context.scene.objects)-before
def is_prop(obj):
    while obj:
        if obj.name.startswith('PROP_'):return True
        obj=obj.parent
    return False
props=[o for o in imported if is_prop(o)]
for obj in imported:
    if obj not in props:bpy.data.objects.remove(obj,do_unlink=True)

def palm(x,z,h):
    bend=rng.uniform(-.7,.7)
    for k in range(8):
        y=h*k/8;xx=x+bend*(k/8)**2
        beam('Palm trunks',(xx,y,z),(x+bend*((k+1)/8)**2,y+h/8,z),.15*(1-k*.045),wood,n=10)
    for k in range(9):
        a=k*math.tau/9+rng.random()*.2;verts=[]
        for j in range(8):
            t=j/7;r=t*h*.56;yy=h+.8*math.sin(t*math.pi)-t*t*1.15;w=math.sin(t*math.pi)*.30
            for side in [-1,1]:verts.append((x+bend+math.cos(a)*r+math.sin(a)*w*side,yy,z+math.sin(a)*r-math.cos(a)*w*side))
        mesh('Palm fronds',verts,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(7)],leaf)

# Coastal promenade with continuous walkways, a road and a clear western approach.
box('Promenade',0,.03,17,200,.12,4.6,stone)
box('Coastal boulevard',0,-.01,21,200,.08,3.1,steel)
for x in range(-96,101,5):box('Road markings',x,.04,21,1.7,.015,.08,white)
for x in range(-92,96,9):
    palm(x+rng.uniform(-1,1),13.4, rng.uniform(4.8,7.7))
    box('Street lamp',x,1.6,18.6,.09,3.2,.09,steel)
    box('Street lantern',x,3.15,18.6,.35,.2,.35,warm)
    box('Planter',x+2,.25,15.2,1.8,.5,1,stone)
    for dx in [-.5,0,.5]:beam('Agaves',(x+2+dx,.5,15.2),(x+2+dx,.95,15.2),.28,leaf,0,8)
    for yy in [.42,.68]:box('Cedar bench',x+4,yy,15.7,2,.13,.52,wood)
    for dx in [-.7,.7]:box('Bench feet',x+4+dx,.2,15.7,.12,.4,.4,steel)
for i in range(24):palm(-90+i*8+rng.uniform(-1,1),-14.5+rng.uniform(-1,1),rng.uniform(4,6.5))

facades=[white,stone,material('Terracotta render',(.65,.34,.23),.9),material('Seafoam render',(.40,.61,.59),.88)]
for row in range(3):
    for i in range(12):
        x=-74+i*14+rng.uniform(-1.5,1.5);z=29+row*23+rng.uniform(-1,1)
        w=rng.uniform(8,11);d=rng.uniform(8,12);h=rng.uniform(10,17) if row==0 else rng.uniform(17,43)
        m=facades[(i+row)%4]
        box('City buildings',x,h/2,z,w,h,d,m)
        box('Roof cornice',x,h+.2,z,w+.4,.4,d+.4,white)
        for yy in np.arange(2.2,h-1,2.5):
            for dx in [-w*.3,0,w*.3]:
                box('Recessed glazing',x+dx,float(yy),z-d/2-.04,w*.21,1.55,.08,glass)
                if row==0:
                    box('Balcony slabs',x+dx,float(yy)-.9,z-d/2-.48,w*.26,.17,.94,stone)
                    box('Balcony railing',x+dx,float(yy)-.42,z-d/2-.89,w*.25,.72,.065,glass)
        if i%3==0:box('Roof pergola',x,h+1.4,z,w*.7,.18,d*.6,wood)

# Route to the resort does not pass through any buildings.
for z in range(28,150,4):box('Alpine access path',-94,.015,z,8,.06,3.94,stone)
for x in range(-175,-94,4):box('Lift approach',x,height(x,150)+.025,150,4.03,.05,7,stone)
for z in range(40,148,15):
    for x in [-101,-87]:
        box('Access lantern pole',x,1.6,z,.11,3.2,.11,steel);box('Access lantern',x,3.2,z,.44,.2,.44,warm)

for i in range(38):
    x=rng.choice([-1,1])*rng.uniform(110,250);z=rng.uniform(-7,100);h=rng.uniform(.6,4)
    beam('Coastal boulders',(x,-.12,z),(x+rng.uniform(-.3,.3),h,z),h*.8,rock,h*.25,9)
for x in [-66,-48,48,66]:
    for dx in [-2,2]:
        for z in [3,7]:box('Beach pergola pillars',x+dx,1.5,z,.17,3,.17,wood)
    for j in range(8):box('Pergola battens',x-2.1+j*.6,3.03,5,.17,.18,4.7,wood)

# Rebuilt pier, cafe and water park retain the previous interaction coordinates.
for j in range(29):box('Pier deck',-27,.44,-16-j*.33,3.3,.14,.30,wood)
for x in [-28.4,-25.6]:
    for z in [-16,-18,-20,-22,-24]:beam('Pier piles',(x,-2,z),(x,.48,z),.13,wood)
box('Pier house',-27,1.7,-23.1,4.9,2.36,4,white)
mesh('Pier roof',[(-30,2.9,-25.4),(-24,2.9,-25.4),(-24,2.9,-20.8),(-30,2.9,-20.8),(-27,4.3,-25.4),(-27,4.3,-20.8)],[(0,4,5,3),(4,1,2,5)],wood)
for x in [-28.5,-25.5]:box('Pier windows',x,2,-21.05,.9,.8,.10,glass)
box('Beach cafe',-15,1.3,-16,4.1,2.6,2.25,wood)
box('Cafe counter',-15,1,-14.6,3.7,.15,.6,stone)
box('Cafe glazing',-15,1.7,-14.84,3.2,1.1,.08,glass)
for i in range(10):box('Cafe striped awning',-17+i*.44,2.55,-14.3,.44,.12,1.4,white if i%2 else blue)
box('Pool terrace',29,.06,-7,15,.14,14,stone)
box('Pool coping',29,.18,-5,12,.15,7,white)
box('Pool surface',29,.27,-5,11.45,.03,6.45,blue)
for x in [25,33]:
    for dx in [-1.05,1.05]:
        for dz in [-1,1]:beam('Slide towers',(x+dx,0,-11+dz),(x+dx,5.55,-11+dz),.10,wood)
    box('Slide platform',x-.5,5.55,-11,3.4,.18,2.4,wood)
    for i in range(24):box('Waterpark stairs',x-1.5,i*.23+.12,-5-i*.26,1,.17,.34,stone)
paths=json.loads((out/'tools/slide-paths.json').read_text())
for index,pts in enumerate(paths):
    for a,b in zip(pts,pts[1:]):
        if index:beam('Spiral water slide',a,b,.49,red,n=12,caps=False)
        else:
            mesh('Open water slide',[(a[0]-1,a[1],a[2]),(a[0]+1,a[1],a[2]),(b[0]+1,b[1],b[2]),(b[0]-1,b[1],b[2])],[(0,1,2,3)],white)
            for dx in [-1.04,1.04]:beam('Slide lip',(a[0]+dx,a[1]+.12,a[2]),(b[0]+dx,b[1]+.12,b[2]),.12,blue)
coast_objects=flush()+props

def export(objects,name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(out/name),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
export(mountain_objects,'snow-mountain.glb')
export(coast_objects,'coast.blend.glb')

# Bring the actual game terrain, sea props and vehicles into the editable master scene.
for name in ['terrain.blend.glb','riptide.glb','water-dolphin.glb']:
    prior=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(out/name))
    new=set(bpy.context.scene.objects)-prior
    if name=='riptide.glb':
        for obj in new:
            if obj.parent is None:obj.location+=Vector((-18,20,.2))
    if name=='water-dolphin.glb':
        for obj in new:
            if obj.parent is None:obj.location+=Vector((15,50,.1))
group='preview'
mesh('Land preview',[(-1800,-.25,-19),(-1800,-.25,2200),(1800,-.25,2200),(1800,-.25,-19)],[(0,1,2,3)],stone)
sea=material('Sea preview',(.025,.19,.28),.20,.25)
mesh('Sea preview',[(-1800,.03,-19),(1800,.03,-19),(1800,.03,-3619),(-1800,.03,-3619)],[(0,1,2,3)],sea)
flush()
scene=bpy.context.scene
scene.world=bpy.data.worlds.new('Coastal sky');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.35,.52,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
bpy.ops.object.light_add(type='SUN',location=(200,200,700));bpy.context.object.rotation_euler=(.45,-.6,-.4);bpy.context.object.data.energy=3;bpy.context.object.data.angle=.08
bpy.ops.object.camera_add(location=(1900,900,1700));cam=bpy.context.object
cam.rotation_euler=(Vector((-100,-800,170))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=38;cam.data.clip_end=10000;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Beach World - Inland Alpine.blend'))
scene.render.filepath=str(out/'alpine-world-preview.png');bpy.ops.render.render(write_still=True)
print('WORLD COMPLETE',len(trails),'trails',len(ramps),'ramps',max(g['heights']),'metres')
