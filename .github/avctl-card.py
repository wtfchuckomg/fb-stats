#!/usr/bin/env python3
"""AVCTLstats.com link card: ~/Desktop/avctl-stats/page.png (1200x630), laid out like stats/KMR page.png.

The seal is the AVCTL logo Chuck sent (~/Downloads/images (4).jpeg, 350px); a bigger copy makes it sharper.
Run from anywhere; writes avctl-card.png in the current folder, then copy it over page.png in avctl-stats.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1200,630
RED=(210,35,42); GOLD=(245,184,0); BLACK=(12,12,12); WHITE=(255,255,255)
IMPACT='/System/Library/Fonts/Supplemental/Impact.ttf'
img=Image.new('RGB',(W,H),WHITE); d=ImageDraw.Draw(img)

# the seal, on the left
seal=Image.open('/Users/cc/Downloads/images (4).jpeg').convert('RGB')
S=430; seal=seal.resize((S,S),Image.LANCZOS)
img.paste(seal,(70,(H-S)//2))

def skewed_text(txt,size,fill,stroke,sw,skew=0.18):
    f=ImageFont.truetype(IMPACT,size)
    l,t,r,b=f.getbbox(txt,stroke_width=sw)
    w,h=r-l+int((b-t)*skew)+20,b-t+20
    layer=Image.new('RGBA',(w,h),(0,0,0,0)); dl=ImageDraw.Draw(layer)
    dl.text((10-l+int((b-t)*skew),10-t),txt,font=f,fill=fill,stroke_width=sw,stroke_fill=stroke)
    return layer.transform(layer.size,Image.AFFINE,(1,skew,-skew*0,0,1,0),resample=Image.BICUBIC)

def slant_bar(x0,y0,x1,y1,fill,outline=BLACK,ow=4,s=14):
    d.polygon([(x0+s,y0),(x1+s,y0),(x1-s,y1),(x0-s,y1)],fill=outline)
    d.polygon([(x0+s+ow,y0+ow),(x1+s-ow,y0+ow),(x1-s+ow//2,y1-ow),(x0-s+ow+ow//2,y1-ow)],fill=fill)

X0,X1=560,1130
# top line: the league's full name between two red bars
top=skewed_text('ARK VALLEY CHISHOLM TRAIL LEAGUE',40,BLACK,WHITE,0,0.12)
tx=X0+(X1-X0-top.width)//2; img.paste(top,(tx,118),top)
# big AVCTL (red, black outline) over STATS (black, white inner line)
av=skewed_text('AVCTL',190,RED,BLACK,7)
st=skewed_text('STATS',150,BLACK,WHITE,0)
img.paste(av,(X0+(X1-X0-av.width)//2,160),av)
img.paste(st,(X0+(X1-X0-st.width)//2+10,352),st)
# bottom: red bars with three gold slashes, like the KMR card
y0,y1=528,552
slant_bar(X0-10,y0,X0+140,y1,RED)
for i in range(3):
    gx=X0+185+i*62; slant_bar(gx,y0-6,gx+40,y1+6,GOLD,s=18)
slant_bar(X0+385,y0,X1,y1,RED)
img.save('avctl-card.png',optimize=True)
print(img.size)
