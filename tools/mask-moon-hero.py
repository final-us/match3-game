"""User-approved, asset-specific hand-authored contour matte, not checker-alpha fallback automation.
Keeps solid interiors, refines only a narrow contour strip by foreground chroma.
No model calls, downloads, or changes to original pixels outside edge decontamination.
"""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/_incoming/moon-ui-runtime/hero-contour'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = Path('/Users/Admin/.codex/generated_images/01a0342c-1f4b-7f10-93f6-93fce15e1d60/exec-ebd5e2b3-2396-44a9-8e23-1afcf3f01aeb.png')
im = Image.open(SOURCE).convert('RGB')
im.save(OUT / 'source.png')
w,h=im.size
# Contours in original 1536x1024 coordinates, separately editable by component.
shapes = {
'left-moon': [(385,125),(343,141),(302,165),(260,206),(230,251),(209,300),(194,357),(186,424),(190,491),(206,554),(238,614),(286,664),(350,702),(415,724),(481,726),(551,710),(619,677),(676,630),(683,635),(665,692),(633,740),(596,776),(548,805),(493,826),(427,839),(353,838),(283,823),(215,794),(158,754),(111,706),(75,644),(51,578),(40,503),(43,427),(61,351),(88,283),(126,224),(173,178),(228,142),(290,119),(345,116)],
'left-cat':[(271,362),(286,345),(309,351),(341,359),(380,342),(417,339),(449,328),(486,293),(514,279),(527,308),(529,344),(539,376),(558,390),(579,422),(590,451),(602,442),(621,437),(642,448),(658,468),(660,490),(645,512),(627,548),(607,584),(578,618),(548,640),(527,667),(521,702),(510,728),(486,742),(454,742),(434,735),(417,743),(390,743),(363,732),(332,730),(310,729),(278,714),(259,692),(235,681),(206,669),(180,653),(156,633),(145,606),(146,580),(158,558),(181,546),(213,546),(214,511),(235,486),(256,477),(276,458),(291,447),(284,420),(276,394)],
'right-moon':[(1155,125),(1194,143),(1234,168),(1275,207),(1304,252),(1327,307),(1344,366),(1351,429),(1347,493),(1332,553),(1303,611),(1260,659),(1206,697),(1148,720),(1085,727),(1020,721),(957,704),(900,674),(864,639),(856,639),(876,692),(906,735),(944,773),(991,804),(1047,827),(1110,839),(1180,840),(1249,827),(1317,801),(1377,763),(1426,715),(1464,656),(1487,590),(1500,519),(1495,438),(1479,365),(1455,302),(1420,244),(1375,195),(1325,157),(1268,132),(1211,118),(1175,118)],
'right-cat':[(1056,285),(1039,305),(1023,344),(1016,364),(990,385),(968,414),(957,446),(941,440),(924,440),(905,449),(889,467),(890,492),(903,516),(914,548),(929,581),(951,615),(976,641),(994,665),(1002,691),(1003,714),(1015,731),(1043,737),(1066,735),(1085,747),(1116,747),(1135,736),(1166,740),(1196,730),(1228,719),(1257,702),(1282,686),(1306,671),(1334,660),(1360,638),(1374,609),(1376,580),(1364,553),(1343,538),(1314,535),(1289,543),(1275,562),(1266,584),(1254,588),(1253,554),(1242,525),(1224,507),(1237,479),(1253,448),(1268,408),(1275,380),(1264,372),(1229,382),(1194,389),(1160,376),(1125,372),(1098,350),(1078,308)],
}
mask=np.zeros((h,w),bool)
components=[]
for name,points in shapes.items():
    layer=Image.new('L',(w,h));ImageDraw.Draw(layer).polygon(points,fill=255)
    mask |= np.asarray(layer)>0
    components.append((name,np.asarray(layer)>0))
# Five jewel silhouettes and hanging pearls/crystals: solid interiors, chroma-refined perimeters.
ellipses=[(716,268,823,383),(620,336,734,449),(799,339,913,447),(667,447,778,551),(779,447,877,553),
          (154,819,211,878),(268,893,327,982),(1324,819,1384,878),(1207,889,1270,982)]
layer=Image.new('L',(w,h));d=ImageDraw.Draw(layer)
for box in ellipses:d.ellipse(box,fill=255)
mask |= np.asarray(layer)>0
for i,box in enumerate(ellipses):
    single=Image.new('L',(w,h));ImageDraw.Draw(single).ellipse(box,fill=255)
    components.append(('jewel' if i<5 else 'pendant',np.asarray(single)>0))
rgb=np.asarray(im).astype(float)/255
chroma=rgb.max(2)-rgb.min(2)
foreground=np.zeros((h,w),bool)
for name,component in components:
    support=ndi.binary_dilation(component,iterations=18 if 'moon' in name else 3)
    core=ndi.binary_erosion(component,iterations=28)
    if name=='jewel':
        # Saturated hard jewel outline excludes the checker-contaminated glow.
        part=support & (chroma>.32)
    else:
        part=core | (support & (chroma>.07))
    # Fill each object separately so five nearby gems cannot enclose gray backdrop.
    part=ndi.binary_fill_holes(part)
    labels,n=ndi.label(part)
    if n:
        sizes=np.bincount(labels.ravel());sizes[0]=0
        part=labels==sizes.argmax()
    foreground |= part
alpha=foreground.astype(float)
outer=ndi.binary_dilation(foreground,iterations=2)&~foreground
alpha[outer]=np.clip((chroma[outer]-.025)/.10,0,1)
# Fine gold chains and isolated star ornaments use restricted manually located regions.
detail=Image.new('L',(w,h));dd=ImageDraw.Draw(detail)
for box in [(269,0,308,244),(1235,0,1277,238),(253,224,314,299),(1229,224,1290,298),
            (172,737,196,837),(284,829,307,920),(1340,744,1370,837),(1225,831,1252,918)]:dd.rectangle(box,fill=255)
detail=np.asarray(detail)>0
alpha[detail]=np.maximum(alpha[detail],np.clip((chroma[detail]-.04)/.14,0,1))
# Explicit paint corrections after dark-background review: retain neutral glass
# facets bounded by the gold rim; these are foreground, not background gray.
restore=[[(1265,186),(1291,221),(1321,276),(1342,337),(1353,398),(1352,458),(1342,502),(1360,505),(1371,440),(1364,365),(1347,300),(1317,239)],
[(866,642),(895,666),(927,685),(966,700),(1007,706),(1017,730),(984,722),(941,706),(901,680)],
[(674,644),(646,666),(611,685),(567,699),(522,706),(512,731),(555,724),(601,706),(640,680)],
[(1049,296),(1066,310),(1081,342),(1096,354),(1088,366),(1057,349),(1036,346)],
[(288,895),(302,900),(323,940),(306,972),(296,979),(273,947)],
[(1234,893),(1247,896),(1265,940),(1251,972),(1239,978),(1213,943)],
[(490,693),(511,700),(520,716),(516,730),(498,736)]]
paint=Image.new('L',(w,h));pd=ImageDraw.Draw(paint)
for points in restore:pd.polygon(points,fill=255)
alpha[np.asarray(paint)>0]=1
erase=[[(233,495),(269,476),(281,465),(278,493),(263,510),(238,508)],
       [(589,448),(609,435),(630,440),(613,448),(603,454)]]
paint=Image.new('L',(w,h));pd=ImageDraw.Draw(paint)
for points in erase:pd.polygon(points,fill=255)
alpha[np.asarray(paint)>0]=0
# Do not preserve checker-contaminated broad glow; runtime renders its clean halo separately.
alpha=ndi.gaussian_filter(alpha,.45)
alpha[alpha<.025]=0
rgba=np.dstack([np.asarray(im),np.uint8(np.clip(alpha,0,1)*255)])
result=Image.fromarray(rgba)
result.save(OUT/'transparent.png')
Image.fromarray(np.uint8(alpha*255)).save(OUT/'mask.png')
for name,color in [('white','#ffffff'),('dark','#182344')]:
    bg=Image.new('RGBA',im.size,color);bg.alpha_composite(result);bg.convert('RGB').save(OUT/f'preview-{name}.png')
(OUT/'contours.json').write_text(json.dumps(shapes,indent=2))
print(json.dumps({'output':str(OUT),'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'size':im.size}))
