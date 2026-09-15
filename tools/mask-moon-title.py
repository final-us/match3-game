"""Asset-specific local contour matte, explicitly authorized by user 2026-09-13."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image,ImageDraw
from scipy import ndimage as ndi
root=Path(__file__).resolve().parents[1]
out=root/'assets/_incoming/moon-ui-runtime/title-contour'
out.mkdir(parents=True,exist_ok=True)
src=Path('/Users/Admin/.codex/generated_images/01a0342c-1f4b-7f10-93f6-93fce15e1d60/exec-d7833e8f-c79a-4669-abdb-53b9f7e26c05.png')
im=Image.open(src).convert('RGB'); im.save(out/'source.png')
w,h=im.size
points=[(80,491),(92,445),(106,403),(104,358),(117,321),(145,294),(184,279),(224,270),(250,238),(286,225),(324,221),(353,204),(396,190),(444,172),(481,164),(524,175),(550,190),(595,178),(650,169),(703,153),(761,134),(828,120),(881,115),(939,125),(984,148),(1018,184),(1081,188),(1114,212),(1181,191),(1240,189),(1302,215),(1346,184),(1417,153),(1439,123),(1496,120),(1557,150),(1604,194),(1641,246),(1668,316),(1696,390),(1706,471),(1688,541),(1652,603),(1600,648),(1540,676),(1482,683),(1429,667),(1380,643),(1320,649),(1278,617),(1224,607),(1173,615),(1112,610),(1051,623),(1020,685),(952,703),(899,684),(845,690),(780,701),(718,686),(683,646),(629,625),(575,615),(527,627),(480,649),(431,666),(384,673),(339,661),(286,641),(255,615),(207,624),(158,615),(119,594),(93,555)]
rough=Image.new('L',(w,h));ImageDraw.Draw(rough).polygon(points,fill=255)
m=np.asarray(rough)>0
rgb=np.asarray(im).astype(float)/255
c=rgb.max(2)-rgb.min(2)
mat=ndi.binary_erosion(m,iterations=12)|(ndi.binary_dilation(m,iterations=20)&(c>.09))
mat=ndi.binary_fill_holes(mat)
# Restricted ornament regions: top stars, loops, dangling chains and crystal.
regions=Image.new('L',(w,h));d=ImageDraw.Draw(regions)
for box in [(249,130,354,231),(546,15,1093,204),(450,571,522,750),(524,602,716,682),(1080,589,1329,750),(855,626,948,877)]:d.rectangle(box,fill=255)
detail=(np.asarray(regions)>0)&(c>.15)
labels,n=ndi.label(detail)
sizes=np.bincount(labels.ravel());sizes[0]=0
detail=sizes[labels]>10
mat|=detail
# Retain white facets inside the hanging crystal, but not surrounding glow.
gem=Image.new('L',(w,h));ImageDraw.Draw(gem).polygon([(899,711),(932,779),(941,810),(924,846),(901,869),(870,837),(855,803),(875,757)],fill=255)
mat|=np.asarray(gem)>0
# Local paint corrections from dark-background inspection, preserving white facets.
paint=Image.new('L',(w,h));pd=ImageDraw.Draw(paint)
for poly in [[(302,141),(316,162),(343,170),(324,190),(326,216),(304,204),(283,216),(285,190),(269,171),(292,164)],
             [(1054,9),(1058,37),(1082,51),(1057,63),(1050,91),(1030,73),(1000,78),(1008,51),(1004,22),(1032,27)],
             [(997,159),(1025,175),(1048,180),(1076,189),(1097,207),(1118,217),(1100,236),(1053,220),(1020,204)],
             [(649,115),(662,133),(685,142),(668,157),(668,178),(647,167),(626,179),(629,154),(611,139),(636,134)]]:pd.polygon(poly,fill=255)
for box in [(468,630,515,684),(1257,628,1310,684)]:pd.ellipse(box,fill=255)
mat |= np.asarray(paint)>0
# Bound the dangling jewel to its own exact silhouette rather than its purple halo.
jewel_roi=np.zeros_like(mat);jewel_roi[710:887,842:958]=True
mat[jewel_roi]=np.asarray(gem,dtype=bool)[jewel_roi]
a=ndi.gaussian_filter(mat.astype(float),.55);a[a<.025]=0
result=Image.fromarray(np.dstack((np.asarray(im),np.uint8(a*255))))
result.save(out/'transparent.png');Image.fromarray(np.uint8(a*255)).save(out/'mask.png')
for name,col in [('white','#fff'),('dark','#182344')]:
    bg=Image.new('RGBA',im.size,col);bg.alpha_composite(result);bg.convert('RGB').save(out/f'preview-{name}.png')
(out/'contours.json').write_text(json.dumps(points))
print(json.dumps({'size':im.size,'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest()}))
